import { BufferGeometry, Object3D, ConeGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { createGeneralParams, createRenderingParams } from "../../../engine/nodeParameterFactories";
import { BaseContainer } from "../../../engine/containers/BaseContainer";
export interface ConeNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radius: number;
    height: number;
    radialSegments: number;
    heightSegments: number;
  };
}
function createConeGeometry(data: ConeNodeData): BufferGeometry {
  let { radius, height, radialSegments, heightSegments } = data.geometry;
  if (radius <= 0) radius = 0.1;
  if (height <= 0) height = 0.1;
  const clampedRadialSegments = Math.max(3, Math.min(512, Math.round(radialSegments)));
  const clampedHeightSegments = Math.max(1, Math.min(512, Math.round(heightSegments)));
  return new ConeGeometry(radius, height, clampedRadialSegments, clampedHeightSegments);
}
export const processor: NodeProcessor<
  ConeNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: ConeNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createConeGeometry(data);
  return createGeometryMesh(data, geometry, input?.object);
};
export const coneNodeParams: NodeParams = {
  general: createGeneralParams("Cone", "Creates a 3D cone geometry"),
  geometry: {
    radius: createParameterMetadata("number", 0.5, {
      displayName: "Radius",
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
    radialSegments: createParameterMetadata("number", 32, {
      displayName: "Radial Segments",
      min: 3,
      max: 512,
      step: 1,
    }),
    heightSegments: createParameterMetadata("number", 1, {
      displayName: "Height Segments",
      min: 1,
      max: 512,
      step: 1,
    }),
  },
  rendering: createRenderingParams(),
};
export const coneNodeDefaults = {
  general: {
    name: "Cone Node",
    description: "Creates a 3D cone geometry",
  },
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, factor: 1 },
  },
  geometry: {
    radius: 0.5,
    height: 1,
  },
  rendering: {
    material: null,
    visible: true,
  },
};
export const coneNodeCompute = (params: Record<string, any>) => {
  const data: ConeNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as ConeNodeData;
  const inputObject = undefined;
  return processor(data, inputObject);
};
export const coneNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
  const data: ConeNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as ConeNodeData;
  const geometry = createConeGeometry(data);
  const container = createGeometryMesh(data, geometry);
  return { default: container };
};
