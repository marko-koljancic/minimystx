import { BaseEdge, EdgeProps } from "@xyflow/react";
import { BaseConnection } from "./BaseConnection";

export default function EdgeLine({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  return (
    <BaseConnection
      sourceX={sourceX}
      sourceY={sourceY}
      targetX={targetX}
      targetY={targetY}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
    >
      {(pathData) => (
        <BaseEdge
          path={pathData}
          style={{ stroke: "var(--edge-color)", strokeWidth: 2 }}
          markerEnd={markerEnd}
        />
      )}
    </BaseConnection>
  );
}
