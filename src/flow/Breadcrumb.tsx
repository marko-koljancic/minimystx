import React from "react";
import { useCurrentContext, useNavigateToRoot } from "../store/uiStore";
import { useGraphStore } from "../engine/graphStore";
import styles from "./Breadcrumb.module.css";

export const Breadcrumb: React.FC = () => {
  const currentContext = useCurrentContext();
  const navigateToRoot = useNavigateToRoot();
  const { rootNodeRuntime } = useGraphStore();

  const handleNavigateToRoot = () => {
    // Trigger custom event to save viewport before navigation
    const saveViewportEvent = new CustomEvent("minimystx:saveCurrentViewport");
    window.dispatchEvent(saveViewportEvent);

    navigateToRoot();
  };

  if (currentContext.type === "root") {
    return null; // Hide breadcrumbs in root context
  }

  const geoNodeId = currentContext.geoNodeId;
  const geoNodeName =
    geoNodeId && rootNodeRuntime[geoNodeId]
      ? rootNodeRuntime[geoNodeId].params.general?.name || "GeoNode"
      : "GeoNode";

  return (
    <div className={styles.breadcrumb}>
      <button className={styles.breadcrumbButton} onClick={handleNavigateToRoot}>
        Scene
      </button>
      <span className={styles.separator}> → </span>
      <span className={styles.currentContext}>{geoNodeName}</span>
    </div>
  );
};
