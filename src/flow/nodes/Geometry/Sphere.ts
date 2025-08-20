import { BufferGeometry, Object3D, SphereGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createSubflowRenderingParams,
} from "../../../engine/nodeParameterFactories";

export interface SphereNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radius: number;
  };
}

function createSphereGeometry(data: SphereNodeData): BufferGeometry {
  const { radius } = data.geometry;
  const widthSegments = 32;
  const heightSegments = 16;
  return new SphereGeometry(radius, widthSegments, heightSegments);
}

export const processor: NodeProcessor<
  SphereNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: SphereNodeData, input?: Object3D) => {
  const geometry = createSphereGeometry(data);
  return createGeometryMesh(data, geometry, input);
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
  },
  rendering: createSubflowRenderingParams(),
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
