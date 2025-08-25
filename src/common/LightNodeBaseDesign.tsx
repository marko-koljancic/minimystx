import { useState } from "react";
import styles from "./LightNodeBaseDesign.module.css";

export interface LightNodeStyleProps {
  label?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
}

export default function LightNodeBaseDesign({
  label = "Light",
  isSelected = false,
  isDisabled = false,
}: LightNodeStyleProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div className={`${styles.nodeLabel} ${isDisabled ? styles.disabled : ""}`}>{label}</div>
      <div
        className={`
          ${styles.nodePill} 
          ${isSelected ? styles.nodeSelected : ""} 
          ${isHovered ? styles.nodeHovered : ""}
          ${isDisabled ? styles.disabled : ""}
        `}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
    </>
  );
}
