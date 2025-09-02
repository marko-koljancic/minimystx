# Parametric Flow Journeys and Behaviors

## Purpose

Give designers and engineers a clear, consistent mental model for how node graphs create and update the Three.js scene in Minimystx. Cover root-level and subflow behaviors, branching and merging, render flags, and what users should expect to see in the 3D canvas.

---

## Core mental model

* A graph is a directed acyclic graph (DAG). Data flows from sources to consumers top-to-bottom.
* Each node has:

  * **Params**: validated inputs (numbers, enums, vectors).
  * **Inputs/Outputs**: typed sockets (e.g., geometry, number, transform).
  * **Processor**: pure function of params + upstream outputs.
  * **Render flag**: controls scene membership, not geometry computation.
* Evaluation is **incremental**. A change publishes a new version once per cycle; all downstream consumers update in a single UI pulse.

---

## Surfaces

* **Graph editor**: build and edit the DAG.
* **Inspector**: edit node params with immediate validation/clamping.
* **3D canvas**: shows the “render set” of nodes whose render flags are on; updates are flicker-free, object resources are reused when possible.

---

## Node categories

* **Sources**: Box, Sphere, ImportOBJ/GLTF, Curve, Points.
* **Modifiers/Transforms**: Transform, Subdivide, Boolean, Material.
* **Combiners**: **Group** (merge N geometry streams into one).
* **Lights/Cameras**: PointLight, DirectionalLight, Camera nodes.
* **Bridging/Utility**: Attribute nodes, Math nodes, Subflow I/O.

---

## Root-level behaviors

### 1) Create and connect

```
[Box] --geometry--> [Transform] --geometry--> [Material] --geometry--> (render flag ON)
```

* When a param changes upstream (e.g., Box width), all downstream consumers recompute once.
* Expected canvas: geometry morphs smoothly without camera reset.

### 2) Fan-out (one output → many consumers)

```
                 ┌--> [Transform A] --┐
[Box] --geom---->│                    ├--> [Material] --> (render ON)
                 └--> [Transform B] --┘
```

* A single Box drives multiple branches. Changing Box updates both A and B branches in one UI frame.
* Expected canvas: both variants update together; no “half-updated” states.

### 3) Branch merge with Group

```
[Transform A] --\
                 >-- [Group] --geometry--> [Subdivide] --> (render ON)
[Transform B] --/
```

* Group accepts N geometries, outputs one stream.
* Expected canvas: combined result appears as one object hierarchy; toggling Group render adds/removes the merged object only.

### 4) Render flags

* Turning a node’s render flag **on** adds its latest output to the render set.
* Turning it **off** removes it and disposes owned resources safely.
* Expected canvas: enabling multiple renders overlays results for comparison; upstream geometry is not re-computed only because a flag changed.

### 5) Error protection

* **Cycles** are blocked with a clear message on the offending connection.
* **Missing inputs**: downstream shows a harmless “no data” state; nothing is pushed to the renderer.
* **Invalid params**: values are clamped or rejected before compute; last valid output remains in view.

---

## Subflow behaviors

### Subflow concept

* Certain nodes (e.g., GeoNode) encapsulate a nested graph with explicit **Subflow Inputs/Outputs**.
* Parent graph sees the subflow as a single node with the same evaluation guarantees.

### Entering a subflow

```
[GeoNode •••]  (double-click)  => opens sub-graph:
[Subflow Input: geometry] --> [Transform] --> [Noise Deform] --> [Subflow Output: geometry]
```

* Params changed inside the subflow propagate to its Output, then to the parent graph in one cycle.
* Expected canvas: if the parent node’s render flag is on, edits inside update the rendered result immediately.

### Subflow render scope

* Render flags inside a subflow are **for debugging** previews within the subflow viewport (if present); the parent render flag controls what reaches the main canvas.
* Expected canvas: consistent with parent; no duplicate objects unless explicitly exposed via multiple outputs upstream.

### Subflow I/O contracts

* Types must match. If a subflow Output changes type, affected parent connections show a clear error until resolved.

---

## Typical user journeys

### Journey 1: From primitive to render

1. Drop a **Box**.
2. Add **Transform**, connect Box → Transform.
3. Toggle **Transform render ON**.
   Expected: box appears; changing Box width updates the view.

### Journey 2: Branch, compare, decide

1. From Box, branch to **Transform A** and **Transform B**.
2. Turn both renders ON to compare.
3. Decide on a path, feed both into **Group**, then render only Group.
   Expected: both branches update together; switching to Group shows a single merged result.

### Journey 3: Import and process

1. **ImportGLTF** node loads a file.
2. Connect to **Material** and **Transform** pipelines.
3. Toggle renders on selected stages for A/B viewing.
   Expected: renderer reuses meshes when only transforms/materials change; no camera jump.

### Journey 4: Encapsulate as subflow

1. Select a chain and convert to **GeoNode** subflow.
2. Expose a few key params as subflow Inputs.
3. Use this node across the graph; edits propagate predictably.
   Expected: parent canvas updates once per edit; subflow remains a clean reusable unit.

### Journey 5: Live scrubbing

1. Click-drag a numeric param (e.g., rotation).
2. The engine batches changes within a short transaction; only the final value triggers full downstream recompute, with lightweight throttled previews during the drag.
   Expected: smooth interaction without stutter or flicker.

### Journey 6: Handling mistakes

1. Create a connection that forms a cycle.
   Expected: UI blocks the link and explains why.
2. Enter an out-of-range value.
   Expected: field clamps or shows inline validation; no invalid geometry reaches the renderer.

---

## Schematic behaviors (ASCII)

**Fan-out and merge**

```
    +---------+
    |  Box    |
    +----+----+
         |
         v
  +------+------+
  | Transform A |----\
  +-------------+     \
                        >----[ Group ]----[ Material ]----(Render ON)
  +-------------+     /
  | Transform B |----/
  +-------------+
```

**Subflow boundary**

```
[Parent Graph]
   ... --> [GeoNode: BuildingFacade] --> ...

[Inside GeoNode]
[Input: profile] -> [Array Along Curve] -> [Inset] -> [Output: facadeGeom]
```

**Render set membership**

```
Render Set = { NodeId: latestObjectDescriptor }

Toggle ON  => add/update descriptor
Toggle OFF => remove + dispose owned resources
```

---

## 3D canvas expectations

* No camera reset on graph edits; controls remain uninterrupted.
* Object reuse to minimize flicker; only changed transforms/materials are updated.
* Selection highlights the last edited node’s contribution when possible.
* Multiple renders may coexist; each node uses a stable naming scheme for debugging in the scene tree.
* Disposing is graceful on node delete or render-off; GPU memory is reclaimed.

---

## General guidelines for parametric modeling

### Graph hygiene

* Keep graphs acyclic; prefer **Group** for merges over ad-hoc concatenation inside processors.
* Use descriptive node names; subflows should expose only the minimal, typed interface.
* Prefer many small, composable nodes over monoliths.

### Performance and responsiveness

* Fan-out is supported; avoid excessive branching without Group merges to keep evaluation clear.
* Use render flags for comparison; switch off unused renders to reduce draw cost.
* Scrub with reasonable param steps; use integers where appropriate to reduce recompute churn.

### Validation and robustness

* Define sensible param ranges and defaults on every node.
* Treat missing inputs as empty, not errors; downstream should degrade gracefully.
* Surface errors at the node where they originate; never crash the whole graph.

### Subflows as building blocks

* Encapsulate recurring patterns as subflows; document their I/O and assumptions.
* Keep subflow internals private; change them without breaking the parent by keeping I/O contracts stable.

### Scene management

* Separate compute from render. Processors produce abstract descriptors; the SceneManager manages what is shown.
* Turning a render flag on must not trigger upstream recompute unless the node requires fresh data.

---

## Acceptance behaviors to watch for

* Upstream param change updates all downstream branches in one UI pulse.
* Toggling any render flag only affects the render set, not upstream computation.
* Group with dynamic inputs recomputes once when any input changes; downstream sees one consistent update.
* Subflow edits propagate to parent without double renders or stale states.
* Cycles are prevented; invalid params do not propagate.

---

## What this enables next

* Reliable A/B comparisons with multi-node renders.
* Reusable subflow components with stable interfaces.
* Scalable graphs that remain responsive as nodes grow in number.
* A clean path to add new nodes without rethinking evaluation rules each time.
