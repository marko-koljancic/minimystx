# Minimystx Container System Implementation Plan

## Executive Summary
This document outlines the complete implementation plan for modernizing Minimystx's container system based on analysis of the current codebase and PolygonJS architecture patterns. The goal is to eliminate legacy code patterns and implement a clean, type-safe container system for all nodes.

## Current State Analysis

### Problem Statement
The application is experiencing console errors when creating subflow nodes:
```
RenderConeScheduler.ts:388 Could not create container for legacy output: 
Error: Cannot auto-detect container type for value: [object Object]
```

### Root Cause
1. **Legacy Output Pattern**: Nodes currently return raw objects like `{ object: Object3D, geometry: BufferGeometry }`
2. **Mixed Patterns**: Both `compute` (legacy) and `computeTyped` (new) functions exist
3. **Band-aid Solutions**: `LegacyCompatibility.ts` was created but never integrated
4. **Inconsistent Handling**: ContainerFactory.auto() has complex legacy detection logic

### Current Implementation Status
-  Container classes implemented (BaseContainer, GeometryContainer, Object3DContainer, etc.)
-  RenderConeScheduler supports typed compute functions
-  Enhanced error logging in place
- L Nodes still use legacy output format
- L LegacyCompatibility.ts exists but unused
- L Mixed compute patterns causing confusion

## Architecture Decisions

Based on PolygonJS analysis and requirements discussion:

### 1. Container Output Pattern
**Decision: Single Container Output**
```typescript
// Standard output format for all nodes
{ default: BaseContainer }

// Example for geometry nodes
{ default: Object3DContainer }
```

**Rationale:**
- PolygonJS uses single container per node (CoreGroup)
- Simplifies connection validation
- Object3D already contains geometry reference
- Cleaner data flow architecture

### 2. Input Handling
**Decision: Container-based Inputs**
```typescript
// Nodes receive containers, not raw values
computeTyped(
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer>
```

**Rationale:**
- Type safety throughout pipeline
- Consistent with PolygonJS pattern
- Enables metadata tracking
- Supports proper type coercion

### 3. Clone Strategy
**Decision: Hybrid Approach with Explicit Control**

Implement `InputCloneMode` enum:
```typescript
enum InputCloneMode {
  ALWAYS = 'always',      // Always clone inputs
  NEVER = 'never',        // Never clone (performance)
  FROM_NODE = 'from_node' // Node decides based on params
}
```

**Default Behaviors:**
- Geometry creation nodes: Always create new containers
- Transform/modifier nodes: Modify in-place (NEVER)
- Nodes can override based on requirements

### 4. Error Handling
**Decision: Graceful Fallback**
- Container creation failures log warnings but don't crash
- Future: Surface status messages near nodes (Ok, No Data, Error)
- Development mode shows detailed error context

## Implementation Requirements

### Phase 1: Clean Up Legacy Code
1. **Delete unnecessary files:**
   - `src/engine/containers/LegacyCompatibility.ts`

2. **Simplify ContainerFactory.auto():**
   - Remove complex legacy object detection
   - Only handle direct Three.js types and primitives
   - Throw clear errors for unsupported types

### Phase 2: Update Node System

#### 2.1 Update geometryFactories.ts
```typescript
// OLD - Returns raw objects
export function createGeometryMesh(data, geometry, input?) {
  return { object: mesh, geometry };
}

// NEW - Returns container
export function createGeometryMesh(data, geometry, input?): Object3DContainer {
  const mesh = new Mesh(geometry, material);
  // ... setup mesh ...
  return new Object3DContainer(mesh);
}
```

#### 2.2 Convert All Geometry Nodes
Update each node to use computeTyped pattern:

```typescript
// Example: Sphere.ts
export const sphereNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
  const data = buildNodeData(params);
  const geometry = createSphereGeometry(data);
  const container = createGeometryMesh(data, geometry);
  return { default: container };
};
```

Nodes to update:
- Geometry/Sphere.ts
- Geometry/Box.ts
- Geometry/Cylinder.ts
- Geometry/Cone.ts
- Geometry/Plane.ts
- Geometry/Torus.ts
- Geometry/TorusKnot.ts
- Geometry/ImportGltf.ts
- Geometry/ImportObj.ts
- Transform nodes
- All subflow nodes

### Phase 3: Update Node Registry

#### 3.1 Modify Registration Pattern
```typescript
// In nodeRegistry.ts
interface NodeDefinition {
  type: string;
  category: NodeCategory;
  computeTyped: ComputeTypedFunction; // Required
  // Remove legacy 'compute' field
  defaultParams: NodeParams;
  inputCloneMode?: InputCloneMode;
}
```

#### 3.2 Update All Node Registrations
```typescript
registerNode({
  type: 'sphere',
  category: NodeCategory.GEOMETRY,
  computeTyped: sphereNodeComputeTyped, // Use typed version
  defaultParams: sphereNodeParams,
  inputCloneMode: InputCloneMode.NEVER
});
```

### Phase 4: Update RenderConeScheduler

#### 4.1 Remove Legacy Handling
```typescript
// Remove this entire block
if (nodeDefinition.compute) {
  const legacyOutput = await nodeDefinition.compute(params);
  // ... legacy conversion attempts ...
}

// Keep only typed computation
if (nodeDefinition.computeTyped) {
  result = await nodeDefinition.computeTyped(params, inputs, context);
}
```

### Phase 5: Implement InputCloneMode

#### 5.1 Add Clone Mode Support
```typescript
// In ComputeContext or node processing
function prepareInputs(
  inputs: Record<string, BaseContainer>,
  cloneMode: InputCloneMode
): Record<string, BaseContainer> {
  if (cloneMode === InputCloneMode.ALWAYS) {
    return cloneInputContainers(inputs);
  }
  return inputs; // Reference for NEVER or FROM_NODE
}
```

## Migration Strategy

### Step-by-Step Process
1. **Start with one node type** (e.g., Sphere)
2. **Update its compute function** to computeTyped
3. **Test in isolation**
4. **Update registry entry**
5. **Verify in flow editor**
6. **Repeat for all nodes**

### Testing Checklist per Node
- [ ] Node creates without errors
- [ ] Parameters update correctly
- [ ] Connections work as expected
- [ ] 3D viewport displays geometry
- [ ] No console errors
- [ ] Performance acceptable

## Testing Plan

### Unit Tests
```typescript
describe('Container System', () => {
  test('Sphere node outputs Object3DContainer', () => {
    const result = sphereNodeComputeTyped(params, {}, context);
    expect(result.default).toBeInstanceOf(Object3DContainer);
  });
  
  test('Transform node modifies input container', () => {
    const input = { default: new Object3DContainer(mesh) };
    const result = transformNodeComputeTyped(params, input, context);
    expect(result.default).toBe(input.default); // Same reference
  });
});
```

### Integration Tests
1. Create flow with multiple geometry nodes
2. Connect nodes with transforms
3. Verify data flows correctly
4. Check performance metrics
5. Test subflow nodes specifically

### Manual Testing
1. Create each node type via UI
2. Modify parameters
3. Connect nodes in various configurations
4. Test subflow creation
5. Monitor console for errors

## Success Criteria

### Must Have
-  No console errors when creating any node type
-  All nodes use computeTyped pattern
-  Consistent container output format
-  Type-safe connections between nodes
-  Subflow nodes work correctly

### Nice to Have
- Performance improvements from in-place modifications
- Better error messages for users
- Visual status indicators on nodes
- Automatic type coercion between compatible types

## Implementation Timeline

### Week 1
- Day 1-2: Clean up legacy code, simplify ContainerFactory
- Day 3-4: Update geometryFactories and first 3 nodes
- Day 5: Test and debug first nodes

### Week 2  
- Day 1-3: Convert remaining geometry nodes
- Day 4-5: Update transform and modifier nodes

### Week 3
- Day 1-2: Update node registry and scheduler
- Day 3-4: Implement InputCloneMode system
- Day 5: Integration testing

### Week 4
- Day 1-2: Fix any remaining issues
- Day 3-4: Performance optimization
- Day 5: Documentation and cleanup

## Risk Mitigation

### Potential Issues
1. **Risk**: Breaking existing flows
   - **Mitigation**: Test each node type thoroughly before moving to next

2. **Risk**: Performance degradation
   - **Mitigation**: Implement InputCloneMode for performance control

3. **Risk**: Unexpected edge cases
   - **Mitigation**: Comprehensive error logging and graceful fallbacks

## Conclusion

This plan provides a clear path to modernize Minimystx's container system. By following PolygonJS's proven patterns and eliminating legacy code, we'll achieve:

1. **Clean Architecture**: Single pattern for all nodes
2. **Type Safety**: Containers throughout the pipeline
3. **Performance**: Controlled cloning behavior
4. **Maintainability**: No legacy compatibility debt
5. **Reliability**: No more console errors

The implementation is straightforward since we're not maintaining backward compatibility. This is the ideal time to make these changes before any public release.

## Appendix: Code Examples

### Example: Complete Node Conversion

```typescript
// Before: Sphere.ts with legacy pattern
export const sphereNodeCompute = (params) => {
  const geometry = new SphereGeometry(...);
  const mesh = new Mesh(geometry, material);
  return { object: mesh, geometry }; // Legacy format
};

// After: Sphere.ts with container pattern  
export const sphereNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
  const geometry = new SphereGeometry(
    params.geometry.radius,
    params.geometry.widthSegments,
    params.geometry.heightSegments
  );
  
  const material = params.rendering.material || new MeshStandardMaterial();
  const mesh = new Mesh(geometry, material);
  
  // Apply properties
  mesh.visible = params.rendering.visible !== false;
  mesh.castShadow = params.rendering.castShadow ?? false;
  mesh.receiveShadow = params.rendering.receiveShadow ?? false;
  
  // Return container
  return { 
    default: new Object3DContainer(mesh) 
  };
};
```

### Example: Transform Node with InputCloneMode

```typescript
export const transformNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
  const inputContainer = inputs.default as Object3DContainer;
  
  // Determine clone behavior
  const shouldClone = context.inputCloneMode === InputCloneMode.ALWAYS ||
    (context.inputCloneMode === InputCloneMode.FROM_NODE && params.general.clone);
  
  const container = shouldClone 
    ? inputContainer.clone() 
    : inputContainer;
  
  // Apply transform
  const object = container.value;
  object.position.set(params.transform.position.x, ...);
  object.rotation.set(params.transform.rotation.x, ...);
  object.scale.set(params.transform.scale.x, ...);
  
  return { default: container };
};
```

---

*Document Version: 1.0*  
*Date: 2025-01-09*  
*Status: Ready for Implementation*