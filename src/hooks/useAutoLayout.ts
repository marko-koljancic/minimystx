import { useCallback } from "react";
import { useContextNodes, useContextEdges } from "./useContextNodes";
import { emitAppEvent } from "../store/events";
import { applyDagreLayout, applyELKLayout, getNodeDimensions, LayoutNode } from "../utils/layoutUtils";
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
      emitAppEvent("minimystx:applyLayout", { nodes: layoutedNodes, algorithm: "dagre" });
    } catch (error) {
      console.error("Auto-layout failed:", error);
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
      emitAppEvent("minimystx:applyLayout", { nodes: layoutedNodes, algorithm: "elk" });
    } catch (error) {
      console.error("Auto-layout failed:", error);
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
        emitAppEvent("minimystx:applyLayout", {
          nodes: layoutedNodes,
          algorithm: "dagre",
          selectedOnly: true,
          selectedCount: selectedNodes.length,
        });
      } catch (error) {
        console.error("Auto-layout failed:", error);
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
        emitAppEvent("minimystx:applyLayout", {
          nodes: layoutedNodes,
          algorithm: "elk",
          selectedOnly: true,
          selectedCount: selectedNodes.length,
        });
      } catch (error) {
        console.error("Auto-layout failed:", error);
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
