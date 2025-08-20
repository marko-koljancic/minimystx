import React, { useState, useEffect, useRef } from "react";
import { getAbsolutePositionStyles, getArrowStyles, PositionType } from "../utils/position";
import styles from "./BaseTooltip.module.css";

export interface TooltipProps {
  name: string;
  description?: string;
  position?: PositionType;
  maxWidth?: number;
  className?: string;
  triggerElement?: React.ReactNode;
  isOpen?: boolean;
}

export default function BaseTooltip({
  name,
  description,
  position = "top",
  maxWidth = 200,
  className,
  triggerElement,
  isOpen,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(!!isOpen);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen !== undefined) {
      setIsVisible(isOpen);
    }
  }, [isOpen]);

  useEffect(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  }, [isVisible]);

  const getTooltipStyle = (): React.CSSProperties => {
    const positionStyles = getAbsolutePositionStyles(coords.x, coords.y, position, 10);

    return {
      ...positionStyles,
      maxWidth: `${maxWidth / 10}rem`,
    };
  };

  const getArrowStyle = (): React.CSSProperties => {
    return getArrowStyles(position, 6, "var(--background-quaternary)");
  };

  const tooltipVisibilityClass = isVisible ? styles.tooltipVisible : styles.tooltipHidden;

  const handleMouseEnter = () => {
    if (isOpen === undefined) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (isOpen === undefined) {
      setIsVisible(false);
    }
  };

  return (
    <>
      {triggerElement && (
        <div
          ref={triggerRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={className}
        >
          {triggerElement}
        </div>
      )}
      <div
        className={`${styles.tooltip} ${tooltipVisibilityClass} ${className || ""}`}
        style={getTooltipStyle()}
      >
        <div className={styles.arrow} style={getArrowStyle()} />
        <div className={styles.tooltipContent}>
          {name && <div className={styles.tooltipName}>{name}</div>}
          {description && <div className={styles.tooltipDescription}>{description}</div>}
        </div>
      </div>
    </>
  );
}
