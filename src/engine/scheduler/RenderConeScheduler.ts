import { GraphLibAdapter } from '../graph/GraphLibAdapter';
import { nodeRegistry } from '../nodeRegistry';
import { BaseContainer } from '../containers/BaseContainer';
import { InputCloneMode } from '../graphStore';

export interface ComputeContext {
  nodeId: string;
  renderTarget: string | null;
  isInRenderCone: boolean;
  abortSignal?: AbortSignal;
  inputs: Record<string, BaseContainer>;
  outputs: Record<string, BaseContainer>;
}

export interface SchedulerEvent {
  type: 'node-computed' | 'cone-updated' | 'render-target-changed' | 'input-connected' | 'input-disconnected';
  nodeId: string;
  output?: any;
  outputs?: Record<string, BaseContainer>;
  error?: string;
  inputKey?: string;
  sourceNodeId?: string;
}

export type SchedulerListener = (event: SchedulerEvent) => void;

/**
 * RenderConeScheduler - Core implementation of render-cone computation semantics
 * 
 * Implements requirements from minimystx-reactive-recompute.md:
 * - R1: Render-cone recompute only - Only dirty nodes within active render cone recompute
 * - R5: Single render target per context - Exactly one render target active per context
 * - S1: Topological scheduling - Compute topo order limited to the cone
 * - I1: Fine-grained dirty marking - Mark dirty only edited node + downstream dependents within cone
 */
export class RenderConeScheduler {
  private graph: GraphLibAdapter;
  private renderTarget: string | null = null;
  private listeners = new Set<SchedulerListener>();
  private nodeOutputs = new Map<string, Record<string, BaseContainer>>();
  private nodeParams = new Map<string, Record<string, any>>();
  private nodeInputs = new Map<string, Record<string, BaseContainer>>();
  private inputConnections = new Map<string, Map<string, string>>(); // nodeId -> inputName -> sourceNodeId
  private outputConnections = new Map<string, Map<string, Set<string>>>(); // nodeId -> outputName -> Set<targetNodeIds>
  private dirtyNodes = new Set<string>();
  private computingNodes = new Set<string>();
  private abortControllers = new Map<string, AbortController>();

  constructor(graph: GraphLibAdapter) {
    this.graph = graph;
  }

  /**
   * R5: Set single render target per context
   * Switching targets recomputes only the newly selected cone
   */
  setRenderTarget(nodeId: string | null): void {
    const previousTarget = this.renderTarget;
    this.renderTarget = nodeId;

    // Compute new render cone
    const newCone = this.computeRenderCone();
    const previousCone = previousTarget ? this.computeRenderConeFor(previousTarget) : [];

    // Mark newly included nodes as dirty
    const newlyIncluded = newCone.filter(id => !previousCone.includes(id));
    newlyIncluded.forEach(nodeId => this.dirtyNodes.add(nodeId));

    this.emitEvent({ type: 'render-target-changed', nodeId: nodeId || '' });
    
    if (newCone.length > 0) {
      this.scheduleComputation();
    }
  }

  /**
   * R1: Only compute nodes in render cone
   * Parameter changes outside cone cause ZERO recomputations
   */
  onParameterChange(nodeId: string, params: Record<string, any>): void {
    // Update stored parameters
    this.nodeParams.set(nodeId, { ...this.nodeParams.get(nodeId), ...params });

    // Critical requirement: Only process if node is in render cone
    if (!this.isInRenderCone(nodeId)) {
      return; // Zero recomputation outside cone
    }

    // I1: Mark dirty only the edited node and downstream dependents within cone
    this.markDirtyInCone(nodeId);
    this.scheduleComputation();
  }

  /**
   * Handle typed input changes from connections
   */
  onInputChange(nodeId: string, inputKey: string, container: BaseContainer): void {
    const inputs = this.nodeInputs.get(nodeId) || {};
    inputs[inputKey] = container;
    this.nodeInputs.set(nodeId, inputs);

    if (this.isInRenderCone(nodeId)) {
      this.markDirtyInCone(nodeId);
      this.scheduleComputation();
    }
  }

  /**
   * Connect typed input to output
   */
  connectInput(
    sourceNodeId: string,
    sourceOutput: string,
    targetNodeId: string, 
    targetInput: string
  ): boolean {
    // Update connection tracking
    if (!this.inputConnections.has(targetNodeId)) {
      this.inputConnections.set(targetNodeId, new Map());
    }
    this.inputConnections.get(targetNodeId)!.set(targetInput, sourceNodeId);

    if (!this.outputConnections.has(sourceNodeId)) {
      this.outputConnections.set(sourceNodeId, new Map());
    }
    if (!this.outputConnections.get(sourceNodeId)!.has(sourceOutput)) {
      this.outputConnections.get(sourceNodeId)!.set(sourceOutput, new Set());
    }
    this.outputConnections.get(sourceNodeId)!.get(sourceOutput)!.add(targetNodeId);

    // Get source output value and propagate
    const sourceOutputs = this.nodeOutputs.get(sourceNodeId);
    if (sourceOutputs && sourceOutputs[sourceOutput]) {
      this.onInputChange(targetNodeId, targetInput, sourceOutputs[sourceOutput]);
    }

    this.emitEvent({
      type: 'input-connected',
      nodeId: targetNodeId,
      inputKey: targetInput,
      sourceNodeId
    });

    return true;
  }

  /**
   * Disconnect typed input
   */
  disconnectInput(targetNodeId: string, targetInput: string): boolean {
    const inputConnections = this.inputConnections.get(targetNodeId);
    if (!inputConnections) return false;

    const sourceNodeId = inputConnections.get(targetInput);
    if (!sourceNodeId) return false;

    // Remove from input connections
    inputConnections.delete(targetInput);
    if (inputConnections.size === 0) {
      this.inputConnections.delete(targetNodeId);
    }

    // Remove from output connections
    const outputConnections = this.outputConnections.get(sourceNodeId);
    if (outputConnections) {
      outputConnections.forEach((targets, outputName) => {
        targets.delete(targetNodeId);
        if (targets.size === 0) {
          outputConnections.delete(outputName);
        }
      });
      if (outputConnections.size === 0) {
        this.outputConnections.delete(sourceNodeId);
      }
    }

    // Clear input value
    const inputs = this.nodeInputs.get(targetNodeId);
    if (inputs) {
      delete inputs[targetInput];
    }

    // Mark target node dirty
    if (this.isInRenderCone(targetNodeId)) {
      this.markDirtyInCone(targetNodeId);
      this.scheduleComputation();
    }

    this.emitEvent({
      type: 'input-disconnected',
      nodeId: targetNodeId,
      inputKey: targetInput,
      sourceNodeId
    });

    return true;
  }

  /**
   * Add/remove connections update graph and trigger recomputation
   */
  onConnectionChange(sourceId: string, targetId: string, added: boolean): void {
    if (added) {
      // When adding connection, target and its dependents need recomputation
      if (this.isInRenderCone(targetId)) {
        this.markDirtyInCone(targetId);
        this.scheduleComputation();
      }
    } else {
      // When removing connection, clear input and mark dirty
      const inputs = this.nodeInputs.get(targetId) || {};
      delete inputs[sourceId];
      this.nodeInputs.set(targetId, inputs);
      
      if (this.isInRenderCone(targetId)) {
        this.markDirtyInCone(targetId);
        this.scheduleComputation();
      }
    }
  }

  /**
   * Get current typed outputs for a node
   */
  getNodeOutputs(nodeId: string): Record<string, BaseContainer> | null {
    return this.nodeOutputs.get(nodeId) || null;
  }

  /**
   * Get specific typed output from a node
   */
  getNodeOutput(nodeId: string, outputName = 'default'): BaseContainer | null {
    const outputs = this.nodeOutputs.get(nodeId);
    return outputs ? outputs[outputName] || null : null;
  }

  /**
   * Add listener for scheduler events
   */
  addListener(listener: SchedulerListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: SchedulerListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Check if node is in current render cone
   */
  private isInRenderCone(nodeId: string): boolean {
    if (!this.renderTarget) return false;
    const cone = this.computeRenderCone();
    return cone.includes(nodeId);
  }

  /**
   * Compute render cone - upstream closure of render target
   */
  private computeRenderCone(): string[] {
    if (!this.renderTarget) return [];
    return this.computeRenderConeFor(this.renderTarget);
  }

  /**
   * Compute render cone for specific target
   */
  private computeRenderConeFor(targetId: string): string[] {
    try {
      // Get all upstream dependencies (predecessors) of the render target
      const predecessors = this.graph.getAllPredecessors(targetId);
      const cone = [targetId, ...predecessors.map(node => node.id)];
      return cone;
    } catch (error) {
      console.warn(`Failed to compute render cone for ${targetId}:`, error);
      return [targetId];
    }
  }

  /**
   * I1: Mark node and downstream dependents dirty (within cone only)
   */
  private markDirtyInCone(nodeId: string): void {
    const cone = this.computeRenderCone();
    const successors = this.graph.getAllSuccessors(nodeId);
    
    // Mark the node itself as dirty
    this.dirtyNodes.add(nodeId);
    
    // Mark downstream dependents that are in cone
    successors.forEach(successor => {
      if (cone.includes(successor.id)) {
        this.dirtyNodes.add(successor.id);
      }
    });
  }

  /**
   * Prepare inputs based on node's InputCloneMode
   */
  private prepareInputs(
    inputs: Record<string, BaseContainer>,
    cloneMode: InputCloneMode = InputCloneMode.NEVER,
    params?: Record<string, any>
  ): Record<string, BaseContainer> {
    switch (cloneMode) {
      case InputCloneMode.ALWAYS:
        return this.cloneInputContainers(inputs);
      
      case InputCloneMode.FROM_NODE:
        // Let the node decide based on parameters
        // For now, default to no cloning unless specifically requested
        const shouldClone = params?.general?.clone === true;
        return shouldClone ? this.cloneInputContainers(inputs) : inputs;
      
      case InputCloneMode.NEVER:
      default:
        // Return inputs by reference for performance
        return inputs;
    }
  }

  /**
   * Clone all containers in the inputs record
   */
  private cloneInputContainers(inputs: Record<string, BaseContainer>): Record<string, BaseContainer> {
    const cloned: Record<string, BaseContainer> = {};
    for (const [key, container] of Object.entries(inputs)) {
      cloned[key] = container.clone();
    }
    return cloned;
  }

  /**
   * Schedule computation of dirty nodes in render cone
   */
  private scheduleComputation(): void {
    // Use requestAnimationFrame for smooth UI updates
    requestAnimationFrame(() => this.processComputation());
  }

  /**
   * S1: Process computation with cone-limited topological ordering
   */
  private async processComputation(): Promise<void> {
    if (!this.renderTarget) return;

    const cone = this.computeRenderCone();
    const dirtyInCone = Array.from(this.dirtyNodes).filter(nodeId => cone.includes(nodeId));
    
    if (dirtyInCone.length === 0) return;

    try {
      // S1: Topological sort limited to dirty nodes in cone
      const sortedDirtyNodes = this.graph.topologicalSort(dirtyInCone);
      
      // Process nodes in topological order
      for (const nodeId of sortedDirtyNodes) {
        if (this.computingNodes.has(nodeId)) continue; // Skip if already computing
        
        await this.computeNode(nodeId);
      }
      
      this.emitEvent({ type: 'cone-updated', nodeId: this.renderTarget });
    } catch (error) {
      console.error('Computation failed:', error);
    }
  }

  /**
   * Compute single node with proper context and error handling
   */
  private async computeNode(nodeId: string): Promise<void> {
    if (!this.isInRenderCone(nodeId)) return;

    const node = this.graph.getNode(nodeId);
    const nodeDefinition = node?.type ? nodeRegistry[node.type as keyof typeof nodeRegistry] : undefined;
    if (!nodeDefinition) {
      console.warn(`No definition found for node ${nodeId}`);
      return;
    }

    // Cancel any previous computation for this node
    const existingAbort = this.abortControllers.get(nodeId);
    if (existingAbort) {
      existingAbort.abort();
    }

    const abortController = new AbortController();
    this.abortControllers.set(nodeId, abortController);
    this.computingNodes.add(nodeId);

    try {
      const params = this.nodeParams.get(nodeId) || {};
      const rawInputs = this.nodeInputs.get(nodeId) || {};
      
      // Prepare inputs based on node's InputCloneMode
      const cloneMode = nodeDefinition.inputCloneMode || InputCloneMode.NEVER;
      const inputs = this.prepareInputs(rawInputs, cloneMode, params);
      
      const context: ComputeContext = {
        nodeId,
        renderTarget: this.renderTarget,
        isInRenderCone: true,
        abortSignal: abortController.signal,
        inputs,
        outputs: {}
      };

      // Check if computation was cancelled
      if (abortController.signal.aborted) return;

      // Execute node computation with typed inputs and context
      let result: Record<string, BaseContainer> | undefined;
      if (nodeDefinition.computeTyped) {
        // Typed compute function - preferred for all geometry nodes
        result = await nodeDefinition.computeTyped(params, inputs, context);
      } else if (nodeDefinition.compute) {
        // Legacy compute function - used for non-geometry nodes (lights, etc.)
        console.warn(`Node ${nodeId} (type: ${nodeDefinition.type}) is using legacy compute function. Consider migrating to computeTyped.`);
        // For legacy nodes, don't try to convert to containers - just skip for now
        result = undefined;
      } else {
        console.error(`Node ${nodeId} (type: ${nodeDefinition.type}) has neither computeTyped nor compute function.`);
        result = undefined;
      }
      
      // Check if computation was cancelled after execution
      if (abortController.signal.aborted) return;

      // Store typed outputs and mark as clean
      if (result) {
        this.nodeOutputs.set(nodeId, result);
        this.propagateOutputs(nodeId, result);
      }
      this.dirtyNodes.delete(nodeId);
      
      // Emit computation event
      this.emitEvent({ 
        type: 'node-computed', 
        nodeId, 
        output: result?.default, // Legacy compatibility
        outputs: result 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Node computation failed for ${nodeId}:`, errorMessage);
      
      // Store error state - don't set nodeOutputs for error case
      this.emitEvent({ type: 'node-computed', nodeId, error: errorMessage });
      
    } finally {
      this.computingNodes.delete(nodeId);
      this.abortControllers.delete(nodeId);
    }
  }

  /**
   * Propagate outputs to connected inputs
   */
  private propagateOutputs(nodeId: string, outputs: Record<string, BaseContainer>): void {
    const outputConnections = this.outputConnections.get(nodeId);
    if (!outputConnections) return;

    outputConnections.forEach((targetNodes, outputName) => {
      const outputContainer = outputs[outputName];
      if (!outputContainer) return;

      targetNodes.forEach(targetNodeId => {
        // Find which input this connects to
        const inputConnections = this.inputConnections.get(targetNodeId);
        if (!inputConnections) return;

        inputConnections.forEach((sourceId, inputName) => {
          if (sourceId === nodeId) {
            this.onInputChange(targetNodeId, inputName, outputContainer);
          }
        });
      });
    });
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: SchedulerEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Scheduler listener error:', error);
      }
    });
  }

  /**
   * Get scheduler statistics for debugging
   */
  getStats() {
    return {
      renderTarget: this.renderTarget,
      coneSize: this.computeRenderCone().length,
      dirtyNodes: this.dirtyNodes.size,
      computingNodes: this.computingNodes.size,
      cachedOutputs: this.nodeOutputs.size,
      listeners: this.listeners.size
    };
  }

  /**
   * Clear all state (for testing or reset)
   */
  clear(): void {
    // Cancel all ongoing computations
    this.abortControllers.forEach(controller => controller.abort());
    
    this.renderTarget = null;
    this.nodeOutputs.clear();
    this.nodeParams.clear();
    this.nodeInputs.clear();
    this.inputConnections.clear();
    this.outputConnections.clear();
    this.dirtyNodes.clear();
    this.computingNodes.clear();
    this.abortControllers.clear();
  }

  /**
   * Add node to scheduler
   */
  addNode(nodeId: string, _type: string, params?: Record<string, any>): void {
    if (params) {
      this.nodeParams.set(nodeId, params);
    }
    
    // If node is in render cone, mark it dirty for initial computation
    if (this.isInRenderCone(nodeId)) {
      this.dirtyNodes.add(nodeId);
      this.scheduleComputation();
    }
  }

  /**
   * Remove node from scheduler
   */
  removeNode(nodeId: string): void {
    // Cancel any ongoing computation
    const abortController = this.abortControllers.get(nodeId);
    if (abortController) {
      abortController.abort();
    }

    // Disconnect all inputs and outputs
    const inputConnections = this.inputConnections.get(nodeId);
    if (inputConnections) {
      inputConnections.forEach((_sourceId, inputName) => {
        this.disconnectInput(nodeId, inputName);
      });
    }

    const outputConnections = this.outputConnections.get(nodeId);
    if (outputConnections) {
      outputConnections.forEach((targetNodes, _outputName) => {
        targetNodes.forEach(targetNodeId => {
          const targetInputs = this.inputConnections.get(targetNodeId);
          if (targetInputs) {
            targetInputs.forEach((sourceId, inputName) => {
              if (sourceId === nodeId) {
                this.disconnectInput(targetNodeId, inputName);
              }
            });
          }
        });
      });
    }

    this.nodeOutputs.delete(nodeId);
    this.nodeParams.delete(nodeId);
    this.nodeInputs.delete(nodeId);
    this.inputConnections.delete(nodeId);
    this.outputConnections.delete(nodeId);
    this.dirtyNodes.delete(nodeId);
    this.computingNodes.delete(nodeId);
    this.abortControllers.delete(nodeId);

    // If this was the render target, clear it
    if (this.renderTarget === nodeId) {
      this.renderTarget = null;
    }
  }
}