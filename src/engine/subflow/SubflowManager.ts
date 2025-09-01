import { GraphLibAdapter } from '../graph/GraphLibAdapter';
import { RenderConeScheduler } from '../scheduler/RenderConeScheduler';

export interface SubflowGraph {
  geoNodeId: string;
  activeOutputNodeId: string | null;
  nodeIds: Set<string>;
  internalGraph: GraphLibAdapter;
  scheduler: RenderConeScheduler;
}

/**
 * SubflowManager - Manages subflow cone isolation and active output semantics
 * 
 * Implements requirements SF1-SF4 from minimystx-reactive-recompute.md:
 * - SF1: Active output - exactly one internal node as activeOutputNodeId (internal render target)
 * - SF2: Cone isolation - only nodes that feed the active output compute  
 * - SF3: Boundary mapping - subflow node's external output equals internal active output's value
 * - SF4: Hot-swap - changing activeOutputNodeId triggers recomputation limited to newly selected internal cone
 */
export class SubflowManager {
  private subflows = new Map<string, SubflowGraph>();

  constructor(_mainGraph: GraphLibAdapter) {
    // Main graph reference not currently used but may be needed for future features
  }

  /**
   * SF1: Create new subflow with isolated graph and scheduler
   */
  createSubflow(geoNodeId: string): void {
    if (this.subflows.has(geoNodeId)) {
      console.warn(`Subflow ${geoNodeId} already exists`);
      return;
    }

    const internalGraph = new GraphLibAdapter();
    const scheduler = new RenderConeScheduler(internalGraph);

    const subflow: SubflowGraph = {
      geoNodeId,
      activeOutputNodeId: null,
      nodeIds: new Set(),
      internalGraph,
      scheduler
    };

    this.subflows.set(geoNodeId, subflow);
  }

  /**
   * Remove subflow and cleanup resources
   */
  removeSubflow(geoNodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;

    // Clear scheduler and graph
    subflow.scheduler.clear();
    subflow.nodeIds.clear();

    this.subflows.delete(geoNodeId);
  }

  /**
   * Add node to subflow's internal graph
   */
  addNodeToSubflow(
    geoNodeId: string, 
    nodeId: string, 
    nodeType: string, 
    params?: Record<string, any>
  ): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) {
      console.warn(`Subflow ${geoNodeId} not found`);
      return;
    }

    // Add to internal graph
    subflow.internalGraph.addNode({
      id: nodeId,
      type: nodeType
    });

    // Track node in subflow
    subflow.nodeIds.add(nodeId);

    // Add to scheduler
    subflow.scheduler.addNode(nodeId, nodeType, params);
  }

  /**
   * Remove node from subflow
   */
  removeNodeFromSubflow(geoNodeId: string, nodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;

    // Remove from internal graph
    subflow.internalGraph.removeNode(nodeId);

    // Remove from scheduler
    subflow.scheduler.removeNode(nodeId);

    // Remove from tracking
    subflow.nodeIds.delete(nodeId);

    // If this was the active output, clear it
    if (subflow.activeOutputNodeId === nodeId) {
      subflow.activeOutputNodeId = null;
      subflow.scheduler.setRenderTarget(null);
    }
  }

  /**
   * SF4: Set active output node (internal render target) with hot-swap
   * Changing activeOutputNodeId triggers recomputation limited to newly selected internal cone
   */
  setActiveOutput(geoNodeId: string, nodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) {
      console.warn(`Subflow ${geoNodeId} not found`);
      return;
    }

    if (!subflow.nodeIds.has(nodeId)) {
      console.warn(`Node ${nodeId} not found in subflow ${geoNodeId}`);
      return;
    }

    // SF4: Hot-swap - set new internal render target
    subflow.activeOutputNodeId = nodeId;
    subflow.scheduler.setRenderTarget(nodeId);
  }

  /**
   * SF2: Check if node should compute based on cone isolation
   * Only nodes that feed the active output compute
   */
  shouldComputeInSubflow(geoNodeId: string, nodeId: string): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;

    if (!subflow.activeOutputNodeId) return false;

    // Get internal render cone
    const internalCone = this.computeSubflowCone(geoNodeId);
    return internalCone.includes(nodeId);
  }

  /**
   * SF3: Get active output value for boundary mapping
   * Subflow node's external output equals internal active output's value
   */
  getActiveOutputValue(geoNodeId: string): any {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow || !subflow.activeOutputNodeId) {
      return null;
    }

    // Get output from internal scheduler
    return subflow.scheduler.getNodeOutput(subflow.activeOutputNodeId);
  }

  /**
   * Handle parameter changes in subflow nodes
   */
  onSubflowParameterChange(
    geoNodeId: string, 
    nodeId: string, 
    params: Record<string, any>
  ): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;

    // Delegate to internal scheduler - it will handle cone isolation
    subflow.scheduler.onParameterChange(nodeId, params);
  }

  /**
   * Handle input changes in subflow nodes
   */
  onSubflowInputChange(
    geoNodeId: string, 
    nodeId: string, 
    inputKey: string, 
    value: any
  ): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;

    subflow.scheduler.onInputChange(nodeId, inputKey, value);
  }

  /**
   * Add connection within subflow
   */
  addSubflowConnection(
    geoNodeId: string,
    sourceId: string, 
    targetId: string,
    _sourceHandle?: string,
    _targetHandle?: string
  ): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;

    // Add to internal graph
    // Adding connection to internal graph
    const connected = subflow.internalGraph.connect(sourceId, targetId);
    // Internal graph connection result available
    
    if (!connected) {
      console.warn(`❌ Failed to connect ${sourceId} → ${targetId} in internal graph`);
      return false;
    }

    // Notify scheduler
    subflow.scheduler.onConnectionChange(sourceId, targetId, true);
    
    // Debug: Check current graph state
    try {
      const predecessors = subflow.internalGraph.getAllPredecessors(targetId);
      // Connection established, predecessors updated
    } catch (error) {
      console.warn(`Could not get predecessors for ${targetId}:`, error);
    }
    
    return true;
  }

  /**
   * Remove connection within subflow
   */
  removeSubflowConnection(
    geoNodeId: string,
    sourceId: string,
    targetId: string
  ): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;

    // Remove from internal graph
    subflow.internalGraph.disconnect(sourceId, targetId);

    // Notify scheduler
    subflow.scheduler.onConnectionChange(sourceId, targetId, false);
  }

  /**
   * Get subflow information
   */
  getSubflow(geoNodeId: string): SubflowGraph | undefined {
    return this.subflows.get(geoNodeId);
  }

  /**
   * Get all subflows
   */
  getAllSubflows(): Map<string, SubflowGraph> {
    return new Map(this.subflows);
  }

  /**
   * SF2: Compute internal render cone for subflow
   * Returns nodes that feed the active output (cone isolation)
   */
  private computeSubflowCone(geoNodeId: string): string[] {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow || !subflow.activeOutputNodeId) {
      return [];
    }

    try {
      // Get upstream closure of active output within subflow
      const predecessors = subflow.internalGraph.getAllPredecessors(subflow.activeOutputNodeId);
      return [subflow.activeOutputNodeId, ...predecessors.map(node => node.id)];
    } catch (error) {
      console.warn(`Failed to compute subflow cone for ${geoNodeId}:`, error);
      return subflow.activeOutputNodeId ? [subflow.activeOutputNodeId] : [];
    }
  }

  /**
   * Get statistics for all subflows
   */
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.subflows.forEach((subflow, geoNodeId) => {
      const internalCone = this.computeSubflowCone(geoNodeId);
      const schedulerStats = subflow.scheduler.getStats();

      stats[geoNodeId] = {
        activeOutputNodeId: subflow.activeOutputNodeId,
        totalNodes: subflow.nodeIds.size,
        coneSize: internalCone.length,
        coneNodes: internalCone,
        schedulerStats
      };
    });

    return stats;
  }

  /**
   * Validate subflow consistency
   */
  validateSubflows(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.subflows.forEach((subflow, geoNodeId) => {
      // Check active output exists in subflow
      if (subflow.activeOutputNodeId && !subflow.nodeIds.has(subflow.activeOutputNodeId)) {
        errors.push(`Subflow ${geoNodeId}: active output ${subflow.activeOutputNodeId} not found in subflow nodes`);
      }

      // Check internal graph consistency
      const graphValidation = subflow.internalGraph.validateGraph();
      if (!graphValidation.valid) {
        errors.push(`Subflow ${geoNodeId}: internal graph validation failed: ${graphValidation.errors.join(', ')}`);
      }

      // Check scheduler state
      const schedulerStats = subflow.scheduler.getStats();
      if (schedulerStats.renderTarget !== subflow.activeOutputNodeId) {
        errors.push(`Subflow ${geoNodeId}: scheduler render target mismatch`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear all subflows
   */
  clear(): void {
    this.subflows.forEach(subflow => {
      subflow.scheduler.clear();
    });
    this.subflows.clear();
  }

  /**
   * Subscribe to subflow scheduler events
   */
  addSubflowListener(
    geoNodeId: string, 
    listener: (event: any) => void
  ): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;

    subflow.scheduler.addListener(listener);
    return true;
  }

  /**
   * Unsubscribe from subflow scheduler events
   */
  removeSubflowListener(
    geoNodeId: string,
    listener: (event: any) => void
  ): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;

    subflow.scheduler.removeListener(listener);
    return true;
  }

  /**
   * Get active output node ID for subflow
   */
  getActiveOutputNodeId(geoNodeId: string): string | null {
    const subflow = this.subflows.get(geoNodeId);
    return subflow?.activeOutputNodeId || null;
  }

  /**
   * Check if subflow exists
   */
  hasSubflow(geoNodeId: string): boolean {
    return this.subflows.has(geoNodeId);
  }

  /**
   * Get visible nodes in subflow (those in render cone)
   */
  getVisibleSubflowNodes(geoNodeId: string): string[] {
    return this.computeSubflowCone(geoNodeId);
  }
}