import { BufferGeometry, PlaneGeometry } from "three";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
import { BaseContainer } from "../../../engine/containers/BaseContainer";
export interface PlaneNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    width: number;
    height: number;
    widthSegments: number;
    heightSegments: number;
  };
}
function createPlaneGeometry(data: PlaneNodeData): BufferGeometry {
  let { width, height } = data.geometry;
  const { widthSegments, heightSegments } = data.geometry;
  if (width <= 0) width = 0.1;
  if (height <= 0) height = 0.1;
  const clampedWidthSegments = Math.max(1, Math.min(1024, Math.round(widthSegments)));
  const clampedHeightSegments = Math.max(1, Math.min(1024, Math.round(heightSegments)));
  return new PlaneGeometry(width, height, clampedWidthSegments, clampedHeightSegments);
}
export const planeNodeParams: NodeParams = {
  general: createGeneralParams("Plane", "Creates a plane geometry"),
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
    widthSegments: createParameterMetadata("number", 1, {
      displayName: "Width Segments",
      min: 1,
      max: 1024,
      step: 1,
    }),
    heightSegments: createParameterMetadata("number", 1, {
      displayName: "Height Segments",
      min: 1,
      max: 1024,
      step: 1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};
export const planeNodeComputeTyped = (params: Record<string, any>): Record<string, BaseContainer> => {
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
  const geometry = createPlaneGeometry(data);
  const container = createGeometryMesh(data, geometry);
  return { default: container };
};
