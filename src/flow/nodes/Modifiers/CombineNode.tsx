import { NodeProps, Position } from "@xyflow/react";
import IOHandle from "../../handles/IOHandle";
import BaseGeometryNodeDesign from "../../../components/BaseGeometryNodeDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { CombineNodeData } from "./Combine";

const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;

export default function CombineNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as CombineNodeData;

  return (
    <div className={styles.nodeContainer}>
      <BaseGeometryNodeDesign label={nodeData.general?.name || "Combine"} isSelected={Boolean(selected)} />

      <RenderFlagBadge
        nodeId={id}
        render={nodeData.rendering?.visible ?? true}
        nodeWidth={NODE_WIDTH}
        nodeHeight={NODE_HEIGHT}
      />

      <IOHandle
        type="target"
        position={Position.Top}
        className={`${styles.targetHandle} ${styles.handleBlue}`}
        style={{
          top: -8,
          left: NODE_WIDTH * 0.2,
        }}
        id="input1"
      />

      <IOHandle
        type="target"
        position={Position.Top}
        className={`${styles.targetHandle} ${styles.handleBlue}`}
        style={{
          top: -8,
          left: NODE_WIDTH * 0.4,
        }}
        id="input2"
      />

      <IOHandle
        type="target"
        position={Position.Top}
        className={`${styles.targetHandle} ${styles.handleBlue}`}
        style={{
          top: -8,
          left: NODE_WIDTH * 0.6,
        }}
        id="input3"
      />

      <IOHandle
        type="target"
        position={Position.Top}
        className={`${styles.targetHandle} ${styles.handleBlue}`}
        style={{
          top: -8,
          left: NODE_WIDTH * 0.8,
        }}
        id="input4"
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
