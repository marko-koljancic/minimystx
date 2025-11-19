export interface HandleTypeInfo {
  label: string;
  description: string;
}
export interface HandleTypeDefinition {
  input: HandleTypeInfo;
  output: HandleTypeInfo;
}
export const handleTypes: Record<string, HandleTypeDefinition> = {
  geometry: {
    input: {
      label: "Input",
      description: "3D geometry object",
    },
    output: {
      label: "Output",
      description: "Generated 3D geometry",
    },
  },
  light: {
    input: {
      label: "Input",
      description: "Light configuration",
    },
    output: {
      label: "Output",
      description: "Scene lighting",
    },
  },
  transform: {
    input: {
      label: "Input",
      description: "Object to transform",
    },
    output: {
      label: "Output",
      description: "Transformed object",
    },
  },
  import: {
    input: {
      label: "Input",
      description: "File path or data",
    },
    output: {
      label: "Output",
      description: "Imported geometry",
    },
  },
};
export const getHandleTypeInfo = (handleId: string, handleType: "source" | "target"): HandleTypeInfo => {
  const baseType = handleId.split("_")[0];
  const typeDefinition = handleTypes[baseType];
  if (!typeDefinition) {
    return {
      label: handleType === "source" ? "Output" : "Input",
      description: handleType === "source" ? "Node output" : "Node input",
    };
  }
  return handleType === "source" ? typeDefinition.output : typeDefinition.input;
};
