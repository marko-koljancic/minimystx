import { useMemo } from "react";
import { useGraphStore } from "../engine/graphStore";
import { useCurrentContext } from "../store/uiStore";

/**
 * Context-aware hook that returns nodes for the current context (root or sub-flow)
 */
export const useContextNodes = () => {
  const currentContext = useCurrentContext();
  const { rootNodeRuntime, subFlows } = useGraphStore();

  return useMemo(() => {
    if (currentContext.type === "root") {
      return Object.entries(rootNodeRuntime).map(([id, runtime]) => ({
        id,
        type: runtime.type,
        data: runtime.params,
      }));
    } else if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      const subFlow = subFlows[currentContext.geoNodeId];
      if (!subFlow) return [];

      return Object.entries(subFlow.nodeRuntime).map(([id, runtime]) => ({
        id,
        type: runtime.type,
        data: runtime.params,
      }));
    }

    return [];
  }, [currentContext, rootNodeRuntime, subFlows]);
};

/**
 * Context-aware hook that returns edges for the current context (root or sub-flow)
 */
export const useContextEdges = () => {
  const currentContext = useCurrentContext();
  const { connectionManager, rootNodeRuntime, subFlows } = useGraphStore();

  return useMemo(() => {
    const edges = [];
    let contextNodeIds: string[];

    if (currentContext.type === "root") {
      contextNodeIds = Object.keys(rootNodeRuntime);
    } else if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      const subFlow = subFlows[currentContext.geoNodeId];
      if (!subFlow) return [];
      contextNodeIds = Object.keys(subFlow.nodeRuntime);
    } else {
      return [];
    }

    // Get all connections from ConnectionManager for nodes in this context
    for (const nodeId of contextNodeIds) {
      const connections = connectionManager.getOutputConnections(nodeId);
      
      for (const connection of connections) {
        // Only include connections between nodes in the same context
        if (contextNodeIds.includes(connection.targetNodeId)) {
          edges.push({
            id: connection.id,
            source: connection.sourceNodeId,
            target: connection.targetNodeId,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
            type: "wire",
          });
        }
      }
    }
    
    return edges;
  }, [
    currentContext.type,
    currentContext.geoNodeId,
    connectionManager,
    rootNodeRuntime,
    subFlows
  ]);
};
