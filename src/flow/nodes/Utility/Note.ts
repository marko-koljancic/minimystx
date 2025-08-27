import type { GeneralProps, NodeProcessor } from "../props";
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

export const processor: NodeProcessor<NoteNodeData, void> = (
  _data: NoteNodeData
): void => {
  return undefined;
};

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

export const noteNodeCompute = (params: Record<string, unknown>) => {
  const generalParams = params.general as Record<string, unknown> || {};
  const noteParams = params.note as Record<string, unknown> || {};
  
  const data: NoteNodeData = {
    general: {
      name: (generalParams.name as string) || "Note",
      description: (generalParams.description as string) || undefined,
    },
    note: {
      text: (noteParams.text as string) || "",
      color: (noteParams.color as string) || NOTE_COLORS[0],
      width: (noteParams.width as number) || 160,
      height: (noteParams.height as number) || 80,
    },
  };
  
  return processor(data);
};