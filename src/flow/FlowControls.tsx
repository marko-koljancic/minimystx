import { Controls, MiniMap } from "@xyflow/react";
import styles from "./FlowControls.module.css";
import { useUIStore } from "../store";
export function FlowControls() {
  const { showMinimap, showFlowControls } = useUIStore();
  return (
    <>
      {showMinimap && (
        <MiniMap zoomable pannable bgColor="transparent" className={styles.miniMap} />
      )}
      {showFlowControls && <Controls />}
    </>
  );
}
