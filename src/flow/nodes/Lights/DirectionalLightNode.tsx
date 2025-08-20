import { NodeProps, Position } from "@xyflow/react";
import IOHandle from "../../../common/IOHandle";
import LightNodeBaseDesign from "../../../common/LightNodeBaseDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { DirectionalLightNodeData } from "./DirectionalLight";

const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;

export default function DirectionalLightNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as DirectionalLightNodeData;

  return (
    <div className={styles.nodeContainer}>
      <LightNodeBaseDesign
        label={nodeData.general?.name || "Directional Light"}
        isSelected={Boolean(selected)}
      />
      <RenderFlagBadge
        nodeId={id}
        render={nodeData.rendering?.visible || false}
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
