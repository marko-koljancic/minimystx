import { useGraphStore } from "../engine/graphStore";
import type { NodeState } from "../engine/graphStore";

function findNodeState(nodeId: string | null, state: { rootNodeState: Record<string, NodeState>; subFlows: Record<string, { nodeState: Record<string, NodeState> }> }): NodeState | undefined {
  if (!nodeId) return undefined;
  const root = state.rootNodeState[nodeId];
  if (root) return root;
  for (const subflow of Object.values(state.subFlows)) {
    const nodeState = subflow.nodeState[nodeId];
    if (nodeState) return nodeState;
  }
  return undefined;
}

// Reads a node's latest compute error (if any) from the engine store, searching the
// root graph and every subflow. Returns a stable string reference (or undefined) so a
// subscribing node re-renders only when its own error changes.
export function useNodeComputeError(nodeId: string | null): string | undefined {
  return useGraphStore((state) => findNodeState(nodeId, state)?.error);
}

// Reads a node's non-fatal warning (e.g. empty output while keeping the last good
// geometry). Selecting a plain string keeps the subscription cheap and stable.
export function useNodeComputeWarning(nodeId: string | null): string | undefined {
  return useGraphStore((state) => findNodeState(nodeId, state)?.warning);
}
