import { Background, BackgroundVariant } from "@xyflow/react";
import styles from "./FlowBackground.module.css";
import { useUIStore } from "../store";

export function FlowBackground() {
  const { showGridInFlowCanvas } = useUIStore();
  if (!showGridInFlowCanvas) return null;

  return (
    <div className={styles.background}>
      <Background
        variant={BackgroundVariant.Lines}
        gap={10}
        color={`var(--grid-line-color-small)`}
        bgColor="transparent"
        lineWidth={1}
        id="1"
      />
      <Background
        variant={BackgroundVariant.Lines}
        gap={100}
        color={`var(--grid-line-color-large)`}
        bgColor="transparent"
        lineWidth={0.5}
        id="2"
      />
    </div>
  );
}
