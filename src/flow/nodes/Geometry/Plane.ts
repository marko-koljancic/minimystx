import { BufferGeometry, Object3D, PlaneGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createSubflowRenderingParams,
} from "../../../engine/nodeParameterFactories";

export interface PlaneNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    width: number;
    height: number;
  };
}

function createPlaneGeometry(data: PlaneNodeData): BufferGeometry {
  let { width, height } = data.geometry;
  if (width <= 0) width = 0.1;
  if (height <= 0) height = 0.1;

  const widthSegments = 1;
  const heightSegments = 1;

  return new PlaneGeometry(width, height, widthSegments, heightSegments);
}

export const processor: NodeProcessor<
  PlaneNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: PlaneNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createPlaneGeometry(data);
  return createGeometryMesh(data, geometry, input?.object);
};

export const planeNodeParams: NodeParams = {
  general: createGeneralParams("Plane 1", "Creates a plane geometry"),
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
  },
  rendering: createSubflowRenderingParams(),
};

export const planeNodeCompute = (params: Record<string, any>) => {
  const data: PlaneNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as PlaneNodeData;
  const inputObject = undefined;
  return processor(data, inputObject);
};
