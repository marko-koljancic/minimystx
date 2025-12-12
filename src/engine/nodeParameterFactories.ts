import { createParameterMetadata } from "./parameterUtils";
import type { CategoryParams } from "./graphStore";
export function createGeneralParams(defaultName: string, defaultDescription: string): CategoryParams {
  return {
    name: createParameterMetadata("string", defaultName, {
      displayName: "Name",
      displayMode: "name",
    }),
    description: createParameterMetadata("string", defaultDescription, {
      displayName: "Description",
      displayMode: "description",
    }),
  };
}
export function createTransformParams(): CategoryParams {
  return {
    position: createParameterMetadata(
      "vector3",
      { x: 0, y: 0, z: 0 },
      {
        displayName: "Position",
      }
    ),
    rotation: createParameterMetadata(
      "vector3",
      { x: 0, y: 0, z: 0 },
      {
        displayName: "Rotation",
      }
    ),
    scale: createParameterMetadata(
      "vector3",
      { x: 1, y: 1, z: 1 },
      {
        displayName: "Scale",
        min: 0.01,
        max: 100,
        step: 0.1,
      }
    ),
    scaleFactor: createParameterMetadata("number", 1, {
      displayName: "Scale Factor",
      min: 0.01,
      max: 100,
      step: 0.1,
    }),
  };
}
export function createRenderingParams(): CategoryParams {
  return {
    visible: createParameterMetadata("boolean", true, {
      displayName: "Visible",
    }),
    castShadow: createParameterMetadata("boolean", true, {
      displayName: "Cast Shadow",
    }),
    receiveShadow: createParameterMetadata("boolean", true, {
      displayName: "Receive Shadow",
    }),
  };
}
export function createLightTransformParams(
  defaultPosition: { x: number; y: number; z: number } = { x: 0, y: 5, z: 0 }
): CategoryParams {
  return {
    position: createParameterMetadata("vector3", defaultPosition, {
      displayName: "Position",
    }),
  };
}
export function createLightRenderingParams(): CategoryParams {
  return {
    enabled: createParameterMetadata("boolean", true, {
      displayName: "Enabled",
    }),
    showHelper: createParameterMetadata("boolean", false, {
      displayName: "Show Helper",
    }),
  };
}
export function createSubflowRenderingParams(): CategoryParams {
  return {
    visible: createParameterMetadata("boolean", false, {
      displayName: "Render Out",
    }),
  };
}
