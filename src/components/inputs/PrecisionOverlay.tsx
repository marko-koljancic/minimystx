import React from "react";
import styles from "./PrecisionOverlay.module.css";

interface PrecisionOverlayProps {
  isVisible: boolean;
  precisionList: number[];
  selectedIndex: number;
  position: { x: number; y: number };
}

export const PrecisionOverlay: React.FC<PrecisionOverlayProps> = ({
  isVisible,
  precisionList,
  selectedIndex,
  position,
}) => {
  if (!isVisible) return null;

  const formatPrecision = (precision: number): string => {
    if (precision >= 1) {
      return precision.toString();
    } else {
      // Format small decimals without unnecessary trailing zeros in display
      return precision.toString();
    }
  };

  // Calculate overlay position to center it
  const overlayHeight = precisionList.length * 28; // 28px per row
  const overlayWidth = 80;
  const overlayStyle = {
    left: position.x - overlayWidth / 2,
    top: position.y - overlayHeight / 2,
  };

  return (
    <div className={styles.precisionOverlay} style={overlayStyle}>
      {precisionList.map((precision, index) => {
        // Calculate opacity based on distance from selected
        const distance = Math.abs(index - selectedIndex);
        let opacity: number;
        if (distance === 0) {
          opacity = 1.0; // Selected
        } else if (distance === 1) {
          opacity = 0.7; // Adjacent
        } else if (distance === 2) {
          opacity = 0.5; // Second neighbor
        } else {
          opacity = 0.35; // Far neighbors
        }

        return (
          <div
            key={precision}
            className={`${styles.precisionRow} ${index === selectedIndex ? styles.selected : ""}`}
            style={{ opacity }}
          >
            {formatPrecision(precision)}
          </div>
        );
      })}
    </div>
  );
};
