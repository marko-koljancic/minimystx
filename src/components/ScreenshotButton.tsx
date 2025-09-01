import { FaCamera } from "react-icons/fa";
import styles from "./ScreenshotButton.module.css";
interface ScreenshotButtonProps {
  onCapture: () => void;
}
const ScreenshotButton = ({ onCapture }: ScreenshotButtonProps) => {
  return (
    <button
      className={styles.screenshotButton}
      onClick={onCapture}
      title="Capture screenshot"
    >
      <FaCamera size={14} />
    </button>
  );
};
export default ScreenshotButton;