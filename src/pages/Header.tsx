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
  initializeMxScene
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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percentage: number; message: string } | null>(null);
  const [importProgress, setImportProgress] = useState<{ percentage: number; message: string } | null>(null);

  const handleSave = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const handleSaveConfirm = useCallback(async (filename: string) => {
    const sanitized = sanitizeFilename(filename);
    const finalFilename = sanitized || getDefaultFilename();

    setShowSaveModal(false);
    setIsExporting(true);
    setExportProgress({ percentage: 0, message: 'Starting export...' });

    try {
      // Get current scene data
      const sceneData = await getCurrentSceneData();
      
      // Export to .mxscene format
      const result = await exportToMxScene(sceneData, {
        projectName: finalFilename,
        onProgress: (progress) => {
          setExportProgress({
            percentage: progress.percentage,
            message: progress.message
          });
        },
        onError: (error) => {
          console.error("Export error:", error);
          setExportProgress(null);
          setIsExporting(false);
          // Could show error modal here
        }
      });

      // Download the file
      downloadMxSceneFile(result);
      
      setExportProgress({ percentage: 100, message: 'Export complete!' });
      
      // Hide progress after a delay
      setTimeout(() => {
        setExportProgress(null);
        setIsExporting(false);
      }, 1000);

    } catch (error) {
      console.error("Failed to export project:", error);
      setExportProgress(null);
      setIsExporting(false);
      // Could show error modal here
    }
  }, []);

  const handleSaveCancel = useCallback(() => {
    setShowSaveModal(false);
  }, []);

  const handleOpen = useCallback(async () => {
    setIsImporting(true);
    setImportProgress({ percentage: 0, message: 'Opening file picker...' });

    try {
      const result = await selectAndImportMxSceneFile({
        onProgress: (progress) => {
          setImportProgress({
            percentage: progress.percentage,
            message: progress.message
          });
        },
        onError: (error) => {
          console.error("Import error:", error);
          setImportProgress(null);
          setIsImporting(false);
          // Could show error modal here
        }
      });

      if (result) {
        // Apply the imported scene to the current session
        await applyImportedScene(result);
        
        setImportProgress({ percentage: 100, message: 'Project loaded successfully!' });
        console.info(`Project loaded: ${result.scene.meta.name}`);
        
        if (result.warnings && result.warnings.length > 0) {
          console.warn('Import completed with warnings:', result.warnings);
        }
        
        // Hide progress after a delay
        setTimeout(() => {
          setImportProgress(null);
          setIsImporting(false);
        }, 1000);
      } else {
        // User cancelled
        setImportProgress(null);
        setIsImporting(false);
      }
      
    } catch (error) {
      console.error("Failed to import project:", error);
      setImportProgress(null);
      setIsImporting(false);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes("Unsupported")) {
          console.warn("Schema mismatch or unsupported format:", error.message);
        } else if (error.message.includes("integrity")) {
          console.error("File integrity check failed:", error.message);
        }
      }
      // Could show error modal here
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

  // Initialize mxscene system
  useEffect(() => {
    initializeMxScene().catch(error => {
      console.warn('Failed to initialize mxscene system:', error);
    });
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Progress indicators */}
        {exportProgress && (
          <div style={{ fontSize: '12px', color: '#888' }}>
            Exporting... {exportProgress.percentage}%
          </div>
        )}
        {importProgress && (
          <div style={{ fontSize: '12px', color: '#888' }}>
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
