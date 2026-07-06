import React from "react";
import { useCurrentContext, useNavigateToRoot } from "../store/uiStore";
import { emitAppEvent } from "../store/events";
import { useGraphStore } from "../engine/graphStore";
import styles from "./Breadcrumb.module.css";
export const Breadcrumb: React.FC = () => {
  const currentContext = useCurrentContext();
  const navigateToRoot = useNavigateToRoot();
  const { rootNodeState } = useGraphStore();
  const handleNavigateToRoot = () => {
    emitAppEvent("minimystx:saveCurrentViewport");
    navigateToRoot();
  };
  if (currentContext.type === "root") {
    return null;
  }
  const geoNodeId = currentContext.geoNodeId;
  const geoNodeName =
    geoNodeId && rootNodeState[geoNodeId] ? rootNodeState[geoNodeId].params.general?.name || "GeoNode" : "GeoNode";
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
