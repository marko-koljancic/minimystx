import { Graph, alg } from "@dagrejs/graphlib";
export interface GraphNode {
  id: string;
  [key: string]: unknown;
  isDirty?(): boolean;
  cook?(): Promise<void> | void;
}
export class GraphLibAdapter {
  private graph = new Graph({ directed: true });
  private nodeObjects: Map<string, GraphNode> = new Map();
  private inputConnections: Map<
    string,
    Map<string, { sourceNodeId: string; sourceOutput: string }>
  > = new Map();
  private outputConnections: Map<
    string,
    Map<string, Array<{ targetNodeId: string; targetInput: string }>>
  > = new Map();
  addNode(node: GraphNode): void {
    this.nodeObjects.set(node.id, node);
    this.graph.setNode(node.id);
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
    return true;
  }
  connectTyped(
    sourceNodeId: string,
    sourceOutput: string,
    targetNodeId: string,
    targetInput: string
  ): boolean {
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
  getInputSource(
    nodeId: string,
    inputName: string
  ): { sourceNodeId: string; sourceOutput: string } | null {
    return this.inputConnections.get(nodeId)?.get(inputName) || null;
  }
  getOutputTargets(
    nodeId: string,
    outputName: string
  ): Array<{ targetNodeId: string; targetInput: string }> {
    return this.outputConnections.get(nodeId)?.get(outputName) || [];
  }
  getNodeInputConnections(
    nodeId: string
  ): Map<string, { sourceNodeId: string; sourceOutput: string }> {
    return this.inputConnections.get(nodeId) || new Map();
  }
  getNodeOutputConnections(
    nodeId: string
  ): Map<string, Array<{ targetNodeId: string; targetInput: string }>> {
    return this.outputConnections.get(nodeId) || new Map();
  }
  wouldCreateCycle(sourceId: string, targetId: string): boolean {
    const testGraph = new Graph({ directed: true });
    this.graph.nodes().forEach((nodeId) => {
      testGraph.setNode(nodeId);
    });
    this.graph.edges().forEach((edge) => {
      testGraph.setEdge(edge.v, edge.w);
    });
    testGraph.setEdge(sourceId, targetId);
    try {
      const cycles = alg.findCycles(testGraph);
      return cycles.length > 0;
    } catch (error) {
      return true;
    }
  }
  getAllPredecessors(nodeId: string): GraphNode[] {
    try {
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
      return result.map((id: string) => this.nodeObjects.get(id)).filter(Boolean) as GraphNode[];
    } catch (error) {
      return this.getDirectPredecessors(nodeId);
    }
  }
  getAllSuccessors(nodeId: string): GraphNode[] {
    try {
      const successorIds = alg.postorder(this.graph, [nodeId]);
      const filteredIds = successorIds.filter((id: string) => id !== nodeId);
      return filteredIds
        .map((id: string) => this.nodeObjects.get(id))
        .filter(Boolean) as GraphNode[];
    } catch (error) {
      return this.getDirectSuccessors(nodeId);
    }
  }
  getDirectPredecessors(nodeId: string): GraphNode[] {
    const predecessorIds = this.graph.predecessors(nodeId) || [];
    return predecessorIds.map((id) => this.nodeObjects.get(id)).filter(Boolean) as GraphNode[];
  }
  getDirectSuccessors(nodeId: string): GraphNode[] {
    const successorIds = this.graph.successors(nodeId) || [];
    return successorIds.map((id) => this.nodeObjects.get(id)).filter(Boolean) as GraphNode[];
  }
  hasConnection(sourceId: string, targetId: string): boolean {
    return this.graph.hasEdge(sourceId, targetId);
  }
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodeObjects.get(nodeId);
  }
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodeObjects.values());
  }
  getAllEdges(): { source: string; target: string }[] {
    return this.graph.edges().map((edge) => ({
      source: edge.v,
      target: edge.w,
    }));
  }
  topologicalSort(nodeIds?: string[]): string[] {
    try {
      if (nodeIds) {
        const subGraph = new Graph({ directed: true });
        const validNodeIds = nodeIds.filter((id) => this.graph.hasNode(id));
        validNodeIds.forEach((id) => subGraph.setNode(id));
        validNodeIds.forEach((sourceId) => {
          validNodeIds.forEach((targetId) => {
            if (this.graph.hasEdge(sourceId, targetId)) {
              subGraph.setEdge(sourceId, targetId);
            }
          });
        });
        return alg.topsort(subGraph);
      } else {
        return alg.topsort(this.graph);
      }
    } catch (error) {
      return nodeIds || Array.from(this.nodeObjects.keys());
    }
  }
  getRenderCone(renderTargetId: string): string[] {
    if (!renderTargetId || !this.graph.hasNode(renderTargetId)) {
      return [];
    }
    try {
      const predecessorIds = alg.preorder(this.graph, [renderTargetId]);
      return predecessorIds; // Includes renderTargetId itself
    } catch (error) {
      return [renderTargetId];
    }
  }
  getSubflowDependencies(_geoNodeId: string, activeOutputId: string): string[] {
    return this.getRenderCone(activeOutputId);
  }
  getDownstreamNodes(nodeId: string): string[] {
    try {
      const successorIds = alg.postorder(this.graph, [nodeId]);
      return successorIds.filter((id) => id !== nodeId); // Exclude the node itself
    } catch (error) {
      return [];
    }
  }
  canReachNode(fromNodeId: string, toNodeId: string): boolean {
    try {
      const cone = this.getRenderCone(toNodeId);
      return cone.includes(fromNodeId);
    } catch (error) {
      return false;
    }
  }
  getAffectedByConnection(_sourceId: string, targetId: string, added: boolean): string[] {
    if (added) {
      return this.getDownstreamNodes(targetId);
    } else {
      return [targetId, ...this.getDownstreamNodes(targetId)];
    }
  }
  validateGraph(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    try {
      const cycles = alg.findCycles(this.graph);
      cycles.forEach((cycle, index) => {
        errors.push(`Cycle ${index + 1} detected: ${cycle.join(" -> ")}`);
      });
    } catch (error) {
      errors.push(`Graph validation failed: ${error}`);
    }
    for (const nodeId of this.graph.nodes()) {
      if (!this.nodeObjects.has(nodeId)) {
        errors.push(`Graph node ${nodeId} missing from node objects map`);
      }
    }
    for (const [nodeId] of this.nodeObjects) {
      if (!this.graph.hasNode(nodeId)) {
        errors.push(`Node object ${nodeId} missing from graph structure`);
      }
    }
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  getStats(): {
    nodeCount: number;
    connectionCount: number;
    cycleCount: number;
    maxDepth: number;
  } {
    const nodeCount = this.graph.nodeCount();
    const edgeCount = this.graph.edgeCount();
    let cycleCount = 0;
    let maxDepth = 0;
    try {
      const cycles = alg.findCycles(this.graph);
      cycleCount = cycles.length;
    } catch (error) {
      cycleCount = -1;
    }
    try {
      const roots = this.graph.nodes().filter((nodeId) => {
        const predecessors = this.graph.predecessors(nodeId);
        return !predecessors || predecessors.length === 0;
      });
      for (const root of roots) {
        const depth = this.calculateMaxDepthFromNode(root);
        maxDepth = Math.max(maxDepth, depth);
      }
    } catch (error) {
      maxDepth = -1;
    }
    return {
      nodeCount,
      connectionCount: edgeCount,
      cycleCount,
      maxDepth,
    };
  }
  private calculateMaxDepthFromNode(rootNodeId: string): number {
    const visited = new Set<string>();
    const dfs = (currentId: string): number => {
      if (visited.has(currentId)) return 0;
      visited.add(currentId);
      const successors = this.graph.successors(currentId) || [];
      let maxChildDepth = 0;
      for (const successorId of successors) {
        const childDepth = dfs(successorId);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
      return maxChildDepth + 1;
    };
    return dfs(rootNodeId);
  }
  copy(): GraphLibAdapter {
    const newAdapter = new GraphLibAdapter();
    for (const [_nodeId, nodeObject] of this.nodeObjects) {
      newAdapter.addNode(nodeObject);
    }
    for (const edge of this.graph.edges()) {
      newAdapter.connect(edge.v, edge.w);
    }
    return newAdapter;
  }
}
