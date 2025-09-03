import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/uiStore";
import styles from "./PreferencesTab.module.css";

interface ScreenshotTabProps {
  preferences: PreferencesState["screenshot"];
  onChange: (updates: Partial<PreferencesState["screenshot"]>) => void;
}

export function ScreenshotTab({ preferences, onChange }: ScreenshotTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabDescription}>
        Configure screenshot capture settings, resolution, and output options.
      </div>
      
      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Resolution</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Preset</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.resolution.preset}
                metadata={{
                  type: "enum",
                  enumValues: ["Viewport", "1.5x", "2x", "4x", "Custom"],
                  default: "2x",
                  displayName: "Resolution Preset",
                }}
                onChange={(value) => onChange({ 
                  resolution: { ...preferences.resolution, preset: value as any }
                })}
              />
            </div>
          </div>

          {preferences.resolution.preset === "Custom" && (
            <>
              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Width</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={preferences.resolution.customWidth || 1920}
                    metadata={{
                      type: "number",
                      min: 100,
                      max: 8192,
                      step: 1,
                      default: 1920,
                      displayName: "Custom Width",
                    }}
                    onChange={(value) => onChange({ 
                      resolution: { ...preferences.resolution, customWidth: value as number }
                    })}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Height</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={preferences.resolution.customHeight || 1080}
                    metadata={{
                      type: "number",
                      min: 100,
                      max: 8192,
                      step: 1,
                      default: 1080,
                      displayName: "Custom Height",
                    }}
                    onChange={(value) => onChange({ 
                      resolution: { ...preferences.resolution, customHeight: value as number }
                    })}
                  />
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Overlays & Metadata</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Transparent BG</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.overlays.transparentBackground}
                metadata={{
                  type: "boolean",
                  default: false,
                  displayName: "Render Transparent Background",
                }}
                onChange={(value) => onChange({ 
                  overlays: { ...preferences.overlays, transparentBackground: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Render Grid</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.overlays.grid}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Render Grid",
                }}
                onChange={(value) => onChange({ 
                  overlays: { ...preferences.overlays, grid: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Render Gizmos</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.overlays.gizmos}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Render Gizmos",
                }}
                onChange={(value) => onChange({ 
                  overlays: { ...preferences.overlays, gizmos: value as boolean }
                })}
              />
            </div>
          </div>


        </div>
      </div>

      <div className={styles.infoBox}>
        <p className={styles.infoText}>
          <strong>Current Template:</strong> {preferences.fileNaming.template}
        </p>
        <p className={styles.infoText}>
          Captures use the resolution multiplier settings. Higher resolutions provide better quality 
          but may impact performance and file size.
        </p>
      </div>
    </div>
  );
}