import { BufferGeometry, Object3D, BoxGeometry } from "three";
import type { NodeProcessor } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import {
  createGeneralParams,
  createRenderingParams,
} from "../../../engine/nodeParameterFactories";

export interface BoxNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    width: number;
    height: number;
    depth: number;
  };
}

function createBoxGeometry(data: BoxNodeData): BufferGeometry {
  const { width, height, depth } = data.geometry;
  return new BoxGeometry(width, height, depth);
}

export const processor: NodeProcessor<
  BoxNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: BoxNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createBoxGeometry(data);
  const result = createGeometryMesh(data, geometry, input?.object);
  return result;
};

export const boxNodeParams: NodeParams = {
  general: createGeneralParams("Box 1", "Creates a 3D box geometry"),
  geometry: {
    width: createParameterMetadata("number", 1, {
      displayName: "Width",
      min: 0.01,
      max: 100,
      step: 0.1,
    }),
    height: createParameterMetadata("number", 1, {
      displayName: "Height",
      min: 0.01,
      max: 100,
      step: 0.1,
    }),
    depth: createParameterMetadata("number", 1, {
      displayName: "Depth",
      min: 0.01,
      max: 100,
      step: 0.1,
    }),
  },
  rendering: createRenderingParams(),
};

export const boxNodeCompute = (params: Record<string, any>) => {
  
  const data: BoxNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  };
  const inputObject = undefined;
  const result = processor(data, inputObject);
  return result;
};
