import { NodeProps } from "@xyflow/react";
import BaseNodeDesign from "../../../common/BaseNodeDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { GeoNodeData } from "./GeoNode";

const NODE_HEIGHT = 48;
const NODE_WIDTH = 48;

export default function GeoNodeNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as GeoNodeData;

  return (
    <div className={styles.nodeContainer}>
      <BaseNodeDesign
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        label={nodeData.general?.name || "GeoNode"}
        topPadding={0}
        bottomPadding={0}
        isSelected={Boolean(selected)}
      />
      <RenderFlagBadge
        nodeId={id}
        render={nodeData.rendering?.visible || false}
        nodeWidth={NODE_WIDTH}
        nodeHeight={NODE_HEIGHT}
      />
    </div>
  );
}
