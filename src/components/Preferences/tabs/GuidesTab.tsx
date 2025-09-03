import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/uiStore";
import styles from "./PreferencesTab.module.css";

interface GuidesTabProps {
  preferences: PreferencesState["guides"];
  onChange: (updates: Partial<PreferencesState["guides"]>) => void;
}

export function GuidesTab({ preferences, onChange }: GuidesTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Guides & Overlays</h3>
        <p className={styles.sectionDescription}>
          Configure grid, axis gizmo, and ground plane visibility and appearance in the 3D viewport.
        </p>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Grid</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Display</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.grid.enabled}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Show Grid",
                }}
                onChange={(value) => onChange({ 
                  grid: { ...preferences.grid, enabled: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={`${styles.toggleGroup} ${preferences.grid.enabled ? styles.enabled : ""}`}>
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Major Lines</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={preferences.grid.majorGridLines}
                  metadata={{
                    type: "number",
                    min: 2,
                    max: 50,
                    step: 1,
                    default: 10,
                    displayName: "Major Lines",
                  }}
                  onChange={(value) => onChange({ 
                    grid: { ...preferences.grid, majorGridLines: value as number }
                  })}
                  disabled={!preferences.grid.enabled}
                />
              </div>
            </div>

            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Major Spacing</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={preferences.grid.majorSpacing}
                  metadata={{
                    type: "number",
                    min: 0.1,
                    max: 10.0,
                    step: 0.1,
                    default: 10.0,
                    displayName: "Major Grid Spacing",
                  }}
                  onChange={(value) => onChange({ 
                    grid: { ...preferences.grid, majorSpacing: value as number }
                  })}
                  disabled={!preferences.grid.enabled}
                />
              </div>
            </div>

            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Minor Subdivisions</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={preferences.grid.minorSubdivisions}
                  metadata={{
                    type: "number",
                    min: 1,
                    max: 20,
                    step: 1,
                    default: 5,
                    displayName: "Minor Subdivisions",
                  }}
                  onChange={(value) => onChange({ 
                    grid: { ...preferences.grid, minorSubdivisions: value as number }
                  })}
                  disabled={!preferences.grid.enabled}
                />
              </div>
            </div>

          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            Grid spacing is displayed in the current display unit. 
            Major Lines sets the number of prominent grid lines (default 10x10), 
            Major Spacing defines the distance between them, 
            and Minor Subdivisions create smaller intermediate lines.
          </p>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Axis Gizmo</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Display</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.axisGizmo.enabled}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Show Axis Gizmo",
                }}
                onChange={(value) => onChange({ 
                  axisGizmo: { ...preferences.axisGizmo, enabled: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={`${styles.toggleGroup} ${preferences.axisGizmo.enabled ? styles.enabled : ""}`}>
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Size</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={preferences.axisGizmo.size}
                  metadata={{
                    type: "enum",
                    enumValues: ["Small", "Medium", "Large"],
                    default: "Small",
                    displayName: "Gizmo Size",
                  }}
                  onChange={(value) => onChange({ 
                    axisGizmo: { ...preferences.axisGizmo, size: value as any }
                  })}
                  disabled={!preferences.axisGizmo.enabled}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            The axis gizmo shows coordinate system orientation with colored arrows: 
            Red (X), Green (Y), Blue (Z). Toggle with <strong>A</strong> key.
          </p>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Ground Plane</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Display</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.groundPlane.enabled}
                metadata={{
                  type: "boolean",
                  default: false,
                  displayName: "Show Ground Plane",
                }}
                onChange={(value) => onChange({ 
                  groundPlane: { ...preferences.groundPlane, enabled: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={`${styles.toggleGroup} ${preferences.groundPlane.enabled ? styles.enabled : ""}`}>
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Shadows</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={preferences.groundPlane.shadowsEnabled}
                  metadata={{
                    type: "boolean",
                    default: false,
                    displayName: "Enable Ground Shadows",
                  }}
                  onChange={(value) => onChange({ 
                    groundPlane: { ...preferences.groundPlane, shadowsEnabled: value as boolean }
                  })}
                  disabled={!preferences.groundPlane.enabled}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            The ground plane provides a reference surface at Y=0. 
            Enable shadows to see object shadows cast on the ground plane.
          </p>
          {preferences.groundPlane.enabled && preferences.groundPlane.shadowsEnabled && (
            <p className={styles.infoText}>
              <span className={styles.badge} style={{ backgroundColor: "var(--warning-subtle)", color: "var(--warning-primary)" }}>
                PERFORMANCE
              </span>
              {" "}Ground shadows may impact rendering performance on complex scenes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}