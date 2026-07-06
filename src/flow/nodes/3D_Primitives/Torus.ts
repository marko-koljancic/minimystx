import { BufferGeometry, TorusGeometry } from "three";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
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
  let { radius, tube } = data.geometry;
  const { radialSegments, tubularSegments } = data.geometry;
  if (radius <= 0) radius = 0.1;
  if (tube <= 0) tube = 0.1;
  const clampedRadialSegments = Math.max(3, Math.min(1024, Math.round(radialSegments)));
  const clampedTubularSegments = Math.max(3, Math.min(1024, Math.round(tubularSegments)));
  return new TorusGeometry(radius, tube, clampedRadialSegments, clampedTubularSegments);
}
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
    radialSegments: createParameterMetadata("number", 16, {
      displayName: "Radial Segments",
      min: 3,
      max: 1024,
      step: 1,
    }),
    tubularSegments: createParameterMetadata("number", 32, {
      displayName: "Tubular Segments",
      min: 3,
      max: 1024,
      step: 1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};
export const torusNodeComputeTyped = (params: Record<string, any>): Record<string, BaseContainer> => {
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
