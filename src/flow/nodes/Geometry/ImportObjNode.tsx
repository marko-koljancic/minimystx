import { NodeProps, Position } from "@xyflow/react";
import { useEffect, useRef } from "react";
import IOHandle from "../../../common/IOHandle";
import BaseGeometryNodeDesign from "../../../common/BaseGeometryNodeDesign";
import RenderFlagBadge from "../../RenderFlagBadge";
import styles from "../Styles/FlowNode.module.css";
import { ImportObjNodeData, loadObjFile, SerializableObjFile } from "./ImportObj";
import { useGraphStore } from "../../../engine/graphStore";
import { useCurrentContext } from "../../../store/uiStore";

const NODE_HEIGHT = 30;
const NODE_WIDTH = 90;

export default function ImportObjNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as ImportObjNodeData;
  const recomputeFrom = useGraphStore(state => state.recomputeFrom);
  const markDirty = useGraphStore(state => state.markDirty);
  const currentContext = useCurrentContext();
  const lastFileRef = useRef<File | SerializableObjFile | null>(null);

  // Load OBJ file when it changes
  useEffect(() => {
    const currentFile = nodeData.object?.file;
    
    // Only process if we have a file and it's different from the last one
    // Compare file properties instead of object references for robustness
    const filesAreDifferent = currentFile && (
      !lastFileRef.current ||
      currentFile.name !== lastFileRef.current.name ||
      currentFile.size !== lastFileRef.current.size ||
      currentFile.lastModified !== lastFileRef.current.lastModified
    );
    
    if (filesAreDifferent) {
      lastFileRef.current = currentFile;
      
      loadObjFile(currentFile)
        .then(() => {
          // Mark node as dirty first, then trigger recompute
          markDirty(id, currentContext);
          recomputeFrom(id, currentContext);
        })
        .catch((error) => {
          console.error("[ImportObjNode] Failed to load OBJ file:", error);
        });
    } else if (!currentFile) {
      lastFileRef.current = null;
    }
  }, [nodeData.object?.file, id, recomputeFrom, markDirty]);

  return (
    <div className={styles.nodeContainer}>
      <BaseGeometryNodeDesign
        label={nodeData.general?.name || "Import OBJ"}
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
