import { NodeProps, Position } from "@xyflow/react";
import { useEffect, useRef } from "react";
import IOHandle from "../../handles/IOHandle";
import BaseGeometryNodeDesign from "../../../components/BaseGeometryNodeDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { ImportGltfNodeData, loadGltfFile, SerializableGltfFile } from "./ImportGltf";
import { useGraphStore } from "../../../engine/graphStore";
const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;
export default function ImportGltfNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as ImportGltfNodeData;
  const recomputeFrom = useGraphStore((state) => state.recomputeFrom);
  const markDirty = useGraphStore((state) => state.markDirty);
  const lastFileRef = useRef<File | SerializableGltfFile | null>(null);
  useEffect(() => {
    const currentFile = nodeData.object?.file;
    const filesAreDifferent =
      currentFile &&
      (!lastFileRef.current ||
        currentFile.name !== lastFileRef.current.name ||
        currentFile.size !== lastFileRef.current.size ||
        currentFile.lastModified !== lastFileRef.current.lastModified);
    if (filesAreDifferent) {
      lastFileRef.current = currentFile;
      loadGltfFile(currentFile)
        .then(() => {
          markDirty(id);
          recomputeFrom(id);
        })
        .catch(() => {});
    } else if (!currentFile) {
      lastFileRef.current = null;
    }
  }, [nodeData.object?.file, id, recomputeFrom, markDirty]);
  return (
    <div className={styles.nodeContainer}>
      <BaseGeometryNodeDesign
        label={nodeData.general?.name || "Import glTF"}
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
