import { useMemo } from "react";
import { useGraphStore } from "../engine/graphStore";
import { useCurrentContext } from "../store/uiStore";

export const useContextNodes = () => {
  const currentContext = useCurrentContext();
  const { rootNodeState, subFlows } = useGraphStore();

  return useMemo(() => {
    if (currentContext.type === "root") {
      return Object.entries(rootNodeState).map(([id, nodeState]) => ({
        id,
        type: nodeState.type || 'unknown',
        data: nodeState.params || {},
      }));
    } else if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      const subFlow = subFlows[currentContext.geoNodeId];
      if (!subFlow) return [];

      return Object.entries(subFlow.nodeState).map(([id, nodeState]) => ({
        id,
        type: nodeState.type || 'unknown', 
        data: nodeState.params || {},
      }));
    }

    return [];
  }, [currentContext, rootNodeState, subFlows]);
};

export const useContextEdges = () => {
  const currentContext = useCurrentContext();
  const { graph, rootNodeState, subFlows } = useGraphStore();

  return useMemo(() => {
    let contextNodeIds: string[];

    if (currentContext.type === "root") {
      contextNodeIds = Object.keys(rootNodeState);
    } else if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      const subFlow = subFlows[currentContext.geoNodeId];
      if (!subFlow) return [];
      contextNodeIds = Object.keys(subFlow.nodeState);
    } else {
      return [];
    }

    // Get all edges from the graph and filter to context
    const allEdges = graph.getAllEdges();
    const contextEdges = allEdges.filter(edge => 
      contextNodeIds.includes(edge.source) && contextNodeIds.includes(edge.target)
    );

    return contextEdges.map((edge, index) => ({
      id: `${edge.source}->${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      type: "wire",
    }));
  }, [currentContext.type, currentContext.geoNodeId, graph, rootNodeState, subFlows]);
};
