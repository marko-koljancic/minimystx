import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/uiStore";
import styles from "./PreferencesTab.module.css";

interface DebugTabProps {
  preferences: PreferencesState["debug"];
  onChange: (updates: Partial<PreferencesState["debug"]>) => void;
}

export function DebugTab({ preferences, onChange }: DebugTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabDescription}>
        Developer tools and debugging options for troubleshooting and performance analysis.
      </div>
      
      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Renderer Debug Info</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Info Panel</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.rendererInfo}
                metadata={{
                  type: "boolean",
                  default: false,
                  displayName: "Show Renderer Info Panel",
                }}
                onChange={(value) => onChange({ rendererInfo: value as boolean })}
              />
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            The renderer info panel displays GPU information, draw calls, geometries, 
            textures, and memory usage statistics.
          </p>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Logging</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Log Level</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.logLevel}
                metadata={{
                  type: "enum",
                  enumValues: ["errors", "warnings", "verbose"],
                  default: "warnings",
                  displayName: "Console Log Level",
                }}
                onChange={(value) => onChange({ logLevel: value as any })}
              />
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            <strong>Log Levels:</strong>
          </p>
          <ul className={styles.infoList}>
            <li><strong>Errors:</strong> Show only critical errors</li>
            <li><strong>Warnings:</strong> Show errors and warnings (recommended)</li>
            <li><strong>Verbose:</strong> Show all debug information</li>
          </ul>
        </div>
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Visual Debug</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Show Normals</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.showNormals}
                metadata={{
                  type: "boolean",
                  default: false,
                  displayName: "Show Vertex Normals",
                }}
                onChange={(value) => onChange({ showNormals: value as boolean })}
              />
            </div>
          </div>
        </div>

        {preferences.showNormals && (
          <div className={styles.infoBox}>
            <p className={styles.infoText}>
              <span className={styles.badge} style={{ backgroundColor: "var(--warning-subtle)", color: "var(--warning-primary)" }}>
                PERFORMANCE
              </span>
              {" "}Showing normals creates additional geometry and may impact performance on complex models.
            </p>
          </div>
        )}
      </div>

      <div className={styles.controlGroup}>
        <h4 className={styles.controlGroupTitle}>Units & Measurements</h4>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Internal Meters</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.revealInternalMeters}
                metadata={{
                  type: "boolean",
                  default: true,
                  displayName: "Show Internal Meter Values",
                }}
                onChange={(value) => onChange({ revealInternalMeters: value as boolean })}
              />
            </div>
          </div>
        </div>

        <div className={styles.infoBox}>
          <p className={styles.infoText}>
            When enabled, tooltips and debug info will show both display unit values 
            and internal meter values used by the engine.
          </p>
        </div>
      </div>

      <div className={styles.infoBox}>
        <p className={styles.infoText}>
          <span className={styles.badge} style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent-primary)" }}>
            DEV
          </span>
          {" "}Debug options are intended for development and troubleshooting. 
          Some options may impact performance or visual quality.
        </p>
      </div>
    </div>
  );
}