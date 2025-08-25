export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  metadata?: Record<string, unknown>;
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private inputConnections: Map<string, Connection[]> = new Map();
  private outputConnections: Map<string, Map<string, Connection[]>> = new Map();
  
  addConnection(connection: Connection): void {
    this.connections.set(connection.id, connection);
    
    const inputConns = this.inputConnections.get(connection.targetNodeId) || [];
    inputConns.push(connection);
    this.inputConnections.set(connection.targetNodeId, inputConns);
    
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
    
    this.connections.delete(connectionId);
    
    this.removeFromInputConnections(connection);
    
    this.removeFromOutputConnections(connection);
  }
  
  removeAllConnectionsForNode(nodeId: string): void {
    const connectionsToRemove: string[] = [];
    
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.sourceNodeId === nodeId || connection.targetNodeId === nodeId) {
        connectionsToRemove.push(connectionId);
      }
    }
    
    for (const connectionId of connectionsToRemove) {
      this.removeConnection(connectionId);
    }
  }
  
  getOutputConnections(nodeId: string, outputHandle?: string): Connection[] {
    const outputMap = this.outputConnections.get(nodeId);
    if (!outputMap) return [];
    
    if (outputHandle) {
      return outputMap.get(outputHandle) || [];
    }
    
    const allConnections: Connection[] = [];
    outputMap.forEach(connections => allConnections.push(...connections));
    return allConnections;
  }
  
  getInputConnections(nodeId: string): Connection[] {
    return this.inputConnections.get(nodeId) || [];
  }
  
  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }
  
  getAllConnections(): Connection[] {
    return Array.from(this.connections.values());
  }
  
  hasConnection(sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string): boolean {
    const outputConnections = this.getOutputConnections(sourceId, sourceHandle);
    return outputConnections.some(conn => 
      conn.targetNodeId === targetId && 
      (!targetHandle || conn.targetHandle === targetHandle)
    );
  }
  
  getConnectionsBetweenNodes(sourceId: string, targetId: string): Connection[] {
    const outputConnections = this.getOutputConnections(sourceId);
    return outputConnections.filter(conn => conn.targetNodeId === targetId);
  }
  
  canConnect(sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string): { canConnect: boolean; reason?: string } {
    if (sourceId === targetId) {
      return { canConnect: false, reason: 'Cannot connect node to itself' };
    }
    
    const existingConnection = this.hasConnection(sourceId, targetId, sourceHandle, targetHandle);
    if (existingConnection) {
      return { canConnect: false, reason: 'Connection already exists' };
    }
    
    return { canConnect: true };
  }
  
  generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
  
  private removeFromInputConnections(connection: Connection): void {
    const inputConns = this.inputConnections.get(connection.targetNodeId);
    if (inputConns) {
      const index = inputConns.findIndex(conn => conn.id === connection.id);
      if (index !== -1) {
        inputConns.splice(index, 1);
        
        if (inputConns.length === 0) {
          this.inputConnections.delete(connection.targetNodeId);
        }
      }
    }
  }
  
  private removeFromOutputConnections(connection: Connection): void {
    const sourceHandle = connection.sourceHandle || 'default';
    const outputMap = this.outputConnections.get(connection.sourceNodeId);
    
    if (outputMap) {
      const handleConnections = outputMap.get(sourceHandle);
      if (handleConnections) {
        const index = handleConnections.findIndex(conn => conn.id === connection.id);
        if (index !== -1) {
          handleConnections.splice(index, 1);
          
          if (handleConnections.length === 0) {
            outputMap.delete(sourceHandle);
            if (outputMap.size === 0) {
              this.outputConnections.delete(connection.sourceNodeId);
            }
          }
        }
      }
    }
  }
  
  validateConnection(connection: Connection): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!connection.id) {
      errors.push('Connection must have an ID');
    }
    
    if (!connection.sourceNodeId) {
      errors.push('Connection must have a source node ID');
    }
    
    if (!connection.targetNodeId) {
      errors.push('Connection must have a target node ID');
    }
    
    if (connection.sourceNodeId === connection.targetNodeId) {
      errors.push('Connection cannot connect node to itself');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  getStats(): {
    totalConnections: number;
    nodesWithInputs: number;
    nodesWithOutputs: number;
    averageInputConnections: number;
    averageOutputConnections: number;
    maxOutputConnectionsPerNode: number;
  } {
    const nodesWithInputs = this.inputConnections.size;
    const nodesWithOutputs = this.outputConnections.size;
    
    let totalInputConnections = 0;
    for (const connections of this.inputConnections.values()) {
      totalInputConnections += connections.length;
    }
    
    let totalOutputConnections = 0;
    let maxOutputConnections = 0;
    for (const outputMap of this.outputConnections.values()) {
      let nodeOutputConnections = 0;
      for (const connections of outputMap.values()) {
        nodeOutputConnections += connections.length;
      }
      totalOutputConnections += nodeOutputConnections;
      maxOutputConnections = Math.max(maxOutputConnections, nodeOutputConnections);
    }
    
    return {
      totalConnections: this.connections.size,
      nodesWithInputs,
      nodesWithOutputs,
      averageInputConnections: nodesWithInputs > 0 ? totalInputConnections / nodesWithInputs : 0,
      averageOutputConnections: nodesWithOutputs > 0 ? totalOutputConnections / nodesWithOutputs : 0,
      maxOutputConnectionsPerNode: maxOutputConnections
    };
  }
  
  getConnectionPairs(): Array<{ source: string; target: string }> {
    return Array.from(this.connections.values()).map(conn => ({
      source: conn.sourceNodeId,
      target: conn.targetNodeId
    }));
  }
  
  cloneConnection(connectionId: string, newId?: string): Connection | undefined {
    const original = this.connections.get(connectionId);
    if (!original) return undefined;
    
    return {
      ...original,
      id: newId || this.generateConnectionId(),
      metadata: original.metadata ? { ...original.metadata } : undefined
    };
  }
}