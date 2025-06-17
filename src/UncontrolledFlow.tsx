import {
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback } from "react";

const edgeOptions = {
  animated: true,
  style: {
    stroke: "white",
  },
};

const connectionLineStyle = { stroke: "white" };

const defaultNodes = [
  {
    id: "a",
    type: "input",
    data: { label: "Node A" },
    position: { x: 250, y: 25 },
  },

  {
    id: "b",
    data: { label: "Node B" },
    position: { x: 100, y: 125 },
  },
  {
    id: "c",
    type: "output",
    data: { label: "Node C" },
    position: { x: 250, y: 250 },
  },
];

const defaultEdges = [{ id: "ea-b", source: "a", target: "b" }];

let nodeId = 0;

function UncontrolledFlow() {
  const reactFlowInstance = useReactFlow();
  const onClick = useCallback(() => {
    const id = `${++nodeId}`;
    const newNode = {
      id,
      position: {
        x: Math.random() * 500,
        y: Math.random() * 500,
      },
      data: {
        label: `Node ${id}`,
      },
    };
    reactFlowInstance.addNodes(newNode);
  }, []);

  return (
    <>
      <ReactFlow
        defaultNodes={defaultNodes}
        defaultEdges={defaultEdges}
        defaultEdgeOptions={edgeOptions}
        fitView
        style={{
          backgroundColor: "#D3D2E5",
        }}
        connectionLineStyle={connectionLineStyle}
      />
      <button onClick={onClick} className="btn-add">
        add node
      </button>
    </>
  );
}

export default function () {
  return (
    <ReactFlowProvider>
      <UncontrolledFlow />
    </ReactFlowProvider>
  );
}
