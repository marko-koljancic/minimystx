import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/preferencesStore";
import styles from "./PreferencesTab.module.css";

interface MaterialsTabProps {
  preferences: PreferencesState["materials"];
  onChange: (updates: Partial<PreferencesState["materials"]>) => void;
}

export function MaterialsTab({ preferences, onChange }: MaterialsTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabDescription}>
        Configure default material properties and tone mapping settings for realistic rendering.
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Default Material</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Material Type</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.defaultMaterial}
                metadata={{
                  type: "enum",
                  enumValues: ["meshStandard", "meshPhysical", "meshBasic", "meshLambert"],
                  default: "meshStandard",
                  displayName: "Default Material",
                }}
                onChange={(value) => onChange({ defaultMaterial: value as string })}
              />
            </div>
          </div>

          {preferences.defaultMaterial === "meshStandard" && (
            <>
              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Color</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value="#ffffff"
                    metadata={{
                      type: "color",
                      default: "#ffffff",
                      displayName: "Base Color",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Metalness</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={0.0}
                    metadata={{
                      type: "number",
                      min: 0.0,
                      max: 1.0,
                      step: 0.01,
                      default: 0.0,
                      displayName: "Metalness",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Roughness</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={1.0}
                    metadata={{
                      type: "number",
                      min: 0.0,
                      max: 1.0,
                      step: 0.01,
                      default: 1.0,
                      displayName: "Roughness",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Emissive</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value="#000000"
                    metadata={{
                      type: "color",
                      default: "#000000",
                      displayName: "Emissive Color",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>
            </>
          )}

          {preferences.defaultMaterial === "meshPhysical" && (
            <>
              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Color</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value="#ffffff"
                    metadata={{
                      type: "color",
                      default: "#ffffff",
                      displayName: "Base Color",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Metalness</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={0.0}
                    metadata={{
                      type: "number",
                      min: 0.0,
                      max: 1.0,
                      step: 0.01,
                      default: 0.0,
                      displayName: "Metalness",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Roughness</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={1.0}
                    metadata={{
                      type: "number",
                      min: 0.0,
                      max: 1.0,
                      step: 0.01,
                      default: 1.0,
                      displayName: "Roughness",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Clearcoat</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={0.0}
                    metadata={{
                      type: "number",
                      min: 0.0,
                      max: 1.0,
                      step: 0.01,
                      default: 0.0,
                      displayName: "Clearcoat",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Transmission</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={0.0}
                    metadata={{
                      type: "number",
                      min: 0.0,
                      max: 1.0,
                      step: 0.01,
                      default: 0.0,
                      displayName: "Transmission",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>
            </>
          )}

          {preferences.defaultMaterial === "meshBasic" && (
            <>
              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Color</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value="#ffffff"
                    metadata={{
                      type: "color",
                      default: "#ffffff",
                      displayName: "Base Color",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Wireframe</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={false}
                    metadata={{
                      type: "boolean",
                      default: false,
                      displayName: "Wireframe Mode",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>
            </>
          )}

          {preferences.defaultMaterial === "meshLambert" && (
            <>
              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Color</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value="#ffffff"
                    metadata={{
                      type: "color",
                      default: "#ffffff",
                      displayName: "Base Color",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Emissive</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value="#000000"
                    metadata={{
                      type: "color",
                      default: "#000000",
                      displayName: "Emissive Color",
                    }}
                    onChange={(value) => {}}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Tone Mapping</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Algorithm</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.toneMapping}
                metadata={{
                  type: "enum",
                  enumValues: ["None", "Linear", "Reinhard", "ACES Filmic"],
                  default: "None",
                  displayName: "Tone Mapping",
                }}
                onChange={(value) => onChange({ toneMapping: value as any })}
              />
            </div>
          </div>

          {preferences.toneMapping !== "None" && (
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Exposure</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={preferences.exposure}
                  metadata={{
                    type: "number",
                    min: 0.1,
                    max: 3.0,
                    step: 0.1,
                    default: 1.0,
                    displayName: "Exposure",
                  }}
                  onChange={(value) => onChange({ exposure: value as number })}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            <strong>Tone Mapping Algorithms:</strong>
          </p>
          <ul className={styles.infoList}>
            <li>
              <strong>None:</strong> No tone mapping applied
            </li>
            <li>
              <strong>Linear:</strong> Simple linear tone mapping
            </li>
            <li>
              <strong>Reinhard:</strong> Classic tone mapping operator
            </li>
            <li>
              <strong>ACES Filmic:</strong> Film-like tone mapping used in cinema (recommended)
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Color Management</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>sRGB Encoding</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.sRGBEncoding}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Enable sRGB Encoding",
                }}
                onChange={(value) => onChange({ sRGBEncoding: value as boolean })}
              />
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            sRGB encoding ensures proper color space handling for web display. Disable only for specialized workflows
            requiring linear color space.
          </p>
        </div>
      </div>
    </div>
  );
}
