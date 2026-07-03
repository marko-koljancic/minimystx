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
        type: nodeState.type || "unknown",
        data: nodeState.params || {},
      }));
    } else if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      const subFlow = subFlows[currentContext.geoNodeId];
      if (!subFlow) return [];
      return Object.entries(subFlow.nodeState).map(([id, nodeState]) => ({
        id,
        type: nodeState.type || "unknown",
        data: nodeState.params || {},
      }));
    }
    return [];
  }, [currentContext, rootNodeState, subFlows]);
};
export const useContextEdges = () => {
  const currentContext = useCurrentContext();
  // getEdges is handle-aware (subflow edges carry sourceHandle/targetHandle). Reading
  // it here, keyed on edgeVersion, is what keeps multi-input wires on their real
  // handles instead of collapsing onto the first input. rootNodeState/subFlows keep
  // the memo fresh across context switches and node add/remove.
  const { getEdges, rootNodeState, subFlows, edgeVersion } = useGraphStore();
  return useMemo(() => {
    return getEdges(currentContext).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: "wire",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentContext.type, currentContext.geoNodeId, getEdges, rootNodeState, subFlows, edgeVersion]);
};
