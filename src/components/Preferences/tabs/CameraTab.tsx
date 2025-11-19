import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/preferencesStore";
import styles from "./PreferencesTab.module.css";

interface CameraTabProps {
  preferences: PreferencesState["camera"];
  onChange: (updates: Partial<PreferencesState["camera"]>) => void;
}

export function CameraTab({ preferences, onChange }: CameraTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabDescription}>
        Configure default camera settings and projection parameters for the 3D viewport.
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Camera Settings</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Default Type</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.defaultType}
                metadata={{
                  type: "enum",
                  enumValues: ["perspective", "orthographic"],
                  default: "perspective",
                  displayName: "Default Camera Type",
                }}
                onChange={(value) => onChange({ defaultType: value as any })}
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Perspective FOV</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.perspectiveFOV}
                metadata={{
                  type: "number",
                  min: 10,
                  max: 120,
                  step: 1,
                  default: 75,
                  displayName: "Field of View (degrees)",
                }}
                onChange={(value) => onChange({ perspectiveFOV: value as number })}
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Ortho Scale</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.orthoScale}
                metadata={{
                  type: "number",
                  min: 1,
                  max: 100,
                  step: 1,
                  default: 10,
                  displayName: "Orthographic Scale",
                }}
                onChange={(value) => onChange({ orthoScale: value as number })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Clipping Planes</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Near Plane</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.clippingNear}
                metadata={{
                  type: "number",
                  min: 0.001,
                  max: 10,
                  step: 0.001,
                  default: 0.1,
                  displayName: "Near Clipping Plane",
                }}
                onChange={(value) => onChange({ clippingNear: value as number })}
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Far Plane</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.clippingFar}
                metadata={{
                  type: "number",
                  min: 100,
                  max: 10000,
                  step: 100,
                  default: 1000,
                  displayName: "Far Clipping Plane",
                }}
                onChange={(value) => onChange({ clippingFar: value as number })}
              />
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            <span
              className={styles.badge}
              style={{ backgroundColor: "var(--warning-subtle)", color: "var(--warning-primary)" }}
            >
              WARNING
            </span>{" "}
            Extreme clipping plane values can cause depth buffer precision issues or object disappearing.
          </p>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Orbit Controls</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Rotate Speed</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.orbitControls.rotateSpeed}
                metadata={{
                  type: "number",
                  min: 0.1,
                  max: 3.0,
                  step: 0.1,
                  default: 1.0,
                  displayName: "Rotation Speed",
                }}
                onChange={(value) =>
                  onChange({
                    orbitControls: { ...preferences.orbitControls, rotateSpeed: value as number },
                  })
                }
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Pan Speed</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.orbitControls.panSpeed}
                metadata={{
                  type: "number",
                  min: 0.1,
                  max: 3.0,
                  step: 0.1,
                  default: 1.0,
                  displayName: "Pan Speed",
                }}
                onChange={(value) =>
                  onChange({
                    orbitControls: { ...preferences.orbitControls, panSpeed: value as number },
                  })
                }
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Dolly Speed</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.orbitControls.dollySpeed}
                metadata={{
                  type: "number",
                  min: 0.1,
                  max: 3.0,
                  step: 0.1,
                  default: 1.0,
                  displayName: "Dolly (Zoom) Speed",
                }}
                onChange={(value) =>
                  onChange({
                    orbitControls: { ...preferences.orbitControls, dollySpeed: value as number },
                  })
                }
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Damping</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.orbitControls.dampingEnabled}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Enable Damping",
                }}
                onChange={(value) =>
                  onChange({
                    orbitControls: {
                      ...preferences.orbitControls,
                      dampingEnabled: value as boolean,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
