import { useCallback } from "react";
import { EdgeData, useGraphStore } from "../engine/graphStore";
import { nodeRegistry } from "../engine/nodeRegistry";
import { useCurrentContext } from "../store/uiStore";
import { EdgeChange } from "@xyflow/react";

export const useFlowGraphSync = () => {
  const currentContext = useCurrentContext();
  const { addNode, removeNode, setParams, addEdge, resetEdges } = useGraphStore();

  const syncNodeChanges = useCallback(
    (changes: any[]) => {
      changes.forEach((change: any) => {
        switch (change.type) {
          case "add":
            if (!nodeRegistry[change.item.type]) return;
            addNode(
              {
                id: change.item.id,
                type: change.item.type,
              },
              currentContext
            );
            break;

          case "remove":
            removeNode(change.id, currentContext);
            break;

          case "replace":
            if (change.item?.data) setParams(change.item.id, change.item.data, currentContext);
            break;
          case "position":
          case "dimensions":
          case "select":
            break;

          default:
        }
      });
    },
    [addNode, removeNode, setParams, currentContext]
  );

  const syncEdgeChanges = useCallback(
    (changes: EdgeChange[], customResetEdges?: EdgeData[]) => {
      const results: Array<{ success: boolean; error?: string; edgeId?: string }> = [];

      changes.forEach((change) => {
        switch (change.type) {
          case "add":
            if ("item" in change) {
              const { source, target, sourceHandle, targetHandle } = change.item;
              if (source && target) {
                const result = addEdge(
                  source,
                  target,
                  currentContext,
                  sourceHandle || undefined,
                  targetHandle || undefined
                );
                results.push({
                  success: result.ok,
                  error: result.ok ? undefined : result.error,
                  edgeId: change.item.id,
                });
              } else {
                results.push({
                  success: false,
                  error: "Invalid edge: missing source or target",
                  edgeId: change.item.id,
                });
              }
            }
            break;

          case "remove":
            if ("id" in change) results.push({ success: true, edgeId: change.id });
            break;

          case "select":
            results.push({ success: true, edgeId: (change as any).id });
            break;

          default:
        }
      });

      if (customResetEdges) {
        const result = resetEdges(customResetEdges, currentContext);
        results.push({
          success: result.ok,
          error: result.ok ? undefined : result.error,
        });
      }

      return results;
    },
    [addEdge, resetEdges, currentContext]
  );

  return { syncNodeChanges, syncEdgeChanges };
};
