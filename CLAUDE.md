# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Minimystx is a browser-only parametric 3D design studio: a node-graph editor (like Grasshopper/Houdini) wired to a live Three.js viewport. React 19 + TypeScript + Vite on the frontend, with a Rust/WebAssembly core that is currently a scaffolded stub (see WASM note below).

## Commands

```bash
npm run dev         # Vite dev server
npm run build       # tsc -b (typecheck all tsconfig projects) then vite build
npm run build-core  # Build the Rust WASM core via wasm-pack into src/wasm/pkg/minimystx-core-wasm
npm run build-all   # build-core then build
npm run lint        # ESLint on ts,tsx. NOTE: --max-warnings 0, so any warning fails
npm run preview     # Preview the production build
```

There is no test runner configured. "Verifying" a change means `npm run lint`, `npm run build` (which typechecks under `strict` with `noUnusedLocals`/`noUnusedParameters`), and exercising the app with `npm run dev`.

Formatting is Prettier (`.prettierrc`): 2-space indent, double quotes, `printWidth` 120.

`build-core` requires Rust, Cargo, and `wasm-pack` installed. Plain `npm run build` does not need them.

## Architecture

The app has two independent state worlds that meet at the node outputs:

1. The compute engine (`src/engine/`) is a headless reactive computation graph. Its single source of truth is the Zustand store `useGraphStore` in `src/engine/graphStore.ts`.
2. The renderer (`src/rendering/`) is an imperative Three.js `SceneManager` that reads node outputs out of the engine store and draws them.

### Compute pipeline

`graphStore` owns four long-lived singletons, constructed once at module load and re-created on `clear()`:

- `GraphLibAdapter` (`engine/graph/`) holds graph topology, cycle detection (`wouldCreateCycle`), topological sort, and the "render cone" (`getRenderCone`: the set of upstream nodes that actually feed a given render target).
- `RenderConeScheduler` (`engine/scheduler/`) runs node compute functions and emits `SchedulerEvent`s. `graphStore` subscribes to it and writes results back into node state.
- `ContentCache` (`engine/cache/`) is an LRU cache keyed by params + input content hashes, invalidated per node.
- `SubflowManager` (`engine/subflow/`) owns each GeoNode's nested internal graph.

`CookOnDemandSystem` (`engine/compute/`) coordinates "cook on demand": parameter/connection changes enqueue cook requests, which are topologically sorted and processed on `requestAnimationFrame`, checking the cache before recomputing. Only nodes inside the current render cone are recomputed.

### Root vs subflow contexts

Every graph mutation takes a `GraphContext` of `{ type: "root" }` or `{ type: "subflow", geoNodeId }`. The root graph holds `GeoNode` containers and lights; each GeoNode opens a subflow (its own node canvas) where primitives, modifiers, and imports live. A node type declares where it is allowed via `allowedContexts: ("root" | "subflow")[]` in the registry. The "render target" (root) / "active output" (subflow) is the node whose output is displayed; changing it recomputes its render cone.

### Data flows through typed Containers

Node outputs are not raw Three.js objects but `BaseContainer` subclasses in `engine/containers/BaseContainer.ts` (`GeometryContainer`, `Object3DContainer`, `NumberContainer`, `Vector3Container`, etc.), each tagged with a `ConnectionType` and carrying `getContentHash()` (used for caching) and `clone()`. Connections between ports are validated by `ConnectionType`. Compute functions receive and return `Record<string, BaseContainer>`, keyed by port name (the primary port is usually `"default"`).

### Node compute has a legacy split

A `NodeDefinition` may define `compute` (old signature `(params, inputs)` returning a plain value or a `{ object, geometry }` shape) and/or `computeTyped` (`(params, inputs, context) => Record<string, BaseContainer>`, the container-based path the scheduler prefers). Most geometry/modifier nodes carry both, where `compute` is legacy and `computeTyped` is authoritative. Light nodes and the GeoNode use `compute` only and are computed eagerly inside `graphStore` when added or when their params change (search `nodeType.includes("Light")` in `graphStore.ts`).

### The three bridges between the worlds

- Flow editor to engine: `hooks/useFlowGraphSync.ts` translates React Flow node/edge changes into `graphStore` mutations (`addNode`, `addEdge`, `setParams`, etc.), always passing the current `GraphContext` from `useCurrentContext()`.
- Engine to renderer: `rendering/objects/SceneObjectManager.ts` subscribes to `useGraphStore` and rebuilds scene objects from node outputs, then dispatches a `minimystx:sceneUpdated` DOM CustomEvent.
- React UI to imperative Three.js: a DOM CustomEvent bus (`store/eventBus.ts`, all events namespaced `minimystx:*`, e.g. `minimystx:setCameraView`, `minimystx:setCameraData`). The imperative `SceneManager` listens for these instead of taking React props.

### Rendering subsystem

`rendering/SceneManager.ts` is the orchestrator; it composes single-responsibility managers (`camera/`, `grid/`, `materials/`, `objects/`, `postprocessing/`, `guides/`, `wireframe/`, `capture/`, `events/`), each in its own folder with a `*Types.ts` and an `index.ts`. It also subscribes directly to `uiStore` and `preferencesStore`.

### UI state stores

Separate from the engine, `src/store/` holds Zustand stores for UI concerns: `uiStore` (current context / breadcrumb, panel layout), `cameraStore`, `preferencesStore`, `layoutStore`. Do not put node-graph data here; that belongs in `graphStore`.

### File IO (MXSCENE)

`io/mxscene/` implements the custom `.mxscene` format: a ZIP (`fflate`) bundling the serialized graph plus embedded assets, with OPFS-based asset caching (`opfs-cache.ts`) and SHA256 integrity (`crypto.ts`). Export/import go through `graphStore.exportGraph` / `importGraph`. Camera and UI state round-trip via `io/sceneStateBridge.ts` using the same CustomEvent bus.

## Adding a new node type

A node is not defined in one place; wiring it up touches five files. Follow an existing node in the same category as a template.

1. `src/flow/nodes/<Category>/<Name>.ts` - export `<name>NodeParams` (a `NodeParams` object; build entries with `createParameterMetadata` and the factories in `engine/nodeParameterFactories.ts`) and a compute function (`<name>NodeComputeTyped` for container-based nodes, `<name>NodeCompute` for lights/containers), plus a `<Name>NodeData` type.
2. `src/flow/nodes/<Category>/<Name>Node.tsx` - the React Flow component for the node's on-canvas UI (typically built on `components/BaseNodeDesign` or `BaseGeometryNodeDesign`).
3. `src/flow/nodes/index.ts` - re-export the params, compute, and data type.
4. `src/flow/nodes/nodeRegistry.ts` - add the registry entry: `type`, `category`, `displayName`, `allowedContexts`, `params`, `compute`/`computeTyped`, and `inputCloneMode` (primitives/modifiers use `InputCloneMode.NEVER`). The registry is also the source for the node palette's fuzzy search.
5. `src/constants/index.ts` - map the node `type` to its React component in `nodeTypes`.

Convention: primitives, modifiers, and imports are `allowedContexts: ["subflow"]`; lights and `geoNode` are `["root"]`; the note node is both.

## WASM note

`src/wasm/src/lib.rs` currently exports only a stub `add(a, b)` and is not imported anywhere in `src/`. The build wiring (`build-core`, `wasm-pack`, output to `src/wasm/pkg/`) exists, but the performance-critical Rust path described in the README is aspirational, not yet wired into the compute pipeline. Do not assume geometry work runs in WASM today; it runs in TypeScript via Three.js.

## Keyboard shortcuts

Viewport and flow-canvas shortcuts are handled by `hooks/useKeyboardShortcuts.ts`, keyed by a `context` ("render" vs flow). The same physical key often does different things depending on which pane is focused (for example `F` fits nodes in the flow canvas but sets the front view in the viewport). The full mapping is documented in `README.md`.

## Specialist agents

This repo ships a `.claude/` team of domain-expert agents, each with a matching slash command and full instructions under `.claude/agents/`. Reach for the one that owns the surface you are working on:

- `/arch` (studio-architect) - the two-worlds boundary, the three bridges, state ownership, tech decisions, and the consolidation debt. Use for structure, boundaries, and one-way-door calls.
- `/eng` (graph-engine-engineer) - the compute engine (`src/engine/`): scheduler, ContentCache, cook-on-demand, containers, cycles. Use for compute/caching correctness and cache-staleness bugs.
- `/node` (node-author) - designing and wiring node types across the 5 files. Pairs with the `scaffold-node` skill.
- `/render` (rendering-engineer) - the imperative Three.js renderer (`src/rendering/`) and its disposal/memory discipline.
- `/ui` (flow-ui-engineer) - the React 19 + React Flow editor UI, the UI stores, and the flow-to-engine sync bridge.
- `/qa` (qa-verifier) - drives the running app via the claude-in-chrome browser to verify compute, viewport render, console health, and IO round-trip. Read-only.
- `/sec` (security-engineer) - read-only defensive audit of the file-import, `.mxscene` IO, XSS, and dependency surface.
- `/ux` (product-tool-designer) - node-editor and viewport interaction design within the tool's real component vocabulary.

The `scaffold-node` skill auto-triggers when adding a new node type and handles the mechanical 5-file wiring.
