import { Graph, alg } from "@dagrejs/graphlib";
export interface GraphNode {
  id: string;
  [key: string]: unknown;
}
export class GraphLibAdapter {
  private graph = new Graph({ directed: true });
  private nodeObjects: Map<string, GraphNode> = new Map();
  private inputConnections: Map<string, Map<string, { sourceNodeId: string; sourceOutput: string }>> = new Map();
  private outputConnections: Map<string, Map<string, Array<{ targetNodeId: string; targetInput: string }>>> = new Map();
  // Single-generation memo for traversal results, invalidated by any topology
  // mutation. A param edit re-reads the same cone several times per frame; this
  // makes those repeats free without any multi-version bookkeeping.
  private predecessorsCache: Map<string, string[]> = new Map();
  private fullTopoOrder: string[] | null = null;
  private bumpTopology(): void {
    this.predecessorsCache.clear();
    this.fullTopoOrder = null;
  }
  addNode(node: GraphNode): void {
    this.nodeObjects.set(node.id, node);
    this.graph.setNode(node.id);
    this.bumpTopology();
  }
  removeNode(nodeId: string): void {
    const nodeData = this.graph.node(nodeId);
    if (!nodeData) return;
    const predecessors = this.graph.predecessors(nodeId) || [];
    const successors = this.graph.successors(nodeId) || [];
    [...predecessors, ...successors].forEach((connectedId) => {
      this.disconnect(nodeId, connectedId);
      this.disconnect(connectedId, nodeId);
    });
    this.graph.removeNode(nodeId);
    this.nodeObjects.delete(nodeId);
    this.bumpTopology();
  }
  connect(sourceId: string, targetId: string): boolean {
    if (sourceId === targetId) {
      return false;
    }
    if (this.wouldCreateCycle(sourceId, targetId)) {
      return false;
    }
    if (!this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) {
      return false;
    }
    this.graph.setEdge(sourceId, targetId);
    this.bumpTopology();
    return true;
  }
  connectTyped(sourceNodeId: string, sourceOutput: string, targetNodeId: string, targetInput: string): boolean {
    if (!this.connect(sourceNodeId, targetNodeId)) {
      return false;
    }
    if (!this.inputConnections.has(targetNodeId)) {
      this.inputConnections.set(targetNodeId, new Map());
    }
    this.inputConnections.get(targetNodeId)!.set(targetInput, {
      sourceNodeId,
      sourceOutput,
    });
    if (!this.outputConnections.has(sourceNodeId)) {
      this.outputConnections.set(sourceNodeId, new Map());
    }
    if (!this.outputConnections.get(sourceNodeId)!.has(sourceOutput)) {
      this.outputConnections.get(sourceNodeId)!.set(sourceOutput, []);
    }
    this.outputConnections.get(sourceNodeId)!.get(sourceOutput)!.push({
      targetNodeId,
      targetInput,
    });
    return true;
  }
  disconnect(sourceId: string, targetId: string): void {
    this.graph.removeEdge(sourceId, targetId);
    this.bumpTopology();
  }
  disconnectTyped(targetNodeId: string, targetInput: string): boolean {
    const inputConnection = this.inputConnections.get(targetNodeId)?.get(targetInput);
    if (!inputConnection) {
      return false;
    }
    const { sourceNodeId, sourceOutput } = inputConnection;
    this.inputConnections.get(targetNodeId)!.delete(targetInput);
    if (this.inputConnections.get(targetNodeId)!.size === 0) {
      this.inputConnections.delete(targetNodeId);
    }
    const outputList = this.outputConnections.get(sourceNodeId)?.get(sourceOutput);
    if (outputList) {
      const index = outputList.findIndex(
        (conn) => conn.targetNodeId === targetNodeId && conn.targetInput === targetInput
      );
      if (index >= 0) {
        outputList.splice(index, 1);
        if (outputList.length === 0) {
          this.outputConnections.get(sourceNodeId)!.delete(sourceOutput);
          if (this.outputConnections.get(sourceNodeId)!.size === 0) {
            this.outputConnections.delete(sourceNodeId);
          }
        }
      }
    }
    const hasOtherConnections = this.hasTypedConnectionBetween(sourceNodeId, targetNodeId);
    if (!hasOtherConnections) {
      this.disconnect(sourceNodeId, targetNodeId);
    }
    return true;
  }
  private hasTypedConnectionBetween(sourceNodeId: string, targetNodeId: string): boolean {
    const outputConnections = this.outputConnections.get(sourceNodeId);
    if (!outputConnections) return false;
    for (const connections of outputConnections.values()) {
      for (const conn of connections) {
        if (conn.targetNodeId === targetNodeId) {
          return true;
        }
      }
    }
    return false;
  }
  getNodeInputConnections(nodeId: string): Map<string, { sourceNodeId: string; sourceOutput: string }> {
    return this.inputConnections.get(nodeId) || new Map();
  }
  // Adding source -> target closes a cycle exactly when target can already reach
  // source. A DFS over live successors replaces the previous full-graph copy plus
  // findCycles, which made scene import O(E * (V + E)).
  wouldCreateCycle(sourceId: string, targetId: string): boolean {
    if (sourceId === targetId) return true;
    const visited = new Set<string>();
    const stack = [targetId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const successors = this.graph.successors(current) || [];
      for (const next of successors) {
        if (!visited.has(next)) stack.push(next);
      }
    }
    return false;
  }
  getAllPredecessors(nodeId: string): GraphNode[] {
    let ids = this.predecessorsCache.get(nodeId);
    if (!ids) {
      const visited = new Set<string>();
      const result: string[] = [];
      const traverse = (currentId: string) => {
        const directPreds = this.graph.predecessors(currentId) || [];
        for (const predId of directPreds) {
          if (!visited.has(predId)) {
            visited.add(predId);
            result.push(predId);
            traverse(predId);
          }
        }
      };
      traverse(nodeId);
      ids = result;
      this.predecessorsCache.set(nodeId, ids);
    }
    return ids.map((id: string) => this.nodeObjects.get(id)).filter(Boolean) as GraphNode[];
  }
  getDirectPredecessors(nodeId: string): GraphNode[] {
    const predecessorIds = this.graph.predecessors(nodeId) || [];
    return predecessorIds.map((id) => this.nodeObjects.get(id)).filter(Boolean) as GraphNode[];
  }
  getDirectSuccessors(nodeId: string): GraphNode[] {
    const successorIds = this.graph.successors(nodeId) || [];
    return successorIds.map((id) => this.nodeObjects.get(id)).filter(Boolean) as GraphNode[];
  }
  getAllEdges(): { source: string; target: string }[] {
    return this.graph.edges().map((edge) => ({
      source: edge.v,
      target: edge.w,
    }));
  }
  getAllTypedEdges(): { source: string; target: string; sourceHandle: string; targetHandle: string }[] {
    const edges: { source: string; target: string; sourceHandle: string; targetHandle: string }[] = [];
    for (const [targetNodeId, inputs] of this.inputConnections) {
      for (const [targetInput, conn] of inputs) {
        edges.push({
          source: conn.sourceNodeId,
          target: targetNodeId,
          sourceHandle: conn.sourceOutput,
          targetHandle: targetInput,
        });
      }
    }
    return edges;
  }
  // Subset sorts filter one memoized full-graph topsort by membership instead of
  // building an O(k^2) subgraph per call.
  topologicalSort(nodeIds?: string[]): string[] {
    try {
      if (!this.fullTopoOrder) {
        this.fullTopoOrder = alg.topsort(this.graph);
      }
      if (!nodeIds) {
        return [...this.fullTopoOrder];
      }
      const wanted = new Set(nodeIds.filter((id) => this.graph.hasNode(id)));
      return this.fullTopoOrder.filter((id) => wanted.has(id));
    } catch {
      return nodeIds || Array.from(this.nodeObjects.keys());
    }
  }
  getRenderCone(renderTargetId: string): string[] {
    if (!renderTargetId || !this.graph.hasNode(renderTargetId)) {
      return [];
    }
    try {
      // The render cone is the render target plus every node upstream that feeds
      // it (its transitive predecessors), since data flows source -> target.
      const predecessorIds = this.getAllPredecessors(renderTargetId).map((node) => node.id);
      return [renderTargetId, ...predecessorIds];
    } catch {
      return [renderTargetId];
    }
  }
  getDownstreamNodes(nodeId: string): string[] {
    try {
      const successorIds = alg.postorder(this.graph, [nodeId]);
      return successorIds.filter((id) => id !== nodeId); // Exclude the node itself
    } catch {
      return [];
    }
  }
}
