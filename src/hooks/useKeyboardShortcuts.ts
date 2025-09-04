import { useEffect, useRef } from "react";
import { useUIStore } from "../store";
type ShortcutContext = "flow" | "render";
interface UseKeyboardShortcutsProps {
  context: ShortcutContext;
  enabled?: boolean;
  onDeleteSelectedEdges?: () => void;
  onAutoLayoutCycle?: (forceAllNodes?: boolean) => void;
}
export function useKeyboardShortcuts({
  context,
  enabled = true,
  onDeleteSelectedEdges,
  onAutoLayoutCycle,
}: UseKeyboardShortcutsProps) {
  const {
    toggleGridInFlowCanvas,
    toggleGridInRenderView,
    toggleMinimap,
    toggleFlowControls,
    cycleConnectionLineStyle,
    displayMode,
    setDisplayMode,
    setFocusedCanvas,
    fitView,
    fitNodes,
    toggleCameraMode,
    toggleAxisGizmo,
    setCameraView,
    setOrthographicCamera,
  } = useUIStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    const handleMouseEnter = () => {
      isFocusedRef.current = true;
      setFocusedCanvas(context);
    };
    const handleMouseLeave = () => {
      isFocusedRef.current = false;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFocusedRef.current) return;
      const key = event.key.toLowerCase();
      const isShiftPressed = event.shiftKey;
      switch (key) {
        case "g":
          event.preventDefault();
          if (context === "flow") {
            toggleGridInFlowCanvas();
          } else if (context === "render") {
            toggleGridInRenderView();
          }
          break;
        case "m":
          if (context === "flow") {
            event.preventDefault();
            toggleMinimap();
          }
          break;
        case "c":
          if (context === "flow") {
            event.preventDefault();
            toggleFlowControls();
          }
          break;
        case "s":
          if (context === "flow") {
            event.preventDefault();
            cycleConnectionLineStyle();
          }
          break;
        case "w":
          if (context === "render") {
            event.preventDefault();
            setDisplayMode(displayMode === "wireframe" ? "shaded" : "wireframe");
          }
          break;
        case "x":
          if (context === "render") {
            event.preventDefault();
            setDisplayMode(displayMode === "xray" ? "shaded" : "xray");
          }
          break;
        case "f":
          if (context === "render") {
            event.preventDefault();
            if (isShiftPressed) {
              fitView();
            } else {
              setCameraView("front");
              setOrthographicCamera(true);
            }
          } else if (context === "flow") {
            event.preventDefault();
            if (isShiftPressed) {
              fitNodes();
            }
          }
          break;
        case "t":
          if (context === "render") {
            event.preventDefault();
            setCameraView("top");
            setOrthographicCamera(true);
          }
          break;
        case "l":
          if (context === "render") {
            event.preventDefault();
            setCameraView("left");
            setOrthographicCamera(true);
          } else if (context === "flow" && onAutoLayoutCycle) {
            event.preventDefault();
            onAutoLayoutCycle(isShiftPressed);
          }
          break;
        case "r":
          if (context === "render") {
            event.preventDefault();
            setCameraView("right");
            setOrthographicCamera(true);
          }
          break;
        case "b":
          if (context === "render") {
            event.preventDefault();
            setCameraView("bottom");
            setOrthographicCamera(true);
          }
          break;
        case "p":
          if (context === "render") {
            event.preventDefault();
            setOrthographicCamera(false);
          }
          break;
        case "o":
          if (context === "render") {
            event.preventDefault();
            setOrthographicCamera(true);
          }
          break;
        case "a":
          if (context === "render") {
            event.preventDefault();
            toggleAxisGizmo();
          }
          break;
        case "delete":
        case "backspace":
          if (context === "flow" && onDeleteSelectedEdges) {
            event.preventDefault();
            onDeleteSelectedEdges();
          }
          break;
      }
    };
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    context,
    enabled,
    toggleGridInFlowCanvas,
    toggleGridInRenderView,
    toggleMinimap,
    toggleFlowControls,
    cycleConnectionLineStyle,
    setFocusedCanvas,
    fitView,
    fitNodes,
    toggleCameraMode,
    toggleAxisGizmo,
    setCameraView,
    setOrthographicCamera,
    onDeleteSelectedEdges,
    onAutoLayoutCycle,
  ]);
  return { containerRef };
}
