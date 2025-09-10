# New Display Types: Shaded + Wireframe & X-Ray + Wireframe

## Overview

Implementation of two new display modes to provide full topology wireframe visualization:
- **Shaded + Wireframe**: Normal shaded materials with black wireframe overlay showing all triangle edges
- **X-Ray + Wireframe**: Semi-transparent materials (40% opacity) with black wireframe overlay

## Requirements Analysis

### Visual Reference
Based on provided reference images showing full topology visualization like Blender's "Solid + Wireframe":

- **Image #1 (Shaded + Wireframe)**: Normal shaded materials + black wireframe showing all triangle edges
- **Image #2 (X-Ray + Wireframe)**: Semi-transparent materials + wireframe maintaining depth order

### Technical Requirements
1. **Wireframe Colors**: Black wireframe lines for both new modes (theme-independent)
2. **Topology Display**: THREE.WireframeGeometry showing all triangle edges (not angle-filtered)
3. **X-Ray Transparency**: Semi-transparent 40% opacity for wireframe overlay
4. **Base Wireframe**: Keep existing theme-dependent wireframe mode unchanged
5. **Preferences**: Global preferences system for future wireframe thickness/color customization
6. **Performance**: Geometry-based caching for wireframe reuse across meshes
7. **State Persistence**: Display mode selection survives page reload
8. **Z-Fighting Prevention**: Small polygon offset on base materials

## Current Architecture Analysis

### Critical Limitations Identified
1. **Boolean State Problem**: Current `wireframe: boolean, xRay: boolean` cannot represent compound modes
   - Location: `src/store/uiStore.ts:135-136`
   - Issue: Cannot have both base material + edge overlay simultaneously

2. **Material Manager Inadequacy**: Single material cache per mesh
   - Location: `src/rendering/materials/MaterialManager.ts:7`
   - Issue: WeakMap stores only ONE original material, cannot manage overlays

3. **No Edge Infrastructure**: Zero existing EdgesGeometry/LineSegments usage
   - Issue: Complete edge system must be built from scratch

4. **State Persistence Gap**: Display modes not persisted
   - Location: `src/store/uiStore.ts:403-414` (missing from partialize)

## Technical Implementation Design

### 1. State System Migration (Breaking Change)

**Current Architecture:**
```typescript
interface UIState {
  wireframe: boolean;
  xRay: boolean;
}
```

**New Architecture:**
```typescript
type DisplayMode = 'shaded' | 'wireframe' | 'xray' | 'shadedEdges' | 'xrayEdges';

interface UIState {
  displayMode: DisplayMode;
}
```

**Migration Strategy:**
- Provide backward compatibility logic in store rehydration
- Map existing boolean combinations to appropriate display mode
- Add displayMode to persistence configuration

### 2. EdgeOverlayManager System

**New Component:** `src/rendering/edges/EdgeOverlayManager.ts`

**Core Architecture:**
```typescript
class EdgeOverlayManager {
  private edgeGeometryCache: WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>;
  private meshOverlayMap: WeakMap<THREE.Mesh, THREE.LineSegments>;
  private edgeMaterial: THREE.LineBasicMaterial;
}
```

**Key Features:**
- Geometry-based caching (not per-mesh) for performance
- Black LineBasicMaterial (theme-independent)
- Automatic cleanup when base geometry disposed
- Device pixel ratio scaling for consistent edge thickness
- Polygon offset to prevent z-fighting

**Edge Detection Configuration:**
```typescript
const edgesGeometry = new THREE.EdgesGeometry(baseGeometry, 1); // 1 degree threshold
const edgeMaterial = new THREE.LineBasicMaterial({ 
  color: 0x000000, // Fixed black
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});
```

### 3. Material System Enhancement

**Current Methods (Remove):**
- `updateWireframeMode(wireframe: boolean)`
- `updateXRayMode(xRay: boolean)`

**New Method:**
```typescript
public updateDisplayMode(mode: DisplayMode): void {
  // Unified handling of all 5 display modes
  // Manages base materials + edge overlays independently
}
```

**Enhanced Caching Strategy:**
- Preserve original materials while managing edge overlays
- Prevent cross-mode state contamination
- Handle X-Ray transparency + edge visibility correctly

## Implementation Task Breakdown

### Phase 1: State Architecture Migration
**Files Modified:**
- `src/store/uiStore.ts`
- `src/rendering/SceneManager.ts`

**Changes:**
1. Add DisplayMode enum to types
2. Replace boolean state with displayMode enum
3. Implement migration logic for existing state
4. Add displayMode to persistence configuration  
5. Update SceneManager to single displayMode subscription handler

### Phase 2: Edge Overlay System
**Files Created:**
- `src/rendering/edges/EdgeOverlayManager.ts`
- `src/rendering/edges/index.ts`

**Changes:**
1. Create EdgeOverlayManager class with caching system
2. Implement THREE.EdgesGeometry creation with 1-degree threshold
3. Create black LineBasicMaterial with polygon offset
4. Integrate with SceneManager for lifecycle management
5. Handle geometry disposal and cache cleanup

### Phase 3: Material System Integration
**Files Modified:**
- `src/rendering/materials/MaterialManager.ts`
- `src/rendering/materials/MaterialTypes.ts`

**Changes:**
1. Replace boolean methods with unified updateDisplayMode()
2. Implement enhanced caching for base materials + edge overlays
3. Handle X-Ray + Edges: transparent base materials + black edges
4. Ensure proper cleanup of edge overlays when switching modes

### Phase 4: UI Integration
**Files Modified:**
- `src/components/ViewportControls.tsx`
- `src/styles/variables.css`

**Changes:**
1. Update ViewportControls dropdown to show 5 modes
2. Update getShadingLabel() function for new mode names
3. Add CSS variable: `--edge-outline-color: #000000` (fixed black)
4. Update dropdown item handling for new display modes

### Phase 5: Performance & Validation
**Testing Focus:**
1. Large scene performance with edge caching
2. Memory leak validation during rapid mode switching
3. Visual validation against reference images
4. Cross-browser compatibility testing

## Future Extensibility

### Global Preferences Integration
**Future Enhancement:** `src/store/preferencesStore.ts`
```typescript
interface PreferencesState {
  renderer: {
    edges: {
      thickness: number; // 1.0 - 5.0
      color: string;     // Hex color
      angleThreshold: number; // Degrees
    };
  };
}
```

### Per-Scene Override System
**Future Enhancement:** Scene-level edge property overrides
- Allow per-project edge customization
- Hierarchy: Global preferences � Per-scene overrides � Runtime overrides

## Performance Considerations

### Geometry Caching Strategy
- **Key Insight**: Multiple meshes often share same base geometry
- **Solution**: Cache edges at geometry level, not per-mesh
- **Implementation**: `WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>`
- **Benefit**: Significant memory savings for repeated geometry

### Memory Management
- WeakMap usage ensures automatic garbage collection
- Edge overlays disposed when base mesh removed
- Geometry cache cleaned up when base geometry disposed
- No memory leaks during rapid mode switching

### Rendering Performance
- Polygon offset prevents z-fighting without depth buffer modifications
- LineSegments rendering is highly optimized in Three.js
- Edge creation is lazy (only when mode activated)
- Device pixel ratio capped at 2x to prevent excessive thickness

## Success Criteria

### Visual Requirements
 **Shaded + Edges**: Normal materials + black edges (matches Image #1)  
 **X-Ray + Edges**: 50% transparent + black edges (matches Image #2)  
 **Theme Independence**: Black edges regardless of dark/light theme  
 **Edge Quality**: Clean 1-degree angle detection, no z-fighting

### Technical Requirements  
 **5 Display Modes**: All modes in ViewportControls dropdown  
 **State Persistence**: Mode survives page reload  
 **Performance**: No memory leaks, smooth mode switching  
 **Compatibility**: Works with existing post-processing (SSAO, Bloom)

### Architecture Requirements
 **Breaking Change Handled**: Clean migration from boolean to enum state
 **Future-Proof**: Extensible for thickness/color customization  
 **Clean Code**: No cross-mode contamination, proper separation of concerns

## Risk Mitigation

### High Risk: State Migration
**Risk**: Boolean to enum migration breaks existing user settings
**Mitigation**: Implement backward compatibility logic in store rehydration

### Medium Risk: Edge Overlay Performance  
**Risk**: Performance degradation on large scenes with many meshes
**Mitigation**: Geometry-based caching, lazy edge creation, WeakMap cleanup

### Low Risk: Z-Fighting
**Risk**: Edge lines fighting with surface geometry
**Mitigation**: Polygon offset configuration tested with existing post-processing

## Implementation Timeline

**Estimated Effort**: 2-3 days
- **Day 1**: State migration + EdgeOverlayManager core
- **Day 2**: Material system integration + UI updates  
- **Day 3**: Testing, validation, polish

**Validation Approach**: Visual comparison against reference images, manual testing of all mode combinations, performance testing with large scenes.