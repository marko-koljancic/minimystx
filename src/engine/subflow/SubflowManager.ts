import { GraphLibAdapter } from "../graph/GraphLibAdapter";

// Registry of per-GeoNode subflow graphs: each holds its own typed topology
// (internalGraph) plus the active-output selection. Computation is owned by
// graphStore's cook path, not by this class.
export interface SubflowGraph {
  geoNodeId: string;
  activeOutputNodeId: string | null;
  nodeIds: Set<string>;
  internalGraph: GraphLibAdapter;
}

export class SubflowManager {
  private subflows = new Map<string, SubflowGraph>();

  createSubflow(geoNodeId: string): void {
    if (this.subflows.has(geoNodeId)) {
      return;
    }
    this.subflows.set(geoNodeId, {
      geoNodeId,
      activeOutputNodeId: null,
      nodeIds: new Set(),
      internalGraph: new GraphLibAdapter(),
    });
  }

  removeSubflow(geoNodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    subflow.nodeIds.clear();
    this.subflows.delete(geoNodeId);
  }

  addNodeToSubflow(geoNodeId: string, nodeId: string, nodeType: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) {
      return;
    }
    subflow.internalGraph.addNode({
      id: nodeId,
      type: nodeType,
    });
    subflow.nodeIds.add(nodeId);
  }

  removeNodeFromSubflow(geoNodeId: string, nodeId: string): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    subflow.internalGraph.removeNode(nodeId);
    subflow.nodeIds.delete(nodeId);
    if (subflow.activeOutputNodeId === nodeId) {
      subflow.activeOutputNodeId = null;
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
  }

  shouldComputeInSubflow(geoNodeId: string, nodeId: string): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;
    if (!subflow.activeOutputNodeId) return false;
    const internalCone = this.computeSubflowCone(geoNodeId);
    return internalCone.includes(nodeId);
  }

  addSubflowConnection(
    geoNodeId: string,
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ): boolean {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return false;
    const sourceOutput = sourceHandle || "default";
    const targetInput = targetHandle || "default";
    return subflow.internalGraph.connectTyped(sourceId, sourceOutput, targetId, targetInput);
  }

  removeSubflowConnection(
    geoNodeId: string,
    _sourceId: string,
    targetId: string,
    _sourceHandle?: string,
    targetHandle?: string
  ): void {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow) return;
    const targetInput = targetHandle || "default";
    subflow.internalGraph.disconnectTyped(targetId, targetInput);
  }

  getSubflow(geoNodeId: string): SubflowGraph | undefined {
    return this.subflows.get(geoNodeId);
  }

  getActiveOutputNodeId(geoNodeId: string): string | null {
    const subflow = this.subflows.get(geoNodeId);
    return subflow?.activeOutputNodeId || null;
  }

  clear(): void {
    this.subflows.clear();
  }

  private computeSubflowCone(geoNodeId: string): string[] {
    const subflow = this.subflows.get(geoNodeId);
    if (!subflow || !subflow.activeOutputNodeId) {
      return [];
    }
    try {
      const predecessors = subflow.internalGraph.getAllPredecessors(subflow.activeOutputNodeId);
      return [subflow.activeOutputNodeId, ...predecessors.map((node) => node.id)];
    } catch {
      return subflow.activeOutputNodeId ? [subflow.activeOutputNodeId] : [];
    }
  }
}
