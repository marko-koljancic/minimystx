# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Minimystx is a browser-only parametric 3D design studio: a node-graph editor (like Grasshopper/Houdini) wired to a live Three.js viewport. React 19 + TypeScript + Vite on the frontend, with a Rust/WebAssembly core that is currently a scaffolded stub (see WASM note below).

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # tsc -b (typecheck all tsconfig projects) then vite build
npm test            # vitest run (node environment; Three.js geometry works headless)
npm run test:watch  # vitest watch mode
npm run build-core  # Build the Rust WASM core via wasm-pack into src/wasm/pkg/minimystx-core-wasm
npm run build-all   # build-core then build
npm run lint        # ESLint on ts,tsx. NOTE: --max-warnings 0, so any warning fails
npm run preview     # Preview the production build
```

"Verifying" a change means `npm run lint`, `npm run build` (strict tsc with `noUnusedLocals`/`noUnusedParameters`), `npm test`, and exercising the app with `npm run dev`. CI (`.github/workflows/ci.yml`) runs all three on every push and PR.

Formatting is Prettier (`.prettierrc`): 2-space indent, double quotes, `printWidth` 120.

`build-core` requires Rust, Cargo, and `wasm-pack` installed. Plain `npm run build` does not need them.

Lint note: `.eslintrc.cjs` carries a temporary `no-explicit-any` override for a fixed list of files. The remaining `any`s are parameter values (`Record<string, any>` node params); typing them via a real `ParameterValue` type is a known follow-up. Do not add files to that list.

## Architecture

The app has two independent state worlds that meet at the node outputs:

1. The compute engine (`src/engine/`) is a headless reactive computation graph. Its single source of truth is the Zustand store `useGraphStore` in `src/engine/graphStore.ts`.
2. The renderer (`src/rendering/`) is an imperative Three.js `SceneManager` that reads node outputs out of the engine store and draws them.

### Compute pipeline (single cook path)

There is exactly one compute path. Every node defines `computeTyped(params, inputs, context)` returning `NodeOutputs` (`Record<string, BaseContainer>`, primary port `"default"`). There is no legacy `compute`, no compute cache, and no separate scheduler class.

- `GraphLibAdapter` (`engine/graph/`) holds graph topology: cycle detection (`wouldCreateCycle` is a DFS reachability check on the live graph), topological sort (subset sorts filter one memoized full-graph sort), and cone/predecessor traversals memoized per topology generation.
- `SubflowManager` (`engine/subflow/`) is a registry of per-GeoNode subflow graphs: each holds its own typed `GraphLibAdapter` plus the active-output selection. It does not compute.
- `engine/compute/cook.ts` is the pure cooking core: `cookNode` runs a definition's `computeTyped` and classifies the result (ok / pending promise / error / skipped), and `decideOutput` implements the keep-last-good-on-empty rule so the viewport does not blank on a transient empty result.
- `engine/compute/cookScheduler.ts` provides frame-coalesced dirty tracking: `setParams`, node adds, and connection changes enqueue (context, nodeId) pairs; one flush per animation frame cooks the dirty union plus its transitive downstream in topological order and commits all outputs in a single store write. Any number of slider ticks collapse to one cook pass per frame. `useGraphStore.getState().flushCooks()` flushes synchronously (used by tests).
- Async nodes (the imports) resolve later under a per-node generation guard that drops stale results, then re-cook their downstream.
- Compute functions must NOT mutate input containers (inputs are shared by reference with the upstream node's output); clone internally before mutating.

There is no content cache: editing a param recomputes exactly the edited node and its downstream, nothing else. Reintroduce caching only if profiling shows real need.

### Data flows through typed Containers

Node outputs are `BaseContainer` subclasses in `engine/containers/BaseContainer.ts` (`GeometryContainer`, `Object3DContainer`, `NumberContainer`, etc.), each tagged with a `ConnectionType` and carrying `clone()`. `NodeState.output` is typed `NodeOutputs | null`; `getDefaultObject3D(output)` in the same file is the single unwrapping point the renderer uses.

### Root vs subflow contexts

Every graph mutation takes a `GraphContext` of `{ type: "root" }` or `{ type: "subflow", geoNodeId }`. The root graph holds `GeoNode` containers and lights; each GeoNode opens a subflow (its own node canvas) where primitives, modifiers, and imports live. A node type declares where it is allowed via `allowedContexts` in the registry. Root nodes with a `computeTyped` (the lights) cook eagerly through the same flush; the GeoNode itself never cooks, and the renderer resolves its display object from the subflow's active output at draw time (pull-based).

### Rendering subsystem

`rendering/SceneManager.ts` composes single-responsibility managers (`camera/`, `grid/`, `materials/`, `objects/`, `postprocessing/`, `guides/`, `wireframe/`, `capture/`, `events/`). Key facts:

- `objects/SceneObjectManager.ts` subscribes to `useGraphStore` and maintains the scene by KEYED DIFFING per root node id: a node's display object is replaced only when its engine output object or its transform param object changes by reference (every cook commits fresh objects; immer preserves identity of untouched branches). Only changed nodes are re-cloned; removed nodes are disposed; lights are borrowed live and never disposed. It dispatches `minimystx:sceneUpdated` only when the diff changed something (SceneManager reapplies the display mode to fresh meshes).
- Disposal discipline is strict: renderer-owned display clones own their GPU resources; anything removed gets disposed exactly once.
- Camera mode and axis-gizmo visibility are plain `cameraStore` subscriptions; view snapping stays an event because re-selecting the same view must re-snap.
- `rendering/sceneManagerRegistry.ts` holds the live SceneManager so imperative non-React code (scene IO) can call `getCameraPose`/`setCameraPose` directly.

### The bridges between the worlds

- Flow editor to engine: `hooks/useFlowGraphSync.ts` translates React Flow node/edge changes into `graphStore` mutations, always passing the current `GraphContext` from `useCurrentContext()`.
- Engine to renderer: the `SceneObjectManager` store subscription (above).
- Cross-world commands: the typed event registry `src/store/events.ts` declares every `minimystx:*` event name and payload behind `emitAppEvent`/`onAppEvent`. Do not dispatch raw CustomEvents with string literals; add the event to `AppEvents` first.

### UI state stores (single owner per domain)

- `uiStore`: theme, current context/breadcrumb, selection, palette navigation, display mode, canvas toggles, connection line style.
- `cameraStore`: camera mode (ortho/perspective), current view, axis-gizmo visibility.
- `layoutStore`: pane sizes, drawer, palette open/pin/position, renderer-maximized.
- `documentStore` (NOT persisted): node canvas positions and viewport pan/zoom per context. This is document data that round-trips with the scene file; FlowCanvas keeps it fresh (debounced), the exporter reads it, import loads it.
- `preferencesStore`: app preferences (renderer, materials, camera, guides, screenshot).

Do not put node-graph data in UI stores; that belongs in `graphStore`.

### File IO (MXSCENE, schema 2.0)

`io/mxscene/` implements the custom `.mxscene` format: a ZIP (`fflate`) bundling `scene.json` + `manifest.json` + embedded assets, with OPFS-based asset caching (`opfs-cache.ts`) and SHA256 integrity (`crypto.ts`). The pure build/parse pipeline lives in `packager.ts` (unit-tested in node); `worker.ts` is a thin postMessage wrapper around it. Schema version is `"2.0"`, enforced by strict equality with a clear error; there is deliberately no migration path. The exporter (`export.ts` `getCurrentSceneData`) reads LIVE state: camera via `sceneManagerRegistry`, renderer via `preferencesStore`, ui via `uiStore`, positions/viewports via `documentStore`. Import (`import.ts` `applyImportedScene`) restores the graph via `graphStore.importGraph`, loads positions/viewports into `documentStore`, and restores camera/ui/renderer via `io/sceneStateBridge.ts` (three independent store-based syncs).

## Adding a new node type

Three files (the `scaffold-node` skill automates this):

1. `src/flow/nodes/<Category>/<Name>.ts` - export `<name>NodeParams` (a `NodeParams` object; build entries with `createParameterMetadata` and the factories in `engine/nodeParameterFactories.ts`), `<name>NodeComputeTyped`, and a `<Name>NodeData` type.
2. `src/flow/nodes/index.ts` - re-export the params, compute, and data type.
3. `src/flow/nodes/nodeRegistry.ts` - add the registry entry: `type`, `category`, `displayName`, `allowedContexts`, `params`, `computeTyped`, and declared `inputs`/`outputs` ports.

There is ONE generic canvas component (`src/flow/FlowNode.tsx`, memoized, registry-driven); it renders the label, render-flag badge, compute error/warning badge, and handles from the declared ports automatically. `nodeTypes` is derived from the registry, so no component or constants wiring is needed (the Note node is the only bespoke component).

Port rule: declared port `name`s ARE the React Flow handle ids AND the keys `computeTyped` reads from its `inputs` record. Keep them identical or the node silently receives no input. Output resolution falls back to the `"default"` key, so a single output may use a display id like `geometry_output`.

Convention: primitives, modifiers, and imports are `allowedContexts: ["subflow"]`; lights and `geoNode` are `["root"]`; the note node is both.

## Tests

Vitest (node environment, no DOM needed for engine work; `src/**/*.test.ts`). Existing suites: `GraphLibAdapter` (topology, cycles, memoization), `cook` (cook results, keep-last-good), `graphStore` (integration: cook flush, downstream propagation, async generation guard, serialization round trip), `parameterUtils` (normalization), `packager` (zip round trip, integrity, schema rejection), `applyImportedScene` (import orchestration over real stores), `BaseContainer` (containers, headless Three.js check).

## WASM note

`src/wasm/src/lib.rs` currently exports only a stub `add(a, b)` and is not imported anywhere in `src/`. The build wiring (`build-core`, `wasm-pack`, output to `src/wasm/pkg/`) exists, but the performance-critical Rust path described in the README is aspirational, not yet wired into the compute pipeline. Do not assume geometry work runs in WASM today; it runs in TypeScript via Three.js.

## Keyboard shortcuts

Viewport and flow-canvas shortcuts are handled by `hooks/useKeyboardShortcuts.ts`, keyed by a `context` ("render" vs flow). The same physical key often does different things depending on which pane is focused (for example `F` fits nodes in the flow canvas but sets the front view in the viewport). The full mapping is documented in `README.md`.

## Specialist agents

This repo ships a `.claude/` team of domain-expert agents, each with a matching slash command and full instructions under `.claude/agents/`. Reach for the one that owns the surface you are working on:

- `/arch` (studio-architect) - the two-worlds boundary, the bridges, state ownership, tech decisions, and the consolidation debt. Use for structure, boundaries, and one-way-door calls.
- `/eng` (graph-engine-engineer) - the compute engine (`src/engine/`): the cook path, cookScheduler, containers, graph topology, cycles. Use for compute correctness and missed-recompute bugs.
- `/node` (node-author) - designing and wiring node types across the 3 files. Pairs with the `scaffold-node` skill.
- `/render` (rendering-engineer) - the imperative Three.js renderer (`src/rendering/`), the keyed scene diffing, and its disposal/memory discipline.
- `/ui` (flow-ui-engineer) - the React 19 + React Flow editor UI, the UI stores, and the flow-to-engine sync bridge.
- `/qa` (qa-verifier) - drives the running app via the claude-in-chrome browser to verify compute, viewport render, console health, and IO round-trip. Read-only.
- `/sec` (security-engineer) - read-only defensive audit of the file-import, `.mxscene` IO, XSS, and dependency surface.
- `/ux` (product-tool-designer) - node-editor and viewport interaction design within the tool's real component vocabulary.

The `scaffold-node` skill auto-triggers when adding a new node type and handles the mechanical wiring.
