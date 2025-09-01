import { BufferGeometry, Object3D, BoxGeometry } from "three";
import type { NodeProcessor } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { BaseGeometryData, createGeometryMesh } from "../geometryFactories";
import { createGeneralParams, createRenderingParams } from "../../../engine/nodeParameterFactories";
import { NodePatterns } from "../../../engine/nodes/NodeBuilder";
import { ContainerFactory, BaseContainer } from "../../../engine/containers/BaseContainer";

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

  return new BoxGeometry(
    width,
    height,
    depth,
    clampedWidthSegments,
    clampedHeightSegments,
    clampedDepthSegments
  );
}

export const processor: NodeProcessor<
  BoxNodeData,
  { object: Object3D; geometry: BufferGeometry }
> = (data: BoxNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  const geometry = createBoxGeometry(data);
  const result = createGeometryMesh(data, geometry, input?.object);
  return result;
};

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
  rendering: createRenderingParams(),
};

export const boxNodeCompute = (params: Record<string, any>) => {
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
  const inputObject = undefined;
  const result = processor(data, inputObject);
  return result;
};

export const boxNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Record<string, BaseContainer> => {
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

// New typed node definition using NodeBuilder
export const createBoxNodeDefinition = () => {
  return NodePatterns.geometryGenerator('box', 'Box')
    .parameterCategory('general', createGeneralParams('Box', 'Creates a 3D box geometry'))
    .parameterCategory('geometry', {
      width: createParameterMetadata('number', 1, {
        displayName: 'Width',
        min: 0.01,
        max: 100,
        step: 0.1,
      }),
      height: createParameterMetadata('number', 1, {
        displayName: 'Height', 
        min: 0.01,
        max: 100,
        step: 0.1,
      }),
      depth: createParameterMetadata('number', 1, {
        displayName: 'Depth',
        min: 0.01,
        max: 100,
        step: 0.1,
      }),
      widthSegments: createParameterMetadata('number', 1, {
        displayName: 'Width Segments',
        min: 1,
        max: 512,
        step: 1,
      }),
      heightSegments: createParameterMetadata('number', 1, {
        displayName: 'Height Segments',
        min: 1,
        max: 512,
        step: 1,
      }),
      depthSegments: createParameterMetadata('number', 1, {
        displayName: 'Depth Segments',
        min: 1,
        max: 512,
        step: 1,
      }),
    })
    .parameterCategory('rendering', createRenderingParams())
    .compute(async (params, _inputs, _context) => {
      // Create box geometry with clamped segments
      const { width, height, depth, widthSegments, heightSegments, depthSegments } = params.geometry;
      
      const clampedWidthSegments = Math.max(1, Math.min(512, Math.round(widthSegments)));
      const clampedHeightSegments = Math.max(1, Math.min(512, Math.round(heightSegments)));
      const clampedDepthSegments = Math.max(1, Math.min(512, Math.round(depthSegments)));

      const geometry = new BoxGeometry(
        width,
        height,
        depth,
        clampedWidthSegments,
        clampedHeightSegments,
        clampedDepthSegments
      );

      // Create data structure for existing mesh creation logic
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

      // Use existing mesh creation logic
      const result = createGeometryMesh(data, geometry, undefined);
      
      // Return typed containers
      return {
        geometry: ContainerFactory.geometry(geometry),
        object: ContainerFactory.object3d(result.object)
      };
    })
    .build();
};
