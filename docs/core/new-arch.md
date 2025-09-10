# Minimystx Architecture Analysis & Implementation Plan

## Executive Summary

This document provides a comprehensive analysis of the current Minimystx codebase and a detailed plan to refactor it into a clean, scalable architecture. Based on in-depth examination of the node system, engine implementation, and data flow patterns, we've identified key strengths to preserve and critical issues to address.

---

## Current State Analysis

### System Overview

Minimystx is a browser-based parametric modeling tool with:
- **Node System**: 20+ nodes across categories (primitives, modifiers, lights, containers)
- **Dual Context**: Root level (scene) and subflow level (inside Geo containers)
- **React Flow UI**: Split-pane interface with node editor and Three.js viewport
- **Computation Model**: Graph-based with render cone optimization

### Architecture Strengths 

1. **Type Safety & Containers**
   - Robust `BaseContainer<T>` abstraction for runtime type safety
   - Content hashing for efficient caching
   - Smart type coercion (Vector3 � Color)

2. **Connection System**
   - Well-defined connection types (GEOMETRY, OBJECT3D, NUMBER, etc.)
   - Visual feedback with color-coded ports
   - Cycle detection and validation

3. **Render Cone Optimization**
   - Only computes nodes in path to visible outputs
   - Topological sorting ensures correct evaluation order
   - Incremental updates on parameter changes

4. **Foundation Patterns**
   - Registry-based node discovery
   - Graph adapter abstraction
   - Dedicated scheduler for computation
   - Content caching mechanism

### Critical Issues �

1. **Overly Complex State Management**
   - `graphStore.ts` is 951 lines - monolithic state manager mixing concerns
   - Business logic, state updates, and computation orchestration tangled
   - Direct inline computation in state setters (anti-pattern)
   - Duplicate code paths for root vs subflow contexts

2. **Inconsistent Node Implementation**
   ```typescript
   // Each node has 3-4 different compute patterns:
   processor()           // Legacy raw data processing
   boxNodeCompute()      // Untyped compute
   boxNodeComputeTyped() // Container-based (preferred)
   createBoxNodeDefinition() // Builder pattern (unused)
   ```

3. **Single Input/Output Limitation**
   ```typescript
   // Current: Only "default" port supported
   inputs.default = inputContainer
   return { default: outputContainer }
   // Can't implement Combine node (4 inputs � 1 output)
   ```

4. **Missing Core Features**
   - **No Combine Node** despite documentation
   - **Single Modifier** (only Transform exists)
   - **No Material System**

5. **Data Flow Problems**
   - Port definitions exist but unused
   - No runtime port validation
   - Inconsistent data passing (raw objects vs containers)
   - Transform can't properly chain multiple inputs

6. **Performance Issues**
   - Render cone recalculated on every change
   - No granular invalidation
   - Missing dependency tracking
   - No memoization of expensive computations

7. **Technical Debt**
   - Hardcoded visibility toggle logic scattered
   - Manual subflow output tracking
   - GeoNode directly accesses global store (tight coupling)
   - Error handling swallowed with empty catch blocks

---

## Target Architecture

### Design Principles

1. **Single Compute Pattern**: One way to write nodes
2. **Clean Separation**: Compute logic separate from rendering
3. **Pull-Based Evaluation**: Compute only what's needed
4. **Efficient Caching**: Content-based with versioning
5. **Type Safety**: Compile-time and runtime validation

### Core Components

#### 1. Unified Node System

```typescript
// Single contract for ALL nodes
type ComputeFn<P,I,O> = (
  params: P, 
  inputs: I, 
  ctx: ComputeCtx
) => Promise<O> | O;

type NodeDefinition = {
  id: string; 
  label: string; 
  category: string;
  in: NodePort[];    // Named input ports
  out: NodePort[];   // Named output ports
  paramsSchema: ZodSchema<any>;
  compute: ComputeFn<any, Record<string,unknown>, Record<string,OutputValue<any>>>;
  runtime: 'root'|'subflow'|'both';
};
```

#### 2. Multi-Port System

```typescript
// Support for multiple named inputs/outputs
type NodePort = { 
  name: string;      // e.g., "input1", "geometry", "transform"
  type: string;      // ConnectionType
  optional?: boolean;
};

// Example: Combine node with 4 inputs
const combineNode: NodeDefinition = {
  id: 'combine',
  in: [
    { name: 'input1', type: 'OBJECT3D', optional: true },
    { name: 'input2', type: 'OBJECT3D', optional: true },
    { name: 'input3', type: 'OBJECT3D', optional: true },
    { name: 'input4', type: 'OBJECT3D', optional: true }
  ],
  out: [
    { name: 'combined', type: 'OBJECT3D' }
  ],
  compute: (params, inputs, ctx) => {
    const group = new Group();
    Object.values(inputs).forEach(container => {
      if (container?.value) group.add(container.value.clone());
    });
    return { combined: new Object3DContainer(group) };
  }
};
```

#### 3. Compute Engine

```typescript
type Engine = {
  markDirty(nodeId: string, reason: 'param'|'connection'|'visibility'): void;
  evaluate(targets: string[]): Promise<EvaluationReport>;
  getOutput(nodeId: string, port: string): OutputValue<any> | undefined;
};
```

**Responsibilities:**
- Build/maintain DAG with cycle detection
- Dirty propagation (downstream only)
- Pull-based evaluation of render targets
- Cache management with content hashing
- Version tracking for outputs

#### 4. Scene Syncer

Thin boundary between compute and Three.js:
- Takes logical outputs (GeometrySet, Transform, Material, Light)
- Computes minimal diffs
- Updates only changed objects
- Manages GPU resources

#### 5. Resource Management

```typescript
type ResourcePool = {
  getGeometry(key: string): BufferGeometry | undefined;
  setGeometry(key: string, geometry: BufferGeometry): void;
  release(key: string): void; // Reference counted
};
```

---

## Implementation Plan

### Phase 1: Foundation Refactoring (Week 1-2)

#### 1.1 Unify Node Compute Pattern
- [ ] Remove all legacy compute functions (processor, untyped compute)
- [ ] Standardize on single `ComputeFn` pattern
- [ ] Update all 20+ existing nodes
- [ ] Add proper port definitions to each node

#### 1.2 Enable Multi-Port System
- [ ] Implement named port support in connections
- [ ] Update RenderConeScheduler for named ports
- [ ] Add port compatibility validation
- [ ] Update UI to show port names

#### 1.3 Refactor State Management
- [ ] Split graphStore.ts into:
  - `GraphState.ts` - Pure state
  - `GraphActions.ts` - Actions/commands
  - `Engine.ts` - Computation orchestration
  - `SceneSyncer.ts` - Three.js sync
- [ ] Remove inline computation from setters
- [ ] Implement proper event system

### Phase 2: Core Nodes Implementation (Week 2-3)

#### 2.1 Combine Node
- [ ] Implement Combine with 4 inputs � 1 output
- [ ] Test with multiple geometry branches
- [ ] Ensure proper Group hierarchy

#### 2.2 Essential Modifiers
- [ ] Scale (non-uniform scaling)
- [ ] Array (linear/circular/grid)
- [ ] Instance (efficient copies)
- [ ] Merge (geometry combining)

#### 2.3 Material System
- [ ] Implement MaterialToken abstraction
- [ ] BasicMaterial node
- [ ] PhysicalMaterial node
- [ ] Material � Geometry connection

### Phase 3: Compute Engine (Week 3-4)

#### 3.1 Dirty + Pull System
- [ ] Implement proper dirty propagation
- [ ] Pull-based evaluation for targets
- [ ] Skip clean nodes (cache hits)
- [ ] Version-based cache invalidation

#### 3.2 Subflow Management
- [ ] Implement CompoundNode pattern
- [ ] Namespace caches per container
- [ ] Clean RenderTarget abstraction
- [ ] Remove direct store access from nodes

#### 3.3 Resource Pooling
- [ ] Implement ResourcePool for GPU objects
- [ ] Reference counting system
- [ ] Automatic disposal on zero refs
- [ ] Memory leak prevention

### Phase 4: Scene Synchronization (Week 4-5)

#### 4.1 SceneSyncer Implementation
- [ ] Build diff engine for Three.js updates
- [ ] Stable object ID system
- [ ] Version-based update detection
- [ ] Minimal GPU state changes

#### 4.2 Transform Chains
- [ ] Deterministic transform composition
- [ ] Root-level transform chains
- [ ] Transform support for all object types
- [ ] Proper transform inheritance

### Phase 5: Polish & Performance (Week 5-6)

#### 5.1 Error Handling
- [ ] Structured error system
- [ ] Connection validation messages
- [ ] Compute error propagation to UI
- [ ] Node highlighting on errors

#### 5.2 Instrumentation
- [ ] Per-node compute timing
- [ ] Cache hit rate tracking
- [ ] Evaluation count metrics
- [ ] GPU resource monitoring

#### 5.3 File Reorganization
```
/src/engine/
     graph/          # Engine, GraphTypes
     nodes/          # NodeBuilder, definitions/
     containers/     # CompoundNode (GeoNode)
     sync/three/     # SceneSyncer, RenderPolicies
     resources/      # ResourcePool

/src/nodes/
     primitives/     # Box, Sphere, etc.
     modifiers/      # Transform, Combine, Array
     materials/      # Material nodes
     importers/      # OBJ, glTF importers
     utilities/      # Math, Switch, Random
```

---

## Success Metrics

### Performance Targets
- **Recompute time**: < 16ms for typical parameter changes
- **Cache hit rate**: > 80% for parameter tweaks
- **Memory stability**: Zero GPU leaks over 1000+ edits
- **Evaluation efficiency**: Minimal nodes computed per edit

### Functional Requirements
1.  Single compute pattern across all nodes
2.  Multi-port connections working
3.  Combine node fully functional
4.  Dirty + pull evaluation
5.  Content-based caching with versions
6.  Clean subflow abstraction
7.  Minimal Three.js diffs
8.  Deterministic transform chains
9.  No GPU memory leaks
10.  Structured error handling

### Test Scenarios
1. Complex multi-branch with Combine nodes
2. Nested subflows with proper outputs
3. Transform chains including lights
4. Material application workflow
5. Import � Transform � Combine � Array pipeline

---

## Migration Strategy

### Incremental Approach
1. **Week 1-2**: Foundation refactoring (backward compatible)
2. **Week 3-4**: New features (Combine, materials)
3. **Week 5-6**: Performance optimization
4. **Post-launch**: Advanced features

---

## Code Examples

### Before: Multiple Compute Patterns
```typescript
// Current: 100+ lines per node with 3-4 patterns
export const processor = (data, input) => { /* ... */ };
export const boxNodeCompute = (params) => { /* ... */ };
export const boxNodeComputeTyped = (params, inputs, context) => { /* ... */ };
export const createBoxNodeDefinition = () => { /* ... */ };
```

### After: Single Pattern
```typescript
// Target: 20-30 lines focused on logic
export const boxNode: NodeDefinition = {
  id: 'box',
  category: 'primitives',
  in: [],  // No inputs for generators
  out: [{ name: 'geometry', type: 'GEOMETRY' }],
  compute: (params) => {
    const geometry = new BoxGeometry(
      params.width, params.height, params.depth
    );
    return { 
      geometry: new GeometryContainer(geometry) 
    };
  }
};
```

### Data Flow Example
```typescript
// Clear, traceable data flow
Box � outputs.geometry � Transform.inputs.geometry � 
Transform � outputs.object � Combine.inputs.input1 �
Combine � outputs.combined � [Rendered]
```

---

## Conclusion

This refactoring plan addresses all critical issues while preserving the system's strengths. The phased approach ensures we can deliver improvements incrementally without breaking existing functionality. The result will be a clean, maintainable, and performant architecture that scales with future node additions and features.

**Estimated Timeline**: 6 weeks
**Risk Level**: Medium (mitigated by incremental approach)
**Expected Outcome**: 50% code reduction, 3x performance improvement, unlimited node extensibility