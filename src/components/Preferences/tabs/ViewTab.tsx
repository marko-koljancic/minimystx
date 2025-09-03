import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/uiStore";
import styles from "./PreferencesTab.module.css";

interface ViewTabProps {
  guidesPreferences: PreferencesState["guides"];
  onGuidesChange: (updates: Partial<PreferencesState["guides"]>) => void;
}

export function ViewTab({ guidesPreferences, onGuidesChange }: ViewTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabDescription}>
        Configure viewport guides, overlays, and interaction controls for the 3D environment.
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
                value={guidesPreferences.grid.enabled}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Show Grid",
                }}
                onChange={(value) => onGuidesChange({ 
                  grid: { ...guidesPreferences.grid, enabled: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={`${styles.toggleGroup} ${guidesPreferences.grid.enabled ? styles.enabled : ""}`}>
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Major Lines</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={guidesPreferences.grid.majorGridLines}
                  metadata={{
                    type: "number",
                    min: 2,
                    max: 50,
                    step: 1,
                    default: 10,
                    displayName: "Major Lines",
                  }}
                  onChange={(value) => onGuidesChange({ 
                    grid: { ...guidesPreferences.grid, majorGridLines: value as number }
                  })}
                  disabled={!guidesPreferences.grid.enabled}
                />
              </div>
            </div>

            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Major Spacing</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={guidesPreferences.grid.majorSpacing}
                  metadata={{
                    type: "number",
                    min: 0.1,
                    max: 10.0,
                    step: 0.1,
                    default: 10.0,
                    displayName: "Major Grid Spacing",
                  }}
                  onChange={(value) => onGuidesChange({ 
                    grid: { ...guidesPreferences.grid, majorSpacing: value as number }
                  })}
                  disabled={!guidesPreferences.grid.enabled}
                />
              </div>
            </div>

            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Minor Subdivisions</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={guidesPreferences.grid.minorSubdivisions}
                  metadata={{
                    type: "number",
                    min: 1,
                    max: 20,
                    step: 1,
                    default: 5,
                    displayName: "Minor Subdivisions",
                  }}
                  onChange={(value) => onGuidesChange({ 
                    grid: { ...guidesPreferences.grid, minorSubdivisions: value as number }
                  })}
                  disabled={!guidesPreferences.grid.enabled}
                />
              </div>
            </div>

          </div>
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
                value={guidesPreferences.axisGizmo.enabled}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Show Axis Gizmo",
                }}
                onChange={(value) => onGuidesChange({ 
                  axisGizmo: { ...guidesPreferences.axisGizmo, enabled: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={`${styles.toggleGroup} ${guidesPreferences.axisGizmo.enabled ? styles.enabled : ""}`}>
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Size</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={guidesPreferences.axisGizmo.size}
                  metadata={{
                    type: "enum",
                    enumValues: ["Small", "Medium", "Large"],
                    default: "Small",
                    displayName: "Gizmo Size",
                  }}
                  onChange={(value) => onGuidesChange({ 
                    axisGizmo: { ...guidesPreferences.axisGizmo, size: value as any }
                  })}
                  disabled={!guidesPreferences.axisGizmo.enabled}
                />
              </div>
            </div>
          </div>
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
                value={guidesPreferences.groundPlane.enabled}
                metadata={{
                  type: "boolean",
                  default: false,
                  displayName: "Show Ground Plane",
                }}
                onChange={(value) => onGuidesChange({ 
                  groundPlane: { ...guidesPreferences.groundPlane, enabled: value as boolean }
                })}
              />
            </div>
          </div>

          <div className={`${styles.toggleGroup} ${guidesPreferences.groundPlane.enabled ? styles.enabled : ""}`}>
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Elevation</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={guidesPreferences.groundPlane.elevation}
                  metadata={{
                    type: "number",
                    min: -10.0,
                    max: 10.0,
                    step: 0.1,
                    default: -0.001,
                    displayName: "Ground Plane Elevation",
                  }}
                  onChange={(value) => onGuidesChange({ 
                    groundPlane: { ...guidesPreferences.groundPlane, elevation: value as number }
                  })}
                  disabled={!guidesPreferences.groundPlane.enabled}
                />
              </div>
            </div>

            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Shadows</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={guidesPreferences.groundPlane.shadowsEnabled}
                  metadata={{
                    type: "boolean",
                    default: false,
                    displayName: "Enable Ground Shadows",
                  }}
                  onChange={(value) => onGuidesChange({ 
                    groundPlane: { ...guidesPreferences.groundPlane, shadowsEnabled: value as boolean }
                  })}
                  disabled={!guidesPreferences.groundPlane.enabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}