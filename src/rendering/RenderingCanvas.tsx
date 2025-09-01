import { useEffect, useRef, useState, useCallback } from "react";
import { useKeyboardShortcuts } from "../hooks";
import { SceneManager } from "./SceneManager";
import MaximizeToggleButton from "../components/MaximizeToggleButton";
import ViewportControls from "../components/ViewportControls";
import ScreenshotButton from "../components/ScreenshotButton";
import { ScreenshotModal } from "../components/ScreenshotModal";
export default function RenderingCanvas() {
  const { containerRef: keyboardContainerRef } = useKeyboardShortcuts({ context: "render" });
  const resizeContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const [screenshotModal, setScreenshotModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    filename: string;
  }>({
    isOpen: false,
    imageUrl: "",
    filename: "",
  });
  const generateFilename = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `minimystx-screenshot-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.png`;
  }, []);
  const handleScreenshot = useCallback(() => {
    if (!sceneManagerRef.current) return;
    try {
      const imageUrl = sceneManagerRef.current.captureScreenshot(2); // 2x multiplier
      const filename = generateFilename();
      setScreenshotModal({
        isOpen: true,
        imageUrl,
        filename,
      });
    } catch (error) {}
  }, [generateFilename]);
  const handleCloseModal = useCallback(() => {
    setScreenshotModal({
      isOpen: false,
      imageUrl: "",
      filename: "",
    });
  }, []);
  const handleDownload = useCallback(() => {
    handleCloseModal();
  }, [handleCloseModal]);
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
    <div
      ref={keyboardContainerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
      tabIndex={0}
    >
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
      <ScreenshotButton onCapture={handleScreenshot} />
      <MaximizeToggleButton />
      {screenshotModal.isOpen && (
        <ScreenshotModal
          imageUrl={screenshotModal.imageUrl}
          filename={screenshotModal.filename}
          onClose={handleCloseModal}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
