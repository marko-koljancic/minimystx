import { useEffect, useRef } from "react";
import { useKeyboardShortcuts } from "../hooks";
import { SceneManager } from "./SceneManager";
import MaximizeToggleButton from "../components/MaximizeToggleButton";
import ViewportControls from "../components/ViewportControls";

export default function RenderingCanvas() {
  const { containerRef: keyboardContainerRef } = useKeyboardShortcuts({ context: "render" });
  const resizeContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !resizeContainerRef.current) return;
    sceneManagerRef.current = new SceneManager(canvasRef.current);

    const handleResize = () => {
      if (sceneManagerRef.current) {
        sceneManagerRef.current.handleResize();
      }
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        handleResize();
      });
    });

    resizeObserver.observe(resizeContainerRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
        sceneManagerRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={keyboardContainerRef} style={{ width: "100%", height: "100%", position: "relative" }} tabIndex={0}>
      <div ref={resizeContainerRef} style={{ width: "100%", height: "100%" }}>
        <canvas
          ref={canvasRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      </div>
      <ViewportControls />
      <MaximizeToggleButton />
    </div>
  );
}
