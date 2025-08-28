import { FaProjectDiagram, FaList } from "react-icons/fa";
import { useCurrentContext, useSetFlowViewMode, useGetFlowViewMode, getContextKey } from "../store";
import styles from "./FlowViewToggle.module.css";

const FlowViewToggle = () => {
  const currentContext = useCurrentContext();
  const setFlowViewMode = useSetFlowViewMode();
  const getFlowViewMode = useGetFlowViewMode();

  const contextKey = getContextKey(currentContext);
  const currentViewMode = getFlowViewMode(contextKey);

  const handleToggle = () => {
    const newMode = currentViewMode === "graph" ? "list" : "graph";
    setFlowViewMode(contextKey, newMode);
  };

  const isGraphView = currentViewMode === "graph";
  const title = isGraphView ? "Switch to List view" : "Switch to Graph view";

  return (
    <button className={styles.viewToggleButton} onClick={handleToggle} title={title}>
      {isGraphView ? <FaList size={14} /> : <FaProjectDiagram size={14} />}
    </button>
  );
};

export default FlowViewToggle;
