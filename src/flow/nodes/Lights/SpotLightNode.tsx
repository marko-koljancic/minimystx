import { NodeProps, Position } from "@xyflow/react";
import IOHandle from "../../../common/IOHandle";
import LightNodeBaseDesign from "../../../common/LightNodeBaseDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { SpotLightNodeData } from "./SpotLight";

const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;

export default function SpotLightNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as SpotLightNodeData;

  return (
    <div className={styles.nodeContainer}>
      <LightNodeBaseDesign
        label={nodeData.general?.name || "Spot Light"}
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
