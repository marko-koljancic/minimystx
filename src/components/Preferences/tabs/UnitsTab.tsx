import { ParameterInput } from "../../inputs/ParameterInput";
import { PreferencesState } from "../../../store/preferencesStore";
import styles from "./PreferencesTab.module.css";

interface UnitsTabProps {
  preferences: PreferencesState["units"];
  onChange: (updates: Partial<PreferencesState["units"]>) => void;
}

export function UnitsTab({ preferences, onChange }: UnitsTabProps) {
  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabDescription}>
        Configure display units for measurements and dimensions throughout the application.
      </div>

      <div className={styles.section}>
        <div className={styles.parameterGrid}>
          <div className={styles.parameterRow}>
            <div className={styles.labelColumn}>
              <label className={styles.parameterLabel}>Display Unit</label>
            </div>
            <div className={styles.controlColumn}>
              <ParameterInput
                value={preferences.displayUnit}
                metadata={{
                  type: "enum",
                  enumValues: ["mm", "cm", "m", "in", "ft", "ft-in"],
                  default: "m",
                  displayName: "Display Unit",
                }}
                onChange={(value) =>
                  onChange({ displayUnit: value as PreferencesState["units"]["displayUnit"] })
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.infoBox}>
          <h4 className={styles.infoTitle}>Unit Conversion Examples</h4>
          <p className={styles.infoText}>
            When display unit is <strong>{preferences.displayUnit}</strong>:
          </p>
          <ul className={styles.infoList}>
            <li>Grid spacing will be shown in {preferences.displayUnit}</li>
            <li>Object dimensions will display in {preferences.displayUnit}</li>
            <li>Input fields will accept values in {preferences.displayUnit}</li>
            <li>Tooltips will show measurements in {preferences.displayUnit}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
