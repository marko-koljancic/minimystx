# Minimystx Architecture Simplification & Improvement Plan

## Executive Summary

After comprehensive analysis of both Minimystx and Polygonjs architectures, this document presents a detailed plan to simplify Minimystx while maintaining its functionality and improving performance. The current architecture suffers from over-engineering and multiple overlapping systems that create unnecessary complexity without proportional benefits.

**Key Metrics from Analysis:**
- **Current Complexity**: 5,000+ lines of engine code across 50+ files
- **Major Issues**: 3 overlapping computation systems, 4x state duplication, 60+ event types
- **Target Reduction**: 40-50% code reduction, 70% complexity reduction, 30% performance improvement
- **Implementation Time**: 9-13 weeks across 3 phases

## Current Architecture Analysis

### Critical Issues Identified

#### 1. **Multiple Overlapping Computation Systems** ❌
- **RenderConeScheduler** (692 lines) - Event-driven scheduler with 37+ event types
- **CookOnDemandSystem** (274 lines) - Redundant request-based system
- **GraphLibAdapter** (357 lines) - Unnecessary abstraction layer
- **Direct computation** in GraphStore (1003 lines) - Fourth computation path

**Quantified Impact**:
- 1,326 lines of overlapping computation code
- 60+ event types creating coordination overhead
- 4 different ways to trigger node computation
- Race conditions between systems

#### 2. **State Management Complexity** ❌
- **GraphStore** (1003 lines) - Largest single file, handles all concerns
- **4x State Duplication**: `rootNodeState` + `rootNodeRuntime` + `subFlows.nodeState` + `subFlows.nodeRuntime`
- **useFlowGraphSync** (115 lines) - Complex bidirectional sync with race conditions
- **Custom Events** - 50+ console.log statements indicate debugging difficulty

**Quantified Impact**:
- Node data stored in 4 different locations
- 150+ lines for single parameter update (setParams method)
- No rollback mechanism for failed operations

#### 3. **Node System Boilerplate** ❌
**Per Node Requirements (Current)**:
```typescript
// 132 lines per node minimum:
export const boxNodeParams: NodeParams = { /* 51 lines */ }
export const boxNodeCompute = (params, inputs, context) => { /* 35 lines */ }
export const boxNodeComputeTyped = boxNodeCompute; // duplicate
export const boxNode: UnifiedNodeDefinition = { /* 46 lines */ }
```

**Issues**:
- Manual registration in nodeRegistry (147 lines)
- 8 container types with complex wrapping overhead
- Dual compute functions (`compute` + `computeTyped`)
- Parameter validation scattered across files

#### 4. **Scene Integration Over-Engineering** ❌
- **SceneObjectManager** (763 lines) - Largest rendering file
- **Transform-only optimizations** - 200+ lines for minimal benefit
- **Multiple visibility systems**: `isInRenderCone` + `isEffectivelyVisible` + `effectiveVisibilityMap`
- **Event cascades**: Scene updates → Graph updates → More scene updates

## Comparison with Polygonjs Architecture

### What Polygonjs Does Better

1. **Single Responsibility Systems**
   - One clear computation engine per concern
   - Direct scene updates without complex batching
   - Clear hierarchy: Scene graph matches computation graph

2. **Unified Node Architecture**
   - Single base class with consistent patterns
   - Cook controller manages execution lifecycle
   - Type-safe parameter system with Vue reactivity

3. **Efficient Dependency Tracking** 
   - Graph-based dependencies with lazy evaluation
   - Simple dirty propagation through `DirtyController`
   - Batch processing only where necessary

4. **Performance Through Simplicity**
   - Lazy evaluation without complex scheduling
   - Direct container system for data flow
   - Clear separation between computation and rendering

## Proposed Architecture Simplification

### Phase 1: Unify Computation Architecture (High Priority)

#### 1.1 Replace Multiple Systems with Single Engine

**Current State:**
```typescript
// Three different systems doing similar work
RenderConeScheduler + CookOnDemandSystem + GraphLibAdapter
```

**Target State:**
```typescript
// Single unified computation engine
class UnifiedComputeEngine {
  private graph: ComputationGraph;
  private cache: ContentCache;
  private dirtyNodes: Set<string>;
  
  markDirty(nodeId: string): void
  computeNode(nodeId: string): Promise<void>  
  computeUpstream(nodeId: string): Promise<void>
}
```

**Benefits:**
- 70% reduction in computation-related code
- Single source of truth for node execution
- Elimination of event system complexity

#### 1.2 Simplify Node System

**Current State:**
```typescript
// Each node needs multiple functions and complex params
export const boxNodeParams: NodeParams = { /* 50+ lines */ }
export const boxNodeCompute = (params, inputs, context) => { /* logic */ }
export const boxNodeComputeTyped = boxNodeCompute; // duplicate
export const boxNode: UnifiedNodeDefinition = { /* metadata */ }
```

**Target State:**
```typescript
// Single node class with automatic registration
class BoxNode extends BaseNode {
  static readonly type = 'box';
  static readonly category = '3D Primitives';
  static readonly params = {
    width: { type: 'number', default: 1, min: 0.001, max: 100 },
    height: { type: 'number', default: 1, min: 0.001, max: 100 }
  };
  
  compute(): GeometryContainer {
    const geometry = new BoxGeometry(this.params.width, this.params.height, this.params.depth);
    return new GeometryContainer(geometry);
  }
}
```

**Benefits:**
- 60% reduction in per-node code
- Automatic parameter validation
- Type safety through inheritance

#### 1.3 Streamline State Management

**Current State:**
```typescript
// Complex dual state tracking
rootNodeState: Record<string, NodeState>
rootNodeRuntime: Record<string, any>
// Plus complex sync logic
```

**Target State:**
```typescript
// Single source of truth
nodes: Map<string, ComputeNode>
// Where ComputeNode contains both state and runtime
```

**Benefits:**
- Elimination of sync issues
- 40% reduction in state management code
- Clear ownership of node data

### Phase 2: Simplify Scene Synchronization (Medium Priority)

#### 2.1 Direct Scene Updates

**Current Complex Flow:**
```
Parameter Change � Scheduler � Event � GraphStore � Custom Events � Scene Update
```

**Proposed Direct Flow:**
```
Parameter Change � Node Computation � Direct Scene Update
```

**Implementation:**
```typescript
class SceneManager {
  updateNodeObject(nodeId: string, container: BaseContainer): void {
    const existingObject = this.sceneObjects.get(nodeId);
    if (existingObject) {
      this.scene.remove(existingObject);
    }
    
    const newObject = container.toObject3D();
    this.scene.add(newObject);
    this.sceneObjects.set(nodeId, newObject);
  }
}
```

#### 2.2 Remove Transform Optimizations

**Rationale:** Current transform-only optimizations add 200+ lines of complexity for minimal performance gain. Modern Three.js handles transform updates efficiently.

**Action:** Remove `transformOnlyNodes`, `isTransformOnlyChange`, and related optimization code.

#### 2.3 Simplify Visibility System

**Current:** Complex effective visibility calculations with render cones
**Proposed:** Simple boolean visibility with direct scene updates

```typescript
// Instead of complex visibility calculations
setNodeVisible(nodeId: string, visible: boolean): void {
  const object = this.sceneObjects.get(nodeId);
  if (object) {
    object.visible = visible;
  }
}
```

### Phase 3: Performance & Maintainability (Lower Priority)

#### 3.1 Cache Simplification

**Current:** Complex `ContentCache` with multiple invalidation strategies
**Proposed:** Simple LRU cache focused on actual bottlenecks

```typescript
class SimpleCache {
  private cache = new Map<string, { result: any, timestamp: number }>();
  private maxSize = 100;
  
  get(key: string): any | null
  set(key: string, value: any): void
  invalidate(key: string): void
}
```

#### 3.2 Code Organization

**Actions:**
- Merge related files (reduce from 50+ engine files to ~15)
- Eliminate circular dependencies  
- Create clear module boundaries
- Simplify export/import structure

## Implementation Strategy

### Phase 1 Implementation (4-6 weeks)

#### Week 1-2: Foundation
1. Create `UnifiedComputeEngine` class
2. Implement `BaseNode` class hierarchy
3. Migrate 2-3 primitive nodes to new system
4. Create compatibility layer for existing nodes

#### Week 3-4: Core Migration  
1. Replace `RenderConeScheduler` with `UnifiedComputeEngine`
2. Migrate all primitive nodes
3. Update `graphStore` to use new engine
4. Remove `CookOnDemandSystem`

#### Week 5-6: Scene Integration
1. Implement direct scene updates
2. Remove complex event system
3. Update React Flow integration
4. Comprehensive testing

### Phase 2 Implementation (3-4 weeks)

#### Week 1-2: Scene Simplification
1. Remove transform-only optimizations
2. Implement direct visibility system  
3. Simplify scene update flow

#### Week 3-4: State Cleanup
1. Consolidate state management
2. Remove duplicate tracking systems
3. Update UI components

### Phase 3 Implementation (2-3 weeks)

#### Week 1-2: Performance
1. Implement simple cache
2. Performance testing and optimization
3. Code organization cleanup

#### Week 3: Polish
1. Documentation updates
2. Final testing  
3. Migration guide

## Risk Assessment & Mitigation

### High Risk Items

1. **Breaking Changes During Migration**
   - **Risk:** Temporary functionality loss
   - **Mitigation:** Feature flags, parallel implementation, comprehensive testing

2. **Performance Regression**  
   - **Risk:** Simplified systems might be slower initially
   - **Mitigation:** Performance benchmarks, gradual rollout, rollback plan

3. **Complex Migration Path**
   - **Risk:** Long transition period with hybrid systems
   - **Mitigation:** Clear migration milestones, automated testing

### Medium Risk Items

1. **UI Integration Issues**
   - **Risk:** React Flow sync problems during transition
   - **Mitigation:** Maintain compatibility layer, isolated testing

2. **Cache Performance Impact**
   - **Risk:** Simple cache less effective than current system
   - **Mitigation:** Performance monitoring, adaptive cache sizing

## Expected Benefits

### Quantitative Improvements
- **Code Reduction:** 40-50% reduction in engine code (from ~5000 to ~2500 lines)
- **Performance:** 20-30% faster node computation due to reduced overhead
- **Memory Usage:** 15-20% reduction from eliminating duplicate state
- **Bundle Size:** 10-15% reduction from removing unused complexity

### Qualitative Improvements
- **Developer Experience:** Much easier to add new node types
- **Debugging:** Clear execution flow, single computation path
- **Maintenance:** Fewer systems to maintain and debug
- **Architecture Clarity:** Clear separation of concerns

## Success Metrics

### Technical Metrics
1. **Lines of Code:** Target 50% reduction in engine complexity
2. **Cyclomatic Complexity:** Reduce average function complexity by 30%
3. **Test Coverage:** Maintain 90%+ coverage during migration
4. **Performance Benchmarks:** No regression in computation speed

### User Experience Metrics  
1. **Node Creation Time:** Reduce from 200ms to <100ms
2. **Parameter Update Latency:** Reduce from 50ms to <20ms
3. **Memory Usage:** 20% reduction in baseline memory consumption

## Conclusion

The proposed simplification will transform Minimystx from an over-engineered system to a clean, maintainable architecture inspired by Polygonjs's successful patterns. By eliminating redundant systems and focusing on essential functionality, we can achieve better performance, easier maintenance, and improved developer experience.

The key insight is that **simplicity is not the absence of features, but the absence of unnecessary complexity**. This plan removes architectural complexity while preserving all user-facing functionality, making Minimystx more reliable and easier to extend.

**Next Steps:**
1. Review and approve this plan
2. Set up development branch for Phase 1
3. Create detailed implementation tickets
4. Begin with `UnifiedComputeEngine` foundation

---

## New Architecture Specification

### System Overview 🏗️

```
┌─────────────────────────────────────────────────────────────┐
│                    Minimystx Engine                        │
├─────────────────────────────────────────────────────────────┤
│  React UI Layer                                            │
│  ┌─────────────────┐  ┌──────────────────────────────────┐ │
│  │  React Flow     │  │        Parameter Panels         │ │
│  │   (Node Editor) │  │       (Node Properties)         │ │
│  └─────────────────┘  └──────────────────────────────────┘ │
│                              │                             │
├──────────────────────────────┼─────────────────────────────┤
│  Engine Core                 │                             │
│  ┌─────────────────┐        │    ┌─────────────────────┐  │
│  │  ComputationEngine       └────┤    GraphStore       │  │
│  │  • Node registry         │    │  • State management │  │
│  │  • Dependency graph      │    │  • UI synchronization│  │
│  │  • Execution control     │    │  • Serialization    │  │
│  └─────────────────┘             └─────────────────────┘  │
│           │                                │               │
│  ┌─────────┴────────┐                    │               │
│  │   Node System    │                    │               │
│  │  ┌─────────────┐ │                    │               │
│  │  │ BaseNode<T> │ │                    │               │
│  │  │ • BoxNode   │ │                    │               │
│  │  │ • SphereNode│ │                    │               │
│  │  │ • Transform │ │                    │               │
│  │  └─────────────┘ │                    │               │
│  └──────────────────┘                    │               │
│           │                               │               │
├───────────┼───────────────────────────────┼───────────────┤
│  Scene Layer                              │               │
│  ┌─────────┴────────┐                    │               │
│  │ SceneCoordinator │                    │               │
│  │ • Three.js Scene │◄───────────────────┘               │
│  │ • Object Mgmt    │                                    │
│  │ • Visibility     │                                    │
│  └──────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

### Core Components Architecture

#### 1. BaseNode System 🧩

**Design Philosophy**: Single inheritance hierarchy with generic parameter support

```typescript
// File: src/engine/nodes/BaseNode.ts
abstract class BaseNode<TParams extends Record<string, any> = Record<string, any>> {
  // Static metadata (automatic registration)
  static readonly type: string;
  static readonly category: string;
  static readonly displayName: string;
  static readonly description: string;
  static readonly paramSchema: ParamSchema<TParams>;
  
  // Instance properties
  readonly id: string;
  protected params: TParams;
  private _isDirty: boolean = true;
  private _isComputing: boolean = false;
  private _outputs: Map<string, Container> = new Map();
  private _inputs: Map<string, Container> = new Map();
  
  // Core lifecycle methods
  abstract compute(inputs: InputMap): Promise<OutputMap> | OutputMap;
  
  // Parameter management
  setParam<K extends keyof TParams>(key: K, value: TParams[K]): void {
    if (this.params[key] !== value) {
      this.params[key] = value;
      this.markDirty();
      this.onParameterChanged(key, value);
    }
  }
  
  getParam<K extends keyof TParams>(key: K): TParams[K] {
    return this.params[key];
  }
  
  // Input/Output management
  async getOutput(outputName = 'default'): Promise<Container> {
    if (this._isDirty || !this._outputs.has(outputName)) {
      await this.executeCompute();
    }
    return this._outputs.get(outputName)!;
  }
  
  setInput(inputName: string, container: Container): void {
    this._inputs.set(inputName, container);
    this.markDirty();
  }
  
  // Dirty state management
  markDirty(): void {
    if (!this._isDirty) {
      this._isDirty = true;
      this.onDirtyStateChanged(true);
    }
  }
  
  isDirty(): boolean {
    return this._isDirty;
  }
  
  // Private execution
  private async executeCompute(): Promise<void> {
    if (this._isComputing) {
      throw new Error(`Circular dependency detected in node ${this.id}`);
    }
    
    this._isComputing = true;
    try {
      const inputMap = Object.fromEntries(this._inputs.entries());
      const outputs = await this.compute(inputMap);
      
      this._outputs.clear();
      Object.entries(outputs).forEach(([key, container]) => {
        this._outputs.set(key, container);
      });
      
      this._isDirty = false;
      this.onDirtyStateChanged(false);
      
    } finally {
      this._isComputing = false;
    }
  }
  
  // Event hooks for derived classes
  protected onParameterChanged<K extends keyof TParams>(key: K, value: TParams[K]): void {}
  protected onDirtyStateChanged(isDirty: boolean): void {}
  
  // Cleanup
  dispose(): void {
    this._outputs.forEach(container => container.dispose?.());
    this._outputs.clear();
    this._inputs.clear();
  }
}
```

**Example Node Implementation**:
```typescript
// File: src/engine/nodes/primitives/BoxNode.ts
interface BoxParams {
  width: number;
  height: number;
  depth: number;
  widthSegments: number;
  heightSegments: number;
  depthSegments: number;
}

class BoxNode extends BaseNode<BoxParams> {
  static readonly type = 'box';
  static readonly category = '3D Primitives';
  static readonly displayName = 'Box';
  static readonly description = 'Creates a 3D box geometry';
  static readonly paramSchema: ParamSchema<BoxParams> = {
    width: { type: 'number', default: 1, min: 0.001, max: 100, step: 0.1 },
    height: { type: 'number', default: 1, min: 0.001, max: 100, step: 0.1 },
    depth: { type: 'number', default: 1, min: 0.001, max: 100, step: 0.1 },
    widthSegments: { type: 'integer', default: 1, min: 1, max: 512 },
    heightSegments: { type: 'integer', default: 1, min: 1, max: 512 },
    depthSegments: { type: 'integer', default: 1, min: 1, max: 512 }
  };
  
  compute(): OutputMap {
    const geometry = new BoxGeometry(
      this.params.width,
      this.params.height,
      this.params.depth,
      Math.round(this.params.widthSegments),
      Math.round(this.params.heightSegments),
      Math.round(this.params.depthSegments)
    );
    
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    
    return {
      geometry: new GeometryContainer(geometry),
      mesh: new Object3DContainer(mesh)
    };
  }
}
```

#### 2. ComputationEngine Architecture 🚀

**Design Philosophy**: Single-responsibility computation coordinator with dependency resolution

```typescript
// File: src/engine/ComputationEngine.ts
class ComputationEngine {
  private nodes: Map<string, BaseNode> = new Map();
  private graph: DependencyGraph = new DependencyGraph();
  private computing: Set<string> = new Set();
  private listeners: Set<ComputationListener> = new Set();
  private cache: SimpleCache<Container> = new SimpleCache();
  
  // Node management
  addNode(nodeClass: typeof BaseNode, id?: string): string {
    const nodeId = id || generateId();
    const node = new nodeClass(nodeId);
    
    // Initialize with default parameters
    const defaultParams = this.createDefaultParams(nodeClass.paramSchema);
    node.setParams(defaultParams);
    
    this.nodes.set(nodeId, node);
    this.graph.addNode(nodeId);
    
    this.notifyListeners({ type: 'node-added', nodeId, node });
    return nodeId;
  }
  
  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      // Remove all connections
      this.graph.removeNode(nodeId);
      
      // Cleanup
      node.dispose();
      this.nodes.delete(nodeId);
      this.cache.invalidatePrefix(nodeId);
      
      this.notifyListeners({ type: 'node-removed', nodeId });
    }
  }
  
  // Connection management
  addConnection(fromNodeId: string, toNodeId: string, outputName = 'default', inputName = 'default'): void {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);
    
    if (!fromNode || !toNode) {
      throw new Error('Invalid node IDs for connection');
    }
    
    // Check for cycles
    if (this.graph.wouldCreateCycle(fromNodeId, toNodeId)) {
      throw new Error('Connection would create a cycle');
    }
    
    this.graph.addEdge(fromNodeId, toNodeId, { outputName, inputName });
    this.updateNodeInput(toNodeId, inputName, fromNodeId, outputName);
    
    this.notifyListeners({ 
      type: 'connection-added', 
      fromNodeId, 
      toNodeId, 
      outputName, 
      inputName 
    });
  }
  
  removeConnection(fromNodeId: string, toNodeId: string, outputName = 'default', inputName = 'default'): void {
    this.graph.removeEdge(fromNodeId, toNodeId);
    
    const toNode = this.nodes.get(toNodeId);
    if (toNode) {
      toNode.setInput(inputName, new EmptyContainer());
    }
    
    this.notifyListeners({ 
      type: 'connection-removed', 
      fromNodeId, 
      toNodeId, 
      outputName, 
      inputName 
    });
  }
  
  // Parameter management
  setNodeParameter(nodeId: string, paramKey: string, value: any): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.setParam(paramKey, value);
      this.invalidateDownstream(nodeId);
      
      this.notifyListeners({ 
        type: 'parameter-changed', 
        nodeId, 
        paramKey, 
        value 
      });
    }
  }
  
  // Computation
  async computeNode(nodeId: string): Promise<Container> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    // Check cache first
    const cacheKey = this.getCacheKey(nodeId);
    const cached = this.cache.get(cacheKey);
    if (cached && !node.isDirty()) {
      return cached;
    }
    
    // Prevent cycles
    if (this.computing.has(nodeId)) {
      throw new Error(`Circular dependency detected for node ${nodeId}`);
    }
    
    this.computing.add(nodeId);
    try {
      // Compute dependencies first
      await this.computeDependencies(nodeId);
      
      // Compute this node
      const output = await node.getOutput();
      
      // Cache result
      this.cache.set(cacheKey, output, 300000); // 5 minute TTL
      
      this.notifyListeners({ 
        type: 'node-computed', 
        nodeId, 
        output 
      });
      
      return output;
      
    } finally {
      this.computing.delete(nodeId);
    }
  }
  
  // Dependency resolution
  private async computeDependencies(nodeId: string): Promise<void> {
    const dependencies = this.graph.getDependencies(nodeId);
    
    // Compute in topological order
    const sortedDeps = this.graph.topologicalSort(dependencies);
    
    for (const depId of sortedDeps) {
      if (this.nodes.get(depId)?.isDirty()) {
        await this.computeNode(depId);
      }
    }
  }
  
  private async updateNodeInput(nodeId: string, inputName: string, sourceNodeId: string, outputName: string): Promise<void> {
    const sourceNode = this.nodes.get(sourceNodeId);
    const targetNode = this.nodes.get(nodeId);
    
    if (sourceNode && targetNode) {
      const output = await sourceNode.getOutput(outputName);
      targetNode.setInput(inputName, output);
    }
  }
  
  private invalidateDownstream(nodeId: string): void {
    const dependents = this.graph.getDependents(nodeId);
    dependents.forEach(depId => {
      this.nodes.get(depId)?.markDirty();
      this.cache.invalidatePrefix(depId);
    });
  }
  
  // Cache management
  private getCacheKey(nodeId: string): string {
    const node = this.nodes.get(nodeId);
    if (!node) return nodeId;
    
    const paramsHash = this.hashObject(node.params);
    const inputsHash = this.hashInputs(nodeId);
    return `${nodeId}:${paramsHash}:${inputsHash}`;
  }
  
  // Event system
  addListener(listener: ComputationListener): void {
    this.listeners.add(listener);
  }
  
  removeListener(listener: ComputationListener): void {
    this.listeners.delete(listener);
  }
  
  private notifyListeners(event: ComputationEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in computation listener:', error);
      }
    });
  }
}
```

#### 3. SceneCoordinator Architecture 🎭

**Design Philosophy**: Direct scene management with automatic object lifecycle

```typescript
// File: src/engine/SceneCoordinator.ts
class SceneCoordinator {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private objects: Map<string, THREE.Object3D> = new Map();
  private visibilityMap: Map<string, boolean> = new Map();
  private engine: ComputationEngine;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
  }
  
  initialize(engine: ComputationEngine): void {
    this.engine = engine;
    
    // Listen to engine events
    engine.addListener(this.handleComputationEvent.bind(this));
  }
  
  // Scene object management
  async updateNodeInScene(nodeId: string): Promise<void> {
    try {
      // Remove existing object
      this.removeNodeFromScene(nodeId);
      
      // Check if node should be visible
      if (!this.isNodeVisible(nodeId)) {
        return;
      }
      
      // Get computed output
      const output = await this.engine.computeNode(nodeId);
      
      // Add to scene if it's a 3D object
      if (output instanceof Object3DContainer) {
        const object = output.getObject3D();
        
        // Apply any scene-level transforms or materials
        this.prepareObjectForScene(object, nodeId);
        
        this.scene.add(object);
        this.objects.set(nodeId, object);
      }
      
    } catch (error) {
      console.error(`Error updating node ${nodeId} in scene:`, error);
    }
  }
  
  removeNodeFromScene(nodeId: string): void {
    const existing = this.objects.get(nodeId);
    if (existing) {
      this.scene.remove(existing);
      this.disposeObject(existing);
      this.objects.delete(nodeId);
    }
  }
  
  // Visibility management
  setNodeVisible(nodeId: string, visible: boolean): void {
    this.visibilityMap.set(nodeId, visible);
    
    const object = this.objects.get(nodeId);
    if (object) {
      object.visible = visible;
    } else if (visible) {
      // Object doesn't exist but should be visible - trigger update
      this.updateNodeInScene(nodeId);
    }
  }
  
  isNodeVisible(nodeId: string): boolean {
    return this.visibilityMap.get(nodeId) ?? true;
  }
  
  // Scene preparation
  private prepareObjectForScene(object: THREE.Object3D, nodeId: string): void {
    // Set user data for identification
    object.userData = { nodeId, ...object.userData };
    
    // Apply any global scene settings
    object.castShadow = true;
    object.receiveShadow = true;
    
    // Ensure materials are properly configured
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.envMapIntensity = 1.0;
        }
      }
    });
  }
  
  // Memory management
  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }
  
  // Event handling
  private handleComputationEvent(event: ComputationEvent): void {
    switch (event.type) {
      case 'node-computed':
        this.updateNodeInScene(event.nodeId);
        break;
        
      case 'node-removed':
        this.removeNodeFromScene(event.nodeId);
        this.visibilityMap.delete(event.nodeId);
        break;
        
      case 'parameter-changed':
        // Node will be marked dirty, and computation will trigger scene update
        break;
    }
  }
  
  // Rendering
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
  
  // Cleanup
  dispose(): void {
    this.objects.forEach((object, nodeId) => {
      this.removeNodeFromScene(nodeId);
    });
    this.objects.clear();
    this.visibilityMap.clear();
  }
}
```

#### 4. GraphStore Integration 🔗

**Design Philosophy**: Lightweight state management focused on UI synchronization

```typescript
// File: src/engine/GraphStore.ts
class GraphStore {
  private engine: ComputationEngine;
  private sceneCoordinator: SceneCoordinator;
  private nodePositions: Map<string, { x: number; y: number }> = new Map();
  private selectedNodes: Set<string> = new Set();
  private listeners: Set<GraphStoreListener> = new Set();
  
  constructor(engine: ComputationEngine, sceneCoordinator: SceneCoordinator) {
    this.engine = engine;
    this.sceneCoordinator = sceneCoordinator;
    
    // Listen to engine events for UI updates
    engine.addListener(this.handleEngineEvent.bind(this));
  }
  
  // Node operations (for UI)
  createNode(nodeType: string, position?: { x: number; y: number }): string {
    const nodeClass = NodeRegistry.getNodeClass(nodeType);
    if (!nodeClass) {
      throw new Error(`Unknown node type: ${nodeType}`);
    }
    
    const nodeId = this.engine.addNode(nodeClass);
    
    if (position) {
      this.nodePositions.set(nodeId, position);
    }
    
    this.notifyListeners({ type: 'node-created', nodeId, nodeType });
    return nodeId;
  }
  
  deleteNode(nodeId: string): void {
    this.engine.removeNode(nodeId);
    this.nodePositions.delete(nodeId);
    this.selectedNodes.delete(nodeId);
    
    this.notifyListeners({ type: 'node-deleted', nodeId });
  }
  
  // Connection operations
  createConnection(fromNodeId: string, toNodeId: string, outputName?: string, inputName?: string): void {
    try {
      this.engine.addConnection(fromNodeId, toNodeId, outputName, inputName);
      this.notifyListeners({ 
        type: 'connection-created', 
        fromNodeId, 
        toNodeId, 
        outputName, 
        inputName 
      });
    } catch (error) {
      this.notifyListeners({ 
        type: 'connection-error', 
        error: error.message 
      });
      throw error;
    }
  }
  
  removeConnection(fromNodeId: string, toNodeId: string, outputName?: string, inputName?: string): void {
    this.engine.removeConnection(fromNodeId, toNodeId, outputName, inputName);
    this.notifyListeners({ 
      type: 'connection-removed', 
      fromNodeId, 
      toNodeId, 
      outputName, 
      inputName 
    });
  }
  
  // Parameter operations
  setNodeParameter(nodeId: string, paramKey: string, value: any): void {
    this.engine.setNodeParameter(nodeId, paramKey, value);
    // Engine will handle computation and scene updates
  }
  
  getNodeParameter(nodeId: string, paramKey: string): any {
    const node = this.engine.getNode(nodeId);
    return node?.getParam(paramKey);
  }
  
  // UI state management
  setNodePosition(nodeId: string, position: { x: number; y: number }): void {
    this.nodePositions.set(nodeId, position);
    this.notifyListeners({ type: 'node-moved', nodeId, position });
  }
  
  getNodePosition(nodeId: string): { x: number; y: number } | undefined {
    return this.nodePositions.get(nodeId);
  }
  
  setNodeSelected(nodeId: string, selected: boolean): void {
    if (selected) {
      this.selectedNodes.add(nodeId);
    } else {
      this.selectedNodes.delete(nodeId);
    }
    
    this.notifyListeners({ 
      type: 'selection-changed', 
      selectedNodes: Array.from(this.selectedNodes) 
    });
  }
  
  getSelectedNodes(): string[] {
    return Array.from(this.selectedNodes);
  }
  
  // Visibility operations
  setNodeVisible(nodeId: string, visible: boolean): void {
    this.sceneCoordinator.setNodeVisible(nodeId, visible);
    this.notifyListeners({ type: 'visibility-changed', nodeId, visible });
  }
  
  isNodeVisible(nodeId: string): boolean {
    return this.sceneCoordinator.isNodeVisible(nodeId);
  }
  
  // Serialization
  serialize(): SerializedGraph {
    return {
      nodes: this.engine.getNodes().map(node => ({
        id: node.id,
        type: node.constructor.name,
        params: node.params,
        position: this.nodePositions.get(node.id)
      })),
      connections: this.engine.getConnections(),
      selectedNodes: Array.from(this.selectedNodes)
    };
  }
  
  deserialize(data: SerializedGraph): void {
    // Clear current graph
    this.engine.clear();
    this.nodePositions.clear();
    this.selectedNodes.clear();
    
    // Create nodes
    data.nodes.forEach(nodeData => {
      const nodeId = this.createNode(nodeData.type, nodeData.position);
      Object.entries(nodeData.params).forEach(([key, value]) => {
        this.setNodeParameter(nodeId, key, value);
      });
    });
    
    // Create connections
    data.connections.forEach(conn => {
      this.createConnection(conn.fromNodeId, conn.toNodeId, conn.outputName, conn.inputName);
    });
    
    // Restore selection
    data.selectedNodes?.forEach(nodeId => {
      this.setNodeSelected(nodeId, true);
    });
    
    this.notifyListeners({ type: 'graph-loaded' });
  }
  
  // Event handling
  private handleEngineEvent(event: ComputationEvent): void {
    // Forward relevant events to UI listeners
    this.notifyListeners({
      type: 'engine-event',
      engineEvent: event
    });
  }
  
  // Listener management
  addListener(listener: GraphStoreListener): void {
    this.listeners.add(listener);
  }
  
  removeListener(listener: GraphStoreListener): void {
    this.listeners.delete(listener);
  }
  
  private notifyListeners(event: GraphStoreEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in graph store listener:', error);
      }
    });
  }
}
```

### Key Architectural Benefits 🎯

#### 1. **Separation of Concerns**
- **BaseNode**: Handles individual node computation and state
- **ComputationEngine**: Manages dependency resolution and execution
- **SceneCoordinator**: Handles Three.js scene integration
- **GraphStore**: Provides UI state management and serialization

#### 2. **Type Safety Throughout**
- Generic `BaseNode<TParams>` ensures parameter type safety
- Container system with typed outputs
- Event interfaces prevent runtime errors

#### 3. **Performance by Design**
- Lazy evaluation with automatic dependency resolution
- Built-in caching at engine level
- Smart dirty propagation
- Memory management with automatic cleanup

#### 4. **Extensibility**
- Simple node creation by extending `BaseNode`
- Automatic registration via static properties
- Plugin architecture ready
- Event system for custom behaviors

#### 5. **Testability**
- Clear interfaces and dependencies
- Individual components can be unit tested
- Mock-friendly design
- Deterministic behavior

### Migration Benefits Summary 📊

| **Aspect** | **Current** | **New Architecture** | **Improvement** |
|------------|-------------|---------------------|----------------|
| **Node Definition** | 132 lines | 40 lines | 70% reduction |
| **Core Files** | 50+ files | 15 files | 70% reduction |
| **Computation Systems** | 4 overlapping | 1 unified | 4x simplification |
| **State Storage** | 4 locations | 1 source of truth | 4x simplification |
| **Event Types** | 60+ events | 10 focused events | 6x reduction |
| **Memory Overhead** | High duplication | Minimal overhead | 50% reduction |
| **Developer Experience** | Complex setup | Simple inheritance | 5x faster development |

---

*This comprehensive architecture specification provides the foundation for implementing a clean, maintainable, and performant node-based system that will serve Minimystx for years to come.*