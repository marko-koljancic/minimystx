import { useCallback } from "react";
import {
  addEdge,
  Background,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const defaultNodes = [
  {
    id: "1",
    type: "input",
    data: { label: "Input Node" },
    position: { x: 250, y: 25 },
    style: { backgroundColor: "#6ede87", color: "white" },
  },

  {
    id: "2",
    // you can also pass a React component as a label
    data: { label: <div>Default Node</div> },
    position: { x: 100, y: 125 },
    style: { backgroundColor: "#ff0072", color: "white" },
  },
  {
    id: "3",
    type: "output",
    data: { label: "Output Node" },
    position: { x: 250, y: 250 },
    style: { backgroundColor: "#6865A5", color: "white" },
  },
];

const defaultEdges = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e2-3", source: "2", target: "3", animated: true },
];

function ControlledFlow() {
  const [nodes, setNodes] = useNodesState(defaultNodes);
  const [edges, setEdges] = useEdgesState(defaultEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    []
  );

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const panOnDrag = [1, 2];

  interface NodeColorProps {
    type?: string;
  }

  const nodeColor = (node: NodeColorProps): string => {
    switch (node.type) {
      case "input":
        return "#6ede87";
      case "output":
        return "#6865A5";
      default:
        return "#ff0072";
    }
  };

  return (
    <div style={{ height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        panOnScroll
        selectionOnDrag
        fitView
        panOnDrag={panOnDrag}
        selectionMode={SelectionMode.Partial}
      >
        <Background bgColor="#040e10" color="#171b1b" />
        {/* <Controls /> */}
        <MiniMap nodeColor={nodeColor} nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
}

export default ControlledFlow;
