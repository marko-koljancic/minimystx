import { FaExpandArrowsAlt, FaCompress } from "react-icons/fa";
import { useIsRendererMaximized, useToggleRendererMaximized } from "../store";
import styles from "./MaximizeToggleButton.module.css";

const MaximizeToggleButton = () => {
  const isMaximized = useIsRendererMaximized();
  const toggleMaximized = useToggleRendererMaximized();

  return (
    <button
      className={styles.maximizeButton}
      onClick={toggleMaximized}
      title={isMaximized ? "Restore view" : "Maximize renderer"}
    >
      {isMaximized ? <FaCompress size={14} /> : <FaExpandArrowsAlt size={14} />}
    </button>
  );
};

export default MaximizeToggleButton;