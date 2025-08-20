import { BufferGeometry, Object3D, TorusGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createSubflowRenderingParams,
} from "../../../engine/nodeParameterFactories";

export interface TorusNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radius: number;
    tube: number;
  };
}

function createTorusGeometry(data: TorusNodeData): BufferGeometry {
  let { radius, tube } = data.geometry;
  if (radius <= 0) radius = 0.1;
  if (tube <= 0) tube = 0.1;

  const radialSegments = Math.max(3, 16);
  const tubularSegments = Math.max(3, 100);

  return new TorusGeometry(radius, tube, radialSegments, tubularSegments);
}

export const processor: NodeProcessor<
  TorusNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: TorusNodeData, input?: Object3D) => {
  const geometry = createTorusGeometry(data);
  return createGeometryMesh(data, geometry, input);
};

export const torusNodeParams: NodeParams = {
  general: createGeneralParams("Torus 1", "Creates a 3D torus geometry"),
  geometry: {
    radius: createParameterMetadata("number", 0.5, {
      displayName: "Radius",
      min: 0.01,
      max: 100,
      step: 0.1,
    }),
    tube: createParameterMetadata("number", 0.2, {
      displayName: "Tube",
      min: 0.01,
      max: 100,
      step: 0.1,
    }),
  },
  rendering: createSubflowRenderingParams(),
};

export const torusNodeCompute = (params: Record<string, any>) => {
  const data: TorusNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as TorusNodeData;
  const inputObject = undefined;
  return processor(data, inputObject);
};
