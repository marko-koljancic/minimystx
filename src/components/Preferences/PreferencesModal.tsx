import { useState, useEffect, useRef, useCallback } from "react";
import { usePreferencesStore, PreferencesState } from "../../store";
import { UnitsTab, RendererTab, MaterialsTab, CameraTab, GuidesTab, ScreenshotTab } from "./tabs";
import styles from "./PreferencesModal.module.css";

export type PreferencesTabType = "units" | "renderer" | "materials" | "camera" | "guides" | "screenshot";

interface PreferencesModalProps {
  onClose: () => void;
}

export function PreferencesModal({ onClose }: PreferencesModalProps) {
  const preferences = usePreferencesStore();
  const modalRef = useRef<HTMLDivElement>(null);

  const [localPreferences, setLocalPreferences] = useState<PreferencesState>(preferences);
  const [activeTab, setActiveTab] = useState<PreferencesTabType>("units");
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  const hasUnsavedChanges = JSON.stringify(localPreferences) !== JSON.stringify(preferences);

  const handleCancel = useCallback(() => {
    setLocalPreferences(preferences);
    onClose();
  }, [preferences, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === modalRef.current) {
        handleCancel();
      }
    },
    [handleCancel]
  );

  const updatePreferencesState = useCallback((newPrefs: PreferencesState) => {
    const store = usePreferencesStore.getState();
    store.updateUnits(newPrefs.units);
    store.updateRendererPostProcessing(newPrefs.renderer.postProcessing);
    store.updateRendererBackground(newPrefs.renderer.background);
    store.updateMaterials(newPrefs.materials);
    store.updateCameraSettings(newPrefs.camera);
    store.updateCameraOrbitControls(newPrefs.camera.orbitControls);
    store.updateGridSettings(newPrefs.guides.grid);
    store.updateAxisGizmo(newPrefs.guides.axisGizmo);
    store.updateGroundPlane(newPrefs.guides.groundPlane);
    store.updateScreenshotSettings(newPrefs.screenshot);
    store.updateScreenshotResolution(newPrefs.screenshot.resolution);
    store.updateScreenshotOverlays(newPrefs.screenshot.overlays);
    store.updateScreenshotColorManagement(newPrefs.screenshot.colorManagement);
    store.updateScreenshotFileNaming(newPrefs.screenshot.fileNaming);
    store.updateScreenshotCaptureFlow(newPrefs.screenshot.captureFlow);
  }, []);

  const handleApply = useCallback(() => {
    updatePreferencesState(localPreferences);
  }, [localPreferences, updatePreferencesState]);

  const handleSave = useCallback(() => {
    updatePreferencesState(localPreferences);
    onClose();
  }, [localPreferences, updatePreferencesState, onClose]);

  const handleResetToDefaults = useCallback(() => {
    setShowResetConfirmation(true);
  }, []);

  const handleConfirmReset = useCallback(() => {
    const defaultPrefs: PreferencesState = {
      units: {
        displayUnit: "m",
      },
      renderer: {
        antialiasing: "fxaa",
        pixelRatioCap: 2.0,
        postProcessing: {
          enabled: false,
          passes: [],
          bloomStrength: 0.5,
          ssaoKernelRadius: 16,
          ssaoMinDistance: 0.005,
          ssaoMaxDistance: 0.1,
          ssaoIntensity: 1.0,
        },
        background: {
          type: "single",
          color: "#191919",
        },
      },
      materials: {
        defaultMaterial: "meshStandard",
        toneMapping: "None",
        exposure: 1.0,
        sRGBEncoding: true,
      },
      camera: {
        defaultType: "perspective",
        perspectiveFOV: 75,
        orthoScale: 10,
        clippingNear: 0.1,
        clippingFar: 1000,
        orbitControls: {
          rotateSpeed: 1.0,
          panSpeed: 1.0,
          dollySpeed: 1.0,
          dampingEnabled: true,
        },
      },
      guides: {
        grid: {
          enabled: true,
          majorSpacing: 10.0,
          minorSubdivisions: 5,
          majorGridLines: 10,
        },
        axisGizmo: {
          enabled: true,
          size: "Small",
        },
        groundPlane: {
          enabled: false,
          shadowsEnabled: false,
          elevation: -0.001,
        },
      },
      screenshot: {
        captureArea: "viewport",
        cameraSource: "active",
        resolution: {
          preset: "2x",
        },
        overlays: {
          transparentBackground: false,
          grid: true,
          gizmos: true,
          stats: false,
        },
        colorManagement: {
          embedSRGB: true,
          bakeToneMapping: true,
        },
        fileNaming: {
          template: "minimystx-screenshot-{date}-{time}-{width}x{height}.png",
        },
        captureFlow: {
          countdown: "off",
          restoreViewport: true,
        },
      },
    };

    const store = usePreferencesStore.getState();
    store.resetToDefaults();
    setLocalPreferences(usePreferencesStore.getState());
    setShowResetConfirmation(false);
  }, []);

  const handleCancelReset = useCallback(() => {
    setShowResetConfirmation(false);
  }, []);

  const getTabDisplayName = (tab: PreferencesTabType): string => {
    switch (tab) {
      case "units":
        return "Units";
      case "renderer":
        return "Renderer";
      case "materials":
        return "Materials";
      case "camera":
        return "Camera";
      case "guides":
        return "Guides";
      case "screenshot":
        return "Screenshot";
    }
  };

  const availableTabs: PreferencesTabType[] = ["units", "renderer", "materials", "camera", "guides", "screenshot"];

  const updateTabPreferences = useCallback((tabKey: keyof PreferencesState, updates: any) => {
    setLocalPreferences((prev) => ({
      ...prev,
      [tabKey]: {
        ...prev[tabKey],
        ...updates,
      },
    }));
  }, []);

  const renderTabContent = () => {
    return (
      <div className={styles.tabContent}>
        {(() => {
          switch (activeTab) {
            case "units":
              return (
                <UnitsTab
                  preferences={localPreferences[activeTab]}
                  onChange={(updates: any) => updateTabPreferences(activeTab, updates)}
                />
              );
            case "renderer":
              return (
                <RendererTab
                  preferences={localPreferences[activeTab]}
                  onChange={(updates: any) => updateTabPreferences(activeTab, updates)}
                />
              );
            case "materials":
              return (
                <MaterialsTab
                  preferences={localPreferences[activeTab]}
                  onChange={(updates: any) => updateTabPreferences(activeTab, updates)}
                />
              );
            case "camera":
              return (
                <CameraTab
                  preferences={localPreferences[activeTab]}
                  onChange={(updates: any) => updateTabPreferences(activeTab, updates)}
                />
              );
            case "guides":
              return (
                <GuidesTab
                  preferences={localPreferences.guides}
                  onChange={(updates: any) => updateTabPreferences("guides", updates)}
                />
              );
            case "screenshot":
              return (
                <ScreenshotTab
                  preferences={localPreferences[activeTab]}
                  onChange={(updates: any) => updateTabPreferences(activeTab, updates)}
                />
              );
          }
        })()}
      </div>
    );
  };

  return (
    <div className={styles.backdrop} ref={modalRef} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Preferences{hasUnsavedChanges && " *"}</h2>
        </div>

        <div className={styles.content}>
          <div className={styles.tabNav}>
            {availableTabs.map((tab) => (
              <button
                key={tab}
                className={`${styles.tabButton} ${activeTab === tab ? styles.active : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {getTabDisplayName(tab)}
              </button>
            ))}
          </div>

          {renderTabContent()}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <button className={styles.resetButton} onClick={handleResetToDefaults}>
              Reset to Defaults
            </button>
          </div>
          <div className={styles.footerRight}>
            <button className={styles.cancelButton} onClick={handleCancel}>
              Cancel
            </button>
            <button className={styles.applyButton} onClick={handleApply} disabled={!hasUnsavedChanges}>
              Apply
            </button>
            <button className={styles.saveButton} onClick={handleSave} disabled={!hasUnsavedChanges}>
              Save
            </button>
          </div>
        </div>
      </div>

      {showResetConfirmation && (
        <div className={styles.confirmationOverlay}>
          <div className={styles.confirmationDialog}>
            <h3 className={styles.confirmationTitle}>Reset to Defaults</h3>
            <p className={styles.confirmationMessage}>
              This will reset all preferences to their default values. Any unsaved changes will be lost.
            </p>
            <p className={styles.confirmationMessage}>Are you sure you want to continue?</p>
            <div className={styles.confirmationButtons}>
              <button className={styles.cancelButton} onClick={handleCancelReset}>
                Cancel
              </button>
              <button className={styles.resetConfirmButton} onClick={handleConfirmReset}>
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
