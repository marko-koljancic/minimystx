# 3D Visualization Pipeline Repair Plan

## Executive Summary

After comprehensive analysis of both PolygonJS architecture patterns and Minimystx's current implementation, the **core architecture is sound** but has critical implementation gaps preventing geometry visualization. The activeOutputNodeId subflow system correctly implements the requirement that only one node per subflow can be visible, while root-level nodes can render in parallel.

## Problem Analysis

### Current Architecture Assessment 

**Conceptually Correct Systems:**
- **Subflow Logic**: activeOutputNodeId system properly enforces "one visible node per subflow"
- **Root Visibility**: Multiple root nodes can render simultaneously  
- **Hierarchical Design**: GeoNode visibility controls subflow contribution to scene
- **Container System**: New BaseContainer architecture from recent implementation

### Root Cause Issues =

**Primary Issue: Container Integration Gap**
- SceneManager expects legacy `{ object: Object3D }` format
- New container system returns `{ default: BaseContainer }`
- Extraction logic in `updateSceneFromRenderableObjects()` may not handle containers

**Secondary Issues:**
- Display flag coordination between root and subflow levels
- Scene update triggers when activeOutputNodeId changes
- Parameter change propagation to 3D viewport

## Requirements Specification

### User Journey Requirements

**Core Workflow:**
1. Create GeoNode on root canvas
2. Enter subflow (double-click)
3. Add Box ’ Transform1, Transform2 ’ Group chain
4. Set Group as visible (activeOutputNodeId = Group.id)
5. Parameter edits trigger immediate 3D viewport updates
6. Multiple root GeoNodes can render simultaneously

**Visibility Rules:**
- **Root Level**: Multiple nodes can have Render=true simultaneously
- **Subflow Level**: Only ONE node can be visible (activeOutputNodeId)
- **Scene Aggregation**: All visible root nodes contribute to final scene
- **Output Propagation**: Only visible subflow node output reaches parent GeoNode

### Technical Requirements

**Immediate Visualization:**
- Geometry nodes automatically appear in 3D viewport when set as activeOutputNodeId
- Parameter changes trigger real-time scene updates (< 100ms)
- Container system integration with Three.js scene objects

**System Integration:**
- SceneManager works with BaseContainer system
- Reactive updates on activeOutputNodeId changes
- Proper Object3D extraction from containers

**Future Architecture:**
- Reserved space for material node integration
- Transform hierarchy inheritance
- Multi-geometry scene composition

## Implementation Plan

### Phase 1: Container Integration Fix (CRITICAL - Week 1)

**Objective**: Bridge new container system with SceneManager

**Tasks:**
1. **Update SceneManager.updateSceneFromRenderableObjects()**
   - Handle `{ default: BaseContainer }` format from new container system
   - Extract Object3D from BaseContainer.value
   - Maintain backward compatibility with legacy format

2. **Container Extraction Logic**
   ```typescript
   // In updateSceneFromRenderableObjects()
   if (outputNodeRuntime.output instanceof Object3DContainer) {
     object3D = outputNodeRuntime.output.value;
   } else if (outputNodeRuntime.output?.default instanceof BaseContainer) {
     object3D = outputNodeRuntime.output.default.value;
   }
   ```

3. **Test Simple Case**
   - Create Box node in subflow
   - Set as activeOutputNodeId  
   - Verify appears in 3D viewport

**Acceptance Criteria:**
- Box node displays in 3D viewport
- Transform nodes show transformed geometry
- Group node combines multiple inputs

### Phase 2: Visibility System Validation (Week 2)

**Objective**: Ensure visibility flags coordinate properly

**Tasks:**
1. **Root Display Flags**
   - Verify GeoNode render toggles control scene contribution
   - Test multiple GeoNodes visible simultaneously

2. **Subflow Active Output**
   - Validate activeOutputNodeId setting mechanics
   - Ensure only one subflow node can be visible

3. **Scene Update Triggers**
   - Fix reactive updates when activeOutputNodeId changes
   - Ensure SceneManager subscription to graph changes

**Acceptance Criteria:**
- Root visibility toggles work correctly
- Subflow visibility is mutually exclusive
- Scene updates immediately on visibility changes

### Phase 3: Real-time Parameter Updates (Week 3)

**Objective**: Live preview of parameter changes

**Tasks:**
1. **Parameter Change Pipeline**
   - Ensure parameter updates trigger node recomputation
   - Verify recomputed geometry reaches SceneManager
   - Optimize update frequency for smooth interaction

2. **Dependency Chain Updates**
   - Box parameter change updates Transform1 and Transform2
   - Transform changes update Group output
   - Only visible node changes reach scene

3. **Performance Optimization**
   - Debounce rapid parameter changes
   - Efficient Three.js object updates vs recreation

**Acceptance Criteria:**
- Box width change immediately updates both transforms in viewport
- Transform parameters update individual objects real-time
- Parameter slider dragging shows smooth updates

### Phase 4: Architecture Validation (Week 4)

**Objective**: Validate complete user journey

**Tasks:**
1. **End-to-End Testing**
   - Full user journey from GeoNode creation to parameter editing
   - Multiple GeoNodes with different subflow configurations
   - Complex node chains (Box ’ Transform ’ Group ’ etc.)

2. **Material System Preparation**
   - Ensure architecture can support future material nodes
   - Reserve material input/output patterns in containers

3. **Error Handling**
   - Graceful handling of missing activeOutputNodeId
   - Invalid geometry or computation errors
   - Scene recovery from error states

**Acceptance Criteria:**
- Complete user journey works flawlessly
- Architecture ready for material system
- Robust error handling and recovery

## Technical Architecture

### Current System Integration

**Flow**: Node Computation ’ Container ’ SceneManager ’ Three.js Scene

```
BoxNode.computeTyped() 
  ’ { default: Object3DContainer(mesh) }
  ’ SceneManager.updateSceneFromRenderableObjects()
  ’ scene.add(object3D)
```

### Container System Integration

**BaseContainer Types:**
- `Object3DContainer`: Contains Three.js objects (meshes, groups)
- `GeometryContainer`: Contains BufferGeometry instances
- Future: `MaterialContainer`, `TextureContainer`

**SceneManager Updates:**
- Extract Object3D from container.value
- Handle both legacy and container formats
- Maintain scene object lifecycle

### Visibility System Architecture

**Two-Level Visibility:**
1. **Root Level** (GeoNode.params.rendering.visible): Controls scene contribution
2. **Subflow Level** (activeOutputNodeId): Controls internal output selection

**Scene Composition:**
```
Scene = (visible_root_nodes.subflow_outputs)
where subflow_output = activeOutputNodeId.container.value
```

## Success Metrics

### Immediate Goals
- [ ] Geometry appears in 3D viewport when activeOutputNodeId is set
- [ ] Parameter changes trigger real-time viewport updates
- [ ] Multiple root nodes can render simultaneously
- [ ] Only one subflow node visible at a time

### Quality Metrics
- Parameter update latency < 100ms
- Scene update frame rate > 30fps during parameter editing
- Memory usage stable during parameter changes
- No visual artifacts or object duplication

### User Experience
- Intuitive visibility toggle behavior
- Responsive parameter editing
- Clear visual feedback for active/inactive nodes
- Smooth 3D viewport interaction

## Risk Mitigation

### Technical Risks
- **Container format conflicts**: Maintain backward compatibility
- **Performance degradation**: Profile and optimize critical paths
- **Memory leaks**: Proper Three.js object disposal

### Implementation Risks
- **Scope creep**: Focus on core visualization first
- **Complex debugging**: Start with simple test cases
- **Integration conflicts**: Test incremental changes

## Conclusion

The Minimystx architecture is fundamentally sound and correctly implements the required visibility semantics. The primary issue is a **container integration gap** between the new BaseContainer system and SceneManager's object extraction logic. This is a targeted, fixable problem that should restore full 3D visualization functionality.

The plan prioritizes immediate visualization repair while preparing the architecture for future material system integration. Success will be measured by the complete user journey working flawlessly: GeoNode creation ’ subflow editing ’ parameter manipulation ’ real-time 3D preview.