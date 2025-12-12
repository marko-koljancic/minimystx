import { ConnectionLineComponentProps } from "@xyflow/react";
import { BaseConnection } from "./BaseConnection";
export default function ConnectionLine({ fromX, fromY, toX, toY, connectionStatus }: ConnectionLineComponentProps) {
  let color = "var(--connection-line-default)";
  if (connectionStatus === "valid") color = "var(--connection-line-valid)";
  if (connectionStatus === "invalid") color = "var(--connection-line-invalid)";
  return (
    <BaseConnection sourceX={fromX} sourceY={fromY} targetX={toX} targetY={toY}>
      {(pathData) => <path fill="none" stroke={color} strokeWidth={2} d={pathData} />}
    </BaseConnection>
  );
}
