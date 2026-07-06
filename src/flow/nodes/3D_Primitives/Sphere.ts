import { BufferGeometry, SphereGeometry } from "three";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
import { BaseContainer } from "../../../engine/containers/BaseContainer";
export interface SphereNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radius: number;
    widthSegments: number;
    heightSegments: number;
  };
}
function createSphereGeometry(data: SphereNodeData): BufferGeometry {
  const { radius, widthSegments, heightSegments } = data.geometry;
  const clampedWidthSegments = Math.max(3, Math.min(512, Math.round(widthSegments)));
  const clampedHeightSegments = Math.max(2, Math.min(512, Math.round(heightSegments)));
  return new SphereGeometry(radius, clampedWidthSegments, clampedHeightSegments);
}
export const sphereNodeParams: NodeParams = {
  general: createGeneralParams("Sphere", "Creates a 3D sphere geometry"),
  geometry: {
    radius: createParameterMetadata("number", 0.5, {
      displayName: "Radius",
      min: 0.01,
      max: 50,
      step: 0.1,
    }),
    widthSegments: createParameterMetadata("number", 32, {
      displayName: "Width Segments",
      min: 3,
      max: 512,
      step: 1,
    }),
    heightSegments: createParameterMetadata("number", 16, {
      displayName: "Height Segments",
      min: 2,
      max: 512,
      step: 1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};
export const sphereNodeComputeTyped = (params: Record<string, any>): Record<string, BaseContainer> => {
  const data: SphereNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as SphereNodeData;
  const geometry = createSphereGeometry(data);
  const container = createGeometryMesh(data, geometry);
  return { default: container };
};
