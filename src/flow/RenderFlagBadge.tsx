import { useCallback } from "react";
import { useGraphStore } from "../engine/graphStore";
import { useCurrentContext } from "../store/uiStore";
import styles from "./RenderFlagBadge.module.css";

interface RenderFlagBadgeProps {
  nodeId: string;
  render: boolean;
  nodeWidth: number;
  nodeHeight: number;
}

export default function RenderFlagBadge({
  nodeId,
  render,
  nodeWidth,
  nodeHeight,
}: RenderFlagBadgeProps) {
  const { setParams } = useGraphStore();
  const currentContext = useCurrentContext();

  const handleToggleRender = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setParams(
        nodeId,
        {
          rendering: {
            visible: !render,
          },
        },
        currentContext
      );
    },
    [nodeId, render, setParams, currentContext]
  );

  // Determine if this is a sub-flow context
  const isSubFlowContext = currentContext.type === "subflow";
  
  // Check node types by dimensions  
  // const isGeoNode = nodeWidth === 48 && nodeHeight === 48; // Square GeoNodes
  const isLightNode = nodeWidth === 90 && nodeHeight === 30; // Rectangular LightNodes
  const isGeometryNode = nodeWidth === 90 && nodeHeight === 30 && !isLightNode; // Legacy geometry nodes
  
  // Adjust positioning for different node types to prevent overlap
  const badgeLeft = isLightNode
    ? `${-2.5}rem` // Position left of LightNodes to avoid overlap with pill
    : isGeometryNode 
    ? `${-2.5}rem` // Position left of geometry nodes but not too far
    : `${(nodeWidth / 2 - 8) / 10 - 4}rem`; // Original positioning for GeoNodes

  return (
    <>
      {render && (
        <div
          className={styles.renderHalo}
          style={{
            width: `${(nodeWidth + 16) / 10}rem`, // 8px padding on each side
            height: `${(nodeHeight + 16) / 10}rem`, // 8px padding on each side
            left: `${-8 / 10}rem`, // Center with 8px padding
            top: `${-8 / 10}rem`, // Center with 8px padding
          }}
        />
      )}
      <div
        className={`${styles.renderBadge} ${
          render
            ? isSubFlowContext
              ? styles.renderSubFlowActive
              : styles.renderActive
            : styles.renderInactive
        }`}
        style={{
          left: badgeLeft,
          top: `${(nodeHeight / 2 - 8) / 10}rem`,
        }}
        onClick={handleToggleRender}
        role="button"
        tabIndex={0}
        aria-label={`Toggle render: ${render ? "on" : "off"}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const syntheticEvent = {
              stopPropagation: () => {},
            } as React.MouseEvent;
            handleToggleRender(syntheticEvent);
          }
        }}
      ></div>
    </>
  );
}
