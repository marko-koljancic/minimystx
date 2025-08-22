import { BufferGeometry, Object3D, CylinderGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createSubflowRenderingParams,
} from "../../../engine/nodeParameterFactories";

export interface CylinderNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radiusTop: number;
    radiusBottom: number;
    height: number;
  };
}

function createCylinderGeometry(data: CylinderNodeData): BufferGeometry {
  let { radiusTop, radiusBottom, height } = data.geometry;

  if (radiusTop <= 0) radiusTop = 0.1;
  if (radiusBottom <= 0) radiusBottom = 0.1;
  if (height <= 0) height = 0.1;

  const radialSegments = 32;
  const heightSegments = 1;

  return new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments);
}

export const processor: NodeProcessor<
  CylinderNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: CylinderNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createCylinderGeometry(data);
  return createGeometryMesh(data, geometry, input?.object);
};

export const cylinderNodeParams: NodeParams = {
  general: createGeneralParams("Cylinder 1", "Creates a 3D cylinder geometry"),
  geometry: {
    radiusTop: createParameterMetadata("number", 0.5, {
      displayName: "Top Radius",
      min: 0.01,
      max: 50,
      step: 0.1,
    }),
    radiusBottom: createParameterMetadata("number", 0.5, {
      displayName: "Bottom Radius",
      min: 0.01,
      max: 50,
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

export const cylinderNodeCompute = (params: Record<string, any>) => {
  const data: CylinderNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as CylinderNodeData;
  const inputObject = undefined;
  return processor(data, inputObject);
};
