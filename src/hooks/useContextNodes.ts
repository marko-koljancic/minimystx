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
  const { rootDependencyMap, subFlows } = useGraphStore();

  // Extract the specific subflow dependency map to create a stable reference
  const subFlowDependencyMap = useMemo(() => {
    if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      return subFlows[currentContext.geoNodeId]?.dependencyMap;
    }
    return null;
  }, [currentContext.type, currentContext.geoNodeId, subFlows]);

  return useMemo(() => {
    let dependencyMap: Record<string, string[]>;

    if (currentContext.type === "root") {
      dependencyMap = rootDependencyMap;
    } else if (currentContext.type === "subflow" && subFlowDependencyMap) {
      dependencyMap = subFlowDependencyMap;
    } else {
      // Return empty array for invalid contexts without logging on every render
      return [];
    }

    // Only process if we have valid dependency map
    if (!dependencyMap || typeof dependencyMap !== "object") {
      return [];
    }

    const edges = [];
    
    for (const [targetId, sources] of Object.entries(dependencyMap)) {
      if (!Array.isArray(sources)) continue;
      
      for (const sourceId of sources) {
        edges.push({
          id: `${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          sourceHandle: undefined,
          targetHandle: undefined,
          type: "wire",
        });
      }
    }
    
    return edges;
  }, [
    currentContext.type,
    rootDependencyMap,
    subFlowDependencyMap
  ]);
};
