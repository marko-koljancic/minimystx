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

// Pastel color palette
export const NOTE_COLORS = [
  "#FDE68A", // yellow
  "#A7F3D0", // green
  "#BFDBFE", // blue
  "#FBCFE8", // pink
  "#FDE2E2", // red
  "#D1FAE5", // emerald
  "#EDE9FE", // purple
  "#FFE4E6", // rose
  "#E9D5FF", // violet
];

export const processor: NodeProcessor<NoteNodeData, void> = (
  _data: NoteNodeData
): void => {
  // Note nodes don't produce any output - they're purely visual annotations
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
    width: createParameterMetadata("number", 120, {
      displayName: "Width",
      min: 120,
      max: 800,
    }),
    height: createParameterMetadata("number", 60, {
      displayName: "Height", 
      min: 60,
      max: 600,
    }),
  },
};

export const noteNodeCompute = (params: Record<string, unknown>) => {
  // Convert params to structured data with proper fallbacks
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
      width: (noteParams.width as number) || 120,
      height: (noteParams.height as number) || 60,
    },
  };
  
  return processor(data);
};