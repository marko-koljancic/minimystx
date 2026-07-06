import { Edge, Node } from "@xyflow/react";
import FlowNode from "../flow/FlowNode.tsx";
import NoteNode from "../flow/nodes/Utility/NoteNode.tsx";
import EdgeLine from "../flow/edges/EdgeLine.tsx";
import { nodeRegistry } from "../flow/nodes/nodeRegistry";

// Every registered node type renders through the one registry-driven FlowNode,
// except the Note node (freeform text editing). Module-level so the map identity
// is stable across renders (React Flow requirement).
export const nodeTypes = Object.fromEntries(
  Object.keys(nodeRegistry).map((type) => [type, type === "noteNode" ? NoteNode : FlowNode])
);
export const edgeTypes = {
  wire: EdgeLine,
};
export const initialEdges: Edge[] = [];
export const initialNodes: Node[] = [];
