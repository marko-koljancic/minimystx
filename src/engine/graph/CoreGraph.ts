interface GraphNodeData {
  predecessorIds: Set<string>;
  successorIds: Set<string>;
  predecessorNodes: GraphNode[];
  successorNodes: GraphNode[];
  cacheDirty: boolean;
}

export interface GraphNode {
  id: string;
  [key: string]: unknown;
  isDirty?(): boolean;
  cook?(): Promise<void> | void;
  dirtyController?: import('./DirtyController').DirtyController;
}

export class CoreGraph {
  private nodes: Map<string, GraphNodeData> = new Map();
  private nodeObjects: Map<string, GraphNode> = new Map();
  
  addNode(node: GraphNode): void {
    this.nodeObjects.set(node.id, node);
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, {
        predecessorIds: new Set(),
        successorIds: new Set(),
        predecessorNodes: [],
        successorNodes: [],
        cacheDirty: true
      });
    }
  }
  
  removeNode(nodeId: string): void {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return;
    
    const allConnectedIds = new Set([...nodeData.predecessorIds, ...nodeData.successorIds]);
    for (const connectedId of allConnectedIds) {
      this.disconnect(nodeId, connectedId);
    }
    
    this.nodes.delete(nodeId);
    this.nodeObjects.delete(nodeId);
  }
  
  connect(sourceId: string, targetId: string): boolean {
      if (sourceId === targetId) {
      return false;
    }
    
    if (this.wouldCreateCycle(sourceId, targetId)) {
      return false;
    }
    
    const sourceData = this.nodes.get(sourceId);
    const targetData = this.nodes.get(targetId);
    
    if (!sourceData || !targetData) {
      return false;
    }
    
    sourceData.successorIds.add(targetId);
    targetData.predecessorIds.add(sourceId);
    
    this.invalidateCache(sourceId);
    this.invalidateCache(targetId);
    
    return true;
  }
  
  disconnect(sourceId: string, targetId: string): void {
    const sourceData = this.nodes.get(sourceId);
    const targetData = this.nodes.get(targetId);
    
    if (!sourceData || !targetData) {
      return;
    }
    
    sourceData.successorIds.delete(targetId);
    targetData.predecessorIds.delete(sourceId);
    
    this.invalidateCache(sourceId);
    this.invalidateCache(targetId);
  }
  
  wouldCreateCycle(sourceId: string, targetId: string): boolean {
    const targetSuccessors = this.getAllSuccessors(targetId);
    return targetSuccessors.some(node => node.id === sourceId);
  }
  
  getAllPredecessors(nodeId: string): GraphNode[] {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return [];
    
    if (nodeData.cacheDirty) {
      this.rebuildPredecessorCache(nodeId);
    }
    return nodeData.predecessorNodes;
  }
  
  getAllSuccessors(nodeId: string): GraphNode[] {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return [];
    
    if (nodeData.cacheDirty) {
      this.rebuildSuccessorCache(nodeId);
    }
    return nodeData.successorNodes;
  }
  
  getDirectPredecessors(nodeId: string): GraphNode[] {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return [];
    
    return Array.from(nodeData.predecessorIds)
      .map(id => this.nodeObjects.get(id))
      .filter(Boolean) as GraphNode[];
  }
  
  getDirectSuccessors(nodeId: string): GraphNode[] {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return [];
    
    return Array.from(nodeData.successorIds)
      .map(id => this.nodeObjects.get(id))
      .filter(Boolean) as GraphNode[];
  }
  
  hasConnection(sourceId: string, targetId: string): boolean {
    const sourceData = this.nodes.get(sourceId);
    return sourceData?.successorIds.has(targetId) ?? false;
  }
  
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodeObjects.get(nodeId);
  }
  
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodeObjects.values());
  }
  
  topologicalSort(nodeIds?: string[]): string[] {
    const nodesToSort = nodeIds || Array.from(this.nodeObjects.keys());
    const visited = new Set<string>();
    const result: string[] = [];
    
    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const nodeData = this.nodes.get(nodeId);
      if (nodeData) {
        for (const predecessorId of nodeData.predecessorIds) {
          if (nodesToSort.includes(predecessorId)) {
            visit(predecessorId);
          }
        }
      }
      
      result.push(nodeId);
    };
    
    for (const nodeId of nodesToSort) {
      visit(nodeId);
    }
    
    return result;
  }
  
  private rebuildPredecessorCache(nodeId: string): void {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return;
    
    const visited = new Set<string>();
    const predecessors: GraphNode[] = [];
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const currentData = this.nodes.get(currentId);
      if (!currentData) return;
      
      for (const predecessorId of currentData.predecessorIds) {
        const predecessorNode = this.nodeObjects.get(predecessorId);
        if (predecessorNode) {
          predecessors.push(predecessorNode);
          traverse(predecessorId);
        }
      }
    };
    
    traverse(nodeId);
    
    nodeData.predecessorNodes = predecessors;
    nodeData.cacheDirty = false;
  }
  
  private rebuildSuccessorCache(nodeId: string): void {
    const nodeData = this.nodes.get(nodeId);
    if (!nodeData) return;
    
    const visited = new Set<string>();
    const successors: GraphNode[] = [];
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const currentData = this.nodes.get(currentId);
      if (!currentData) return;
      
      for (const successorId of currentData.successorIds) {
        const successorNode = this.nodeObjects.get(successorId);
        if (successorNode) {
          successors.push(successorNode);
          traverse(successorId);
        }
      }
    };
    
    traverse(nodeId);
    
    nodeData.successorNodes = successors;
    nodeData.cacheDirty = false;
  }
  
  private invalidateCache(nodeId: string): void {
    const visited = new Set<string>();
    
    const invalidate = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const nodeData = this.nodes.get(currentId);
      if (nodeData) {
        nodeData.cacheDirty = true;
        
        for (const successorId of nodeData.successorIds) {
          invalidate(successorId);
        }
        for (const predecessorId of nodeData.predecessorIds) {
          invalidate(predecessorId);
        }
      }
    };
    
    invalidate(nodeId);
  }
  
  getStats(): {
    nodeCount: number;
    connectionCount: number;
    cacheHitRatio: number;
  } {
    let connectionCount = 0;
    let cachedNodes = 0;
    
    for (const nodeData of this.nodes.values()) {
      connectionCount += nodeData.successorIds.size;
      if (!nodeData.cacheDirty) {
        cachedNodes++;
      }
    }
    
    return {
      nodeCount: this.nodeObjects.size,
      connectionCount,
      cacheHitRatio: this.nodeObjects.size > 0 ? cachedNodes / this.nodeObjects.size : 0
    };
  }
  
  validateGraph(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const [nodeId, nodeData] of this.nodes.entries()) {
      for (const successorId of nodeData.successorIds) {
        const successorData = this.nodes.get(successorId);
        if (!successorData || !successorData.predecessorIds.has(nodeId)) {
          errors.push(`Orphaned successor connection: ${nodeId} -> ${successorId}`);
        }
      }
      
      for (const predecessorId of nodeData.predecessorIds) {
        const predecessorData = this.nodes.get(predecessorId);
        if (!predecessorData || !predecessorData.successorIds.has(nodeId)) {
          errors.push(`Orphaned predecessor connection: ${predecessorId} -> ${nodeId}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}