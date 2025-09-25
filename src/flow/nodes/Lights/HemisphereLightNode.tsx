import { NodeProps } from "@xyflow/react";
import LightNodeBaseDesign from "./LightNodeBaseDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { HemisphereLightNodeData } from "./HemisphereLight";
const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;
export default function HemisphereLightNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as HemisphereLightNodeData;
  return (
    <div className={styles.nodeContainer}>
      <LightNodeBaseDesign
        label={nodeData.general?.name || "Hemisphere Light"}
        isSelected={Boolean(selected)}
      />
      <RenderFlagBadge
        nodeId={id}
        render={nodeData.rendering?.visible ?? true}
        nodeWidth={NODE_WIDTH}
        nodeHeight={NODE_HEIGHT}
      />
    </div>
  );
}
