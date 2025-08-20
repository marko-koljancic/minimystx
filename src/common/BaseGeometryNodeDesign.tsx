import { useState } from "react";
import styles from "./BaseGeometryNodeDesign.module.css";

export interface GeometryNodeStyleProps {
  label?: string;
  isSelected?: boolean;
  isDisabled?: boolean;
}

export default function BaseGeometryNodeDesign({
  label = "Geometry",
  isSelected = false,
  isDisabled = false,
}: GeometryNodeStyleProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      <div
        className={`${styles.nodeLabel} ${isDisabled ? styles.disabled : ""}`}
      >
        {label}
      </div>
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