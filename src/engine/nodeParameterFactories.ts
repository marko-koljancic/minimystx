/**
 * Reusable parameter factory functions to eliminate boilerplate across node definitions
 * These factories provide consistent parameter structures across all node types
 */

import { createParameterMetadata } from "./parameterUtils";
import type { CategoryParams } from "./graphStore";

/**
 * Creates standard general parameters used by all nodes
 * @param defaultName - Default name for the node (e.g., "Box 1", "Sphere 1")
 * @param defaultDescription - Default description for the node
 */
export function createGeneralParams(
  defaultName: string,
  defaultDescription: string
): CategoryParams {
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

/**
 * Creates standard transform parameters used by most nodes
 * Includes position, rotation, scale, and scale factor
 */
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

/**
 * Creates standard rendering parameters used by geometry nodes
 * Includes color, visibility, and shadow settings
 */
export function createRenderingParams(): CategoryParams {
  return {
    color: createParameterMetadata("color", "#ffffff", {
      displayName: "Color",
    }),
    visible: createParameterMetadata("boolean", true, {
      displayName: "Visible",
    }),
    castShadow: createParameterMetadata("boolean", false, {
      displayName: "Cast Shadow",
    }),
    receiveShadow: createParameterMetadata("boolean", false, {
      displayName: "Receive Shadow",
    }),
  };
}

/**
 * Creates transform parameters for light nodes (position only)
 * Light nodes typically only need position, not full transform
 */
export function createLightTransformParams(
  defaultPosition: { x: number; y: number; z: number } = { x: 0, y: 5, z: 0 }
): CategoryParams {
  return {
    position: createParameterMetadata("vector3", defaultPosition, {
      displayName: "Position",
    }),
  };
}

/**
 * Creates basic rendering parameters for light nodes
 * Includes enabled state and helper visibility
 */
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

/**
 * Creates minimal rendering parameters for sub-flow geometry nodes
 * Only includes visibility flag for render out selection
 */
export function createSubflowRenderingParams(): CategoryParams {
  return {
    visible: createParameterMetadata("boolean", false, {
      displayName: "Render Out",
    }),
  };
}
