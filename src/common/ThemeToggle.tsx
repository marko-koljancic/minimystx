import { useUIStore } from "../store";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { theme, setTheme } = useUIStore();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as "dark" | "light" | "system");
  };

  return (
    <div className={styles.toggleContainer}>
      <span className={styles.themeLabel}>Theme</span>
      <select
        className={styles.themeSelect}
        value={theme}
        onChange={handleThemeChange}
        title="Choose theme (Dark, Light, System)"
      >
        <option value="dark" className={styles.themeOption}>
          Dark
        </option>
        <option value="light" className={styles.themeOption}>
          Light
        </option>
        <option value="system" className={styles.themeOption}>
          System
        </option>
      </select>
    </div>
  );
}
