import React from "react";
import {
  getSmoothStepPath,
  getStraightPath,
  getBezierPath,
  getSimpleBezierPath,
  Position,
} from "@xyflow/react";
import { useUIStore } from "../../store";

interface BaseConnectionProps {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  children: (pathData: string) => React.ReactNode;
}

enum CONNECTION_LINE_STYLE {
  Bezier = "Bezier",
  SmoothStep = "SmoothStep",
  Straight = "Straight",
  SimpleBezier = "SimpleBezier",
}

export function BaseConnection({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  children,
}: BaseConnectionProps) {
  const { connectionLineStyle } = useUIStore();
  let d: string;

  const getConnectionStyle = (style: string) => {
    switch (style) {
      case "bezier":
        return CONNECTION_LINE_STYLE.Bezier;
      case "straight":
        return CONNECTION_LINE_STYLE.Straight;
      case "simpleBezier":
        return CONNECTION_LINE_STYLE.SimpleBezier;
      case "step":
        return CONNECTION_LINE_STYLE.SmoothStep;
      default:
        return CONNECTION_LINE_STYLE.SmoothStep;
    }
  };

  const currentStyle = getConnectionStyle(connectionLineStyle);

  switch (currentStyle) {
    case CONNECTION_LINE_STYLE.Bezier:
      [d] = getBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      });
      break;
    case CONNECTION_LINE_STYLE.Straight:
      [d] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
      });
      break;
    case CONNECTION_LINE_STYLE.SimpleBezier:
      [d] = getSimpleBezierPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
      });
      break;
    case CONNECTION_LINE_STYLE.SmoothStep:
    default:
      [d] = getSmoothStepPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        borderRadius: 10,
      });
      break;
  }

  return <>{children(d)}</>;
}
