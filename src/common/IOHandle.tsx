import { Handle, HandleProps } from "@xyflow/react";
import React, { useState } from "react";
import { getHandleTypeInfo } from "./handleTypes";
import styles from "./IOHandle.module.css";

export interface IOHandleProps extends HandleProps {
  name?: string;
  description?: string;
}

export default function IOHandle({ ...props }: IOHandleProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTooltip(true);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTooltip(false);
  };

  const handleTypeInfo = getHandleTypeInfo(props.id || "unknown", props.type);

  const getTooltipStyle = (): React.CSSProperties => {
    const tooltipOffset = 8;
    const isInput = props.type === "target";

    let handleLeftPos = 0;
    let handleTopPos = 0;
    let handleBottomPos = 0;

    if (props.style?.left) {
      if (typeof props.style.left === "number") {
        handleLeftPos = props.style.left;
      } else if (typeof props.style.left === "string") {
        handleLeftPos = parseFloat(props.style.left) || 0;
      }
    }

    if (props.style?.top) {
      if (typeof props.style.top === "number") {
        handleTopPos = props.style.top;
      } else if (typeof props.style.top === "string") {
        handleTopPos = parseFloat(props.style.top) || 0;
      }
    }

    if (props.style?.bottom) {
      if (typeof props.style.bottom === "number") {
        handleBottomPos = props.style.bottom;
      } else if (typeof props.style.bottom === "string") {
        handleBottomPos = parseFloat(props.style.bottom) || 0;
      }
    }

    const handleRadius = 6.4;

    if (isInput) {
      return {
        top: `${handleTopPos - tooltipOffset - 20}px`, // Above the handle
        left: `${handleLeftPos - handleRadius}px`, // Left-aligned with handle edge
        zIndex: 1000,
      };
    } else {
      // Output handles are at bottom of node - show tooltip below the handle
      return {
        bottom: `${handleBottomPos - tooltipOffset - 20}px`, // Below the handle
        left: `${handleLeftPos - handleRadius}px`, // Left-aligned with handle edge
        zIndex: 1000,
      };
    }
  };

  return (
    <>
      <Handle
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={styles.handle}
        {...props}
      />
      {showTooltip && (
        <div className={styles.tooltipContainer} style={getTooltipStyle()}>
          <div className={styles.tooltipText}>
            <div className={styles.tooltipLabel}>{handleTypeInfo.label}</div>
            <div className={styles.tooltipDescription}>{handleTypeInfo.description}</div>
          </div>
        </div>
      )}
    </>
  );
}
