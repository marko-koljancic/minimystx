import { BufferGeometry, Object3D, SphereGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { createGeneralParams, createRenderingParams } from "../../../engine/nodeParameterFactories";

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

export const processor: NodeProcessor<
  SphereNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: SphereNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createSphereGeometry(data);
  return createGeometryMesh(data, geometry, input?.object);
};

export const sphereNodeParams: NodeParams = {
  general: createGeneralParams("Sphere 1", "Creates a 3D sphere geometry"),
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
  rendering: createRenderingParams(),
};

export const sphereNodeCompute = (params: Record<string, any>) => {
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
  const inputObject = undefined;
  return processor(data, inputObject);
};
