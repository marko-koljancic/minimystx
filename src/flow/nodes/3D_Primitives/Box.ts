import { BufferGeometry, BoxGeometry } from "three";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
import { BaseContainer } from "../../../engine/containers/BaseContainer";
export interface BoxNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    width: number;
    height: number;
    depth: number;
    widthSegments: number;
    heightSegments: number;
    depthSegments: number;
  };
}
function createBoxGeometry(data: BoxNodeData): BufferGeometry {
  const { width, height, depth, widthSegments, heightSegments, depthSegments } = data.geometry;
  const clampedWidthSegments = Math.max(1, Math.min(512, Math.round(widthSegments)));
  const clampedHeightSegments = Math.max(1, Math.min(512, Math.round(heightSegments)));
  const clampedDepthSegments = Math.max(1, Math.min(512, Math.round(depthSegments)));
  return new BoxGeometry(width, height, depth, clampedWidthSegments, clampedHeightSegments, clampedDepthSegments);
}
export const boxNodeParams: NodeParams = {
  general: createGeneralParams("Box", "Creates a 3D box geometry"),
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
    widthSegments: createParameterMetadata("number", 1, {
      displayName: "Width Segments",
      min: 1,
      max: 512,
      step: 1,
    }),
    heightSegments: createParameterMetadata("number", 1, {
      displayName: "Height Segments",
      min: 1,
      max: 512,
      step: 1,
    }),
    depthSegments: createParameterMetadata("number", 1, {
      displayName: "Depth Segments",
      min: 1,
      max: 512,
      step: 1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};
export const boxNodeComputeTyped = (params: Record<string, any>): Record<string, BaseContainer> => {
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
  const geometry = createBoxGeometry(data);
  const container = createGeometryMesh(data, geometry);
  return { default: container };
};
