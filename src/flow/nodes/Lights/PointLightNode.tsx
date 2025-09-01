import { NodeProps, Position } from "@xyflow/react";
import IOHandle from "../../../common/IOHandle";
import LightNodeBaseDesign from "../../../common/LightNodeBaseDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { PointLightNodeData } from "./PointLight";
const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;
export default function PointLightNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as PointLightNodeData;
  return (
    <div className={styles.nodeContainer}>
      <LightNodeBaseDesign
        label={nodeData.general?.name || "Point Light"}
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
