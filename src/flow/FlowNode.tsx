import { memo } from "react";
import { NodeProps, Position } from "@xyflow/react";
import IOHandle from "./handles/IOHandle";
import RenderFlagBadge from "./RenderFlagBadge";
import { nodeRegistry } from "./nodes/nodeRegistry";
import { ConnectionType, NodeInput, NodeOutput } from "../engine/types/NodeIO";
import { useNodeComputeError, useNodeComputeWarning } from "../hooks/useNodeComputeStatus";
import styles from "./FlowNode.module.css";

// The one registry-driven node component. Everything a node shows on the canvas
// comes from its NodeDefinition: displayName, declared input/output ports (handle
// ids MUST match the keys its computeTyped reads and writes), whether it has a
// render flag, and the live compute error/warning state. The Note node keeps its
// own component (freeform text editing is genuinely different).

const PILL_WIDTH = 90;
const PILL_HEIGHT = 30;
const SQUARE_SIZE = 48;

const handleColorClass = (type: ConnectionType): string => {
  switch (type) {
    case ConnectionType.GEOMETRY:
      return styles.handleGreen;
    case ConnectionType.NUMBER:
      return styles.handleYellow;
    default:
      return styles.handleBlue;
  }
};

// Distribute n handles across the node width: 1 handle sits centered, 4 handles
// sit at 0.2/0.4/0.6/0.8 (matching the previous per-node layouts).
const handleLeft = (index: number, count: number, width: number): number => (width * (index + 1)) / (count + 1);

type FlowNodeData = {
  general?: { name?: string };
  rendering?: { visible?: boolean };
};

function FlowNode(props: NodeProps) {
  const { data, selected, id, type } = props;
  const nodeData = data as FlowNodeData;
  const error = useNodeComputeError(id);
  const warning = useNodeComputeWarning(id);

  const definition = nodeRegistry[type];
  if (!definition) {
    return <div className={styles.nodeContainer}>Unknown node type: {type}</div>;
  }

  const isSquare = definition.category === "Container";
  const width = isSquare ? SQUARE_SIZE : PILL_WIDTH;
  const height = isSquare ? SQUARE_SIZE : PILL_HEIGHT;
  const label = nodeData.general?.name || definition.displayName;
  const hasRenderFlag = Boolean(definition.params.rendering?.visible);
  const inputs: NodeInput[] = definition.inputs ?? [];
  const outputs: NodeOutput[] = definition.outputs ?? [];

  // Error (red) takes precedence over warning (amber).
  const status = error
    ? { color: "#e5484d", message: error, label: "Compute error" }
    : warning
      ? { color: "#f5a623", message: warning, label: "Warning" }
      : null;

  return (
    <div className={styles.nodeContainer}>
      <div className={isSquare ? styles.squareLabel : styles.pillLabel}>{label}</div>
      <div
        className={`
          ${isSquare ? styles.square : styles.pill}
          ${selected ? styles.nodeSelected : ""}
        `}
        style={status ? { boxShadow: `0 0 0 2px ${status.color}`, outline: "none" } : undefined}
      />
      {status && (
        <div
          role="img"
          aria-label={`${status.label}: ${status.message}`}
          title={status.message}
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: status.color,
            color: "#fff",
            fontSize: 10,
            lineHeight: "14px",
            textAlign: "center",
            fontWeight: 700,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
            pointerEvents: "auto",
            cursor: "help",
            zIndex: 5,
          }}
        >
          !
        </div>
      )}
      {hasRenderFlag && (
        <RenderFlagBadge
          nodeId={id}
          render={nodeData.rendering?.visible ?? true}
          nodeWidth={width}
          nodeHeight={height}
        />
      )}
      {inputs.map((input, index) => (
        <IOHandle
          key={input.name}
          type="target"
          position={Position.Top}
          className={`${styles.targetHandle} ${handleColorClass(input.type)}`}
          style={{
            top: -8,
            left: handleLeft(index, inputs.length, width),
          }}
          id={input.name}
        />
      ))}
      {outputs.map((output, index) => (
        <IOHandle
          key={output.name}
          type="source"
          position={Position.Bottom}
          className={`${styles.sourceHandle} ${handleColorClass(output.type)}`}
          style={{
            bottom: -8,
            left: handleLeft(index, outputs.length, width),
          }}
          id={output.name}
        />
      ))}
    </div>
  );
}

export default memo(FlowNode);
