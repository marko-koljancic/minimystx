import { Position } from "@xyflow/react";
export type PositionType = Position | "top" | "bottom" | "left" | "right";
export interface RelativePositionOptions {
  offset?: number;
  position: PositionType;
}
export function getRelativePositionStyles(
  position: PositionType,
  offset: number = 8
): React.CSSProperties {
  const normalizedPosition = normalizePosition(position);
  switch (normalizedPosition) {
    case "top":
      return {
        bottom: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginBottom: `${offset}px`,
      };
    case "bottom":
      return {
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginTop: `${offset}px`,
      };
    case "left":
      return {
        right: "100%",
        top: "50%",
        transform: "translateY(-50%)",
        marginRight: `${offset}px`,
      };
    case "right":
      return {
        left: "100%",
        top: "50%",
        transform: "translateY(-50%)",
        marginLeft: `${offset}px`,
      };
    default:
      return {
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginTop: `${offset}px`,
      };
  }
}
export function getAbsolutePositionStyles(
  x: number,
  y: number,
  position: PositionType,
  offset: number = 10
): React.CSSProperties {
  const normalizedPosition = normalizePosition(position);
  const baseStyles: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
  };
  switch (normalizedPosition) {
    case "top":
      return {
        ...baseStyles,
        left: x,
        top: y - offset,
        transform: "translate(-50%, -100%)",
      };
    case "bottom":
      return {
        ...baseStyles,
        left: x,
        top: y + offset,
        transform: "translate(-50%, 0)",
      };
    case "left":
      return {
        ...baseStyles,
        left: x - offset,
        top: y,
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        ...baseStyles,
        left: x + offset,
        top: y,
        transform: "translate(0, -50%)",
      };
    default:
      return {
        ...baseStyles,
        left: x,
        top: y + offset,
        transform: "translate(-50%, 0)",
      };
  }
}
function normalizePosition(position: PositionType): "top" | "bottom" | "left" | "right" {
  if (typeof position === "string") {
    return position as "top" | "bottom" | "left" | "right";
  }
  switch (position) {
    case Position.Top:
      return "top";
    case Position.Bottom:
      return "bottom";
    case Position.Left:
      return "left";
    case Position.Right:
      return "right";
    default:
      return "bottom";
  }
}
export function getArrowStyles(
  position: PositionType,
  arrowSize: number = 6,
  color: string = "#1f2937"
): React.CSSProperties {
  const normalizedPosition = normalizePosition(position);
  const baseArrowStyle: React.CSSProperties = {
    position: "absolute",
    width: 0,
    height: 0,
    borderStyle: "solid",
  };
  switch (normalizedPosition) {
    case "top":
      return {
        ...baseArrowStyle,
        left: "50%",
        bottom: -arrowSize,
        transform: "translateX(-50%)",
        borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
        borderColor: `${color} transparent transparent transparent`,
      };
    case "bottom":
      return {
        ...baseArrowStyle,
        left: "50%",
        top: -arrowSize,
        transform: "translateX(-50%)",
        borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
        borderColor: `transparent transparent ${color} transparent`,
      };
    case "left":
      return {
        ...baseArrowStyle,
        right: -arrowSize,
        top: "50%",
        transform: "translateY(-50%)",
        borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
        borderColor: `transparent transparent transparent ${color}`,
      };
    case "right":
      return {
        ...baseArrowStyle,
        left: -arrowSize,
        top: "50%",
        transform: "translateY(-50%)",
        borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
        borderColor: `transparent ${color} transparent transparent`,
      };
    default:
      return baseArrowStyle;
  }
}
