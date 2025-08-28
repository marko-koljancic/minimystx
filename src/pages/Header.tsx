import MenuItem from "./MenuItem";
import styles from "./Header.module.css";
import { ThemeToggle } from "../common/ThemeToggle";
import { useUIStore, useCurrentContext } from "../store";
import { useState, useCallback, useEffect, useMemo } from "react";
import { PromptModal } from "../common/PromptModal";
import { sanitizeFilename, getDefaultFilename } from "../utils";
import {
  exportToMxScene,
  downloadMxSceneFile,
  selectAndImportMxSceneFile,
  applyImportedScene,
  getCurrentSceneData,
  initializeMxScene,
} from "../io/mxscene";
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

  const handleApplyDagre = useCallback(() => {
    const event = new CustomEvent("minimystx:applyAutoLayout", {
      detail: { algorithm: "dagre" },
    });
    window.dispatchEvent(event);
  }, []);

  const handleApplyELK = useCallback(() => {
    const event = new CustomEvent("minimystx:applyAutoLayout", {
      detail: { algorithm: "elk" },
    });
    window.dispatchEvent(event);
  }, []);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    percentage: number;
    message: string;
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{
    percentage: number;
    message: string;
  } | null>(null);

  const handleSave = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const handleSaveConfirm = useCallback(async (filename: string) => {
    const sanitized = sanitizeFilename(filename);
    const finalFilename = sanitized || getDefaultFilename();

    setShowSaveModal(false);
    setIsExporting(true);
    setExportProgress({ percentage: 0, message: "Starting export..." });

    try {
      const sceneData = await getCurrentSceneData();

      const result = await exportToMxScene(sceneData, {
        projectName: finalFilename,
        onProgress: (progress) => {
          setExportProgress({
            percentage: progress.percentage,
            message: progress.message,
          });
        },
        onError: (_error) => {
          setExportProgress(null);
          setIsExporting(false);
        },
      });

      downloadMxSceneFile(result);

      setExportProgress({ percentage: 100, message: "Export complete!" });

      setTimeout(() => {
        setExportProgress(null);
        setIsExporting(false);
      }, 1000);
    } catch (error) {
      setExportProgress(null);
      setIsExporting(false);
    }
  }, []);

  const handleSaveCancel = useCallback(() => {
    setShowSaveModal(false);
  }, []);

  const handleOpen = useCallback(async () => {
    setIsImporting(true);
    setImportProgress({ percentage: 0, message: "Opening file picker..." });

    try {
      const result = await selectAndImportMxSceneFile({
        onProgress: (progress) => {
          setImportProgress({
            percentage: progress.percentage,
            message: progress.message,
          });
        },
        onError: (_error) => {
          setImportProgress(null);
          setIsImporting(false);
        },
      });

      if (result) {
        await applyImportedScene(result);

        setImportProgress({ percentage: 100, message: "Project loaded successfully!" });

        if (result.warnings && result.warnings.length > 0) {
        }

        setTimeout(() => {
          setImportProgress(null);
          setIsImporting(false);
        }, 1000);
      } else {
        setImportProgress(null);
        setIsImporting(false);
      }
    } catch (error) {
      setImportProgress(null);
      setIsImporting(false);

      if (error instanceof Error) {
        if (error.message.includes("Unsupported")) {
        } else if (error.message.includes("integrity")) {
        }
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

  useEffect(() => {
    initializeMxScene().catch((_error) => {
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.userAgent.indexOf("Mac") !== -1;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (cmdOrCtrl && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      } else if (cmdOrCtrl && !event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        handleOpen();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleOpen]);

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

      const submenuItems = nodes.map((node) => ({
        label: node.displayName,
        onClick: () => handleCreateNodeAtCenter(node.type),
      }));

      items.push({
        label: category,
        onClick: () => {},
        submenu: submenuItems,
      });
    });

    return items;
  }, [handleCreateNodeAtCenter, currentContext.type]);

  const fileDropdownItems = [
    {
      label: isExporting ? "Exporting..." : "Save (.mxscene)… (Ctrl+Shift+S)",
      onClick: isExporting ? () => {} : handleSave,
      testId: "file-save",
    },
    {
      label: isImporting ? "Importing..." : "Open (.mxscene)… (Ctrl+O)",
      onClick: isImporting ? () => {} : handleOpen,
      testId: "file-open",
    },
  ];

  const viewDropdownItems = useMemo(
    () => [
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

      ...(focusedCanvas
        ? [
            {
              label: "",
              onClick: () => {},
              isDivider: true,
            },
          ]
        : []),

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
    ],
    [
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
      resetToDefaults,
    ]
  );

  const helpDropdownItems = [
    {
      label: "Minimystx GitHub Repo",
      onClick: () => window.open("https://github.com/marko-koljancic/minimystx", "_blank", "noopener,noreferrer"),
    },
    {
      label: "Minimystx Project Roadmap",
      onClick: () => window.open("https://github.com/users/marko-koljancic/projects/18", "_blank", "noopener,noreferrer"),
    },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.menuBar}>
        <MenuItem title="File" dropdownItems={fileDropdownItems} />
        <MenuItem title="Edit" />
        <MenuItem title="Components" dropdownItems={componentsDropdownItems} />
        <MenuItem title="View" dropdownItems={viewDropdownItems} />
        <MenuItem title="Help" dropdownItems={helpDropdownItems} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {exportProgress && (
          <div style={{ fontSize: "12px", color: "#888" }}>
            Exporting... {exportProgress.percentage}%
          </div>
        )}
        {importProgress && (
          <div style={{ fontSize: "12px", color: "#888" }}>
            Importing... {importProgress.percentage}%
          </div>
        )}
        <ThemeToggle />
      </div>
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
