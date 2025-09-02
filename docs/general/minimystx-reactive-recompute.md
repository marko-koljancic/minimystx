# Minimystx — Reactive Recompute Spec (Render‑Cone Only)

## 1) Purpose & Scope

Define runtime behavior so that **only** nodes that contribute to the **current renderer target** (the node marked “Render”) are recomputed when inputs change. This document sets the requirements for graph evaluation, invalidation, scheduling, caching, and node boundaries. It applies to root graphs and subflows.

## 2) Definitions

* **Node**: Atomic processing unit with typed inputs, parameters, and outputs. No shared mutable state across nodes.
* **Edge**: Directed connection from an output socket to an input socket.
* **Render Target**: The single node (per flow or subflow context) marked as `render=true`. Only data reachable from this node’s **upstream** sources may affect the visible scene.
* **Render Cone**: Minimal **upstream dependency closure** of the render target (all nodes that can reach the render target via forward edges). Only nodes in the cone are candidates for recomputation.
* **Fan‑out**: One node’s output may feed **many** downstream inputs (multi‑consumer). The producer runs once; its output instance is **shared** by all consumers.
* **Dirty**: A node whose output cache is invalid relative to current inputs/params/runtime resources.
* **Clean**: A node whose cached output is valid and may be reused.
* **Topological Layer**: A Kahn/DFS-derived order ensuring inputs are produced before consumers.
* **Subflow**: A node encapsulating an internal graph with its own inputs/outputs and an internal render target (`activeOutputNodeId`).

## 3) High-level Requirements

R1. **Render-cone recompute only**: On any change (parameter edit, input change, topology change, resource change), the engine must recompute **only** dirty nodes within the active render cone. Nodes outside the cone must not compute.

R2. **Atomic nodes**: Each node must encapsulate only its own responsibilities: input validation/coercion, algorithmic processing, and output emission. No global state modifications; no knowledge of other nodes’ internals.

R3. **Deterministic evaluation**: Given the same inputs, params, and resources, a node must return the same outputs. Side effects must be declared and confined.

R4. **Incremental & reactive**: Changes mark minimal dirty sets and trigger a **topologically ordered** recompute through the cone. Unchanged, cache-valid nodes are skipped.

R5. **Single render target per context**: Exactly one render target is active per graph/subflow context. Switching targets recomputes only the newly selected cone.

R6. **Cycle safety**: Cycles are invalid. Creation must be prevented or detected and rejected with diagnostics.

R7. **Concurrency-safe**: The scheduler may run independent branches in parallel if there are no data hazards. Node code must be pure with respect to inputs.

R8. **Async compatible**: Nodes may be async (e.g., file I/O, WASM compute). The scheduler must support async boundaries without recomputing unaffected branches.

R9. **Stable caches**: Outputs are cached content-addressably (by an input/param/resource hash). Cache invalidation must be precise to minimize recompute.

R10. **Resource-awareness**: External resources (textures, files, GPU buffers) participate in the node’s validity hash. Resource lifecycle hooks must be defined.

R11. **UI truthfulness**: The UI must reflect the actual render target and which nodes are in the active cone, and display live node states (clean/dirty/failed/pending) only for nodes in the cone.
R12. **Non‑destructive fan‑out**: The system must support arbitrary multi‑consumer connections. A producer computes at most once per validity hash; all in‑cone consumers receive the **same** referential output. Out‑of‑cone consumers do **not** trigger compute.

## 4) Node Contract (Atomicity)

**Inputs**

* Typed sockets; provide default values. Perform input validation and coercion locally.

**Parameters**

* Serializable, versioned struct. Parameter changes are treated like input changes.

**Process**

* A single `evaluate(context)` function that reads inputs/params and produces outputs.
* No direct DOM/renderer mutations. All renderable artifacts must be returned as outputs.

**Outputs**

* Typed, immutable data objects (e.g., Geometry, Material, Transform, SceneFragment, Diagnostics).
* Outputs must be **referentially stable** if equal (enable memoization reuse) and serializable for persistence.
* Outputs are designed for **structural sharing** across consumers; any consumer-side modification must use **copy‑on‑write (CoW)** APIs that produce a new object without mutating the shared instance.

**Side Effects**

* Disallowed by default. If required (e.g., GPU allocation), they must go through declared hooks: `onAcquire(context)`, `onRelease(context)`, and be captured in the node’s validity hash.

### 4.1) Fan‑out & Sharing Semantics

* A node may have unlimited **out‑degree** (its output connects to many inputs).
* The engine maintains a single cached output per validity hash; all in‑cone consumers reference it.
* Consumers must treat inputs as **read‑only**. Mutation attempts are blocked or transparently CoW‑cloned.
* GPU/large resources exposed via handles must be reference‑counted; release occurs only when no in‑cone consumer needs them.

## 5) Graph Contract

G1. **Acyclic DAG**: Validate on every connect/reconnect.
G2. **Typed edges**: Enforce socket type compatibility (with optional coercion rules).
G3. **Single render target**: `render=true` is unique within a graph context. Setting a new target clears the flag on the previous target.
G4. **Render cone derivation**: Maintain a dynamic reverse-adjacency index to derive the upstream closure of the current target in O(|V|+|E|) worst case, amortized.
G5. **Subflow encapsulation**: Subflow exposes public inputs/outputs. Internal `activeOutputNodeId` defines its render target; only the internal cone computes. The subflow node’s **external** outputs mirror the chosen internal output.
G6. **Many-to-many connectivity**: A single output socket may connect to multiple inputs (unbounded fan‑out). Each input socket accepts one connection unless the node explicitly defines a variadic input list.
G7. **Composition nodes**: Nodes that merge multiple upstream branches (e.g., SceneMerge, GeometryGroup) must compose inputs **without duplicating computation**, preserving referential identity where possible.

## 6) Invalidation & Caching

I1. **Fine-grained dirty marking**: On change, mark dirty only: the edited node, all its **downstream** dependents **within the cone**, and the target if reachable.
I2. **Content-addressed cache**: Compute `validityHash = hash(inputs, params, version, resources)`. If unchanged, reuse cached output.
I3. **Topology changes**: Recompute the cone set; mark newly included nodes as dirty; nodes exiting the cone are not recomputed and may have their caches kept or evicted by policy.
I4. **Resource changes**: Any mutation to bound assets invalidates nodes that include the asset’s handle in their hash.
I5. **Policy knobs**: Provide global toggles for cache size, eviction strategy (LRU, LFU), and persistence (session vs. disk).
I6. **Structural sharing**: Shared outputs across multiple consumers are kept **once** in cache; their lifetime is extended while any in‑cone consumer remains valid.
I7. **Copy-on-write enforcement**: If a consumer requires a mutated variant, the engine clones lazily and records a new cache entry keyed by the new hash.

## 7) Scheduler & Execution

S1. **Topological scheduling**: Compute a topo order **limited to the cone**. Execute nodes whose inputs are clean first.
S2. **Parallelism**: Execute independent ready nodes concurrently when safe. Respect per-node `concurrency` hints.
S3. **Async awaitability**: The scheduler awaits async nodes and then schedules their dependents.
S4. **Short-circuit on failure**: If a node in the cone fails, its downstream dependents are skipped and marked `blocked` with propagated diagnostics.
S5. **Debounce & coalescing**: Parameter drags and rapid edits are debounced. Only the latest state triggers recompute.
S6. **Single-producer, multi-consumer reuse**: For a node with N in‑cone consumers, schedule the producer once per validity hash; enqueue all N consumers after the producer resolves, each receiving the same output reference.
S7. **Backpressure & cancellation**: If the render target changes mid‑compute, cancel producers that no longer lie in the new cone; retain completed caches for reuse.

## 8) Renderer-Target Semantics

RT1. **What renders**: Only artifacts produced by the render target’s **resolved SceneFragment** (and its composed child fragments) are committed to the scene.
RT2. **Visibility vs. Render**: Visibility flags are local to node previews; they do not affect render-cone membership. The `render=true` flag alone defines the cone and the final scene.
RT3. **Switching target**: On target switch, compute the new cone; diff old vs. new to reuse overlapping caches and only evaluate missing parts.
RT4. **Multiple views (future)**: When multiple viewport tabs exist, each has a bound render target and independent cone.
RT5. **Scene composition**: When the render target represents a composition (e.g., merge/group), it must reference child fragments **by identity** rather than deep‑copying geometry. The committed scene graph uses references to shared buffers/materials where safe.

## 9) Subflows

SF1. **Active output**: A subflow must specify exactly one internal node as `activeOutputNodeId` (its internal render target).
SF2. **Cone isolation**: Only nodes that feed the active output compute. Internal previews outside that cone must not compute.
SF3. **Boundary mapping**: The subflow node’s external output equals the internal active output’s exported value.
SF4. **Hot-swap**: Changing `activeOutputNodeId` triggers recomputation limited to the newly selected internal cone.

## 10) Error Handling & Diagnostics

E1. **Per-node diagnostics**: Standardized error object with code, title, details, and input provenance.
E2. **Cone-limited surfacing**: Diagnostics surface only for nodes in the current cone to avoid noise.
E3. **Cycle errors**: Attempting to create a cycle immediately rejects the connection with a clear message.
E4. **Timeouts**: Per-node execution timeout with cancelation; downstream nodes become `blocked` with causal chain shown.

## 11) Performance Requirements

P1. **Latency**: 95th percentile interactive edits must settle under 100 ms for graphs ≤ 200 nodes with ≤ 1M‑tri geometry per branch, assuming cache hits on 70 percent of cone nodes.
P2. **Throughput**: Parallel execution should demonstrate ≥ 1.5× speedup on 4-core CPUs for branchy cones.
P3. **Memory**: Configurable cache cap; when exceeded, evict least‑recently used clean nodes outside the current cone first.

## 12) API & Data Model (TypeScript Sketch)

```ts
interface NodeIO<TIn, TOut> {
  id: string
  type: string
  inputs: TIn
  params: Record<string, unknown>
  evaluate(ctx: EvalContext): Promise<TOut> | TOut
  onAcquire?(ctx: EvalContext): void | Promise<void>
  onRelease?(ctx: EvalContext): void | Promise<void>
}

interface EvalContext {
  getInput<T>(socket: string): T
  getParam<T>(key: string): T
  getResource<T>(key: string): T
  setDiagnostic(diag: Diagnostic): void
  signal: AbortSignal
}

interface Scheduler {
  setRenderTarget(nodeId: string): void
  applyChange(change: GraphChange): void // marks dirty + schedules cone-only recompute
}
```

## 13) Change Triggers

* Parameter edit
* Input value change (upstream recompute)
* Edge add/remove
* Node add/remove
* Resource acquire/release/update
* Render target switch

Each trigger must resolve the new cone and recompute only the affected dirty nodes within it.

## 14) UI/UX Requirements

U1. **Render target indicator**: Exactly one node shows a solid “Render” pill; clicking it moves the render flag.
U2. **Cone highlight**: Optional overlay highlights nodes in the active cone.
U3. **Node state badges**: `clean`, `dirty`, `pending`, `blocked`, `failed` shown only for cone nodes during recompute.
U4. **Preview vs. final**: Node-level preview is opt-in and does not force compute unless the node lies in the cone.

## 15) Persistence & Serialization

* Serialize node params, connections, and `renderTargetId` per context.
* Cache persistence is optional; if enabled, include node validity hashes.

## 16) Acceptance Criteria (Executable Scenarios)

AC1. **Outside-cone no-op**: Edit a parameter on a node not in the cone; zero recomputations occur; FPS and timings remain unchanged.

AC2. **Minimal recompute**: Edit a parameter on a cone leaf; only that node and downstream to the target recompute; siblings remain clean.

AC3. **Target switch**: Switch render target from A to B; only nodes exclusive to B’s cone compute; overlapping nodes reuse cache.

AC4. **Subflow isolation**: In a subflow with two branches, set `activeOutputNodeId` to branch 1; edits in branch 2 do not trigger compute.

AC5. **Cycle prevention**: Attempt to create a cycle; connection is rejected with a clear diagnostic.

AC6. **Async correctness**: Introduce an async node; downstream waits; no extra recomputes when the promise resolves.

AC7. **Resource invalidation**: Replace a texture asset used by two cone nodes; both invalidated; unrelated nodes remain clean.

AC8. **Fan‑out reuse**: One producer with three in‑cone consumers computes **once**; all three receive the same output reference; timings show no duplicate evaluation.

AC9. **Out‑of‑cone branch ignored**: A producer fans out to two consumers, but only one path reaches the render target; edits on the ignored consumer do not cause recompute.

AC10. **Copy‑on‑write safety**: A consumer attempts to mutate a shared geometry; engine creates a new instance; upstream shared producer output remains unchanged; other consumers continue to share the original.

## 17) Non-Goals

* Global “compute everything” modes
* Multi-target compositing across multiple cones (future)
* Cross-graph shared mutable state

## 18) Implementation Notes (Guidance)

* Maintain forward and reverse adjacency lists for fast cone derivation.
* Track per-node `version` counters to short-circuit hash calculations on no-op changes.
* Use a two-phase scheduler: (1) collect dirty-in-cone set; (2) topo sort and execute with a ready queue.
* Make hashing pluggable to accommodate large geometry digests (e.g., GPU buffer hashes vs. CPU arrays).
* Prefer immutable data structures with structural sharing to enable low‑cost fan‑out across consumers.
