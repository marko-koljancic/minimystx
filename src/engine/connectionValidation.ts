import { Edge, Connection, Node } from "@xyflow/react";
import { nodeRegistry } from "./nodeRegistry";

interface NodeHandleConfig {
  sourceHandles: string[];
  targetHandles: string[];
}

const wouldCreateCycle = (edges: Edge[], newSource: string, newTarget: string): boolean => {
  const tempEdges = [...edges, { source: newSource, target: newTarget }];

  const adjacencyList = new Map<string, string[]>();
  tempEdges.forEach((edge) => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, []);
    }
    adjacencyList.get(edge.source)!.push(edge.target);
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const nodeId of adjacencyList.keys()) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        return true;
      }
    }
  }

  return false;
};

export const isValidConnection = (
  connection: Edge | Connection,
  nodes: Node[],
  edges: Edge[],
  currentContext?: { type: "root" | "subflow"; geoNodeId?: string }
): boolean => {
  const { source, target, targetHandle } = connection;
  
  // Debug: Log the incoming connection details
  console.log(`🔍 Validating connection:`, {
    source,
    target, 
    targetHandle,
    connectionType: typeof targetHandle,
    totalEdges: edges.length,
    edgeIds: edges.map(e => e.id)
  });
  
  // Early validation cache to reduce repeated calls during drag (unused for now)
  // const connectionKey = `${source}-${target}-${targetHandle}`;
  
  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);
  
  // CRITICAL FIX: Handle undefined/null targetHandle by treating it as a default handle
  const normalizedTargetHandle = targetHandle ?? "default";
  
  // CRITICAL FIX: Count existing connections to the same target handle more robustly
  // This addresses React Flow edge state timing issues
  const existingConnectionsToHandle = edges.filter((edge) => {
    const edgeTargetHandle = edge.targetHandle ?? "default";
    return edge.target === target && edgeTargetHandle === normalizedTargetHandle;
  });
  
  const existingTargetConnection = existingConnectionsToHandle.length > 0 ? existingConnectionsToHandle[0] : undefined;

  // Basic validation
  if (!source || !target) {
    console.log(`🚫 Connection validation failed: missing source/target`);
    return false;
  }
  if (source === target) {
    console.log(`🚫 Connection validation failed: self-connection`);
    return false;
  }
  if (!sourceNode || !targetNode) {
    console.log(`🚫 Connection validation failed: node not found`);
    return false;
  }

  if (currentContext && sourceNode.type && targetNode.type) {
    const sourceNodeDef = nodeRegistry[sourceNode.type as keyof typeof nodeRegistry];
    const targetNodeDef = nodeRegistry[targetNode.type as keyof typeof nodeRegistry];
    
    if (sourceNodeDef && !sourceNodeDef.allowedContexts.includes(currentContext.type)) {
      return false;
    }
    
    if (targetNodeDef && !targetNodeDef.allowedContexts.includes(currentContext.type)) {
      return false;
    }
  }

  // Check for existing connection to same target handle
  console.log(`🔍 Checking for existing connections to ${target}.${normalizedTargetHandle}:`, {
    totalEdges: edges.length,
    edgesToTarget: edges.filter(edge => edge.target === target),
    edgesToTargetHandle: edges.filter(edge => {
      const edgeTargetHandle = edge.targetHandle ?? "default";
      return edge.target === target && edgeTargetHandle === normalizedTargetHandle;
    }),
    existingConnection: existingTargetConnection,
    // Debug: Show actual targetHandle values from existing edges
    existingEdgesHandles: edges.filter(edge => edge.target === target).map(edge => ({
      id: edge.id,
      targetHandle: edge.targetHandle,
      targetHandleType: typeof edge.targetHandle,
      normalizedTargetHandle: edge.targetHandle ?? "default",
      sourceHandle: edge.sourceHandle,
      source: edge.source,
      target: edge.target
    })),
    currentConnectionTargetHandle: targetHandle,
    normalizedCurrentTargetHandle: normalizedTargetHandle
  });
  
  if (existingTargetConnection) {
    console.log(`🚫 Connection validation failed: target handle already connected (${target}.${targetHandle})`);
    return false;
  }
  
  // Check for cycles
  if (wouldCreateCycle(edges, source, target)) {
    console.log(`🚫 Connection validation failed: would create cycle`);
    return false;
  }
  
  console.log(`✅ Connection validation passed: ${source} → ${target}.${targetHandle}`);
  return true;
};

export type { NodeHandleConfig };
