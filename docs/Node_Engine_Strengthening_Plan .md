# Minimystx Node Engine Strengthening Plan

**Goal:** Strengthen Minimystx node engine by learning from Polygonjs to achieve robust multi-branch computation, reliable live updates, and easier extensibility.

## Executive Summary

After comprehensive analysis of both Minimystx and Polygonjs architectures, we've identified critical opportunities to enhance the Minimystx node evaluation system. This document outlines a systematic approach to adopt proven patterns from Polygonjs while maintaining Minimystx's React-focused design philosophy.

## Current State Analysis

### Minimystx Architecture Assessment

**Strengths:**
- Clean React-based architecture with Zustand state management
- Solid foundation with CoreGraph and node evaluation system  
- Efficient Three.js integration via SceneManager
- Good separation between engine and UI concerns
- WebAssembly integration for performance-critical operations
- Consistent node processor pattern

**Critical Gaps Identified:**
1. **Fan-out propagation issues**: Single output to multiple consumers causes unreliable updates
2. **Missing Group node**: No mechanism to merge multiple geometry streams
3. **Render flag coupling**: Rendering visibility tightly coupled to computation cycles
4. **Parameter validation enhancement**: Existing comprehensive validation needs transformation functions
5. **Fan-out evaluation reliability**: Existing Cooker/DirtyController needs fan-out scenario optimization
6. **Missing testing infrastructure**: No test framework or test coverage for core functionality
7. **Resource management**: Three.js object disposal and caching could be improved

### Polygonjs Architecture Insights

**Superior Patterns to Adopt:**

1. **Enhanced Fan-out Handling**: Improve existing Cooker for reliable multi-consumer updates
2. **PostDirtyHooks Optimization**: Existing system needs fan-out scenario improvements  
3. **Forbidden Trigger Nodes**: Fine-grained control over propagation paths
4. **Dual-level Graph Management**: Separate graph structure from node runtime state
5. **Parameter Transformation System**: Add transformation functions to existing validation
6. **Sophisticated Caching**: Content-addressed cache with proper invalidation

## Detailed Comparison Matrix

| Concept | Minimystx Current | Polygonjs Pattern | Gap Analysis |
|---------|-------------------|-------------------|--------------|
| **Node Evaluation** | Existing Cooker with block/unblock | Enhanced fan-out reliability | Fan-out scenarios need consistency fixes |
| **Parameter System** | Comprehensive validation system | Schema with transformations | Missing transformation functions |
| **Dirty Propagation** | DirtyController with PostDirtyHooks | Enhanced propagation control | Fan-out propagation reliability |
| **Connection Management** | Advanced ConnectionManager | Graph-level with handles | Fan-out tracking improvements needed |
| **Caching** | Basic output caching | Content-addressed with versioning | No cache invalidation strategy |
| **Scene Assembly** | Immediate Three.js object creation | Separate compute/render phases | Render flags force recomputation |
| **Testing** | No testing infrastructure | Comprehensive test coverage | Missing Vitest setup and test suites |
| **Error Handling** | Basic error states | Comprehensive error propagation | Limited error context |

## Implementation Plan

### Phase 1: Core Infrastructure Enhancement (Weeks 1-2)

#### 1.1 Testing Infrastructure Setup (Foundation)

**Implementation:**

- Add Vitest testing framework to package.json
- Create test directory structure and utilities
- Set up test mocks for Three.js and React components
- Establish testing conventions and patterns

**Code Changes:**

```typescript
// New files: test/setup.ts, test/utils/graphTestUtils.ts
// package.json: add vitest, @testing-library, test scripts
```

**Acceptance Criteria:**

- Unit tests can run with `npm test`
- Test utilities available for graph and node testing
- Mocking infrastructure for Three.js objects

#### 1.2 Enhanced Fan-out Reliability (Existing Cooker)

**Implementation:**

- Enhance existing `src/engine/graph/Cooker.ts` for fan-out scenarios
- Add fan-out tracking and versioning to prevent partial updates
- Improve queue processing for consistent multi-consumer updates
- Integrate with existing DirtyController for better propagation

**Code Changes:**

```typescript
// Enhancement to existing Cooker.ts
export class Cooker {
  private fanOutTracking: Map<string, Set<string>> = new Map();
  private evaluationVersions: Map<string, number> = new Map();
  
  // Enhanced processQueue for fan-out reliability
  private async processQueue(): Promise<void>
}
```

**Acceptance Criteria:**

- Single upstream change updates all downstream nodes exactly once
- No partial state updates visible in UI during fan-out scenarios
- Maintains compatibility with existing evaluation patterns

#### 1.3 Fan-out Connection Management Enhancement

**Implementation:**

- Enhance existing ConnectionManager to improve fan-out subscriber tracking
- Implement versioned outputs to ensure consistency
- Update propagation logic to handle fan-out scenarios

**Code Changes:**

- Update `src/engine/graph/ConnectionManager.ts`
- Enhance `src/engine/graphStore.ts` evaluation logic
- Add subscriber tracking to connection data structures

**Acceptance Criteria:**

- Single upstream change updates all downstream nodes exactly once
- No partial state updates visible in UI
- Maintains existing single-connection behavior

### Phase 2: Parameter System Overhaul (Weeks 2-3)

#### 2.1 Enhanced Parameter System (Existing Foundation)

**Implementation:**

- Enhance existing `src/engine/parameterUtils.ts` validation system
- Add transformation functions to existing comprehensive validation
- Implement parameter coercion and conversion utilities
- Maintain backward compatibility with current parameter definitions

**Enhanced Schema Format:**

```typescript
// Extension to existing ParameterMetadata in graphStore.ts
interface ParameterMetadata {
  // ... existing fields ...
  transform?: (value: any) => any;
  validator?: (value: any) => boolean;
  coerceType?: boolean;
}
```

**Acceptance Criteria:**

- Enhanced validation with transformation functions
- Backward compatibility with all existing parameter definitions
- Clear error messages with actionable feedback

#### 2.2 Group Node Implementation (Missing Critical Feature)

**Implementation:**

- Create new `src/flow/nodes/Geometry/Group.ts`
- Implement dynamic input management system
- Support multiple merge modes (concatenate, deduplicate, hierarchy)
- Add proper Three.js resource disposal and cleanup
- Register in `src/engine/nodeRegistry.ts`

**Node Specification:**
```typescript
interface GroupNodeParams {
  mergeMode: 'concatenate' | 'deduplicate' | 'hierarchy';
  preserveGroups: boolean;
  removeEmpty: boolean;
}
```

**Acceptance Criteria:**
- Dynamic add/remove of input connections
- All merge modes work correctly with various geometry types
- Proper cleanup of Three.js resources when inputs change

### Phase 3: Render Pipeline Separation (Weeks 3-4)

#### 3.1 Decoupled Render Pipeline

**Implementation:**
- Separate computation descriptors from render membership
- Create render set management in SceneManager
- Implement independent render flag toggling

**Architecture Changes:**
- Processors output abstract descriptors, not direct Three.js objects
- SceneManager maintains render set keyed by node ID
- Render flags control scene membership, not computation

**Acceptance Criteria:**
- Render flag changes never trigger upstream recomputation
- Multiple nodes can be rendered simultaneously
- Scene updates only affect visible objects

#### 3.2 Advanced Resource Management

**Implementation:**
- Content-addressed caching system
- Automatic Three.js resource disposal
- Cache invalidation strategies

**Code Changes:**
- New `src/engine/cache/ContentAddressedCache.ts`
- Enhanced disposal logic in SceneManager
- Cache-aware node processors

**Acceptance Criteria:**
- No memory leaks during extended sessions
- Efficient resource reuse across similar computations
- Clear cache invalidation on relevant changes

### Phase 4: Developer Experience (Weeks 4-5)

#### 4.1 Node Authoring Improvements

**Implementation:**
- Standardized node template with checklist
- Migration hooks for versioned definitions
- Enhanced error reporting in node headers

**New Files:**
- `src/engine/templates/NodeTemplate.ts`
- `docs/NodeAuthoringGuide.md`
- Enhanced error display components

**Acceptance Criteria:**
- New nodes follow consistent patterns
- Clear error messages with actionable information
- Smooth migration path for scene file updates

#### 4.2 Comprehensive Testing Suite

**Implementation:**
- Unit tests for critical fan-out scenarios
- Playwright E2E tests for multi-branch updates
- Performance benchmarks for graph evaluation

**Test Scenarios:**
- Box � Transform1, Transform2 (fan-out)
- Multiple branches merged by Group node
- Render flag toggling without recomputation
- Large graph performance characteristics

**Acceptance Criteria:**
- 100% test coverage for core evaluation logic
- Performance benchmarks show no regression
- E2E tests catch UI-level integration issues

## Success Metrics

### Functional Requirements
1. **Fan-out Reliability**: Single upstream parameter change updates all downstream consumers in one UI cycle
2. **Render Flag Independence**: Toggling render flags never triggers upstream recomputation  
3. **Group Node Functionality**: Dynamic input management with proper downstream propagation
4. **Cycle Prevention**: Clear detection and user feedback for circular dependencies
5. **Parameter Validation**: Invalid inputs rejected with clear error messages

### Performance Requirements
- No regression in evaluation speed for existing graphs
- 20% improvement for complex multi-branch graphs
- Memory usage stable during extended sessions
- UI responsiveness maintained during large graph operations

### Developer Experience
- New node creation time reduced by 50%
- Clear debugging information for evaluation issues
- Comprehensive documentation with examples
- Migration path for existing scenes

## Risk Mitigation Strategy

### Technical Risks
- **Backward Compatibility**: Implement changes behind feature flags, maintain scene file compatibility
- **Performance Regression**: Continuous benchmarking, optimization focus areas identified
- **Complexity Management**: Clear separation of concerns, comprehensive documentation

### Implementation Risks
- **Scope Creep**: Fixed deliverables, clear phase boundaries
- **Integration Issues**: Incremental rollout with monitoring
- **Testing Coverage**: Automated test suite, manual testing protocols

## Detailed Technical Specifications

### Enhanced Cooker Implementation (Building on Existing)

```typescript
// Enhancements to existing src/engine/graph/Cooker.ts
export class Cooker {
  // Add fan-out tracking for reliability
  private fanOutTracking: Map<string, Set<string>> = new Map();
  private evaluationVersions: Map<string, number> = new Map();
  private currentEpoch: number = 0;

  // Enhanced existing enqueue method
  enqueue(nodeId: string, taskData?: Partial<ComputeTask>): void {
    // Track fan-out relationships for consistent updates
    this.trackFanOutConnections(nodeId);
    
    // ... existing enqueue logic enhanced ...
  }

  // New method: track fan-out scenarios
  private trackFanOutConnections(nodeId: string): void {
    // Implementation for tracking multiple downstream consumers
  }

  // Enhanced existing processQueue for fan-out reliability
  private async processQueue(): Promise<void> {
    // Ensure all fan-out consumers get same version
    this.currentEpoch++;
    
    // ... existing queue processing enhanced ...
  }
}
```

### Group Node Specification

```typescript
interface GroupNodeData {
  mergeMode: 'concatenate' | 'deduplicate' | 'hierarchy';
  preserveGroups: boolean;
  removeEmpty: boolean;
  dynamicInputCount: number;
}

class GroupNodeProcessor {
  static compute(params: GroupNodeData, inputs: Record<string, Object3D>): Object3D {
    const inputObjects = Object.values(inputs).filter(Boolean);
    
    switch (params.mergeMode) {
      case 'concatenate':
        return this.concatenateObjects(inputObjects, params);
      case 'deduplicate':
        return this.deduplicateObjects(inputObjects, params);
      case 'hierarchy':
        return this.createHierarchy(inputObjects, params);
    }
  }

  private static concatenateObjects(objects: Object3D[], params: GroupNodeData): Object3D {
    const group = new THREE.Group();
    
    for (const obj of objects) {
      if (params.removeEmpty && this.isEmpty(obj)) continue;
      
      if (params.preserveGroups || !obj.isGroup) {
        group.add(obj.clone());
      } else {
        // Flatten group contents
        obj.children.forEach(child => group.add(child.clone()));
      }
    }
    
    return group;
  }
}
```

### Parameter Schema System

```typescript
interface ParameterDefinition {
  type: ParameterType;
  default: any;
  validation?: ValidationRule[];
  transform?: TransformFunction;
  displayName?: string;
  description?: string;
  category?: string;
}

interface ValidationRule {
  type: 'range' | 'enum' | 'pattern' | 'custom';
  config: any;
  message?: string;
}

class ParameterValidator {
  static validate(value: any, definition: ParameterDefinition): ValidationResult {
    for (const rule of definition.validation || []) {
      const result = this.applyRule(value, rule);
      if (!result.valid) return result;
    }
    return { valid: true };
  }

  static transform(value: any, definition: ParameterDefinition): any {
    if (definition.transform) {
      return definition.transform(value);
    }
    return this.coerceType(value, definition.type);
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('Fan-out Propagation', () => {
  test('single source updates multiple targets once', async () => {
    // Setup: Box � Transform1, Transform2
    const graph = createTestGraph();
    const box = graph.addNode('box');
    const transform1 = graph.addNode('transform');
    const transform2 = graph.addNode('transform');
    
    graph.connect(box, transform1);
    graph.connect(box, transform2);
    
    // Act: Change box width
    box.setParam('width', 2.0);
    await graph.evaluate();
    
    // Assert: Both transforms computed exactly once
    expect(transform1.computeCount).toBe(1);
    expect(transform2.computeCount).toBe(1);
    expect(transform1.output.geometry.parameters.width).toBe(2.0);
    expect(transform2.output.geometry.parameters.width).toBe(2.0);
  });
});

describe('Group Node', () => {
  test('dynamic input management', () => {
    const groupNode = new GroupNode();
    
    // Add inputs
    groupNode.addInput('input1');
    groupNode.addInput('input2');
    expect(groupNode.inputCount).toBe(2);
    
    // Remove input
    groupNode.removeInput('input1');
    expect(groupNode.inputCount).toBe(1);
    
    // Downstream should still update correctly
    groupNode.connectInput('input2', sourceNode);
    sourceNode.setParam('value', 42);
    
    expect(groupNode.output).toBeDefined();
  });
});
```

### E2E Tests
```typescript
// test/e2e/multi-branch-updates.spec.ts
test('multi-branch graph updates correctly', async ({ page }) => {
  await page.goto('/editor');
  
  // Create graph: Box � Transform1, Transform2
  await page.click('[data-testid="add-box-node"]');
  await page.click('[data-testid="add-transform-node"]');
  await page.click('[data-testid="add-transform-node"]');
  
  // Connect nodes
  await page.dragAndDrop('.box-output', '.transform1-input');
  await page.dragAndDrop('.box-output', '.transform2-input');
  
  // Change box width
  await page.fill('[data-testid="box-width"]', '3.0');
  
  // Verify both transforms updated
  await expect(page.locator('.transform1-output-indicator')).toHaveClass(/updated/);
  await expect(page.locator('.transform2-output-indicator')).toHaveClass(/updated/);
  
  // Verify 3D scene shows both transformed objects
  await expect(page.locator('[data-testid="3d-objects"]')).toContainText('2 objects');
});
```

### Performance Benchmarks
```typescript
describe('Performance Benchmarks', () => {
  test('large graph evaluation', async () => {
    const startTime = performance.now();
    
    // Create graph with 100 nodes, multiple branches
    const graph = createLargeTestGraph(100);
    await graph.evaluateAll();
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(1000); // 1 second max
  });
  
  test('memory usage stability', async () => {
    const initialMemory = performance.memory?.usedJSHeapSize || 0;
    
    // Create and destroy multiple graphs
    for (let i = 0; i < 10; i++) {
      const graph = createTestGraph();
      await graph.evaluateAll();
      graph.dispose();
    }
    
    const finalMemory = performance.memory?.usedJSHeapSize || 0;
    const growth = finalMemory - initialMemory;
    
    expect(growth).toBeLessThan(10 * 1024 * 1024); // Max 10MB growth
  });
});
```

## Implementation Timeline (Updated Based on Codebase Analysis)

### Week 1-2: Foundation & Core Fixes

- [ ] Set up Vitest testing infrastructure
- [ ] Enhance existing Cooker for fan-out reliability
- [ ] Fix fan-out propagation in ConnectionManager
- [ ] Create comprehensive test suite for fan-out scenarios

### Week 2-3: Critical Features

- [ ] Implement Group node (missing essential feature)
- [ ] Enhance existing parameter validation with transformations
- [ ] Add Group node to registry and test integration
- [ ] Comprehensive fan-out + Group node testing

### Week 3-4: Performance & Polish

- [ ] Implement render flag decoupling
- [ ] Add content-addressed caching system
- [ ] Performance optimization and benchmarks
- [ ] End-to-end testing of parametric flow behaviors

### Week 4-5: Quality Assurance

- [ ] Comprehensive testing of all enhanced systems
- [ ] Performance regression testing
- [ ] Documentation updates and examples
- [ ] Validation against Parametric Flow Journey requirements

## Conclusion

This strengthening plan transforms Minimystx from a functional node-based editor into a robust, extensible parametric modeling system. By adopting proven patterns from Polygonjs while maintaining our React-focused architecture, we achieve:

1. **Reliability**: Robust fan-out propagation and render flag independence
2. **Extensibility**: Formal parameter schemas and standardized node authoring
3. **Performance**: Sophisticated caching and evaluation scheduling
4. **Developer Experience**: Clear patterns and comprehensive testing

The updated approach focuses on enhancing the strong existing foundation while addressing the critical gaps identified through codebase analysis. This ensures reliable parametric modeling workflows as described in the Parametric Flow Journeys document.
