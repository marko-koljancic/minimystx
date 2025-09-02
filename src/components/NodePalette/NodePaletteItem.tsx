import { useState } from "react";
import { NodeDefinition } from "../../engine/graphStore";
import styles from "./NodePaletteItem.module.css";
interface NodePaletteItemProps {
  node: NodeDefinition;
  onDrop: () => void;
  isSelected?: boolean;
  onMouseEnter?: () => void;
}
export default function NodePaletteItem({
  node,
  onDrop,
  isSelected = false,
  onMouseEnter,
}: NodePaletteItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    e.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({
        type: node.type,
        displayName: node.displayName,
      })
    );
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => {
    setIsDragging(false);
    onDrop();
  };
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={onMouseEnter}
      className={`${styles.item} ${isDragging ? styles.dragging : ""} ${
        isSelected ? styles.selected : ""
      }`}
      role="option"
      aria-selected={isSelected}
      aria-label={`${node.displayName} node`}
      tabIndex={-1}
    >
      <span className={styles.name}>{node.displayName}</span>
    </div>
  );
}
