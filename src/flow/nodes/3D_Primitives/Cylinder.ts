import { BufferGeometry, Object3D, CylinderGeometry } from "three";
import type { NodeProcessor } from "../props";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { createGeneralParams } from "../../../engine/nodeParameterFactories";
import { BaseContainer } from "../../../engine/containers/BaseContainer";
export interface CylinderNodeData extends BaseGeometryData, Record<string, unknown> {
  geometry: {
    radiusTop: number;
    radiusBottom: number;
    height: number;
    radialSegments: number;
    heightSegments: number;
  };
}
function createCylinderGeometry(data: CylinderNodeData): BufferGeometry {
  let { radiusTop, radiusBottom, height, radialSegments, heightSegments } = data.geometry;
  if (radiusTop <= 0) radiusTop = 0.1;
  if (radiusBottom <= 0) radiusBottom = 0.1;
  if (height <= 0) height = 0.1;
  const clampedRadialSegments = Math.max(3, Math.min(512, Math.round(radialSegments)));
  const clampedHeightSegments = Math.max(1, Math.min(512, Math.round(heightSegments)));
  return new CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    clampedRadialSegments,
    clampedHeightSegments
  );
}
export const processor: NodeProcessor<
  CylinderNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: CylinderNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createCylinderGeometry(data);
  return createGeometryMesh(data, geometry, input?.object);
};
export const cylinderNodeParams: NodeParams = {
  general: createGeneralParams("Cylinder", "Creates a 3D cylinder geometry"),
  geometry: {
    radiusTop: createParameterMetadata("number", 0.5, {
      displayName: "Top Radius",
      min: 0.01,
      max: 50,
      step: 0.1,
    }),
    radiusBottom: createParameterMetadata("number", 0.5, {
      displayName: "Bottom Radius",
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
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};
export const cylinderNodeCompute = (params: Record<string, any>) => {
  const data: CylinderNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as CylinderNodeData;
  const inputObject = undefined;
  return processor(data, inputObject);
};
export const cylinderNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
  const data: CylinderNodeData = {
    general: params.general,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    geometry: params.geometry,
    rendering: params.rendering,
  } as CylinderNodeData;
  const geometry = createCylinderGeometry(data);
  const container = createGeometryMesh(data, geometry);
  return { default: container };
};
