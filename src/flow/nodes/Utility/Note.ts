import type { GeneralProps } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams } from "../../../engine/graphStore";
export interface NoteNodeData extends Record<string, unknown> {
  general: GeneralProps;
  note: {
    text: string;
    color: string;
    width: number;
    height: number;
  };
}
export const NOTE_COLORS = [
  "#FDE68A",
  "#A7F3D0",
  "#BFDBFE",
  "#FBCFE8",
  "#FDE2E2",
  "#D1FAE5",
  "#EDE9FE",
  "#FFE4E6",
  "#E9D5FF",
];
export const noteNodeParams: NodeParams = {
  general: createGeneralParams("Note", "Visual annotation for documentation"),
  note: {
    text: createParameterMetadata("string", "", {
      displayName: "Text",
    }),
    color: createParameterMetadata("string", NOTE_COLORS[0], {
      displayName: "Color",
    }),
    width: createParameterMetadata("number", 160, {
      displayName: "Width",
      min: 120,
      max: 800,
    }),
    height: createParameterMetadata("number", 80, {
      displayName: "Height",
      min: 60,
      max: 600,
    }),
  },
};
