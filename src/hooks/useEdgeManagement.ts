import { useCallback } from "react";
import { Connection, Edge, Node } from "@xyflow/react";
import { v4 as uuid } from "uuid";
import { isValidConnection } from "../engine/connectionValidation";
import { useGraphStore } from "../engine/graphStore";
import { useCurrentContext } from "../store/uiStore";
export function useEdgeManagement(
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  nodes: Node[],
  edges: Edge[]
) {
  const { addEdge, removeEdge } = useGraphStore();
  const currentContext = useCurrentContext();
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection, nodes, edges, currentContext)) {
        return;
      }
      const edge = {
        ...connection,
        sourceHandle: connection.sourceHandle ?? null,
        targetHandle: connection.targetHandle ?? null,
        type: "wire",
        id: uuid(),
      };
      setEdges((eds) => {
        const newEdges = eds.concat(edge);
        return newEdges;
      });
      if (connection.source && connection.target) {
        const result = addEdge(
          connection.source,
          connection.target,
          currentContext,
          connection.sourceHandle || undefined,
          connection.targetHandle || undefined
        );
        if (!result.ok) {
          setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        }
      }
    },
    [setEdges, addEdge, currentContext, nodes, edges]
  );
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!isValidConnection(newConnection, nodes, edges, currentContext)) {
        return;
      }
      const oldRemoveResult = removeEdge(
        oldEdge.source,
        oldEdge.target,
        currentContext,
        oldEdge.sourceHandle || undefined,
        oldEdge.targetHandle || undefined
      );
      if (!oldRemoveResult.ok) {
        return;
      }
      if (newConnection.source && newConnection.target) {
        const addResult = addEdge(
          newConnection.source,
          newConnection.target,
          currentContext,
          newConnection.sourceHandle || undefined,
          newConnection.targetHandle || undefined
        );
        if (!addResult.ok) {
          addEdge(
            oldEdge.source,
            oldEdge.target,
            currentContext,
            oldEdge.sourceHandle || undefined,
            oldEdge.targetHandle || undefined
          );
          return;
        }
      }
      setEdges((eds) => {
        return eds.map((e) => {
          if (e.id === oldEdge.id) {
            return {
              ...e,
              source: newConnection.source || e.source,
              target: newConnection.target || e.target,
              sourceHandle: newConnection.sourceHandle || e.sourceHandle,
              targetHandle: newConnection.targetHandle || e.targetHandle,
            };
          }
          return e;
        });
      });
    },
    [setEdges, nodes, edges, removeEdge, addEdge, currentContext]
  );
  const handleIsValidConnection = useCallback(
    (connection: Edge | Connection) => {
      return isValidConnection(connection, nodes, edges, currentContext);
    },
    [nodes, edges, currentContext]
  );
  return {
    onConnect,
    onReconnect,
    handleIsValidConnection,
  };
}
