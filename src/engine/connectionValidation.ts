import { Edge, Connection, Node } from "@xyflow/react";
import { nodeRegistry } from "../flow/nodes/nodeRegistry";
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
  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);
  const normalizedTargetHandle = targetHandle || "default";
  const existingConnectionsToHandle = edges.filter((edge) => {
    const edgeTargetHandle = edge.targetHandle || "default";
    return edge.target === target && edgeTargetHandle === normalizedTargetHandle;
  });
  const existingTargetConnection = existingConnectionsToHandle.length > 0 ? existingConnectionsToHandle[0] : undefined;
  if (!source || !target) {
    return false;
  }
  if (source === target) {
    return false;
  }
  if (!sourceNode || !targetNode) {
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
  if (existingTargetConnection) {
    return false;
  }
  if (wouldCreateCycle(edges, source, target)) {
    return false;
  }
  return true;
};
export type { NodeHandleConfig };
