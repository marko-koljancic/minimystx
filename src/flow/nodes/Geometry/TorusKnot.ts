import { BufferGeometry, Object3D, TorusKnotGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { createGeneralParams, createRenderingParams } from "../../../engine/nodeParameterFactories";
import { BaseContainer } from "../../../engine/containers/BaseContainer";

export interface TorusKnotNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radius: number;
    tube: number;
    p: number;
    q: number;
    tubularSegments: number;
    radialSegments: number;
  };
}

function createTorusKnotGeometry(data: TorusKnotNodeData): BufferGeometry {
  let { radius, tube, p, q, tubularSegments, radialSegments } = data.geometry;
  if (radius <= 0) radius = 0.1;
  if (tube <= 0) tube = 0.1;

  p = Math.round(Math.max(1, Math.min(10, p)));
  q = Math.round(Math.max(1, Math.min(10, q)));

  const clampedTubularSegments = Math.max(3, Math.min(2048, Math.round(tubularSegments)));
  const clampedRadialSegments = Math.max(3, Math.min(2048, Math.round(radialSegments)));

  return new TorusKnotGeometry(radius, tube, clampedTubularSegments, clampedRadialSegments, p, q);
}

export const processor: NodeProcessor<
  TorusKnotNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: TorusKnotNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createTorusKnotGeometry(data);
  return createGeometryMesh(data, geometry, input?.object);
};

export const torusKnotNodeParams: NodeParams = {
  general: createGeneralParams("TorusKnot", "Creates a 3D torus knot geometry"),
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
    p: createParameterMetadata("number", 2, { displayName: "P Value", min: 1, max: 10, step: 1 }),
    q: createParameterMetadata("number", 3, { displayName: "Q Value", min: 1, max: 10, step: 1 }),
    tubularSegments: createParameterMetadata("number", 64, {
      displayName: "Tubular Segments",
      min: 3,
      max: 2048,
      step: 1,
    }),
    radialSegments: createParameterMetadata("number", 8, {
      displayName: "Radial Segments",
      min: 3,
      max: 2048,
      step: 1,
    }),
  },
  rendering: createRenderingParams(),
};

export const torusKnotNodeCompute = (params: Record<string, any>) => {
  const data: TorusKnotNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as TorusKnotNodeData;
  const inputObject = undefined;
  return processor(data, inputObject);
};

export const torusKnotNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
  const data: TorusKnotNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as TorusKnotNodeData;

  const geometry = createTorusKnotGeometry(data);
  const container = createGeometryMesh(data, geometry);
  
  return { default: container };
};
