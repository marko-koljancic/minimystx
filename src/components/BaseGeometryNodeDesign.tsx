import { useState } from "react";
import { useNodeId } from "@xyflow/react";
import styles from "./BaseGeometryNodeDesign.module.css";
import { useNodeComputeError, useNodeComputeWarning } from "../hooks/useNodeComputeStatus";
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
  const nodeId = useNodeId();
  const error = useNodeComputeError(nodeId);
  const warning = useNodeComputeWarning(nodeId);
  // Error (red) takes precedence over warning (amber).
  const status = error ? { color: "#e5484d", message: error, label: "Compute error" } : warning ? { color: "#f5a623", message: warning, label: "Warning" } : null;
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
        style={status ? { boxShadow: `0 0 0 2px ${status.color}`, outline: "none" } : undefined}
      />
      {status && (
        <div
          role="img"
          aria-label={`${status.label}: ${status.message}`}
          title={status.message}
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: status.color,
            color: "#fff",
            fontSize: 10,
            lineHeight: "14px",
            textAlign: "center",
            fontWeight: 700,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
            pointerEvents: "auto",
            cursor: "help",
            zIndex: 5,
          }}
        >
          !
        </div>
      )}
    </>
  );
}
