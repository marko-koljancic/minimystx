import { NodeProps, Position } from "@xyflow/react";
import IOHandle from "../../handles/IOHandle";
import LightNodeBaseDesign from "./LightNodeBaseDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { RectAreaLightNodeData } from "./RectAreaLight";
const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;
export default function RectAreaLightNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as RectAreaLightNodeData;
  return (
    <div className={styles.nodeContainer}>
      <LightNodeBaseDesign
        label={nodeData.general?.name || "Rect Area Light"}
        isSelected={Boolean(selected)}
      />
      <RenderFlagBadge
        nodeId={id}
        render={nodeData.rendering?.visible ?? true}
        nodeWidth={NODE_WIDTH}
        nodeHeight={NODE_HEIGHT}
      />
      <IOHandle
        type="source"
        position={Position.Bottom}
        className={`${styles.sourceHandle} ${styles.handleYellow}`}
        style={{
          bottom: -8,
          left: NODE_WIDTH / 2,
        }}
        id="light_output"
      />
    </div>
  );
}
