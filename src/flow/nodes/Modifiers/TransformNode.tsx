import { NodeProps, Position } from "@xyflow/react";
import IOHandle from "../../handles/IOHandle";
import BaseGeometryNodeDesign from "../../../components/BaseGeometryNodeDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { TransformNodeData } from "./Transform";
const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;
export default function TransformNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as TransformNodeData;
  return (
    <div className={styles.nodeContainer}>
      <BaseGeometryNodeDesign
        label={nodeData.general?.name || "Transform"}
        isSelected={Boolean(selected)}
      />
      <RenderFlagBadge
        nodeId={id}
        render={nodeData.rendering?.visible ?? true}
        nodeWidth={NODE_WIDTH}
        nodeHeight={NODE_HEIGHT}
      />
      <IOHandle
        type="target"
        position={Position.Top}
        className={`${styles.targetHandle} ${styles.handleGreen}`}
        style={{
          top: -8,
          left: NODE_WIDTH / 2,
        }}
        id="geometry_input"
      />
      <IOHandle
        type="source"
        position={Position.Bottom}
        className={`${styles.sourceHandle} ${styles.handleBlue}`}
        style={{
          bottom: -8,
          left: NODE_WIDTH / 2,
        }}
        id="geometry_output"
      />
    </div>
  );
}
