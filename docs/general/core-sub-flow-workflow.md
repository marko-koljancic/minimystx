## **Sub-Flow Node Workflow — Updated Requirements (Based on Your Provided Details)**

### **1. Context-Aware Node Palette & Components**

* **Node Palette behavior**:

  * Must adapt to the **current graph context** (root or sub-flow).
  * **Context Switching**: Updates contents seamlessly in place (no close/reopen).
  * **Context Labels**:
    * Root context: "Root Nodes"
    * Sub-flow context: "Sub-Flow Nodes — {GeoNode Name}"
  * When at **root level**: show **root-level nodes** (GeoNode, Lights).
  * When in a **sub-flow**: show **sub-flow-level nodes** (geometry primitives, transforms, imports).

---

### **2. Root-Level Nodes**

* **GeoNode**:

  * New root-level node type.
  * User can create **any number** of GeoNodes (no limit).
  * **Supports sub-flow** — acts as a **container** for sub-flow nodes.
  * **Visual Design**: Appears as regular node in flow canvas (no special design needed).
  * **Data Flow**: No inputs or outputs (completely self-contained sub-flows).
  * **Property groups**:

    * **General** (name, description)
    * **Transform** (position, rotation, scale - applied to final result of sub-flow computation)
    * **Render** (visible boolean toggle)
  * **Transform behavior**:

    * Applied *after* the sub-flow is computed at render reconciliation time.
    * Allows moving/rotating/scaling the final geometry output of the sub-flow.
  * **Visibility behavior**:

    * Toggling `Visible` at the GeoNode level turns **on/off** rendering for everything inside that sub-flow.
    * Acts as a parent-level toggle — if off, sub-flow computation is skipped entirely.
  * **Initial State**: New GeoNodes start with empty sub-flows.

* **Lights**:

  * Can **only** be created at the root level.
  * Do **not** support sub-flows.
  * Types: PointLight, SpotLight, DirectionalLight, HemisphereLight, RectAreaLight, AmbientLight (as per your earlier node plans).

---

### **3. Sub-Flow-Level Nodes**

* Supported nodes inside a sub-flow:

  * Box
  * Sphere
  * Cone
  * Torus
  * TorusKnot
  * Plane
  * Cylinder
  * ImportOBJ
  * Transform
* These nodes **do not** support sub-flows themselves.
* **Default Render State**: All newly created sub-flow nodes have render flag **OFF** by default.
* **Output Selection**: Only one node per sub-flow can have render flag **ON** (automatic mutual exclusion).
* **Auto-Toggle Behavior**: When user enables render flag on one node, system automatically disables it on all others in the same sub-flow.
* **Empty Output State**: User can turn off render flag on the only active node - result is nothing gets rendered from that sub-flow.

---

### **4. Navigation & Interaction**

* **Entering sub-flow**:

  * Double-clicking a GeoNode immediately opens its sub-flow.
  * User perceives it as "going inside" the node.
  * In sub-flow view, the canvas only shows that sub-flow's nodes and connections.
  * **Breadcrumb Navigation**: Displays "Root → {GeoNode Name}" at top-left of FlowCanvas.
  * **Node Palette Context**: Updates seamlessly to show "Sub-Flow Nodes — {GeoNode Name}".

* **Exiting sub-flow**:

  * User clicks "Root" in breadcrumb navigation to return to root-level.
  * **Selection Behavior**: Clears current selection when switching contexts.
  * **Initial State**: Always start at root context on app load (ephemeral state).

---

### **5. Rendering & Visibility Rules**

* **Root level**:

  * Multiple root-level nodes can be visible and rendered at the same time.
* **Sub-flow level**:

  * Only **one node's output** can be rendered at a time (designated by render flag).
  * **Visual Feedback**: Node with render flag ON is visually indicated as current output.
  * **Computation**: Renderer calculates the sub-flow graph **up to that single visible node** only.
  * **Auto-Toggle Logic**: Handled in graph store when `setParams` sets render flag - automatically turns OFF all others in same sub-flow.
  * **Scope Detection**: Nodes identified as belonging to same sub-flow by owning GeoNode ID.
* **GeoNode visibility toggle**:

  * Disabling visibility at the root level stops sub-flow output from being sent to the renderer entirely.

---

### **6. Parameter & Properties Panel Rules**

* **Description**:

  * Display as **read-only text**, not an editable field.
* **Layout**:

  * Parameter names on the **left**, input fields on the **right**.
  * 3 float values (e.g., position, rotation, scale) in a **single row**, equal width, stretching almost to the right edge.
  * Numeric inputs have **no up/down spinner controls** — direct typing only.
* **Validation**:

  * Invalid input turns the field **red** until confirmed by Enter or blur.
  * On confirmation, the value is applied; if invalid, revert to previous valid value.

---

### **7. Serialization Requirements**

* **File Structure**:
```json
{
  "schema": "minimystx-graph@1",
  "graph": {
    "rootNodes": [...],
    "rootEdges": [...],
    "rootPositions": { ... },
    "subFlows": {
      "<geoNodeId>": {
        "nodes": [...],
        "edges": [...],
        "positions": { ... },
        "activeOutputNodeId": "<nodeId-or-null>"
      }
    }
  }
}
```

* **Saving/export must include**:

  * Root-level graph (nodes, edges, positions).
  * All sub-flows and their internal nodes, connections, and parameters.
  * Active output node ID per sub-flow.
  * **Stable IDs**: Required for nodes/ports/edges across serialization.

* **Importing must recreate**:

  * Exact structure (root + sub-flows).
  * All parameter values and node positions.
  * Sub-flow boundaries and designated visible nodes.
  * **Context State**: Always opens at root (ephemeral UI state not persisted).

---

### **8. Performance Requirements**

* **Computation Strategy**: Single cache approach (simpler for initial release).
* **Incremental Updates**: Sub-flow recalculates **only when parameters or connections change**.
* **Render Pipeline**:
  * If `GeoNode.Render.Visible === true` and sub-flow has active output node: compute that branch, then apply GeoNode.Transform.
  * If `Visible === false`: skip compute and render entirely for that GeoNode.
  * If no active output node: skip compute and render.
* **Transform Application**: GeoNode transformation applied *after* sub-flow computation at render reconciliation time.
* **UI Responsiveness**: Renderer updates must not block UI interactions.
* **Future Optimization**: Can implement separate sub-flow caching later if needed for performance.

---

### **9. Error Handling**

* If sub-flow is missing required inputs, it is marked as invalid until resolved.
* Invalid numeric inputs are clearly highlighted until corrected.
* Any broken/mismatched connections between parent and sub-flow are visually indicated for user correction.

---

## **User Journey — With Your Added Behavior**

1. **Create a GeoNode at Root Level**

   * Appears in the root-level canvas with General, Transform, and Render property groups.

2. **Enter the Sub-Flow**

   * Double-click GeoNode → switches to sub-flow view.
   * Palette now shows only sub-flow-compatible nodes (Box, Sphere, etc.).

3. **Add Geometry Nodes**

   * User places geometry primitives and connects them to form the desired shape.

4. **Select Output Node**

   * Use existing **render flag** as output designation.
   * Turn **ON** render flag on desired output node (automatically turns OFF others).
   * **Visual Feedback**: Node with render flag ON shows as current output.
   * Renderer computes the sub-flow up to that node only.

5. **Apply Transformations**

   * Back at root level, user adjusts GeoNode Transform parameters — moves/scales/rotates the final computed geometry.

6. **Toggle Visibility**

   * User can turn GeoNode visibility on/off at the root level, controlling whether the sub-flow output appears in the renderer.

---

## **Acceptance Criteria**

**Node Palette**

* Shows root-level nodes (GeoNode, Lights) at root context.
* Shows sub-flow-level nodes (geometry + transform + import) in sub-flow context.

**GeoNode Behavior**

* Supports sub-flow.
* Transform applied after sub-flow computation.
* Visibility toggle hides/shows all sub-flow results in renderer.

**Sub-Flow Behavior**

* Only one node with render flag ON inside a sub-flow can be rendered.
* **Auto-Toggle**: Enabling render flag on one node automatically disables on all others.
* **Visual Indication**: Current output node clearly marked in sub-flow canvas.
* Renderer computes graph only up to the active output node.

**Navigation**

* Double-click GeoNode enters sub-flow.
* **Breadcrumb Navigation**: "Root" → "GeoNode Name" at top-left of canvas.
* **Exit Method**: Click "Root" in breadcrumbs to return.
* **Selection Behavior**: Clears selection when switching contexts.
* **Initial State**: Always start at root context on app load.

**Properties Panel**

* Read-only description.
* Left-label/right-input layout.
* 3 float inputs in one row.
* No spinners; direct typing only.
* Invalid input turns red until confirmed.

**Serialization**

* Export/import reproduces root + sub-flows exactly, with all parameters and positions intact.

**Performance**

* Sub-flow recalculates only on changes.
* GeoNode transform applied after computation.
* UI remains responsive during updates.

**Errors**

* Missing required inputs flagged.
* Invalid numeric input highlighted until fixed.
* Broken connections clearly indicated.


# Architectural Considerations (Minimystx Sub‑Flow Feature)

## Goals

Ensure maintainability, scalability, and extensibility of the sub‑flow feature while strictly aligning with the key requirements:

* GeoNode exists at root level, is unlimited in count, and is the **only** node type that supports sub‑flows.
* Lights exist **only** at root and **do not** support sub‑flows.
* Sub‑flow palette shows geometry/transform/import nodes only.
* In sub‑flow, **only one node is visible** (designated output); compute only up to that node.
* GeoNode **Visible** acts as a parent‑level render toggle.
* GeoNode **Transform** is applied **after** sub‑flow computation.

---

## 1) Core Computational Model: Typed Dataflow/DAG

* Represent all computations as a **typed directed acyclic graph (DAG)**.
* Nodes expose **ports** with declared types (e.g., Number, Boolean, Vector3, Color, Transform, Geometry, Material, String).
* Enforce **type compatibility at connect time** with clear validation errors.
* Keep node evaluation **pure** (no renderer side effects) and deterministic.

**Why:** Predictable recomputation, easy validation/migration, clear contracts for future node growth.

---

## 2) Sub‑Flow as Composite Node

* Model **GeoNode** as a **composite**: externally a single node at root; internally it owns a sub‑graph.
* Sub‑flow has a **single designated visible/output node**; only that branch is evaluated for rendering.
* Double‑click to enter sub‑flow; exit returns to root with context preserved.

**Why:** Clean encapsulation, nesting without special‑case code, uniform serialization.

---

## 3) Separation of Concerns: Model / View / Runtime

* **Graph Store (model):** single source of truth for graphs (root + sub‑graphs), nodes, ports, params, and evaluation results.
* **UI (view):** React Flow renders graphs and emits user intents; it holds **no computational logic**.
* **Renderer runtime:** consumes compute results to reconcile Three.js scene objects.

**Why:** Maintainable boundaries; swapping UI or renderer does not impact compute logic.

---

## 4) Scheduling & Incremental Evaluation

* Use **pull evaluation**: compute a node’s outputs only when demanded (e.g., when the designated sub‑flow output is visible).
* Maintain **dirty flags** on param/structure changes; recompute only affected branches.
* **Debounce** rapid UI changes (typing) and apply values on confirm (Enter/blur), per requirements.

**Why:** Scales with graph size; avoids unnecessary work; aligns with “recalculate only when parameters or connections change.”

---

## 5) Context‑Aware Node Registry & Palette

* Maintain a **node registry** with:

  * Allowed **context**: root‑only (GeoNode, Lights), sub‑flow‑only (Box, Sphere, Cone, Torus, TorusKnot, Plane, Cylinder, ImportOBJ, Transform).
  * Port schemas, default params, and metadata.
* Palette filters strictly by **current context** (root vs sub‑flow).

**Why:** Enforces rules declaratively; easy to extend with new nodes without touching palette logic.

---

## 6) Visibility & Transform Semantics

* **Root level:** multiple GeoNodes may be visible; each triggers its own pull evaluation.
* **Sub‑flow level:** exactly **one visible node** is designated; compute only the path to that node.
* **GeoNode.Visible:** gates whether computed results are forwarded to the renderer.
* **GeoNode.Transform:** applied **after** sub‑flow computation, at render reconciliation time (move/rotate/scale final result).

**Why:** Matches user expectations; isolates compute from render‑space transforms; simplifies caching.

---

## 7) Renderer Reconciliation (Scene Lifecycle)

* Treat each computed output as **data**; the renderer creates/updates/destroys Three.js objects to match it.
* Apply **GeoNode visibility** and **transform** during reconciliation (not during compute).
* Ensure renderer work is **idempotent** and diff‑based to avoid flicker and redundant allocations.

**Why:** Stable, performant scene updates and clear division of responsibilities.

---

## 8) Persistence & Migration

* Serialize:

  * Root graph (nodes, edges, positions, params).
  * Each GeoNode’s sub‑graph (nodes, edges, positions, params).
  * Node/port **stable IDs** for rename‑safe reconnect.
* On import, reconstruct graphs exactly; ensure sub‑flow boundaries and designated visible node are restored.

**Why:** Round‑trip fidelity and future‑proof evolution of node schemas.

---

## 9) Error Handling & Validation

* **Connect‑time** type checks with precise messages.
* **Sub‑flow output requirement:** if the designated visible node is missing or invalid, block render and surface a focused error.
* **Properties validation:** invalid numeric inputs highlight red until confirmed; revert to last valid on failed confirm.

**Why:** Fast feedback, no hidden failures, UX consistent with requirements.

---

## 10) Performance Guardrails

* **Memoize** node outputs keyed by inputs/params/structure version.
* Recompute only **dirty** paths; never full‑graph on every keystroke.
* Batch UI→model updates; avoid expensive re‑layouts.
* Keep compute thread fast; renderer runs only when visibility/outputs actually change.

**Why:** Smooth UX with large graphs and multiple visible GeoNodes.

---

## 11) Extensibility Guidelines

* New nodes are added by **registering**:

  * Context (root/sub‑flow), ports, params, defaults, and evaluation function.
* Renderer integrations for new result types (e.g., new Geometry forms) live **only** in the renderer layer.
* Avoid coupling node implementations to UI components; keep them behind the node contract.

**Why:** Enables safe growth of the node library and renderer capabilities without cross‑cutting edits.

---

## Alignment With Key Requirements

* **Only GeoNode supports sub‑flows:** enforced by registry context and composite modeling.
* **Lights root‑only, no sub‑flows:** registry context filter; renderer consumes them directly at root.
* **Sub‑flow one visible node:** designated output + pull evaluation ensures compute up to that node only.
* **GeoNode Visible/Transform behavior:** gated and applied in renderer after compute, matching the parent‑level toggle and post‑compute transform rule.
* **Palette adapts to context:** registry‑driven filtering guarantees correct node availability.
* **Recompute only on change:** pull + dirty flags + debounced apply fulfills the recalculation constraint.

---

## Documentation Notes for Implementers

* Keep **compute pure, render impure**; never create Three.js objects during node evaluation.
* Treat **IDs as stable** across serialization and UI edits.
* Any change that affects port types/structure must update a **structure version** to invalidate caches correctly.
* Prefer small, composable node evaluations over monolithic ones for better caching and testability.

---

# Technical Implementation Specifications

## 1) Graph Store Architecture (Option B - Separate Sub-Graph Storage)

### Current Structure (Flat)
```typescript
// Current graphStore.ts
nodeRuntime: Record<string, NodeRuntime>
dependencyMap: Record<string, string[]>
reverseDeps: Record<string, string[]>
```

### New Hierarchical Structure
```typescript
// Updated graphStore.ts
rootNodeRuntime: Record<string, NodeRuntime>
rootDependencyMap: Record<string, string[]>
rootReverseDeps: Record<string, string[]>

subFlows: Record<string, SubFlowGraph> // GeoNode ID -> its sub-flow
// where SubFlowGraph = {
//   nodeRuntime: Record<string, NodeRuntime>
//   dependencyMap: Record<string, string[]>
//   reverseDeps: Record<string, string[]>
//   activeOutputNodeId: string | null
// }
```

### Context-Aware Operations
```typescript
// Methods become context-aware
addNode(node: NodeInitData, context: GraphContext)
removeNode(nodeId: string, context: GraphContext)
setParams(nodeId: string, params: any, context: GraphContext)

// Context type
type GraphContext = {
  type: 'root' | 'subflow'
  geoNodeId?: string // required for sub-flow context
}
```

### GeoNode Deletion Cascade
```typescript
// When GeoNode is removed from root:
removeNode(geoNodeId: string, { type: 'root' }) => {
  // 1. Remove from rootNodeRuntime
  // 2. Delete entire subFlows[geoNodeId] if exists
  // 3. Update root dependencies
}
```

---

## 2) Context Management (UI Store)

### New UI Store Properties
```typescript
// uiStore.ts additions
currentContext: {
  type: 'root' | 'subflow'
  geoNodeId?: string
}

// Navigation methods
setCurrentContext(context: GraphContext): void
navigateToRoot(): void
navigateToSubFlow(geoNodeId: string): void
```

### Context State Rules
* **Initial State**: Always `{ type: 'root' }` on app load
* **Persistence**: Context is ephemeral (not saved in files)
* **Selection Clearing**: Clear selection when context changes
* **Context Validation**: Ensure geoNodeId exists when navigating to sub-flow

---

## 3) Node Registry Enhancement

### Context Property Addition
```typescript
// NodeDefinition extension
export type NodeDefinition = {
  type: string
  category: string
  displayName: string
  allowedContexts: ('root' | 'subflow')[] // NEW
  params: NodeParams
  compute: (params: any, inputs?: any) => any
}
```

### Context-Specific Node Registration
```typescript
// Updated node registry entries
nodeRegistry = {
  // Root-only nodes
  geoNode: { ..., allowedContexts: ['root'] },
  pointLightNode: { ..., allowedContexts: ['root'] },
  
  // Sub-flow-only nodes  
  boxNode: { ..., allowedContexts: ['subflow'] },
  sphereNode: { ..., allowedContexts: ['subflow'] },
  transformNode: { ..., allowedContexts: ['subflow'] }
}
```

### Context-Aware Filtering
```typescript
// NodePalette.tsx filtering logic
const getNodesForCurrentContext = (context: GraphContext) => {
  return Object.values(nodeRegistry).filter(node => 
    node.allowedContexts.includes(context.type)
  )
}
```

---

## 4) Render Flag Auto-Toggle Implementation

### Graph Store Logic
```typescript
// In setParams method - detect render flag changes
setParams(nodeId: string, params: any, context: GraphContext) => {
  if (context.type === 'subflow' && params.rendering?.visible === true) {
    // Auto-toggle: turn OFF all other nodes in same sub-flow
    const subFlow = subFlows[context.geoNodeId!]
    Object.keys(subFlow.nodeRuntime).forEach(id => {
      if (id !== nodeId && subFlow.nodeRuntime[id].params.rendering?.visible) {
        subFlow.nodeRuntime[id].params.rendering.visible = false
      }
    })
    
    // Update activeOutputNodeId
    subFlow.activeOutputNodeId = nodeId
  }
  
  // Apply the original parameter change
  const targetRuntime = context.type === 'root' 
    ? rootNodeRuntime 
    : subFlows[context.geoNodeId!].nodeRuntime
  targetRuntime[nodeId].params = { ...targetRuntime[nodeId].params, ...params }
}
```

### Visual Feedback
* Sub-flow nodes with `rendering.visible === true` get special styling
* Only one node per sub-flow can have this visual indication
* Clear indication of current "output" node in sub-flow canvas

---

## 5) Navigation & Breadcrumb System

### Breadcrumb Component
```typescript
// New component: Breadcrumb.tsx
const Breadcrumb = () => {
  const { currentContext } = useUIStore()
  const { rootNodeRuntime } = useGraphStore()
  
  const handleNavigateToRoot = () => {
    navigateToRoot() // clears selection
  }
  
  if (currentContext.type === 'root') {
    return <span>Root</span>
  }
  
  const geoNodeName = rootNodeRuntime[currentContext.geoNodeId!]?.params.general?.name
  
  return (
    <div>
      <button onClick={handleNavigateToRoot}>Root</button>
      <span> → {geoNodeName}</span>
    </div>
  )
}
```

### FlowCanvas Integration
```typescript
// FlowCanvas.tsx - add double-click handler
const handleNodeDoubleClick = (event: any, node: Node) => {
  if (node.type === 'geoNode' && currentContext.type === 'root') {
    navigateToSubFlow(node.id)
  }
}

// Add breadcrumb to canvas header
return (
  <div className={styles.flowCanvas}>
    <div className={styles.canvasHeader}>
      <Breadcrumb />
    </div>
    <ReactFlow
      onNodeDoubleClick={handleNodeDoubleClick}
      // ... rest of props
    />
  </div>
)
```

---

## 6) Rendering System Integration

### Updated useRenderableObjects Hook
```typescript
const useRenderableObjects = () => {
  const { rootNodeRuntime, subFlows } = useGraphStore()
  
  return useMemo(() => {
    const results: any[] = []
    
    // Process each root GeoNode
    Object.entries(rootNodeRuntime).forEach(([geoNodeId, runtime]) => {
      if (runtime.type !== 'geoNode') return
      
      // Check GeoNode visibility
      if (runtime.params.rendering?.visible === false) return
      
      // Get sub-flow
      const subFlow = subFlows[geoNodeId]
      if (!subFlow || !subFlow.activeOutputNodeId) return
      
      // Compute sub-flow up to active output node
      const subFlowOutput = computeSubFlowOutput(subFlow, subFlow.activeOutputNodeId)
      if (!subFlowOutput) return
      
      // Apply GeoNode transform to sub-flow result
      const transformedOutput = applyGeoNodeTransform(subFlowOutput, runtime.params.transform)
      
      results.push(transformedOutput)
    })
    
    // Add root-level lights (unchanged)
    Object.values(rootNodeRuntime).forEach(runtime => {
      if (runtime.type.includes('Light') && runtime.params.rendering?.visible !== false) {
        results.push(runtime.output)
      }
    })
    
    return results
  }, [rootNodeRuntime, subFlows])
}
```

---

## 7) Implementation Strategy - 6 Phase Plan

### Phase 1: Core Architecture Foundation (Week 1-2)
**Dependencies**: None
**Deliverables**: 
- Refactored `graphStore.ts` with hierarchical structure
- `uiStore.ts` context management
- Basic GeoNode definition and registration

**Testing**: Unit tests for graph store operations, context switching

### Phase 2: Context-Aware Node System (Week 3)
**Dependencies**: Phase 1 complete
**Deliverables**:
- Node registry context property
- Context-aware node filtering
- Updated node palette with context labels

**Testing**: Node filtering works correctly per context

### Phase 3: Navigation & UI Components (Week 4)
**Dependencies**: Phase 2 complete
**Deliverables**:
- Breadcrumb component
- Double-click navigation
- FlowCanvas integration
- Context state management

**Testing**: Navigation between contexts works smoothly

### Phase 4: Rendering System Integration (Week 5)
**Dependencies**: Phase 3 complete
**Deliverables**:
- Hierarchical computation pipeline
- GeoNode transform application
- Render flag auto-toggle logic

**Testing**: Sub-flow rendering works with proper transforms

### Phase 5: Serialization & Persistence (Week 6)
**Dependencies**: Phase 4 complete
**Deliverables**:
- New file format support
- Export/import functionality
- Schema versioning and migration

**Testing**: Round-trip serialization maintains all data

### Phase 6: Testing & Polish (Week 7)
**Dependencies**: Phase 5 complete
**Deliverables**:
- Integration testing
- Performance optimization
- UX refinements
- Documentation updates

**Testing**: Full feature testing, performance validation

---

## 8) Migration Strategy

### Backward Compatibility
1. **Detect old format** in import: check for flat `nodeRuntime` structure
2. **Auto-migrate**: convert flat structure to hierarchical on import
3. **Schema versioning**: `"schema": "minimystx-graph@1"` for new format
4. **Graceful degradation**: handle missing properties in old files

### Migration Algorithm
```typescript
const migrateFromFlatStructure = (oldGraph: OldSerializedGraph): NewSerializedGraph => {
  const rootNodes = oldGraph.nodes.filter(n => ['geoNode', 'pointLight', ...].includes(n.type))
  const subFlowNodes = oldGraph.nodes.filter(n => ['boxNode', 'sphereNode', ...].includes(n.type))
  
  // Create empty sub-flows for each GeoNode
  const subFlows: Record<string, SubFlowGraph> = {}
  rootNodes.filter(n => n.type === 'geoNode').forEach(geoNode => {
    subFlows[geoNode.id] = {
      nodes: [], edges: [], positions: {}, activeOutputNodeId: null
    }
  })
  
  return { ...oldGraph, rootNodes, subFlows }
}
```

This comprehensive specification provides the technical foundation needed to implement the sub-flow feature while maintaining code quality and extensibility.
