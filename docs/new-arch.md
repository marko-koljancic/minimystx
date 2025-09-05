# Minimystx — Target Architecture (Detailed)

This is a pragmatic, production-ready architecture for a node-based parametric modeling app. It keeps the codebase small, enforces one compute pattern, and cleanly separates compute from rendering.

---

## 1) Domain Model (Types & Contracts)

### 1.1 Port & Value Types

* **Port types** (compile-time + runtime):

  * `Geometry`, `Transform`, `Material`, `Light`, `Number`, `Boolean`, `String`, `Vector2/3/4`, `Color`, `Image/Texture`, `Instances`.
* **Value wrappers** include metadata for caching:

  * `OutputValue<T> = { value: T; version: number; stats?: { computeMs: number } }`.

### 1.2 Geometry Model

* **GeometrySet**: logical (renderer-agnostic) payload.

  * `mesh?: { positions: Float32Array; indices?: Uint32Array; normals?: Float32Array; uvs?: Float32Array; attributes?: Record<string, TypedArray> }`
  * `instances?: { base: GeometrySet; transforms: Float32Array /* n×16 row-major */; attributes?: Record<string, TypedArray> }`
  * `bounds?: { min: [number,number,number]; max: [number,number,number] }`
  * `metadata?: { source: 'primitive'|'import'|'modifier'; hash?: string }`

### 1.3 Transform Model (first-class)

* `Transform = { position: [x,y,z]; rotation: [rx,ry,rz]; scale: [sx,sy,sz]; rotationOrder?: 'XYZ'|'XZY'|'YXZ'|'YZX'|'ZXY'|'ZYX' }`
* Composition is deterministic, left-to-right along root chains.

### 1.4 Materials & Lights (logical)

* **MaterialToken**: `{ type: 'standard'|'physical'|'xray'|'wire'; params: Record<string,unknown> }`
* **LightToken**: `{ kind: 'ambient'|'point'|'spot'|'hemisphere'; params: Record<string,unknown>; transform?: Transform }`

---

## 2) Node System

### 2.1 Node Definition (single contract)

* Every node adheres to one compute signature.

```ts
type ComputeCtx = {
  time: number;
  units: 'm'|'cm'|'mm';
  quality: 'draft'|'medium'|'high';
  cancel: AbortSignal;
  resources: ResourcePool;     // meshes/materials/texture pools
  randomSeed: number;
};

type ComputeFn<P,I,O> = (params: P, inputs: I, ctx: ComputeCtx) => Promise<O> | O;

type NodePort = { name: string; type: string; optional?: boolean };

type NodeDefinition = {
  id: string; label: string; category: string;
  in: NodePort[]; out: NodePort[];
  paramsSchema: ZodSchema<any> | JSONSchema;         // runtime validation
  compute: ComputeFn<any, Record<string,unknown>, Record<string,OutputValue<any>>>;
  runtime: 'root'|'subflow'|'both';                  // where it’s allowed
};
```

### 2.2 Node Registry (metadata-driven)

* Auto-discovers `NodeDefinition` exports.
* Validates at startup:

  * unique ids, port types exist, `compute` signature, param schema.
* Provides search/filter (by `category`, `runtime`).

### 2.3 Containers / Sub-flows

* **CompoundNode** (e.g., GeoNode) exposes **public pins** mapped to an **internal graph**.
* Sub-flow policy:

  * Exactly one **RenderTarget** inside is “visible”.
  * Engine **pulls** from that RenderTarget when the GeoNode’s output is demanded.
* Caches are **namespaced per container instance**.

---

## 3) Graph Store (Authoring State)

* Holds nodes, edges, parameters, selection, visibility.
* Enforces **type-safe connections** at connect time (with helpful errors & optional safe coercions).
* Emits events:

  * `onParamChange(nodeId)`, `onConnectChange(edge)`, `onVisibilityChange(nodeId)` → call `engine.markDirty(...)`.

---

## 4) Compute Engine (Dirty + Pull + Topo + Cache)

The runtime “heart”.

### 4.1 API

```ts
type Engine = {
  markDirty(nodeId: string, reason: 'param'|'connection'|'visibility'): void;
  evaluate(targets: string[]): Promise<EvaluationReport>;  // demand-driven
  getOutput(nodeId: string, port: string): OutputValue<any>|undefined;
  getTopo(): string[];   // for debug/metrics
};
```

### 4.2 Responsibilities

* Build/maintain a **DAG** with cycle detection; keep a cached **topological order**.
* **Dirty propagation**: changing params or wiring marks node dirty; downstream only.
* **Pull evaluation**:

  * Given `targets` (root-level renderables + each GeoNode’s internal RenderTarget), walk prerequisites in topo, recompute **only** dirty nodes.
  * Skip clean nodes; re-use cached `OutputValue` if inputs are unchanged.
* **Caching & versioning**:

  * Each node output gets a content hash; increment `version` on change.
* **Execution context**: provide deterministic seeds, units, quality, cancel tokens.

---

## 5) Scene Syncer (Compute → Three.js)

A thin boundary that turns logical outputs into minimal **diffs** to the Three scene.

### 5.1 Inputs

* From Engine: collections of `GeometrySet`, `Transform`, `MaterialToken`, `LightToken` for **visible** targets.

### 5.2 Diff Strategy

* Stable IDs per logical object (derived from node id + port + instance index).
* Create/update/dispose meshes/lights/materials.
* Update only changed buffers/uniforms based on `version` comparisons.
* Owns **ResourcePool** (GPU buffer reuse, materials/geometry ref-count).

### 5.3 Display Modes & Overlays

* Implemented as **render policy** (not nodes):

  * Shaded, Wireframe, X-Ray, Shaded+Edges, X-Ray+Edges, Normals/Depth overlays.
* Policies decide which Three materials/passes to use per logical object.

---

## 6) Resource Management

* **ResourcePool** keeps reusable Three objects:

  * `getGeometry(key)`, `setGeometry(key, bufferGeometry)`, `release(key)` (ref-counted).
  * Same for materials, textures, FBOs.
* Automatic disposal once refs reach zero or versions diverge.

---

## 7) Validation, Errors, Instrumentation

* **Connection validation** at connect-time; shows user-readable errors (type mismatch, missing required port).
* **Structured errors** from node compute: propagated to UI (e.g., panel banner + highlight faulty node).
* **Instrumentation**:

  * per-node compute time, cache hit/miss, nodes evaluated per edit.
  * Engine timing (total ms), SceneSyncer diff stats (created/updated/disposed).

---

## 8) Configuration & Persistence

* **Preferences** (units, quality, display mode defaults) live outside the graph; read by `ComputeCtx` and SceneSyncer.
* **Project state** saves authoring graph + preferences; **no GPU objects**.

---

# End-to-End Flow: “Assemble a 3D Scene” (Minimystx Use Case)

### Scenario

User builds a simple scene:

* Root: `PointLight`, `AmbientLight`, `GeoNode`.
* Inside `GeoNode` sub-flow: `Box` → `Transform` → `Group` (visible target), plus `TorusKnot` → `Transform` → `Group`.
* Root display mode: `Shaded with Edges`.

### Step-by-step

1. **Authoring**

* User drops `GeoNode` and opens sub-flow.
* Adds `Box` (params: width, height, depth), connects to `Transform` (params: translate \[0,3,0]), connects to `Group`.
* Adds `TorusKnot` → `Transform` (rotate Y 45°) → connects into same `Group`.
* Sets `Group`’s **visible flag** (the sub-flow’s RenderTarget).
* Back at root, user adds `AmbientLight`, `PointLight` with transforms.

2. **Graph Events → Engine Dirty**

* Each add/connect/param edit triggers store events → `engine.markDirty` on the affected node(s) and downstream.

3. **Targets Resolution**

* Root **targets** for evaluation:

  * All root-level renderables (lights are renderables) and
  * Each container’s **internal RenderTarget** (the sub-flow `Group`).
* Here: targets = `[AmbientLight, PointLight, GeoNode:Subflow:Group]`.

4. **Engine Evaluate (Pull)**

* Engine topo-walks prerequisites for each target:

  * For `Group`: visits `Box`, `Transform`, `TorusKnot`, second `Transform`, then `Group`.
  * Recomputes only dirty nodes; uses cached outputs if clean.
* Each node returns `OutputValue<T>` with updated `version` if changed.

5. **SceneSyncer Diff**

* Collects evaluated outputs (lights, geometry, transforms, materials).
* Computes diffs vs last frame:

  * Creates Three `Mesh` objects if new; updates BufferGeometry attributes if `version` changed.
  * Updates materials per **render policy** (Shaded+Edges).
  * Applies transforms to objects (root chain transforms composed deterministically).
  * Disposes any orphaned objects.

6. **Viewport Update**

* Three renderer draws with active passes (e.g., edge overlay).
* User sees updated scene.

7. **Subsequent Edits**

* Changing the `Box.width`:

  * `engine.markDirty(Box)` → dirty propagates to its `Transform` and `Group`.
  * `evaluate([targets])` recomputes only `Box` → downstream `Transform` → `Group`. `TorusKnot` chain stays clean.
  * SceneSyncer updates only the `Mesh` buffers that changed.

---

# Integrating Lights & Root Transform Chains

* Each **root node** has an optional `Transform` output.
* When root nodes are chained (Geo → Light → Geo, etc.), the **composed transform** flows through the chain; every downstream root node composes the incoming transform with its own.
* SceneSyncer applies final composed transforms to corresponding Three objects.

---

# Where Each Building Block Sits in Code

* `/src/engine/graph/`

  * `Engine.ts` (dirty, topo, evaluate, caching)
  * `GraphTypes.ts` (ports, node defs, OutputValue)
* `/src/engine/nodes/`

  * `NodeBuilder.ts` (factory to declare `NodeDefinition`)
  * `definitions/*` (Box, Sphere, Transform, Group, Lights…)
* `/src/engine/containers/`

  * `CompoundNode.ts` (GeoNode)
* `/src/engine/sync/three/`

  * `SceneSyncer.ts` (diff + resource pools)
  * `RenderPolicies.ts` (Shaded, Wireframe, X-Ray, overlays)
* `/src/engine/resources/`

  * `ResourcePool.ts` (geometries, materials, textures)
* `/src/store/`

  * `graphStore.ts` (authoring state, connection validation)
  * `preferencesStore.ts` (units, quality, display modes)

---

# Acceptance Criteria (engineering-ready)

1. **Single node contract**: all core nodes compiled against `compute(params, inputs, ctx)`; no legacy compute functions remain.
2. **Dirty + pull**: editing any param recomputes only the necessary subgraph; report lists evaluated node ids.
3. **Caching**: unchanged nodes return previous `OutputValue` with same `version`; SceneSyncer performs zero updates for them.
4. **Sub-flow target**: GeoNode exposes a visible internal node; engine can evaluate it in isolation.
5. **SceneSyncer**: minimal diffs (created/updated/disposed counts exposed); display modes implemented without touching node code.
6. **Transforms**: consistent composition across root chains; lights honor transforms.
7. **Validation & errors**: illegal connections blocked; compute errors surface to UI with faulty node id.
8. **Resource lifecycle**: no GPU leaks during repeated edits; ref-counts drop to zero dispose correctly.
9. **Instrumentation**: per-edit metrics available (nodes evaluated, engine ms, sync ms, cache hit rate).

---

# What You Gain

* Deterministic, fast edits (only dirty parts recompute).
* Testable compute core (headless) separate from Three.js.
* Cleaner node authoring (one pattern, strong typing).
* Scalable to more nodes (IFC, materials, booleans) without runtime chaos.

If you want, I can convert this into a repo RFC (`/docs/engine-rfc.md`) with a short backlog (milestones, issues) tailored to your current folders and naming.
