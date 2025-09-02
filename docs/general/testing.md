Great instinct. For Minimystx you’ll get the best safety net by testing at four layers: node contracts → graph engine/data-flow → scene assembly → UI/E2E. Below is a concrete test plan you can hand to Claude Code, plus tooling that fits your stack.

# What to test (exact, focused suites)

## 1) Node contract tests (pure, fast unit tests)

Goal: each node behaves correctly given inputs/params.

Covers:

* Deterministic output for same inputs/params.
* Parameter validation and clamping.
* Stable serialization of node state (params in → JSON out).
* Idempotent compute (running twice yields same output, no hidden mutation).
* Bypass behavior (output equals passthrough or “no-op” as designed).
* Error paths (bad file path, invalid geometry, NaN params) produce typed errors.

Helpful fixtures:

* Minimal geometry (tri, quad, cube).
* Small OBJ/GLTF text blobs inlined for import nodes.

## 2) Graph engine & data-flow (core computational flow)

Goal: validate connections, recomputation, and invalidation.

Covers:

* Topological ordering: only recompute what’s needed.
* Reactive recomputation: changing a param on an upstream node only recomputes nodes on the dependency chain to the active renderer(s).
* Fan-out: one output connected to multiple inputs recomputes exactly once, feeds many consumers.
* Fan-in/Merge and GroupNode: consistent combination ordering and deterministic result.
* Subflow semantics:

  * activeOutputNodeId vs visibility toggles (explicit expectations),
  * switching active output redirects parent contribution.
* Bypass across chains: upstream vs local bypass precedence.
* Cycle detection and clear error reporting.
* Determinism: same graph+params always yields identical scene JSON.
* Graph mutations:

  * add/remove node,
  * connect/disconnect ports,
  * replace a node type (migration) → expected invalidations.
* Serialization round-trip:

  * export .mxscene → import → export again = deep equal (or schema-equal) ignoring non-semantic fields (timestamps, ids if designed to differ).
* Concurrency/ordering safety: rapid parameter changes coalesce into correct final state (debounce/throttle paths).
* Undo/redo (if present): state diffs result in correct recompute set.

## 3) Scene assembly & renderer boundary

Goal: assembled SceneGraph matches expectations and only includes what should render.

Covers:

* Only nodes contributing to a renderer-marked chain end up in the SceneGraph.
* Switching renderer target updates SceneGraph minimal-diff (no unrelated removals).
* Materials/attributes propagation rules (normals, uvs, vertex colors).
* World transforms: parent/child composition, order of operations.
* Precision/scale: units handling and numeric stability (no drift after many transforms).
* Snapshot tests of “scene JSON” (your deterministic, order-stable serialization of the renderable scene, not raw Three.js objects).
* Asset resolution: relative path base, missing asset fallback.

## 4) UI integration & end-to-end (browser)

Goal: the user workflows actually work.

Covers:

* Build a graph via UI (add nodes, wire ports), mark renderer, tweak params → canvas updates.
* Subflow: open subflow, set active output, go back to parent → scene changes accordingly.
* Bypass/Render toggles in node UI reflect in canvas and scene JSON.
* Import flows: drop a file, see geometry, change transform → visual change.
* Visual regressions: pixel snapshots of the renderer for key fixtures with a small tolerance.
* Persistence: save project, reload page, project restores, canvas image matches snapshot.

# Libraries and utilities to use

Core test runner:

* **Vitest** (fits Vite/TS; fast, snapshot support)

  * `@vitest/coverage-c8` for coverage
  * `vitest-axe` only if you want quick a11y checks of UI

React/UI:

* **@testing-library/react** and **@testing-library/user-event** for intent-driven UI tests

Browser E2E and visual snapshots:

* **Playwright**

  * Use `expect(page).toHaveScreenshot()` for per-fixture image snapshots with threshold
  * Launch real GPU when possible (CI: use Chromium with WebGL enabled)

Property-based & fuzzing:

* **fast-check**

  * Generate random DAGs (bounded size/depth), random param sets, random connect/disconnect sequences; assert invariants (no cycles, determinism, minimal recompute set)

Schema & type safety:

* **zod** for validating scene/graph JSON schemas in tests
* **tsd** if you want type-level tests for public APIs

Mutation testing (keeps you honest):

* **StrykerJS** on the core graph/compute packages

Performance & regression:

* **tinybench** or `vitest --benchmark` to pin key hot paths (eval of N-node graphs, import of typical asset)

Test harness helpers (have Claude Code implement these first):

* `makeNode(type, initParams?)` → returns node with defaults
* `connect(outHandle, inHandle)` / `disconnect(...)`
* `markRenderer(nodeId)` and `toggleBypass(nodeId, on)`
* `evaluate(graph, {targets: nodeIds?})` → returns evaluation log and recompute set
* `buildScene(graph)` → returns **order-stable** scene JSON (no runtime object ids)
* `exportScene(graph)` / `importScene(json)` → for round-trip tests
* `loadFixture(name)` → graph+assets fixture loader
* `withGraphStoreTestHarness(fn)` → sets up isolated Zustand stores, resets between tests

# Concrete test cases to give Claude Code

Give each of these a named spec with clear assertions.

1. Reactive recomputation minimality

* Setup: A→B→C (renderer=C); also A→D (not used by renderer).
* Change A.param.
* Expect: recompute set = {A,B,C}; D not recomputed.

2. Fan-out recompute once

* A feeds B and D; both feed C (renderer=C).
* Change A.param.
* Expect: A computed once; downstream nodes use same A output.

3. Subflow active output vs visibility

* Subflow nodes S1, S2; activeOutput=S1. Parent GeoNode contributes S1.
* Toggle activeOutput=S2.
* Expect: parent SceneGraph swaps S1→S2 contribution; no extra nodes retained.

4. Bypass semantics

* A→Transform(T)→C (renderer=C). Toggle T.bypass=true.
* Expect: output equals A’s geometry transformed as defined by bypass rule (pass-through or cached), and recompute minimal.

5. Merge/Group deterministic order

* Inputs \[A,B,C] to Group; permute wiring order across runs.
* Expect: scene JSON identical (stable internal ordering rules).

6. Serialization round-trip

* Create medium graph with assets; export .mxscene → import → export.
* Expect: zod-validated, deep equal on stable fields.

7. Cycle detection

* Attempt to connect C→A closing a loop.
* Expect: connection refused or graph error with clear diagnostic; no evaluation.

8. Asset failure path

* Import node points to missing OBJ.
* Expect: node error state; graph evaluates other branches; renderer excludes failed contribution.

9. Precision and units

* Chain of transforms with small scales and rotations; compute world matrix.
* Expect: numerically close to analytic result within epsilon; snapshot stable across platforms.

10. Scene assembly inclusion

* Mark renderer on R1; build scene → includes only chains to R1.
* Add R2; mark both as renderer.
* Expect: union of both chains, no duplicates, stable ids.

11. UI E2E graph build

* In Playwright, add nodes via toolbar, wire ports, mark renderer, tweak sliders; await canvas settle; `toHaveScreenshot()`.
* Expect: image diff below threshold; scene JSON matches expected snapshot.

12. Undo/redo (if enabled)

* Create chain, toggle param, undo, redo.
* Expect: scene JSON snapshots match baseline after each step; recompute sets minimal.

# Automation and CI tips

* Use Playwright’s built-in screenshots and per-test retries. Keep golden images per fixture.
* Seed randomness: `fast-check` with fixed seeds in CI for reproducibility; run an unseeded nightly job for exploration.
* Make scene JSON order-stable: sort arrays where order is not semantically meaningful.
* Skip image tests on headless without GPU if they flake; run them in a dedicated Playwright job with proper WebGL.
* Track performance budgets (tinybench) and fail CI if eval time for standard fixtures regresses by > X percent.

# Suggested repo structure

```
/tests
  /unit
    nodes/*.spec.ts
    graph/*.spec.ts
    schemas/*.spec.ts
  /integration
    scene-assembly/*.spec.ts
  /e2e
    playwright.config.ts
    specs/*.e2e.ts
  /fixtures
    graphs/*.mxscene.json
    assets/{obj,gltf}/*
```

# Quick tool install list

* vitest, @vitest/coverage-c8, @testing-library/react, @testing-library/user-event
* playwright @latest (with browsers)
* fast-check
* zod
* tinybench (or use vitest bench)
* stryker-js (optional but recommended)
