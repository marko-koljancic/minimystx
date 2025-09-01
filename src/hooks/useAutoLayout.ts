import { useCallback } from "react";
import { useContextNodes, useContextEdges } from "./useContextNodes";
import {
  applyDagreLayout,
  applyELKLayout,
  getNodeDimensions,
  LayoutNode,
} from "../utils/layoutUtils";
export const useAutoLayout = () => {
  const contextNodes = useContextNodes();
  const contextEdges = useContextEdges();
  const applyDagre = useCallback(async () => {
    if (contextNodes.length === 0) {
      return;
    }
    try {
      const layoutNodes: LayoutNode[] = contextNodes
        .filter((node) => node.type !== "noteNode")
        .map((node) => ({
          ...node,
          measured: getNodeDimensions(node.id),
        }));
      const layoutedNodes = applyDagreLayout(layoutNodes, contextEdges);
      const event = new CustomEvent("minimystx:applyLayout", {
        detail: {
          nodes: layoutedNodes,
          algorithm: "dagre",
        },
      });
      window.dispatchEvent(event);
    } catch (error) {
    }
  }, [contextNodes, contextEdges]);
  const applyELK = useCallback(async () => {
    if (contextNodes.length === 0) {
      return;
    }
    try {
      const layoutNodes: LayoutNode[] = contextNodes
        .filter((node) => node.type !== "noteNode")
        .map((node) => ({
          ...node,
          measured: getNodeDimensions(node.id),
        }));
      const layoutedNodes = await applyELKLayout(layoutNodes, contextEdges);
      const event = new CustomEvent("minimystx:applyLayout", {
        detail: {
          nodes: layoutedNodes,
          algorithm: "elk",
        },
      });
      window.dispatchEvent(event);
    } catch (error) {
    }
  }, [contextNodes, contextEdges]);
  const applyDagreToSelection = useCallback(
    async (selectedNodeIds: string[]) => {
      if (selectedNodeIds.length === 0) {
        return;
      }
      if (contextNodes.length === 0) {
        return;
      }
      try {
        const selectedNodes = contextNodes
          .filter((node) => selectedNodeIds.includes(node.id))
          .filter((node) => node.type !== "noteNode");
        const selectedNodeSet = new Set(selectedNodes.map((node) => node.id));
        const relevantEdges = contextEdges.filter(
          (edge) => selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target)
        );
        const layoutNodes: LayoutNode[] = selectedNodes.map((node) => ({
          ...node,
          measured: getNodeDimensions(node.id),
        }));
        const layoutedNodes = applyDagreLayout(layoutNodes, relevantEdges);
        const event = new CustomEvent("minimystx:applyLayout", {
          detail: {
            nodes: layoutedNodes,
            algorithm: "dagre",
            selectedOnly: true,
            selectedCount: selectedNodes.length,
          },
        });
        window.dispatchEvent(event);
      } catch (error) {
      }
    },
    [contextNodes, contextEdges]
  );
  const applyELKToSelection = useCallback(
    async (selectedNodeIds: string[]) => {
      if (selectedNodeIds.length === 0) {
        return;
      }
      if (contextNodes.length === 0) {
        return;
      }
      try {
        const selectedNodes = contextNodes
          .filter((node) => selectedNodeIds.includes(node.id))
          .filter((node) => node.type !== "noteNode");
        const selectedNodeSet = new Set(selectedNodes.map((node) => node.id));
        const relevantEdges = contextEdges.filter(
          (edge) => selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target)
        );
        const layoutNodes: LayoutNode[] = selectedNodes.map((node) => ({
          ...node,
          measured: getNodeDimensions(node.id),
        }));
        const layoutedNodes = await applyELKLayout(layoutNodes, relevantEdges);
        const event = new CustomEvent("minimystx:applyLayout", {
          detail: {
            nodes: layoutedNodes,
            algorithm: "elk",
            selectedOnly: true,
            selectedCount: selectedNodes.length,
          },
        });
        window.dispatchEvent(event);
      } catch (error) {
      }
    },
    [contextNodes, contextEdges]
  );
  return {
    applyDagre,
    applyELK,
    applyDagreToSelection,
    applyELKToSelection,
  };
};
