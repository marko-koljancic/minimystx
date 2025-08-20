import { NodeParams } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createTransformParams,
  createRenderingParams,
} from "../../../engine/nodeParameterFactories";

export interface GeoNodeData extends Record<string, unknown> {
  general: {
    name: string;
    description: string;
  };
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    scaleFactor: number;
  };
  rendering: {
    visible: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
  };
}

export const geoNodeParams: NodeParams = {
  general: createGeneralParams("Geo1", "Container for sub-flow geometry"),
  transform: createTransformParams(),
  rendering: createRenderingParams(),
};

export const geoNodeCompute = (params: Record<string, any>) => {
  // Convert params to structured data
  const data: GeoNodeData = {
    general: params.general,
    transform: {
      position: params.transform.position,
      rotation: params.transform.rotation,
      scale: params.transform.scale,
      scaleFactor: params.transform.scaleFactor,
    },
    rendering: params.rendering,
  };
  return { object: null, data };
};
