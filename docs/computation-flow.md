# Computation Flow Analysis & Industry Library Recommendations

## Executive Summary

Minimystx currently implements a custom computation graph system with manual DAG (Directed Acyclic Graph) operations, topological sorting, and reactive propagation. This analysis examines industry-standard libraries that could replace our custom implementation, allowing the team to focus on domain-specific 3D parametric modeling features rather than low-level graph algorithms.

**Key Finding**: We already use `@dagrejs/dagre` (v1.1.4) for layout but don't leverage its underlying `graphlib` for computation. A hybrid approach—proven DAG libraries for graph operations + isolated reactive engine inside compute core—can reduce maintenance burden while preserving existing Zustand/UI architecture.

---

## Current Custom Implementation Analysis

### What We Built (src/engine/graph/)

1. **CoreGraph.ts** (298 lines)
   - Manual DAG implementation with predecessor/successor tracking
   - Custom topological sorting algorithm (lines 143-169)
   - Manual cycle detection (lines 87-90)
   - Cache management for graph traversal (lines 171-250)

2. **Cooker.ts** (129 lines)
   - Custom task queuing and processing system
   - Topological sort integration for computation ordering
   - Block/unblock mechanism for batching operations

3. **DirtyController.ts** (96 lines)
   - Manual dirty propagation system
   - Hook-based side effects management
   - Timestamp tracking for dirty states

4. **ConnectionManager.ts** (Not shown, but referenced throughout)
   - Connection lifecycle management
   - Handle-based edge routing

### Current Problems

1. **Maintenance Burden**: 500+ lines of custom graph algorithms
2. **Bug Prone**: Manual implementations of well-solved problems (topological sorting, cycle detection)
3. **Feature Duplication**: Already using `@dagrejs/dagre` for layout but reimplementing core graph operations
4. **Testing Complexity**: Custom algorithms need extensive edge case testing
5. **Performance**: Unoptimized compared to battle-tested libraries
6. **Missing Features**: No async cancellation, limited scheduling, manual dirty propagation

---

## Industry Standard Solutions

### 1. Graph Computation Libraries

#### Dagre (Already Installed! )
```json
"@dagrejs/dagre": "^1.1.4"
```

**What We're Missing**: Dagre's underlying `graphlib` provides robust DAG operations we're reimplementing:
- `alg.topsort()` - Topological sorting
- `alg.findCycles()` - Cycle detection  
- `alg.preorder()`, `alg.postorder()` - Graph traversal
- Efficient predecessor/successor queries

**Opportunity**: Use `graphlib` for computation ordering, keep Dagre for layout.

#### Graphology-DAG
```bash
npm install graphology graphology-dag
```

**Features**:
- Mature DAG utilities (topological sort, cycle detection)
- 19+ dependent projects in production
- Pure computation focus (no visualization)
- TypeScript support

#### Alternative: Custom TypeScript DAG
```bash
npm install @sha1n/dagraph  # or ms-dag-ts
```

### 2. Reactive Programming Libraries

#### MobX (For Compute Engine Only)
```bash
npm install mobx  # Note: mobx-react-lite NOT needed for isolated usage
```

**Hybrid Architecture Benefits**:
- **Keep Zustand** for UI/UX state (panels, preferences, layout)
- **Isolate MobX** inside compute engine only (src/engine/)
- **Clean bridge** via events and version counters to UI
- **Automatic dependency tracking** - eliminates manual dirty propagation
- **Computed values** - automatic derivation from observables  
- **Fine-grained updates** - only affected computations run

**Critical Separation of Concerns**: MobX will **NOT** be used for UI state management. The reactive layer exists purely within the computation engine. Zustand remains the single source of truth for all application state, UI panels, user preferences, and React component state. This ensures zero disruption to existing UI patterns while gaining computational reactivity benefits.

**MobX vs Our Custom System**:
| Current Custom | MobX Equivalent |
|---|---|
| `isDirty` flags | Automatic tracking |
| `markDirty()` propagation | `autorun`/`reaction` |
| Manual dependency tracking | Transparent proxying |
| `DirtyController` hooks | `reaction` side effects |
| Cooker task queuing | Built-in batching |

#### RxJS (Alternative)
```bash
npm install rxjs
```

**Features**:
- Observable streams for reactive computation
- Rich operator library
- Industry standard for async data flows

**Tradeoffs**: More complex API, overkill for synchronous graph computation.

---

## Hybrid Architecture Migration Plan

### Phase 1: Graph Spine Only (Low Risk)
**Goal**: Replace custom DAG implementation with proven library while preserving all existing APIs

**Approach**: 
```typescript
// Replace src/engine/graph/CoreGraph.ts internals with:
import { Graph } from '@dagrejs/graphlib';
import * as alg from '@dagrejs/graphlib/lib/alg';

class MinimystxGraph {
  private graph = new Graph({ directed: true });
  
  // Keep existing API, delegate to graphlib
  topologicalSort(): string[] {
    return alg.topsort(this.graph);
  }
  
  wouldCreateCycle(source: string, target: string): boolean {
    // Test cycle safely without modifying graph
    const testGraph = this.graph.copy();
    testGraph.setEdge(source, target);
    return alg.findCycles(testGraph).length > 0;
  }
  
  // Preserve Minimystx-specific methods
  getDependencyClosure(nodeId: string): string[] {
    return alg.preorder(this.graph, nodeId);
  }
}
```

**Success Criteria**:
- All existing tests pass
- Same API surface
- Better performance on large graphs
- Cycle detection works correctly

### Phase 2: Isolated Compute Reactivity (Medium Risk)
**Goal**: Add reactive engine inside compute core only, bridge to existing Zustand UI

**Approach**:
```typescript
// src/engine/reactive/ComputeReactivity.ts
import { observable, computed, action, reaction } from 'mobx';

class ReactiveNodeRuntime {
  @observable private _params: Record<string, any> = {};
  @observable private _inputs: Record<string, any> = {};
  
  @computed get output() {
    // Automatically tracked dependencies
    return this.computeFunction(this._params, this._inputs);
  }
  
  @action setParams(newParams: any) {
    Object.assign(this._params, newParams);
  }
  
  // Bridge to UI: emit events on changes
  private setupUIBridge() {
    reaction(() => this.output, (output) => {
      this.emitToUI('node-updated', { nodeId: this.id, output, version: Date.now() });
    });
  }
}

// Keep Zustand for UI state
const useUIStore = create((set) => ({
  nodeVersions: {},
  onNodeUpdate: (nodeId, version) => set(state => ({
    nodeVersions: { ...state.nodeVersions, [nodeId]: version }
  }))
}));
```

**Benefits**:
- No disruption to existing UI patterns
- Isolated reactivity scope
- Clean separation of concerns
- Gradual adoption possible

### Phase 3: Preserve Async + Scheduling (Low Risk) 
**Goal**: Keep streamlined Cooker for async needs that libraries don't solve

**What Libraries Don't Handle**:
- Async node evaluation (file imports, network)
- Cancellation (rapid parameter changes)
- Scheduling (debounce, priority, frame budget)
- Subflow semantics (`activeOutputNodeId`)

**Approach**:
```typescript
class StreamlinedCooker {
  private queue = new Map<string, { task: ComputeTask, abortController: AbortController }>();
  
  enqueue(nodeId: string, task: ComputeTask) {
    // Cancel previous job for same node (latest-wins)
    this.queue.get(nodeId)?.abortController.abort();
    
    const abortController = new AbortController();
    this.queue.set(nodeId, { task, abortController });
    
    // Use graphlib for ordering
    const sortedNodes = this.graph.topologicalSort([...this.queue.keys()]);
    this.processTasks(sortedNodes);
  }
}
```

**Success Criteria**:
- Rapid parameter changes don't stall UI
- File loading can be cancelled
- Subflow active output semantics preserved

---

## Evaluation Contracts

### Processor Purity & Side Effects
**Contract**: Node processors are pure functions of `(params, inputs) → output`
- **Pure processors**: Geometry generation, mathematical operations, transformations
- **Async processors**: File imports, network requests - must return cancellable tasks and declare side effects
- **Idempotent finalization**: Engine ensures cleanup occurs exactly once per async operation

### Async Semantics
**Contract**: Latest-wins with immediate downstream invalidation
- **Cancellation**: Prior jobs for same node are aborted when new computation starts
- **Propagation**: Downstream nodes marked invalid immediately, before async completion
- **Error handling**: Async failures don't crash evaluation engine; errors surface on originating node

### Batching & UI Pulse Alignment
**Contract**: Changes publish one version per node per transaction
- **Transaction boundary**: Parameter changes within single user action (drag, type, etc.)
- **Commit timing**: Aligned to `requestAnimationFrame` for smooth UI updates  
- **Consistency**: All affected nodes update in single render cycle ("one UI pulse")

### Evaluation Determinism
**Contract**: Reproducible computation order for nodes at same topological depth
- **Tie-breaking**: Stable node creation index determines order when topology depth is equal
- **Graph mutations**: Adding/removing nodes doesn't affect existing computation order
- **Subflow isolation**: Node order within subflows independent of root graph order

---

## Implementation Complexity Analysis

### Current Custom System: HIGH Complexity
- **Graph Operations**: Manual implementation (298 LOC)
- **Reactive System**: Custom dirty tracking (225 LOC)  
- **Task Scheduling**: Custom cooker system (129 LOC)
- **Total**: 650+ lines of infrastructure code

### Hybrid Library-Based System: MEDIUM Complexity
- **Graph Operations**: Graphlib wrapper (~50 LOC with typed APIs)
- **Reactive System**: MobX integration + UI bridge (~120 LOC)
- **Task Scheduling**: Streamlined cooker (~80 LOC)
- **Glue Code**: Subflow semantics, async handling (~100 LOC)
- **Total**: ~350 lines of integration code

**Realistic Reduction**: ~45% less infrastructure code (650 → 350 lines)
**Key Benefits**: Proven algorithms, automatic dependency tracking, better maintainability

---

## Preserving Minimystx-Specific Semantics

### Subflow Architecture
Libraries provide graph algorithms, but **don't understand Minimystx's unique subflow model**:

**Key Concepts to Preserve**:
- `activeOutputNodeId` - **single** node per subflow that drives the parent geoNode output
- **Debug vs Production**: Subflow internal renders are debug-only; only active output affects scene
- Dependency closure computation - only compute predecessors of active output node
- Subflow scoping - nodes isolated within geoNode boundaries, no cross-contamination
- Hierarchical contexts - root vs subflow parameter propagation with different visibility defaults

**Implementation Strategy**:
```typescript
class SubflowManager {
  computeDependencyClosure(geoNodeId: string): string[] {
    const subflow = this.subFlows[geoNodeId];
    if (!subflow.activeOutputNodeId) return [];
    
    // Use graphlib to find all predecessors of active output
    const predecessors = this.graph.predecessors(subflow.activeOutputNodeId);
    return [subflow.activeOutputNodeId, ...predecessors];
  }
  
  shouldCompute(nodeId: string, geoNodeId: string): boolean {
    const closure = this.computeDependencyClosure(geoNodeId);
    return closure.includes(nodeId);
  }
}
```

### Async & Cancellation Requirements
Standard reactive libraries don't handle Minimystx's specific async needs:

**Must Preserve**:
- **File imports** - OBJ, glTF loading with progress tracking
- **Rapid parameter changes** - slider scrubbing without stalling UI
- **Latest-wins semantics** - cancel obsolete computations
- **Frame budget** - yield to browser for smooth interaction

**Hybrid Approach**:
- Use MobX for synchronous reactive dependencies
- Keep streamlined async orchestration layer
- Bridge between reactive core and async scheduling

### Type System & Output States
**Contract**: All node outputs are explicitly tri-state for robust error handling
- **`ok`**: Successful computation with valid result data
- **`no_data`**: Missing or empty input (not an error condition)  
- **`error`**: Computation failure with error message and source location

**Propagation Rules**:
- **Upstream `no_data`**: Downstream nodes receive empty input, continue processing
- **Upstream `error`**: Stop propagation, surface error on originating node only
- **Error boundaries**: Errors don't cascade; each node handles its own computation failures

**Group Node Special Case**: 
- Empty inputs treated as `no_data`, not errors
- Maintains stable input order across add/remove operations
- Output invalidated once when input list changes

---

## Resource Management & Rendering

### Render-Set & Object Ownership
**Contract**: Each rendered node owns stable scene resources for efficient reuse
- **SceneObjectDescriptor**: Stable IDs allow renderer to reuse geometry/materials across toggles
- **Resource lifecycle**: ON creates descriptor, OFF disposes GPU resources only
- **Object identity**: Three.js objects remain stable across parameter edits
- **Memory management**: Automatic cleanup prevents resource leaks

### Coordinate System & Units
**Contract**: Consistent world space for reliable parametric operations
- **Units**: World units = meters
- **Angles**: Degrees for user-facing parameters, radians for internal calculations  
- **Coordinate system**: Y-up, right-handed (matches Three.js defaults)
- **Precision**: Single precision floating point with appropriate tolerances

---

## Risk Assessment

### Migration Risks
| Risk | Mitigation |
|---|---|
| Breaking existing functionality | Phased migration with comprehensive testing |
| Learning curve for new libraries | MobX and graphology have excellent docs |
| Bundle size increase | Selective imports, tree shaking |
| Performance regression | Both libraries are heavily optimized |

### Benefits vs Risks
| Benefit | Risk Level | Impact |
|---|---|---|
| Reduced maintenance burden | Low | High |
| Better performance | Low | Medium |
| Fewer bugs | Low | High |
| Focus on domain features | Low | High |
| Industry standard patterns | None | High |

---

## Domain-Specific Behavioral Contracts

### Interactive Parameter Scrubbing
**Contract**: Responsive interaction during rapid parameter changes
- **Preview frequency**: Lightweight updates every ≤16ms (requestAnimationFrame aligned)  
- **Full recompute triggers**: Pointer release OR 100ms idle time
- **Cancellation**: Latest-wins semantics with automatic abort of obsolete computations
- **UI responsiveness**: Yield to browser for smooth interaction, never block main thread

### Cycle Detection & User Experience
**Contract**: Clear, actionable feedback when graph becomes invalid
- **Detection**: Highlight **all edges** participating in detected cycle(s)
- **Prevention**: Block connection that would create cycle before graph corruption
- **User guidance**: Inline "Learn why" action linking to documentation
- **Recovery**: Undo functionality to quickly revert problematic connections

### Async Asset Loading
**Contract**: Non-blocking import of large files (OBJ, glTF, textures)
- **Concurrency**: Limit simultaneous loading operations (e.g., max 3 concurrent)
- **Chunked parsing**: Break large operations into incremental chunks
- **Progress indication**: Node-level loading badges, not global spinners
- **Worker utilization**: Use web workers for parsing where possible to keep UI responsive
- **Error recovery**: Failed imports show clear error state with retry option

### Graph Serialization & Versioning
**Contract**: Reliable persistence and forward compatibility
- **Format**: `.mxscene` files with schema version metadata
- **Migration hooks**: Automatic parameter updates when opening older files
- **Subflow assets**: Reusable subflow components with stable IDs  
- **Partial loading**: Graceful handling of missing node types or corrupted data
- **Validation**: Schema validation on import with clear error messages

### Memory & Performance Guarantees
**Contract**: Sustainable resource usage for complex scenes
- **Geometry sharing**: Identical geometry instances share GPU buffers
- **Automatic cleanup**: Dispose GPU resources when nodes disabled
- **Cache invalidation**: Smart cache keys prevent stale geometry reuse
- **Frame budget**: Limit computation time per frame to maintain 60fps target
- **Memory monitoring**: Track and warn on excessive resource usage

---

## Specific Recommendations

### Immediate Actions (Next Sprint)
1. **Audit current dagre usage** - extend beyond layout to computation
2. **Prototype graphology-dag** - replace CoreGraph.ts topological sorting
3. **Measure performance** - benchmark custom vs library implementations

### Short Term (1-2 months)
1. **Phase 1**: Replace custom graph core with graphology-dag
2. **Remove** CoreGraph.ts, simplify connection management
3. **Keep** current reactive system during transition

### Long Term (3-6 months)  
1. **Phase 2**: Introduce MobX for reactive computation
2. **Remove** DirtyController, Cooker, and manual dirty tracking
3. **Simplify** graphStore.ts dramatically

### Success Metrics
- **Code Reduction**: Target 50%+ reduction in engine/ directory
- **Bug Reduction**: Fewer computation-related issues
- **Performance**: Maintain or improve current speeds  
- **Developer Experience**: Faster feature development

---

## Conclusion

The parametric design domain is complex enough without reimplementing fundamental graph algorithms. A **hybrid approach** - proven DAG libraries for graph operations + isolated reactive engine for compute core - offers the best balance of benefits vs. disruption.

### What This Achieves

1. **Reduce infrastructure by ~300 lines** while maintaining all functionality
2. **Eliminate graph algorithm bugs** through proven libraries
3. **Preserve existing UI architecture** (Zustand, React patterns)
4. **Add automatic dependency tracking** without manual dirty propagation
5. **Keep async capabilities** essential for 3D file loading and smooth UX

### What This Avoids

1. **Full architectural disruption** - no migration of UI state management
2. **Learning curve friction** - libraries isolated to engine layer
3. **Integration complexity** - clean bridges between systems
4. **Loss of domain features** - subflow semantics and async handling preserved

### The Hybrid Advantage

Instead of "rip and replace," this approach respects Minimystx's existing architecture while strategically adopting proven solutions where they add the most value.

**Recommendation**: Start with Phase 1 (graph spine replacement) as a low-risk foundation, then evaluate Phase 2 (isolated reactivity) based on results.

---

*Generated on 2024-12-29 | Next Review: Q1 2025*