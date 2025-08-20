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

  return useMemo(() => {
    let dependencyMap: Record<string, string[]>;

    if (currentContext.type === "root") {
      dependencyMap = rootDependencyMap;
    } else if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      const subFlow = subFlows[currentContext.geoNodeId];
      if (!subFlow) return [];
      dependencyMap = subFlow.dependencyMap;
    } else {
      return [];
    }

    const edges = [];
    for (const [sourceId, targets] of Object.entries(dependencyMap)) {
      for (const targetId of targets) {
        edges.push({
          id: `${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: "wire",
        });
      }
    }

    return edges;
  }, [currentContext, rootDependencyMap, subFlows]);
};
