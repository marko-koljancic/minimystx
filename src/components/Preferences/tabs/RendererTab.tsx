import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/preferencesStore";
import styles from "./PreferencesTab.module.css";

interface RendererTabProps {
  preferences: PreferencesState["renderer"];
  onChange: (updates: Partial<PreferencesState["renderer"]>) => void;
}

export function RendererTab({ preferences, onChange }: RendererTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabDescription}>
        Configure rendering quality, performance, and visual settings for the 3D viewport.
      </div>


      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Post-Processing</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Enable</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.postProcessing.enabled}
                metadata={{
                  type: "boolean",
                  default: false,
                  displayName: "Enable Post-Processing",
                }}
                onChange={(value) =>
                  onChange({
                    postProcessing: {
                      ...preferences.postProcessing,
                      enabled: value as boolean,
                    },
                  })
                }
              />
            </div>
          </div>

          {preferences.postProcessing.enabled && (
            <>
              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>Bloom</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={preferences.postProcessing.passes.includes("bloom")}
                    metadata={{
                      type: "boolean",
                      default: false,
                      displayName: "Bloom Effect",
                    }}
                    onChange={(value) => {
                      const currentPasses = preferences.postProcessing.passes;
                      const newPasses = value
                        ? [...currentPasses.filter((p) => p !== "bloom"), "bloom"]
                        : currentPasses.filter((p) => p !== "bloom");
                      onChange({
                        postProcessing: {
                          ...preferences.postProcessing,
                          passes: newPasses,
                        },
                      });
                    }}
                  />
                </div>
              </div>

              {preferences.postProcessing.passes.includes("bloom") && (
                <div className={styles.parameterRow}>
                  <div className={styles.labelColumn}>
                    <label className={styles.parameterLabel}>Bloom Strength</label>
                  </div>
                  <div className={styles.controlColumn}>
                    <ParameterInput
                      value={preferences.postProcessing.bloomStrength}
                      metadata={{
                        type: "number",
                        min: 0.001,
                        max: 2.0,
                        step: 0.001,
                        default: 0.5,
                        displayName: "Bloom Strength",
                      }}
                      onChange={(value) =>
                        onChange({
                          postProcessing: {
                            ...preferences.postProcessing,
                            bloomStrength: value as number,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <div className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>SSAO</label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={preferences.postProcessing.passes.includes("ssao")}
                    metadata={{
                      type: "boolean",
                      default: false,
                      displayName: "Screen Space Ambient Occlusion",
                    }}
                    onChange={(value) => {
                      const currentPasses = preferences.postProcessing.passes;
                      const newPasses = value
                        ? [...currentPasses.filter((p) => p !== "ssao"), "ssao"]
                        : currentPasses.filter((p) => p !== "ssao");
                      onChange({
                        postProcessing: {
                          ...preferences.postProcessing,
                          passes: newPasses,
                        },
                      });
                    }}
                  />
                </div>
              </div>

              {preferences.postProcessing.passes.includes("ssao") && (
                <>
                  <div className={styles.parameterRow}>
                    <div className={styles.labelColumn}>
                      <label className={styles.parameterLabel}>Kernel Radius</label>
                    </div>
                    <div className={styles.controlColumn}>
                      <ParameterInput
                        value={preferences.postProcessing.ssaoKernelRadius}
                        metadata={{
                          type: "number",
                          min: 1,
                          max: 32,
                          step: 1,
                          default: 16,
                          displayName: "SSAO Kernel Radius",
                        }}
                        onChange={(value) =>
                          onChange({
                            postProcessing: {
                              ...preferences.postProcessing,
                              ssaoKernelRadius: value as number,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.parameterRow}>
                    <div className={styles.labelColumn}>
                      <label className={styles.parameterLabel}>Min Distance</label>
                    </div>
                    <div className={styles.controlColumn}>
                      <ParameterInput
                        value={preferences.postProcessing.ssaoMinDistance}
                        metadata={{
                          type: "number",
                          min: 0.001,
                          max: 0.02,
                          step: 0.001,
                          default: 0.005,
                          displayName: "SSAO Min Distance",
                        }}
                        onChange={(value) =>
                          onChange({
                            postProcessing: {
                              ...preferences.postProcessing,
                              ssaoMinDistance: value as number,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.parameterRow}>
                    <div className={styles.labelColumn}>
                      <label className={styles.parameterLabel}>Max Distance</label>
                    </div>
                    <div className={styles.controlColumn}>
                      <ParameterInput
                        value={preferences.postProcessing.ssaoMaxDistance}
                        metadata={{
                          type: "number",
                          min: 0.05,
                          max: 0.5,
                          step: 0.01,
                          default: 0.1,
                          displayName: "SSAO Max Distance",
                        }}
                        onChange={(value) =>
                          onChange({
                            postProcessing: {
                              ...preferences.postProcessing,
                              ssaoMaxDistance: value as number,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className={styles.parameterRow}>
                    <div className={styles.labelColumn}>
                      <label className={styles.parameterLabel}>Intensity</label>
                    </div>
                    <div className={styles.controlColumn}>
                      <ParameterInput
                        value={preferences.postProcessing.ssaoIntensity}
                        metadata={{
                          type: "number",
                          min: 0.1,
                          max: 2.0,
                          step: 0.1,
                          default: 1.0,
                          displayName: "SSAO Intensity",
                        }}
                        onChange={(value) =>
                          onChange({
                            postProcessing: {
                              ...preferences.postProcessing,
                              ssaoIntensity: value as number,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Background</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Type</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.background.type}
                metadata={{
                  type: "enum",
                  enumValues: ["single", "gradient"],
                  default: "single",
                  displayName: "Background Type",
                }}
                onChange={(value) =>
                  onChange({
                    background: {
                      ...preferences.background,
                      type: value as any,
                    },
                  })
                }
              />
            </div>
          </div>

          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Color</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.background.color}
                metadata={{
                  type: "color",
                  default: "#191919",
                  displayName: "Background Color",
                }}
                onChange={(value) =>
                  onChange({
                    background: {
                      ...preferences.background,
                      color: value as string,
                    },
                  })
                }
              />
            </div>
          </div>

          {preferences.background.type === "gradient" && (
            <div className={styles.parameterRow}>
              <div className={styles.labelColumn}>
                <label className={styles.parameterLabel}>Color 2</label>
              </div>
              <div className={styles.controlColumn}>
                <ParameterInput
                  value={preferences.background.color2 || "#333333"}
                  metadata={{
                    type: "color",
                    default: "#333333",
                    displayName: "Second Gradient Color",
                  }}
                  onChange={(value) =>
                    onChange({
                      background: {
                        ...preferences.background,
                        color2: value as string,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
