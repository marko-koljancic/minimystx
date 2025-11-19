import { ReactNode, useCallback, useRef, useEffect } from "react";
import styles from "./DesignLayout.module.css";
import Header from "../pages/Header";
import { useUIStore, useIsRendererMaximized } from "../store";
import PropertiesDrawer from "../components/PropertiesDrawer";
import { NodePalette } from "../components/NodePalette";
interface DesignLayoutProps {
  leftTop?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}
const DesignLayout = ({ leftTop, right, children }: DesignLayoutProps) => {
  const { leftPaneWidth, updateLayout } = useUIStore();
  const isRendererMaximized = useIsRendererMaximized();
  const isDraggingVertical = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleVerticalDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingVertical.current = true;
  }, []);
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      if (isDraggingVertical.current) {
        const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        updateLayout({ leftPaneWidth: Math.max(20, Math.min(80, newWidth)) });
      }
    },
    [updateLayout]
  );
  const handleMouseUp = useCallback(() => {
    isDraggingVertical.current = false;
  }, []);
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingVertical.current) {
        handleMouseMove(e);
      }
    };
    const handleGlobalMouseUp = () => {
      if (isDraggingVertical.current) {
        handleMouseUp();
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);
  useEffect(() => {
    if (isDraggingVertical.current) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
  });
  if (children) return <>{children}</>;
  return (
    <div className={styles.container}>
      <Header />
      <div ref={containerRef} className={`${styles.contentContainer} ${isRendererMaximized ? styles.maximized : ""}`}>
        <div className={styles.leftPane} style={{ width: isRendererMaximized ? "100%" : `${leftPaneWidth}%` }}>
          {leftTop}
        </div>
        {!isRendererMaximized && (
          <>
            <div className={styles.verticalResizer} onMouseDown={handleVerticalDragStart} />
            <div className={styles.rightPane} style={{ width: `${100 - leftPaneWidth}%` }}>
              <div className={styles.rightPaneContent}>
                <div className={styles.flowArea}>{right}</div>
                <PropertiesDrawer />
              </div>
            </div>
          </>
        )}
      </div>
      <NodePalette />
    </div>
  );
};
export default DesignLayout;
