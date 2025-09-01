import { useRef, useEffect } from "react";
import { useDrawerCollapsed, useDrawerHeight, useToggleDrawer, useSetDrawerHeight } from "../store";
import PropertiesTabs from "./PropertiesTabs";
import styles from "./PropertiesDrawer.module.css";
export default function PropertiesDrawer() {
  const collapsed = useDrawerCollapsed();
  const bottomPaneHeight = useDrawerHeight();
  const toggleDrawer = useToggleDrawer();
  const setDrawerHeight = useSetDrawerHeight();
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const startHeight = useRef(0);
  const drawerStyle = {
    height: collapsed ? 32 : bottomPaneHeight,
  };
  const handleResizeStart = (e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    startHeight.current = bottomPaneHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = dragStartY.current - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight.current + deltaY));
      setDrawerHeight(newHeight);
    };
    const handleGlobalMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [setDrawerHeight]);
  return (
    <div className={styles.drawerContainer} style={drawerStyle}>
      {!collapsed && <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />}
      <div className={styles.drawerHeader}>
        <span className={styles.drawerTitle}>Properties</span>
        <button
          className={styles.collapseButton}
          onClick={toggleDrawer}
          aria-label={collapsed ? "Expand properties" : "Collapse properties"}
        >
          <span className={collapsed ? styles.chevronUp : styles.chevronDown}>
            {collapsed ? "▲" : "▼"}
          </span>
        </button>
      </div>
      {!collapsed && (
        <div className={styles.contentArea}>
          <PropertiesTabs />
        </div>
      )}
    </div>
  );
}
