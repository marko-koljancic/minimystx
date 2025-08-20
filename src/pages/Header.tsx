import MenuItem from "./MenuItem";
import styles from "./Header.module.css";
import { ThemeToggle } from "../common/ThemeToggle";
import { useUIStore, useCurrentContext } from "../store";
import { useState, useCallback, useEffect, useMemo } from "react";
import { PromptModal } from "../common/PromptModal";
import { exportGraphWithMeta, importGraphWithMeta } from "../engine/graphStore";
import {
  downloadObjectAsJson,
  selectJsonFile,
  sanitizeFilename,
  getDefaultFilename,
} from "../utils";
import {
  getNodesByCategoryForContext,
  getAvailableCategoriesForContext,
} from "../engine/nodeRegistry";

export default function Header() {
  const {
    showGridInFlowCanvas,
    showGridInRenderView,
    showMinimap,
    showFlowControls,
    connectionLineStyle,
    wireframe,
    xRay,
    focusedCanvas,
    isOrthographicCamera,
    showAxisGizmo,
    toggleGridInFlowCanvas,
    toggleGridInRenderView,
    toggleMinimap,
    toggleFlowControls,
    cycleConnectionLineStyle,
    toggleWireframe,
    toggleXRay,
    toggleAxisGizmo,
    setOrthographicCamera,
    setCameraView,
    fitView,
    fitNodes,
    resetToDefaults,
  } = useUIStore();

  const currentContext = useCurrentContext();

  // Simple layout handlers that dispatch events directly
  const handleApplyDagre = useCallback(() => {
    const event = new CustomEvent('minimystx:applyAutoLayout', {
      detail: { algorithm: 'dagre' }
    });
    window.dispatchEvent(event);
  }, []);

  const handleApplyELK = useCallback(() => {
    const event = new CustomEvent('minimystx:applyAutoLayout', {
      detail: { algorithm: 'elk' }
    });
    window.dispatchEvent(event);
  }, []);

  const [showSaveModal, setShowSaveModal] = useState(false);

  const handleSave = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const handleSaveConfirm = useCallback(async (filename: string) => {
    const sanitized = sanitizeFilename(filename);
    const finalFilename = sanitized || getDefaultFilename();

    try {
      const data = await exportGraphWithMeta();
      downloadObjectAsJson(data, finalFilename);
    } catch (error) {
      console.error("Failed to export project:", error);
    }

    setShowSaveModal(false);
  }, []);

  const handleSaveCancel = useCallback(() => {
    setShowSaveModal(false);
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const data = await selectJsonFile();
      if (data) {
        importGraphWithMeta(data);
        console.info("Project loaded");
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unsupported schema")) {
        console.warn("Schema mismatch detected, import aborted:", error.message);
      } else {
        console.error("Failed to import project:", error);
      }
    }
  }, []);

  const handleCreateNodeAtCenter = useCallback((nodeType: string) => {
    const event = new CustomEvent("minimystx:createNode", {
      detail: {
        nodeType: nodeType,
        position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      },
    });
    window.dispatchEvent(event);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.userAgent.indexOf("Mac") !== -1;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl/Cmd + Shift + S for Save
      if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
      // Ctrl/Cmd + O for Open
      else if (cmdOrCtrl && !event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        handleOpen();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleOpen]);

  // Components dropdown items - organized by category with submenus
  const componentsDropdownItems = useMemo(() => {
    const nodesByCategory = getNodesByCategoryForContext(currentContext.type);
    const categories = getAvailableCategoriesForContext(currentContext.type);

    const items: Array<{
      label: string;
      onClick: () => void;
      submenu?: Array<{ label: string; onClick: () => void }>;
    }> = [];

    categories.forEach((category) => {
      const nodes = nodesByCategory[category] || [];

      // Create submenu items for nodes in this category
      const submenuItems = nodes.map((node) => ({
        label: node.displayName,
        onClick: () => handleCreateNodeAtCenter(node.type),
      }));

      // Add category as main dropdown item with submenu
      items.push({
        label: category,
        onClick: () => {}, // Categories themselves are not clickable
        submenu: submenuItems,
      });
    });

    return items;
  }, [handleCreateNodeAtCenter, currentContext.type]);

  const fileDropdownItems = [
    {
      label: "Save… (Ctrl+Shift+S)",
      onClick: handleSave,
      testId: "file-save",
    },
    {
      label: "Open… (Ctrl+O)",
      onClick: handleOpen,
      testId: "file-open",
    },
  ];

  const viewDropdownItems = useMemo(() => [
    // Render-specific shortcuts (when focused on render canvas)
    ...(focusedCanvas === "render"
      ? [
          {
            label: `${showGridInRenderView ? "Hide" : "Show"} Grid (G)`,
            onClick: toggleGridInRenderView,
          },
          {
            label: `Wireframe: ${wireframe ? "On" : "Off"} (W)`,
            onClick: toggleWireframe,
          },
          {
            label: `X-Ray: ${xRay ? "On" : "Off"} (X)`,
            onClick: toggleXRay,
          },
          {
            label: `Axis Gizmo: ${showAxisGizmo ? "On" : "Off"} (A)`,
            onClick: toggleAxisGizmo,
          },
          {
            label: `Camera: ${isOrthographicCamera ? "Orthographic" : "Perspective"} (P/O)`,
            onClick: () => setOrthographicCamera(!isOrthographicCamera),
          },
          {
            label: "",
            onClick: () => {},
            isDivider: true,
          },
          {
            label: "Top View (T)",
            onClick: () => {
              setCameraView("top");
              setOrthographicCamera(true);
            },
          },
          {
            label: "Front View (F)",
            onClick: () => {
              setCameraView("front");
              setOrthographicCamera(true);
            },
          },
          {
            label: "Left View (L)",
            onClick: () => {
              setCameraView("left");
              setOrthographicCamera(true);
            },
          },
          {
            label: "Right View (R)",
            onClick: () => {
              setCameraView("right");
              setOrthographicCamera(true);
            },
          },
          {
            label: "Bottom View (B)",
            onClick: () => {
              setCameraView("bottom");
              setOrthographicCamera(true);
            },
          },
          {
            label: "",
            onClick: () => {},
            isDivider: true,
          },
          {
            label: "Fit View (Shift+F)",
            onClick: fitView,
          },
        ]
      : []),
    // Flow-specific shortcuts (when focused on flow canvas)
    ...(focusedCanvas === "flow"
      ? [
          {
            label: `${showGridInFlowCanvas ? "Hide" : "Show"} Grid (G)`,
            onClick: toggleGridInFlowCanvas,
          },
          {
            label: `Minimap: ${showMinimap ? "On" : "Off"} (M)`,
            onClick: toggleMinimap,
          },
          {
            label: `Flow Controls: ${showFlowControls ? "On" : "Off"} (C)`,
            onClick: toggleFlowControls,
          },
          {
            label: `Connection Style: ${
              connectionLineStyle.charAt(0).toUpperCase() + connectionLineStyle.slice(1)
            } (S)`,
            onClick: cycleConnectionLineStyle,
          },
          {
            label: "",
            onClick: () => {},
            isDivider: true,
          },
          {
            label: "Fit Nodes (Shift+F)",
            onClick: fitNodes,
          },
        ]
      : []),
    // Global options (shown regardless of focused canvas)
    ...(focusedCanvas
      ? [
          {
            label: "",
            onClick: () => {},
            isDivider: true,
          },
        ]
      : []),
    // Show all options when no specific canvas is focused
    ...(focusedCanvas === null
      ? [
          {
            label: `${showGridInRenderView ? "Hide" : "Show"} Grid - Render (G)`,
            onClick: toggleGridInRenderView,
          },
          {
            label: `Wireframe: ${wireframe ? "On" : "Off"} (W)`,
            onClick: toggleWireframe,
          },
          {
            label: `X-Ray: ${xRay ? "On" : "Off"} (X)`,
            onClick: toggleXRay,
          },
          {
            label: `Axis Gizmo: ${showAxisGizmo ? "On" : "Off"} (A)`,
            onClick: toggleAxisGizmo,
          },
          {
            label: `Camera: ${isOrthographicCamera ? "Orthographic" : "Perspective"} (P/O)`,
            onClick: () => setOrthographicCamera(!isOrthographicCamera),
          },
          {
            label: "",
            onClick: () => {},
            isDivider: true,
          },
          {
            label: `${showGridInFlowCanvas ? "Hide" : "Show"} Grid - Flow (G)`,
            onClick: toggleGridInFlowCanvas,
          },
          {
            label: `Minimap: ${showMinimap ? "On" : "Off"} (M)`,
            onClick: toggleMinimap,
          },
          {
            label: `Flow Controls: ${showFlowControls ? "On" : "Off"} (C)`,
            onClick: toggleFlowControls,
          },
          {
            label: `Connection Style: ${
              connectionLineStyle.charAt(0).toUpperCase() + connectionLineStyle.slice(1)
            } (S)`,
            onClick: cycleConnectionLineStyle,
          },
        ]
      : []),
    {
      label: "",
      onClick: () => {},
      isDivider: true,
    },
    {
      label: "Auto-Layout (Dagre)",
      onClick: handleApplyDagre,
    },
    {
      label: "Auto-Layout (ELK)",
      onClick: handleApplyELK,
    },
    {
      label: "",
      onClick: () => {},
      isDivider: true,
    },
    {
      label: "Reset to Defaults",
      onClick: resetToDefaults,
    },
  ], [
    focusedCanvas,
    showGridInRenderView,
    wireframe,
    xRay,
    showAxisGizmo,
    isOrthographicCamera,
    showGridInFlowCanvas,
    showMinimap,
    showFlowControls,
    connectionLineStyle,
    toggleGridInRenderView,
    toggleWireframe,
    toggleXRay,
    toggleAxisGizmo,
    setOrthographicCamera,
    setCameraView,
    fitView,
    toggleGridInFlowCanvas,
    toggleMinimap,
    toggleFlowControls,
    cycleConnectionLineStyle,
    fitNodes,
    handleApplyDagre,
    handleApplyELK,
    resetToDefaults
  ]);

  return (
    <header className={styles.header}>
      <div className={styles.menuBar}>
        <MenuItem title="File" dropdownItems={fileDropdownItems} />
        <MenuItem title="Edit" />
        <MenuItem title="Components" dropdownItems={componentsDropdownItems} />
        <MenuItem title="View" dropdownItems={viewDropdownItems} />
        <MenuItem title="Help" />
      </div>
      <ThemeToggle />
      {showSaveModal && (
        <PromptModal
          title="Save Project"
          placeholder="Enter project name..."
          defaultValue={getDefaultFilename()}
          onSave={handleSaveConfirm}
          onCancel={handleSaveCancel}
        />
      )}
    </header>
  );
}
