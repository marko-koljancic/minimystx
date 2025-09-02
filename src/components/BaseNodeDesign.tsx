export interface HandleData {
  id: string;
  label: string;
  shortLabel?: string;
  longLabel?: string;
}
import styles from "./BaseNodeDesign.module.css";
export interface NodeStyleProps {
  label?: string;
  width?: number;
  height?: number;
  topPadding?: number;
  bottomPadding?: number;
  isSelected?: boolean;
}
export default function BaseNodeDesign({
  label = "<Node Name>",
  width = 48,
  height = 48,
  isSelected = false,
}: NodeStyleProps) {
  return (
    <div
      className={`${styles.nodeContainer} ${isSelected ? styles.nodeSelected : ""}`}
      style={{
        width: `${width / 10}rem`,
        height: `${height / 10}rem`,
      }}
    >
      <div
        className={styles.nodeLabel}
        style={{
          left: `${(width + 6) / 10}rem`,
        }}
      >
        {label}
      </div>
    </div>
  );
}
