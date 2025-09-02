# MinimySTX Core Architecture Enhancements

## Overview

This document outlines comprehensive architecture improvements for MinimySTX based on analysis of PolygonJS's proven parametric modeling architecture. These enhancements will solve current issues with one-to-many connections, recomputation inefficiencies, and enable advanced parametric workflows.

## Current Issues Analysis

### Critical Problems Identified

1. **One-to-Many Connection Failures**
   - Current dependency maps (`rootDependencyMap`, `rootReverseDeps`) use simple arrays
   - Cannot properly handle single output connecting to multiple inputs (e.g., Box ’ Transform1, Transform2)
   - Results in connection conflicts and computation errors

2. **Inefficient Recomputation System**
   - Complex debouncing with 50ms delays (`RECOMPUTATION_DEBOUNCE_MS`)
   - Elaborate cycle detection with multiple tracking maps
   - Cascading updates cause redundant computations
   - No proper batching mechanism

3. **Missing Graph Optimization**
   - Repeated dependency traversals without caching
   - No efficient predecessor/successor lookup
   - Linear search through dependency arrays

4. **Basic Node Lifecycle**
   - Simple `evaluateNode` function without proper phases
   - No input validation or error recovery
   - Missing performance tracking
   - No async computation support

## PolygonJS Architecture Advantages

### Superior Graph Management

**CoreGraph System**:
- Efficient bidirectional graph with cached traversals
- Map-based connection storage: `Map<outputIndex, Map<connectionId, Connection>>`
- Built-in cycle detection with O(1) lookups
- Automatic cache invalidation on topology changes

**Connection Handling**:
```typescript
// PolygonJS approach - supports multiple connections per output
private _outputConnections: Map<number, Map<number, TypedNodeConnection>>

// vs MinimySTX current - single connection arrays
rootDependencyMap: Record<string, string[]>
```

### Advanced Computation Management

**Cooker System (Batching)**:
- Blocks cascading updates during computation
- Queues dirty nodes for batch processing
- Processes in topological order
- Prevents redundant recomputation

**DirtyController**:
- Clean separation of dirty state management
- PostDirtyHooks for extensible behavior
- Timestamp tracking for optimization
- Proper propagation control

### Comprehensive Node Lifecycle

**CookController**:
- Multi-phase cooking: inputs ’ params ’ compute ’ outputs
- Async computation support with Promise handling
- Comprehensive error handling and recovery
- Performance tracking and optimization

## Implementation Plan

## Phase 1: Core Graph Architecture Enhancement

### 1.1 Enhanced Graph Data Structure

**File**: `src/engine/graph/CoreGraph.ts` (NEW)

```typescript
interface GraphNodeData {
  predecessorIds: Set<string>;
  successorIds: Set<string>;
  predecessorNodes: GraphNode[];
  successorNodes: GraphNode[];
  cacheDirty: boolean;
}

export class CoreGraph {
  private nodes: Map<string, GraphNodeData> = new Map();
  private nodeObjects: Map<string, GraphNode> = new Map();
  
  // Efficient connection management
  connect(sourceId: string, targetId: string): boolean {
    // Add bidirectional relationships
    // Update caches
    // Return success/failure
  }
  
  disconnect(sourceId: string, targetId: string): void {
    // Remove relationships
    // Invalidate caches
  }
  
  // Cached traversal methods - O(1) after first computation
  getAllPredecessors(nodeId: string): GraphNode[] {
    const nodeData = this.nodes.get(nodeId);
    if (nodeData?.cacheDirty) {
      this.rebuildPredecessorCache(nodeId);
    }
    return nodeData?.predecessorNodes || [];
  }
  
  getAllSuccessors(nodeId: string): GraphNode[] {
    const nodeData = this.nodes.get(nodeId);
    if (nodeData?.cacheDirty) {
      this.rebuildSuccessorCache(nodeId);
    }
    return nodeData?.successorNodes || [];
  }
  
  // Efficient cycle detection using cached relationships
  wouldCreateCycle(sourceId: string, targetId: string): boolean {
    const successors = this.getAllSuccessors(targetId);
    return successors.some(node => node.id === sourceId);
  }
  
  private rebuildPredecessorCache(nodeId: string): void {
    // Efficient graph traversal with visited set
    // Cache results for future queries
  }
  
  private rebuildSuccessorCache(nodeId: string): void {
    // Efficient graph traversal with visited set
    // Cache results for future queries
  }
}
```

**Benefits**:
- Eliminates O(n) dependency array searches
- Cached traversals prevent repeated computations
- Proper cycle detection without complex tracking
- Foundation for complex graph operations

### 1.2 Connection Management System

**File**: `src/engine/graph/ConnectionManager.ts` (NEW)

```typescript
interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  metadata?: Record<string, any>;
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private inputConnections: Map<string, Connection[]> = new Map();
  private outputConnections: Map<string, Map<string, Connection[]>> = new Map();
  
  addConnection(connection: Connection): void {
    this.connections.set(connection.id, connection);
    
    // Update input connections
    const inputConns = this.inputConnections.get(connection.targetNodeId) || [];
    inputConns.push(connection);
    this.inputConnections.set(connection.targetNodeId, inputConns);
    
    // Update output connections (handle-based)
    const sourceHandle = connection.sourceHandle || 'default';
    let outputMap = this.outputConnections.get(connection.sourceNodeId);
    if (!outputMap) {
      outputMap = new Map();
      this.outputConnections.set(connection.sourceNodeId, outputMap);
    }
    
    const handleConnections = outputMap.get(sourceHandle) || [];
    handleConnections.push(connection);
    outputMap.set(sourceHandle, handleConnections);
  }
  
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Remove from all indexes
    this.connections.delete(connectionId);
    this.removeFromInputConnections(connection);
    this.removeFromOutputConnections(connection);
  }
  
  // SOLVES ONE-TO-MANY ISSUE: Multiple connections per output
  getOutputConnections(nodeId: string, outputHandle?: string): Connection[] {
    const outputMap = this.outputConnections.get(nodeId);
    if (!outputMap) return [];
    
    if (outputHandle) {
      return outputMap.get(outputHandle) || [];
    }
    
    // Return all connections from all handles
    const allConnections: Connection[] = [];
    outputMap.forEach(connections => allConnections.push(...connections));
    return allConnections;
  }
  
  getInputConnections(nodeId: string): Connection[] {
    return this.inputConnections.get(nodeId) || [];
  }
  
  canConnect(sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string): boolean {
    // Check for cycles using graph
    // Validate connection point compatibility
    // Check for duplicate connections if not allowed
    return true;
  }
}
```

**Benefits**:
- **Solves one-to-many connection problems completely**
- Efficient connection lookup by node and handle
- Support for named input/output handles
- Foundation for complex connection validation

### 1.3 GraphStore Refactoring

**File**: `src/engine/graphStore.ts` (MODIFY EXISTING)

**Major Changes**:

```typescript
// REMOVE current problematic systems
- rootDependencyMap: Record<string, string[]>
- rootReverseDeps: Record<string, string[]>
- All complex recomputation guard logic
- Debouncing mechanisms
- Cycle detection maps

// ADD new robust systems
+ private graph: CoreGraph = new CoreGraph()
+ private connectionManager: ConnectionManager = new ConnectionManager()
+ private cooker: Cooker = new Cooker()

// Simplified, robust edge management
addEdge(source: string, target: string, context: GraphContext): Result {
  // Simple cycle check using graph
  if (this.graph.wouldCreateCycle(source, target)) {
    return { ok: false, error: "Connection would create cycle" };
  }
  
  // Create connection
  const connectionId = generateUniqueId();
  const connection: Connection = {
    id: connectionId,
    sourceNodeId: source,
    targetNodeId: target
  };
  
  // Add to both systems
  this.connectionManager.addConnection(connection);
  this.graph.connect(source, target);
  
  // Queue for batched recomputation
  this.cooker.enqueue(target);
  
  return { ok: true };
}

// Simplified parameter updates
setParams(nodeId: string, params: Partial<Record<string, any>>, context: GraphContext): void {
  set((state) => {
    const runtime = this.getNodeRuntime(nodeId, context);
    runtime.params = { ...runtime.params, ...params };
    runtime.isDirty = true;
  });
  
  // Single, efficient recomputation trigger
  this.cooker.enqueue(nodeId);
}
```

**Benefits**:
- Eliminates all current recomputation issues
- Removes complex cycle detection logic
- Provides clean, maintainable API
- Foundation for advanced features

## Phase 2: Advanced Dirty State Management

### 2.1 DirtyController Implementation

**File**: `src/engine/graph/DirtyController.ts` (NEW)

```typescript
export type PostDirtyHook = (trigger?: GraphNode) => void;

export class DirtyController {
  private isDirty: boolean = false;
  private dirtyTimestamp: number | undefined;
  private postDirtyHooks: Map<string, PostDirtyHook> = new Map();
  private cooker: Cooker;
  
  constructor(private node: GraphNode, cooker: Cooker) {
    this.cooker = cooker;
  }
  
  setDirty(trigger?: GraphNode): void {
    if (this.isDirty) return; // Prevent redundant dirty marking
    
    this.isDirty = true;
    this.dirtyTimestamp = performance.now();
    
    // Queue hooks instead of immediate execution
    this.queuePostDirtyHooks(trigger);
    this.propagateDirtyToSuccessors(trigger);
  }
  
  private queuePostDirtyHooks(trigger?: GraphNode): void {
    if (this.postDirtyHooks.size > 0) {
      // Add to cooker queue for batched processing
      this.cooker.enqueue(this.node.id, {
        type: 'hooks',
        hooks: Array.from(this.postDirtyHooks.values()),
        trigger
      });
    }
  }
  
  private propagateDirtyToSuccessors(trigger?: GraphNode): void {
    // Block cooker during propagation to batch all updates
    this.cooker.block();
    
    try {
      const successors = this.node.graph.getAllSuccessors(this.node.id);
      for (const successor of successors) {
        successor.dirtyController.setDirty(trigger || this.node);
      }
    } finally {
      this.cooker.unblock(); // Triggers batch processing
    }
  }
  
  removeDirtyState(): void {
    this.isDirty = false;
  }
  
  addPostDirtyHook(name: string, hook: PostDirtyHook): void {
    this.postDirtyHooks.set(name, hook);
  }
  
  removePostDirtyHook(name: string): void {
    this.postDirtyHooks.delete(name);
  }
}
```

**Benefits**:
- Clean separation of dirty state logic
- Prevents redundant dirty marking
- Batched hook execution
- Proper propagation control

### 2.2 Cooker System (Batching Mechanism)

**File**: `src/engine/graph/Cooker.ts` (NEW)

```typescript
interface ComputeTask {
  nodeId: string;
  type: 'compute' | 'hooks';
  timestamp: number;
  trigger?: GraphNode;
  hooks?: PostDirtyHook[];
}

export class Cooker {
  private queue: Map<string, ComputeTask> = new Map();
  private blockLevel: number = 0;
  private processing: boolean = false;
  private graph: CoreGraph;
  
  constructor(graph: CoreGraph) {
    this.graph = graph;
  }
  
  block(): void {
    this.blockLevel++;
  }
  
  unblock(): void {
    this.blockLevel--;
    if (this.blockLevel <= 0) {
      this.blockLevel = 0;
      if (!this.processing) {
        // Use microtask to batch synchronous operations
        Promise.resolve().then(() => this.processQueue());
      }
    }
  }
  
  enqueue(nodeId: string, taskData?: Partial<ComputeTask>): void {
    if (this.queue.has(nodeId)) {
      // Update existing task with latest data
      const existing = this.queue.get(nodeId)!;
      Object.assign(existing, taskData, { timestamp: performance.now() });
      return;
    }
    
    const task: ComputeTask = {
      nodeId,
      type: 'compute',
      timestamp: performance.now(),
      ...taskData
    };
    
    this.queue.set(nodeId, task);
    
    if (this.blockLevel === 0 && !this.processing) {
      Promise.resolve().then(() => this.processQueue());
    }
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing || this.blockLevel > 0) return;
    
    this.processing = true;
    
    try {
      // Get all queued tasks
      const tasks = Array.from(this.queue.values());
      this.queue.clear();
      
      // Sort by dependency order using graph
      const sortedTasks = this.topologicalSort(tasks);
      
      // Process each task
      for (const task of sortedTasks) {
        await this.processTask(task);
      }
    } finally {
      this.processing = false;
      
      // Process any new tasks that were queued during processing
      if (this.queue.size > 0) {
        Promise.resolve().then(() => this.processQueue());
      }
    }
  }
  
  private topologicalSort(tasks: ComputeTask[]): ComputeTask[] {
    // Use graph to determine dependency order
    const nodeIds = tasks.map(t => t.nodeId);
    const sortedIds = this.graph.topologicalSort(nodeIds);
    
    // Return tasks in dependency order
    return sortedIds.map(id => tasks.find(t => t.nodeId === id)!).filter(Boolean);
  }
  
  private async processTask(task: ComputeTask): Promise<void> {
    if (task.type === 'hooks' && task.hooks) {
      // Execute post-dirty hooks
      for (const hook of task.hooks) {
        try {
          hook(task.trigger);
        } catch (error) {
          console.error(`Hook execution failed for node ${task.nodeId}:`, error);
        }
      }
    } else {
      // Execute node computation
      const node = this.graph.getNode(task.nodeId);
      if (node && node.isDirty()) {
        await node.cook();
      }
    }
  }
}
```

**Benefits**:
- **Eliminates cascading update problems**
- Batches multiple dirty markings into single computation cycle
- Respects dependency order during processing
- Prevents redundant computations
- Handles both sync and async operations

### 2.3 GraphStore Integration

**File**: `src/engine/graphStore.ts` (MODIFY EXISTING)

```typescript
// Replace complex recomputation logic with simple enqueuing
recomputeFrom(nodeId: string, context: GraphContext): void {
  // OLD: 100+ lines of complex debouncing, cycle detection, batching
  // NEW: Simple, reliable enqueuing
  this.cooker.enqueue(nodeId);
}

markDirty(nodeId: string, context: GraphContext): void {
  // OLD: Complex dependency traversal and manual dirty marking
  // NEW: Let DirtyController handle propagation
  const runtime = this.getNodeRuntime(nodeId, context);
  if (runtime) {
    runtime.dirtyController.setDirty();
  }
}

// Remove all complex recomputation tracking
- recomputationGuard: Map<string, Set<string>>
- recomputationCycleTracker: Map<string, Array<{...}>>
- globalRecomputationTracker: Map<string, {...}>
- recomputationTimers: Map<string, ReturnType<typeof setTimeout>>
- All debouncing logic
- All cycle detection logic
```

**Benefits**:
- Reduces GraphStore complexity by ~500 lines
- Eliminates all current recomputation bugs
- Provides clean, maintainable API
- Enables reliable one-to-many connections

## Phase 3: Enhanced Node System

### 3.1 Node Cook Controller

**File**: `src/engine/nodes/CookController.ts` (NEW)

```typescript
interface NodeInputs {
  [handle: string]: any;
}

interface NodeOutput {
  data: any;
  metadata?: Record<string, any>;
}

export class NodeCookController {
  private cooking: boolean = false;
  private cookingTimestamp: number | undefined;
  private lastCookTime: number = 0;
  private cookCount: number = 0;
  private performanceTracker: PerformanceTracker;
  
  constructor(private node: BaseNode) {
    this.performanceTracker = new PerformanceTracker(node.id);
  }
  
  async cookMain(): Promise<void> {
    if (this.cooking) {
      console.warn(`Node ${this.node.id} already cooking, skipping`);
      return;
    }
    
    this.initCookingState();
    
    try {
      // Phase 1: Validate node state
      if (!this.validateNodeState()) {
        throw new Error('Node validation failed');
      }
      
      // Phase 2: Evaluate inputs
      const inputs = await this.evaluateInputs();
      
      // Phase 3: Evaluate parameters (if needed)
      if (this.node.needsParameterEvaluation()) {
        await this.evaluateParameters();
      }
      
      // Phase 4: Execute node computation
      const output = await this.executeComputation(inputs);
      
      // Phase 5: Process and store output
      this.processOutput(output);
      
      // Phase 6: Notify dependents
      this.notifyDependents();
      
    } catch (error) {
      this.handleComputeError(error);
    } finally {
      this.endCook();
    }
  }
  
  private async evaluateInputs(): Promise<NodeInputs> {
    this.performanceTracker.startPhase('inputs');
    
    const connectionManager = this.node.scene.connectionManager;
    const inputConnections = connectionManager.getInputConnections(this.node.id);
    
    const inputs: NodeInputs = {};
    
    // Evaluate inputs in parallel when possible
    const inputPromises = inputConnections.map(async (connection) => {
      const sourceNode = this.node.scene.getNode(connection.sourceNodeId);
      if (!sourceNode) return;
      
      // Ensure source node is computed
      if (sourceNode.isDirty()) {
        await sourceNode.cook();
      }
      
      if (sourceNode.hasValidOutput()) {
        const handle = connection.targetHandle || 'default';
        const outputHandle = connection.sourceHandle || 'default';
        inputs[handle] = sourceNode.getOutput(outputHandle);
      }
    });
    
    await Promise.all(inputPromises);
    
    this.performanceTracker.endPhase('inputs');
    return inputs;
  }
  
  private async evaluateParameters(): Promise<void> {
    this.performanceTracker.startPhase('parameters');
    
    // Evaluate parameter expressions and dependencies
    await this.node.parameterController.evaluateAll();
    
    this.performanceTracker.endPhase('parameters');
  }
  
  private async executeComputation(inputs: NodeInputs): Promise<NodeOutput> {
    this.performanceTracker.startPhase('compute');
    
    // Validate inputs
    if (!this.node.validateInputs(inputs)) {
      throw new Error('Input validation failed');
    }
    
    // Execute the actual node computation
    let output: NodeOutput;
    if (this.node.supportsAsyncComputation()) {
      output = await this.node.cookAsync(inputs);
    } else {
      output = this.node.cook(inputs);
    }
    
    this.performanceTracker.endPhase('compute');
    return output;
  }
  
  private processOutput(output: NodeOutput): void {
    this.performanceTracker.startPhase('output');
    
    // Store output with metadata
    this.node.setOutput(output.data, output.metadata);
    
    // Clear dirty state
    this.node.clearDirtyState();
    
    this.performanceTracker.endPhase('output');
  }
  
  private handleComputeError(error: any): void {
    console.error(`Node ${this.node.id} computation failed:`, error);
    
    // Set error state
    this.node.setError(error.message || String(error));
    
    // Attempt error recovery
    this.node.errorRecovery.handleError(error);
  }
  
  private initCookingState(): void {
    this.cooking = true;
    this.cookingTimestamp = performance.now();
    this.cookCount++;
  }
  
  private endCook(): void {
    this.cooking = false;
    this.lastCookTime = performance.now() - (this.cookingTimestamp || 0);
    
    // Record performance data
    this.performanceTracker.recordCook(this.lastCookTime);
  }
}
```

**Benefits**:
- Comprehensive cooking lifecycle with validation
- Parallel input evaluation for performance
- Proper error handling and recovery
- Performance tracking for optimization
- Support for both sync and async computation

### 3.2 Enhanced Node Base Class

**File**: `src/engine/nodes/BaseNode.ts` (MODIFY EXISTING)

```typescript
interface NodeCapabilities {
  asyncComputation: boolean;
  dynamicInputs: boolean;
  dynamicOutputs: boolean;
  cacheable: boolean;
  validateInputs: boolean;
}

export abstract class BaseNode {
  protected cookController: NodeCookController;
  protected dirtyController: DirtyController;
  protected errorRecovery: ErrorRecovery;
  protected parameterController: ParameterController;
  protected performanceTracker: PerformanceTracker;
  
  // Node metadata
  readonly id: string;
  readonly type: string;
  readonly capabilities: NodeCapabilities;
  
  // Runtime state
  protected output: any = null;
  protected outputMetadata: Record<string, any> = {};
  protected error: string | null = null;
  protected isDirtyFlag: boolean = true;
  
  constructor(id: string, type: string, scene: Scene) {
    this.id = id;
    this.type = type;
    this.capabilities = this.defineCapabilities();
    
    this.cookController = new NodeCookController(this);
    this.dirtyController = new DirtyController(this, scene.cooker);
    this.errorRecovery = new ErrorRecovery(this);
    this.parameterController = new ParameterController(this);
    this.performanceTracker = new PerformanceTracker(this.id);
  }
  
  // Main computation interface
  abstract cook(inputs: NodeInputs): NodeOutput;
  
  // Optional async computation
  async cookAsync(inputs: NodeInputs): Promise<NodeOutput> {
    return this.cook(inputs);
  }
  
  // Input validation (override in specific nodes)
  validateInputs(inputs: NodeInputs): boolean {
    return true;
  }
  
  // Output processing (override for complex outputs)
  processOutput(output: any): NodeOutput {
    return { data: output };
  }
  
  // Capability definition (override in specific nodes)
  protected defineCapabilities(): NodeCapabilities {
    return {
      asyncComputation: false,
      dynamicInputs: false,
      dynamicOutputs: false,
      cacheable: true,
      validateInputs: false
    };
  }
  
  // State management
  isDirty(): boolean {
    return this.isDirtyFlag;
  }
  
  setDirty(trigger?: BaseNode): void {
    this.dirtyController.setDirty(trigger);
  }
  
  clearDirtyState(): void {
    this.isDirtyFlag = false;
    this.dirtyController.removeDirtyState();
  }
  
  // Output management
  setOutput(data: any, metadata?: Record<string, any>): void {
    this.output = data;
    this.outputMetadata = metadata || {};
    this.error = null;
  }
  
  getOutput(handle?: string): any {
    if (handle && handle !== 'default') {
      // Support for multiple outputs in future
      return this.outputMetadata[handle];
    }
    return this.output;
  }
  
  hasValidOutput(): boolean {
    return this.output !== null && this.error === null;
  }
  
  // Error management
  setError(message: string): void {
    this.error = message;
    this.output = null;
  }
  
  clearError(): void {
    this.error = null;
  }
  
  // Capability queries
  supportsAsyncComputation(): boolean {
    return this.capabilities.asyncComputation;
  }
  
  supportsDynamicInputs(): boolean {
    return this.capabilities.dynamicInputs;
  }
  
  needsParameterEvaluation(): boolean {
    return this.parameterController.hasExpressionsOrDependencies();
  }
}
```

**Benefits**:
- Comprehensive node lifecycle management
- Support for both sync and async computation
- Proper error handling and recovery
- Performance tracking and optimization
- Extensible capability system
- Clean separation of concerns

### 3.3 Error Recovery System

**File**: `src/engine/nodes/ErrorRecovery.ts` (NEW)

```typescript
interface ErrorState {
  nodeId: string;
  error: string;
  timestamp: number;
  recoveryAttempts: number;
  lastGoodOutput?: any;
  recoveryStrategy?: string;
}

export class ErrorRecovery {
  private errorStates: Map<string, ErrorState> = new Map();
  private maxRecoveryAttempts = 3;
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  
  constructor(private node: BaseNode) {
    this.initializeRecoveryStrategies();
  }
  
  handleError(error: Error): void {
    const errorState: ErrorState = {
      nodeId: this.node.id,
      error: error.message,
      timestamp: Date.now(),
      recoveryAttempts: 0
    };
    
    // Store last good output before error
    if (this.node.hasValidOutput()) {
      errorState.lastGoodOutput = this.node.getOutput();
    }
    
    this.errorStates.set(this.node.id, errorState);
    
    // Attempt recovery
    this.attemptRecovery(errorState);
  }
  
  private async attemptRecovery(errorState: ErrorState): Promise<boolean> {
    if (errorState.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.error(`Max recovery attempts reached for node ${errorState.nodeId}`);
      return false;
    }
    
    errorState.recoveryAttempts++;
    
    // Try recovery strategies in order
    const strategies = ['clearCache', 'useLastGoodOutput', 'useDefaultOutput', 'skipComputation'];
    
    for (const strategyName of strategies) {
      const strategy = this.recoveryStrategies.get(strategyName);
      if (strategy) {
        try {
          const success = await strategy.execute(this.node, errorState);
          if (success) {
            errorState.recoveryStrategy = strategyName;
            console.log(`Node ${errorState.nodeId} recovered using strategy: ${strategyName}`);
            return true;
          }
        } catch (recoveryError) {
          console.warn(`Recovery strategy ${strategyName} failed:`, recoveryError);
        }
      }
    }
    
    return false;
  }
  
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies.set('clearCache', new ClearCacheStrategy());
    this.recoveryStrategies.set('useLastGoodOutput', new UseLastGoodOutputStrategy());
    this.recoveryStrategies.set('useDefaultOutput', new UseDefaultOutputStrategy());
    this.recoveryStrategies.set('skipComputation', new SkipComputationStrategy());
  }
  
  clearErrorState(): void {
    this.errorStates.delete(this.node.id);
  }
  
  hasErrorState(): boolean {
    return this.errorStates.has(this.node.id);
  }
}

interface RecoveryStrategy {
  execute(node: BaseNode, errorState: ErrorState): Promise<boolean>;
}

class ClearCacheStrategy implements RecoveryStrategy {
  async execute(node: BaseNode, errorState: ErrorState): Promise<boolean> {
    // Clear node caches and retry computation
    node.clearCaches();
    try {
      await node.cookController.cookMain();
      return node.hasValidOutput();
    } catch (error) {
      return false;
    }
  }
}

class UseLastGoodOutputStrategy implements RecoveryStrategy {
  async execute(node: BaseNode, errorState: ErrorState): Promise<boolean> {
    if (errorState.lastGoodOutput) {
      node.setOutput(errorState.lastGoodOutput, { recoveryUsed: true });
      node.clearError();
      return true;
    }
    return false;
  }
}
```

**Benefits**:
- Automatic error recovery with multiple strategies
- Preserves last good outputs for fallback
- Prevents cascade failures in complex graphs
- Provides detailed error tracking and reporting
- Extensible recovery strategy system

## Phase 4: Parametric Flow Enhancement

### 4.1 Connection Point Management

**File**: `src/engine/connections/ConnectionPoints.ts` (NEW)

```typescript
interface ConnectionPoint {
  name: string;
  type: 'input' | 'output';
  dataType: string;
  required: boolean;
  multipleConnections: boolean;
  defaultValue?: any;
  validation?: (value: any) => boolean;
  description?: string;
}

export class ConnectionPointsManager {
  private inputPoints: Map<string, ConnectionPoint[]> = new Map();
  private outputPoints: Map<string, ConnectionPoint[]> = new Map();
  private connectionRules: Map<string, ConnectionRule[]> = new Map();
  
  setInputPoints(nodeId: string, points: ConnectionPoint[]): void {
    this.inputPoints.set(nodeId, points);
    this.validateExistingConnections(nodeId);
  }
  
  setOutputPoints(nodeId: string, points: ConnectionPoint[]): void {
    this.outputPoints.set(nodeId, points);
    this.updateConnectionCapabilities(nodeId);
  }
  
  canConnect(
    sourceId: string, 
    targetId: string, 
    sourceHandle?: string, 
    targetHandle?: string
  ): { canConnect: boolean; reason?: string } {
    
    const sourcePoints = this.outputPoints.get(sourceId);
    const targetPoints = this.inputPoints.get(targetId);
    
    if (!sourcePoints || !targetPoints) {
      return { canConnect: false, reason: 'Connection points not defined' };
    }
    
    // Find relevant connection points
    const sourcePoint = sourcePoints.find(p => p.name === (sourceHandle || 'default'));
    const targetPoint = targetPoints.find(p => p.name === (targetHandle || 'default'));
    
    if (!sourcePoint || !targetPoint) {
      return { canConnect: false, reason: 'Connection point not found' };
    }
    
    // Check data type compatibility
    if (!this.areDataTypesCompatible(sourcePoint.dataType, targetPoint.dataType)) {
      return { canConnect: false, reason: 'Incompatible data types' };
    }
    
    // Check if target already has connection and doesn't allow multiple
    if (!targetPoint.multipleConnections) {
      const existingConnections = this.connectionManager.getInputConnections(targetId);
      const hasExistingConnection = existingConnections.some(
        conn => conn.targetHandle === (targetHandle || 'default')
      );
      
      if (hasExistingConnection) {
        return { canConnect: false, reason: 'Target already connected' };
      }
    }
    
    // Check custom connection rules
    const canConnectCustom = this.validateCustomRules(sourceId, targetId, sourceHandle, targetHandle);
    if (!canConnectCustom.valid) {
      return { canConnect: false, reason: canConnectCustom.reason };
    }
    
    return { canConnect: true };
  }
  
  private areDataTypesCompatible(sourceType: string, targetType: string): boolean {
    // Exact match
    if (sourceType === targetType) return true;
    
    // Check type hierarchy (e.g., 'mesh' extends 'geometry')
    return this.isTypeAssignable(sourceType, targetType);
  }
  
  private isTypeAssignable(sourceType: string, targetType: string): boolean {
    const typeHierarchy: Record<string, string[]> = {
      'geometry': ['mesh', 'points', 'line'],
      'object3d': ['geometry', 'light', 'camera'],
      'any': ['object3d', 'number', 'string', 'boolean', 'vector']
    };
    
    return typeHierarchy[targetType]?.includes(sourceType) || false;
  }
  
  getConnectionPointInfo(nodeId: string, handle: string, type: 'input' | 'output'): ConnectionPoint | undefined {
    const points = type === 'input' 
      ? this.inputPoints.get(nodeId) 
      : this.outputPoints.get(nodeId);
    
    return points?.find(p => p.name === handle);
  }
  
  getDefaultValue(nodeId: string, inputHandle: string): any {
    const point = this.getConnectionPointInfo(nodeId, inputHandle, 'input');
    return point?.defaultValue;
  }
}
```

**Benefits**:
- Flexible connection validation system
- Support for data type compatibility checking
- Default values for unconnected inputs
- Extensible connection rules
- Foundation for visual connection feedback

### 4.2 Dynamic Node Inputs/Outputs

**File**: `src/flow/nodes/DynamicNode.ts` (NEW)

```typescript
export abstract class DynamicNode extends BaseNode {
  protected connectionPoints: {
    inputs: ConnectionPoint[];
    outputs: ConnectionPoint[];
  } = { inputs: [], outputs: [] };
  
  protected defineCapabilities(): NodeCapabilities {
    return {
      ...super.defineCapabilities(),
      dynamicInputs: true,
      dynamicOutputs: true
    };
  }
  
  protected updateConnectionPoints(): void {
    const points = this.defineConnectionPoints();
    this.connectionPoints = points;
    
    // Update in connection points manager
    const scene = this.getScene();
    scene.connectionPointsManager.setInputPoints(this.id, points.inputs);
    scene.connectionPointsManager.setOutputPoints(this.id, points.outputs);
    
    // Trigger UI update
    this.notifyConnectionPointsChanged();
  }
  
  protected abstract defineConnectionPoints(): {
    inputs: ConnectionPoint[];
    outputs: ConnectionPoint[];
  };
  
  // Override parameter change handler to update connection points
  onParameterChanged(paramName: string, value: any): void {
    super.onParameterChanged(paramName, value);
    
    // Check if this parameter affects connection points
    if (this.parameterAffectsConnectionPoints(paramName)) {
      this.updateConnectionPoints();
    }
  }
  
  protected parameterAffectsConnectionPoints(paramName: string): boolean {
    // Override in specific nodes (e.g., Merge node with inputCount parameter)
    return false;
  }
  
  // Helper methods for common dynamic patterns
  protected createVariableInputs(count: number, baseName: string, dataType: string): ConnectionPoint[] {
    return Array.from({ length: count }, (_, i) => ({
      name: `${baseName}_${i}`,
      type: 'input' as const,
      dataType,
      required: false,
      multipleConnections: false,
      description: `${baseName} input ${i + 1}`
    }));
  }
  
  protected createNamedOutputs(names: string[], dataType: string): ConnectionPoint[] {
    return names.map(name => ({
      name,
      type: 'output' as const,
      dataType,
      required: false,
      multipleConnections: true,
      description: `${name} output`
    }));
  }
}

// Example: Merge node with variable inputs
export class MergeNode extends DynamicNode {
  protected defineConnectionPoints() {
    const inputCount = this.getParameterValue('inputCount') || 2;
    
    return {
      inputs: this.createVariableInputs(inputCount, 'input', 'geometry'),
      outputs: [{
        name: 'output',
        type: 'output' as const,
        dataType: 'geometry',
        required: false,
        multipleConnections: true,
        description: 'Merged geometry output'
      }]
    };
  }
  
  protected parameterAffectsConnectionPoints(paramName: string): boolean {
    return paramName === 'inputCount';
  }
  
  cook(inputs: NodeInputs): NodeOutput {
    // Merge all connected inputs
    const geometries = Object.values(inputs).filter(Boolean);
    const merged = this.mergeGeometries(geometries);
    
    return { data: merged };
  }
}

// Example: Switch node with conditional outputs
export class SwitchNode extends DynamicNode {
  protected defineConnectionPoints() {
    const outputMode = this.getParameterValue('outputMode') || 'single';
    
    const inputs = [
      {
        name: 'input',
        type: 'input' as const,
        dataType: 'any',
        required: true,
        multipleConnections: false
      },
      {
        name: 'condition',
        type: 'input' as const,
        dataType: 'boolean',
        required: true,
        multipleConnections: false
      }
    ];
    
    const outputs = outputMode === 'dual' 
      ? this.createNamedOutputs(['true_output', 'false_output'], 'any')
      : this.createNamedOutputs(['output'], 'any');
    
    return { inputs, outputs };
  }
  
  protected parameterAffectsConnectionPoints(paramName: string): boolean {
    return paramName === 'outputMode';
  }
}
```

**Benefits**:
- Flexible node configurations based on parameters
- Support for variable input/output counts
- Clean API for common dynamic patterns
- Automatic connection point management
- Foundation for advanced node types

### 4.3 Parameter Dependency Tracking

**File**: `src/engine/params/DependencyTracker.ts` (NEW)

```typescript
interface ParameterDependency {
  nodeId: string;
  paramName: string;
  expression: string;
  dependencies: string[];
  compiledExpression?: CompiledExpression;
}

export class ParameterDependencyTracker {
  private dependencies: Map<string, ParameterDependency> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private evaluationCache: Map<string, { value: any; timestamp: number }> = new Map();
  private expressionCompiler: ExpressionCompiler;
  
  constructor() {
    this.expressionCompiler = new ExpressionCompiler();
  }
  
  setParameterExpression(nodeId: string, paramName: string, expression: string): void {
    const key = `${nodeId}.${paramName}`;
    
    // Parse expression to find dependencies
    const dependencies = this.expressionCompiler.extractDependencies(expression);
    
    // Compile expression for efficient evaluation
    const compiledExpression = this.expressionCompiler.compile(expression);
    
    const dependency: ParameterDependency = {
      nodeId,
      paramName,
      expression,
      dependencies,
      compiledExpression
    };
    
    this.dependencies.set(key, dependency);
    this.updateDependencyGraph(key, dependencies);
    
    // Invalidate cache for this parameter and dependents
    this.invalidateCache(key);
  }
  
  removeParameterExpression(nodeId: string, paramName: string): void {
    const key = `${nodeId}.${paramName}`;
    this.dependencies.delete(key);
    this.dependencyGraph.delete(key);
    this.evaluationCache.delete(key);
  }
  
  evaluateParameter(nodeId: string, paramName: string): any {
    const key = `${nodeId}.${paramName}`;
    const dependency = this.dependencies.get(key);
    
    if (!dependency) {
      // No expression, return raw parameter value
      return this.getRawParameterValue(nodeId, paramName);
    }
    
    // Check cache
    const cached = this.evaluationCache.get(key);
    if (cached && this.isCacheValid(cached, dependency)) {
      return cached.value;
    }
    
    // Evaluate dependencies first
    const context = this.buildEvaluationContext(dependency);
    
    // Evaluate expression
    const value = dependency.compiledExpression?.evaluate(context) || dependency.expression;
    
    // Cache result
    this.evaluationCache.set(key, {
      value,
      timestamp: Date.now()
    });
    
    return value;
  }
  
  private buildEvaluationContext(dependency: ParameterDependency): Record<string, any> {
    const context: Record<string, any> = {};
    
    for (const dep of dependency.dependencies) {
      if (dep.startsWith('node.')) {
        // Node reference: node.boxNode1.width
        const [, nodeId, paramName] = dep.split('.');
        context[dep] = this.evaluateParameter(nodeId, paramName);
      } else if (dep.startsWith('global.')) {
        // Global reference: global.time, global.frame
        const [, globalName] = dep.split('.');
        context[dep] = this.getGlobalValue(globalName);
      } else if (dep.startsWith('input.')) {
        // Input reference: input.geometry.bounds
        const [, inputName, property] = dep.split('.');
        context[dep] = this.getInputProperty(dependency.nodeId, inputName, property);
      }
    }
    
    return context;
  }
  
  private updateDependencyGraph(key: string, dependencies: string[]): void {
    this.dependencyGraph.set(key, new Set(dependencies));
    
    // Check for cycles
    if (this.hasCycle(key)) {
      throw new Error(`Circular dependency detected for parameter ${key}`);
    }
  }
  
  private hasCycle(startKey: string): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();
    
    const visit = (key: string): boolean => {
      if (stack.has(key)) return true; // Cycle found
      if (visited.has(key)) return false;
      
      visited.add(key);
      stack.add(key);
      
      const deps = this.dependencyGraph.get(key) || new Set();
      for (const dep of deps) {
        if (visit(dep)) return true;
      }
      
      stack.delete(key);
      return false;
    };
    
    return visit(startKey);
  }
  
  private invalidateCache(key: string): void {
    this.evaluationCache.delete(key);
    
    // Invalidate all dependents
    for (const [depKey, deps] of this.dependencyGraph.entries()) {
      if (deps.has(key)) {
        this.invalidateCache(depKey);
      }
    }
  }
  
  getDependents(nodeId: string, paramName: string): string[] {
    const key = `${nodeId}.${paramName}`;
    const dependents: string[] = [];
    
    for (const [depKey, deps] of this.dependencyGraph.entries()) {
      if (deps.has(key)) {
        dependents.push(depKey);
      }
    }
    
    return dependents;
  }
  
  hasExpression(nodeId: string, paramName: string): boolean {
    return this.dependencies.has(`${nodeId}.${paramName}`);
  }
}

class ExpressionCompiler {
  extractDependencies(expression: string): string[] {
    // Parse expression to find references like:
    // - node.boxNode1.width
    // - global.time
    // - input.geometry.bounds.max.x
    
    const dependencyRegex = /(node\.\w+\.\w+|global\.\w+|input\.\w+(?:\.\w+)*)/g;
    const matches = expression.match(dependencyRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
  }
  
  compile(expression: string): CompiledExpression {
    // Create a compiled function for efficient evaluation
    // This could use a library like mathjs or a custom parser
    
    return {
      evaluate: (context: Record<string, any>) => {
        // Replace references with context values and evaluate
        let processedExpression = expression;
        
        for (const [key, value] of Object.entries(context)) {
          processedExpression = processedExpression.replace(
            new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            String(value)
          );
        }
        
        // Safely evaluate the expression
        try {
          return Function(`"use strict"; return (${processedExpression})`)();
        } catch (error) {
          throw new Error(`Expression evaluation failed: ${error.message}`);
        }
      }
    };
  }
}

interface CompiledExpression {
  evaluate(context: Record<string, any>): any;
}
```

**Benefits**:
- Powerful parameter expressions with node references
- Automatic dependency tracking and cache invalidation
- Cycle detection for parameter dependencies
- Efficient expression compilation and evaluation
- Support for global variables and input properties

### 4.4 Advanced Node Registry

**File**: `src/engine/nodeRegistry.ts` (ENHANCE EXISTING)

```typescript
interface EnhancedNodeDefinition extends NodeDefinition {
  // Existing properties...
  type: string;
  category: string;
  displayName: string;
  allowedContexts: ("root" | "subflow")[];
  params: NodeParams;
  compute: (params: any, inputs?: any) => any;
  
  // New capabilities
  dynamicInputs?: boolean;
  dynamicOutputs?: boolean;
  connectionPoints?: {
    inputs: ConnectionPoint[];
    outputs: ConnectionPoint[];
  };
  asyncCompute?: boolean;
  cacheable?: boolean;
  dependencies?: string[];
  validation?: {
    inputs?: (inputs: any) => { valid: boolean; message?: string };
    params?: (params: any) => { valid: boolean; message?: string };
  };
  metadata?: {
    description?: string;
    documentation?: string;
    examples?: any[];
    version?: string;
    author?: string;
  };
}

interface NodeCapabilities {
  supportsDynamicInputs: boolean;
  supportsDynamicOutputs: boolean;
  supportsAsyncComputation: boolean;
  supportsCaching: boolean;
  supportsValidation: boolean;
  maxInputs: number;
  maxOutputs: number;
  requiredInputs: string[];
  optionalInputs: string[];
}

class EnhancedNodeRegistry {
  private nodeRegistry: Record<string, EnhancedNodeDefinition> = {};
  private nodeCapabilities: Map<string, NodeCapabilities> = new Map();
  private categoryIndex: Map<string, string[]> = new Map();
  private tagIndex: Map<string, string[]> = new Map();
  
  register(nodeType: string, definition: EnhancedNodeDefinition): void {
    this.nodeRegistry[nodeType] = definition;
    
    // Build capability cache
    const capabilities = this.computeCapabilities(definition);
    this.nodeCapabilities.set(nodeType, capabilities);
    
    // Update category index
    this.updateCategoryIndex(definition.category, nodeType);
    
    // Update tag index if metadata has tags
    if (definition.metadata?.tags) {
      for (const tag of definition.metadata.tags) {
        this.updateTagIndex(tag, nodeType);
      }
    }
  }
  
  getNodeCapabilities(nodeType: string): NodeCapabilities | undefined {
    return this.nodeCapabilities.get(nodeType);
  }
  
  getCompatibleNodes(outputType: string): string[] {
    const compatible: string[] = [];
    
    for (const [nodeType, definition] of Object.entries(this.nodeRegistry)) {
      const connectionPoints = definition.connectionPoints;
      if (connectionPoints?.inputs) {
        const hasCompatibleInput = connectionPoints.inputs.some(
          input => this.areDataTypesCompatible(outputType, input.dataType)
        );
        if (hasCompatibleInput) {
          compatible.push(nodeType);
        }
      }
    }
    
    return compatible;
  }
  
  searchNodes(query: string, filters?: {
    category?: string;
    capabilities?: Partial<NodeCapabilities>;
    tags?: string[];
  }): EnhancedNodeDefinition[] {
    let results = Object.values(this.nodeRegistry);
    
    // Text search
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(def => 
        def.displayName.toLowerCase().includes(lowerQuery) ||
        def.type.toLowerCase().includes(lowerQuery) ||
        def.metadata?.description?.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Category filter
    if (filters?.category) {
      results = results.filter(def => def.category === filters.category);
    }
    
    // Capability filters
    if (filters?.capabilities) {
      results = results.filter(def => {
        const capabilities = this.nodeCapabilities.get(def.type);
        if (!capabilities) return false;
        
        return Object.entries(filters.capabilities!).every(([key, value]) => {
          return capabilities[key as keyof NodeCapabilities] === value;
        });
      });
    }
    
    // Tag filters
    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter(def => {
        const nodeTags = def.metadata?.tags || [];
        return filters.tags!.some(tag => nodeTags.includes(tag));
      });
    }
    
    return results;
  }
  
  getNodeTemplate(nodeType: string): NodeTemplate | undefined {
    const definition = this.nodeRegistry[nodeType];
    if (!definition) return undefined;
    
    return {
      type: nodeType,
      displayName: definition.displayName,
      category: definition.category,
      defaultParams: this.extractDefaultParams(definition.params),
      connectionPoints: definition.connectionPoints,
      capabilities: this.nodeCapabilities.get(nodeType)!
    };
  }
  
  private computeCapabilities(definition: EnhancedNodeDefinition): NodeCapabilities {
    const connectionPoints = definition.connectionPoints;
    
    return {
      supportsDynamicInputs: definition.dynamicInputs || false,
      supportsDynamicOutputs: definition.dynamicOutputs || false,
      supportsAsyncComputation: definition.asyncCompute || false,
      supportsCaching: definition.cacheable !== false,
      supportsValidation: !!definition.validation,
      maxInputs: connectionPoints?.inputs.length || Infinity,
      maxOutputs: connectionPoints?.outputs.length || 1,
      requiredInputs: connectionPoints?.inputs.filter(p => p.required).map(p => p.name) || [],
      optionalInputs: connectionPoints?.inputs.filter(p => !p.required).map(p => p.name) || []
    };
  }
  
  private areDataTypesCompatible(outputType: string, inputType: string): boolean {
    // Implement type compatibility checking
    // This could be enhanced with a proper type system
    return outputType === inputType || inputType === 'any';
  }
}

interface NodeTemplate {
  type: string;
  displayName: string;
  category: string;
  defaultParams: Record<string, any>;
  connectionPoints?: {
    inputs: ConnectionPoint[];
    outputs: ConnectionPoint[];
  };
  capabilities: NodeCapabilities;
}
```

**Benefits**:
- Rich node metadata and capability system
- Advanced search and filtering capabilities
- Type compatibility checking
- Node template system for UI generation
- Performance optimizations with capability caching
- Extensible validation system

## Implementation Benefits Summary

### Immediate Benefits (Phase 1-2)
-  **Completely eliminates one-to-many connection issues**
-  **Solves all current recomputation problems**
-  **Dramatically improves performance** with caching and batching
-  **Removes ~500 lines of complex, buggy code**
-  **Provides stable foundation** for advanced features

### Advanced Benefits (Phase 3-4)
-  **Enables complex async node operations** (file loading, API calls)
-  **Comprehensive error handling** with automatic recovery
-  **Advanced parametric modeling** with expressions and dependencies
-  **Dynamic node configurations** for flexible workflows
-  **Professional-grade architecture** matching industry standards

### Performance Improvements
- **Graph Traversal**: O(n) ’ O(1) with caching
- **Connection Lookup**: O(n) ’ O(1) with Map structures
- **Recomputation**: Batched processing eliminates cascading updates
- **Memory Usage**: Efficient data structures reduce memory footprint
- **Computation Time**: Parallel input evaluation and optimized algorithms

### Developer Experience
- **Cleaner Code**: Separation of concerns with dedicated controllers
- **Better Debugging**: Comprehensive logging and performance tracking
- **Easier Testing**: Modular architecture enables unit testing
- **Documentation**: Rich metadata system for node documentation
- **Extensibility**: Clean APIs for adding new node types and capabilities

## Migration Strategy

Since backward compatibility is not a concern, we can implement these changes progressively:

### Phase 1: Foundation (Week 1-2)
- Implement CoreGraph and ConnectionManager
- Replace basic dependency maps in GraphStore
- Add simple batching with Cooker

### Phase 2: Enhancement (Week 3-4)
- Implement DirtyController and advanced batching
- Add comprehensive error handling
- Integrate performance tracking

### Phase 3: Advanced Features (Week 5-6)
- Implement enhanced node system
- Add parameter dependency tracking
- Create dynamic node capabilities

### Phase 4: Polish (Week 7-8)
- Implement connection point management
- Add advanced node registry features
- Performance optimization and testing

## Testing Strategy

### Unit Tests
- CoreGraph operations (connect, disconnect, traversal)
- ConnectionManager functionality
- Cooker batching behavior
- DirtyController propagation
- Parameter dependency evaluation

### Integration Tests
- Complex graph scenarios (multiple one-to-many connections)
- Error recovery workflows
- Performance benchmarks
- Dynamic node reconfiguration

### Stress Tests
- Large graph processing (1000+ nodes)
- Rapid parameter changes
- Memory usage under load
- Concurrent operations

This comprehensive enhancement plan will transform MinimySTX into a robust, performant parametric modeling platform capable of handling advanced workflows while maintaining clean, maintainable code.