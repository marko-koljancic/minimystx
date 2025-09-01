import { BufferGeometry, Object3D, TorusGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { createGeneralParams, createRenderingParams } from "../../../engine/nodeParameterFactories";
import { BaseContainer } from "../../../engine/containers/BaseContainer";

export interface TorusNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radius: number;
    tube: number;
    radialSegments: number;
    tubularSegments: number;
  };
}

function createTorusGeometry(data: TorusNodeData): BufferGeometry {
  let { radius, tube, radialSegments, tubularSegments } = data.geometry;
  if (radius <= 0) radius = 0.1;
  if (tube <= 0) tube = 0.1;

  const clampedRadialSegments = Math.max(3, Math.min(1024, Math.round(radialSegments)));
  const clampedTubularSegments = Math.max(3, Math.min(1024, Math.round(tubularSegments)));

  return new TorusGeometry(radius, tube, clampedRadialSegments, clampedTubularSegments);
}

export const processor: NodeProcessor<
  TorusNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: TorusNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createTorusGeometry(data);
  return createGeometryMesh(data, geometry, input?.object);
};

export const torusNodeParams: NodeParams = {
  general: createGeneralParams("Torus", "Creates a 3D torus geometry"),
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
    radialSegments: createParameterMetadata("number", 8, {
      displayName: "Radial Segments",
      min: 3,
      max: 1024,
      step: 1,
    }),
    tubularSegments: createParameterMetadata("number", 6, {
      displayName: "Tubular Segments",
      min: 3,
      max: 1024,
      step: 1,
    }),
  },
  rendering: createRenderingParams(),
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

export const torusNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
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

  const geometry = createTorusGeometry(data);
  const container = createGeometryMesh(data, geometry);
  
  return { default: container };
};
