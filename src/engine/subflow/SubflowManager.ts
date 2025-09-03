import { GraphLibAdapter } from "../graph/GraphLibAdapter";
import { RenderConeScheduler } from "../scheduler/RenderConeScheduler";
export interface SubflowGraph {
  geoNodeId: string;
  activeOutputNodeId: string | null;
  nodeIds: Set<string>;
  internalGraph: GraphLibAdapter;
  scheduler: RenderConeScheduler;
}
export class SubflowManager {
  private subflows = new Map<string, SubflowGraph>();
  constructor(_mainGraph: GraphLibAdapter) {}
  createSubflow(geoNodeId: string): void {
    if (this.subflows.has(geoNodeId)) {
      return;
    }
    const internalGraph = new GraphLibAdapter();
    const scheduler = new RenderConeScheduler(internalGraph);
    const subflow: SubflowGraph = {
      geoNodeId,
      activeOutputNodeId: null,
      nodeIds: new Set(),
      internalGraph,
      scheduler,
    };
    this.subflows.set(geoNodeId, subflow);
  }
  removeSubflow(geoNodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    subflow.scheduler.clear();
    subflow.nodeIds.clear();
    this.subflows.delete(geoNodeId);
  }
  addNodeToSubflow(
    geoNodeId: string,
    nodeId: string,
    nodeType: string,
    params?: Record<string, any>
  ): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) {
      return;
    }
    subflow.internalGraph.addNode({
      id: nodeId,
      type: nodeType,
    });
    subflow.nodeIds.add(nodeId);
    subflow.scheduler.addNode(nodeId, nodeType, params);
  }
  removeNodeFromSubflow(geoNodeId: string, nodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    subflow.internalGraph.removeNode(nodeId);
    subflow.scheduler.removeNode(nodeId);
    subflow.nodeIds.delete(nodeId);
    if (subflow.activeOutputNodeId === nodeId) {
      subflow.activeOutputNodeId = null;
      subflow.scheduler.setRenderTarget(null);
    }
  }
  setActiveOutput(geoNodeId: string, nodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) {
      return;
    }
    if (!subflow.nodeIds.has(nodeId)) {
      return;
    }
    subflow.activeOutputNodeId = nodeId;
    subflow.scheduler.setRenderTarget(nodeId);
  }
  shouldComputeInSubflow(geoNodeId: string, nodeId: string): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;
    if (!subflow.activeOutputNodeId) return false;
    const internalCone = this.computeSubflowCone(geoNodeId);
    return internalCone.includes(nodeId);
  }
  getActiveOutputValue(geoNodeId: string): any {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow || !subflow.activeOutputNodeId) {
      return null;
    }
    return subflow.scheduler.getNodeOutput(subflow.activeOutputNodeId);
  }
  onSubflowParameterChange(geoNodeId: string, nodeId: string, params: Record<string, any>): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    subflow.scheduler.onParameterChange(nodeId, params);
  }
  onSubflowInputChange(geoNodeId: string, nodeId: string, inputKey: string, value: any): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    subflow.scheduler.onInputChange(nodeId, inputKey, value);
  }
  addSubflowConnection(geoNodeId: string, sourceId: string, targetId: string): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;
    const connected = subflow.internalGraph.connect(sourceId, targetId);
    if (!connected) {
      return false;
    }
    subflow.scheduler.onConnectionChange(sourceId, targetId, true);
    try {
      const predecessors = subflow.internalGraph.getAllPredecessors(targetId);
    } catch (error) {
      console.error("Error computing predecessors after adding connection:", error);
    }
    return true;
  }
  removeSubflowConnection(geoNodeId: string, sourceId: string, targetId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    subflow.internalGraph.disconnect(sourceId, targetId);
    subflow.scheduler.onConnectionChange(sourceId, targetId, false);
  }
  getSubflow(geoNodeId: string): SubflowGraph | undefined {
    return this.subflows.get(geoNodeId);
  }
  getAllSubflows(): Map<string, SubflowGraph> {
    return new Map(this.subflows);
  }
  private computeSubflowCone(geoNodeId: string): string[] {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow || !subflow.activeOutputNodeId) {
      return [];
    }
    try {
      const predecessors = subflow.internalGraph.getAllPredecessors(subflow.activeOutputNodeId);
      return [subflow.activeOutputNodeId, ...predecessors.map((node) => node.id)];
    } catch (error) {
      return subflow.activeOutputNodeId ? [subflow.activeOutputNodeId] : [];
    }
  }
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
        schedulerStats,
      };
    });
    return stats;
  }
  validateSubflows(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    this.subflows.forEach((subflow, geoNodeId) => {
      if (subflow.activeOutputNodeId && !subflow.nodeIds.has(subflow.activeOutputNodeId)) {
        errors.push(
          `Subflow ${geoNodeId}: active output ${subflow.activeOutputNodeId} not found in subflow nodes`
        );
      }
      const graphValidation = subflow.internalGraph.validateGraph();
      if (!graphValidation.valid) {
        errors.push(
          `Subflow ${geoNodeId}: internal graph validation failed: ${graphValidation.errors.join(
            ", "
          )}`
        );
      }
      const schedulerStats = subflow.scheduler.getStats();
      if (schedulerStats.renderTarget !== subflow.activeOutputNodeId) {
        errors.push(`Subflow ${geoNodeId}: scheduler render target mismatch`);
      }
    });
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  clear(): void {
    this.subflows.forEach((subflow) => {
      subflow.scheduler.clear();
    });
    this.subflows.clear();
  }
  addSubflowListener(geoNodeId: string, listener: (event: any) => void): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;
    subflow.scheduler.addListener(listener);
    return true;
  }
  removeSubflowListener(geoNodeId: string, listener: (event: any) => void): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;
    subflow.scheduler.removeListener(listener);
    return true;
  }
  getActiveOutputNodeId(geoNodeId: string): string | null {
    const subflow = this.subflows.get(geoNodeId);
    return subflow?.activeOutputNodeId || null;
  }
  hasSubflow(geoNodeId: string): boolean {
    return this.subflows.has(geoNodeId);
  }
  getVisibleSubflowNodes(geoNodeId: string): string[] {
    return this.computeSubflowCone(geoNodeId);
  }
}
