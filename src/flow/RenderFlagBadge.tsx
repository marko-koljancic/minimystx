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
export default function RenderFlagBadge({ nodeId, render, nodeWidth, nodeHeight }: RenderFlagBadgeProps) {
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
  const isSubFlowContext = currentContext.type === "subflow";
  const isLightNode = nodeWidth === 90 && nodeHeight === 30;
  const isGeometryNode = nodeWidth === 90 && nodeHeight === 30 && !isLightNode;
  const isGeoNode = nodeWidth === 48 && nodeHeight === 48;
  const badgeLeft = isLightNode ? `${-2.5}rem` : isGeometryNode ? `${-2.5}rem` : `${(nodeWidth / 2 - 8) / 10 - 4}rem`;
  return (
    <>
      {render && (
        <div
          className={styles.renderHalo}
          style={{
            width: `${(nodeWidth * (isGeoNode ? 1.5 : 0.8)) / 10}rem`,
            height: `${(nodeWidth * (isGeoNode ? 1.5 : 0.8)) / 10}rem`,
            left: `${(nodeWidth - nodeWidth * (isGeoNode ? 1.5 : 0.8)) / 2 / 10}rem`,
            top: `${(nodeHeight - nodeWidth * (isGeoNode ? 1.5 : 0.8)) / 2 / 10}rem`,
          }}
        />
      )}
      <div
        className={`${styles.renderBadge} ${
          render ? (isSubFlowContext ? styles.renderSubFlowActive : styles.renderActive) : styles.renderInactive
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
