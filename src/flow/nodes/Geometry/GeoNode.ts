import { NodeParams, useGraphStore } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createTransformParams,
  createRenderingParams,
} from "../../../engine/nodeParameterFactories";
import { Object3DContainer } from "../../../engine/containers/BaseContainer";
export interface GeoNodeData extends Record<string, unknown> {
  general: {
    name: string;
    description: string;
  };
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    scaleFactor: number;
  };
  rendering: {
    visible: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
  };
}
export const geoNodeParams: NodeParams = {
  general: createGeneralParams("Geo", "Container for sub-flow geometry"),
  transform: createTransformParams(),
  rendering: createRenderingParams(),
};
export const geoNodeCompute = (params: Record<string, any>, _inputs?: any, context?: { nodeId?: string }) => {
  const data: GeoNodeData = {
    general: params.general,
    transform: {
      position: params.transform.position,
      rotation: params.transform.rotation,
      scale: params.transform.scale,
      scaleFactor: params.transform.scaleFactor,
    },
    rendering: params.rendering,
  };
  let subflowObject = null;
  if (context?.nodeId) {
    try {
      const graphStore = useGraphStore.getState();
      const subFlow = graphStore.subFlows[context.nodeId];
      if (subFlow && subFlow.activeOutputNodeId) {
        const outputNodeRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
        if (outputNodeRuntime?.output) {
          if (outputNodeRuntime.output.default instanceof Object3DContainer) {
            subflowObject = outputNodeRuntime.output.default.value;
          }
          else if (outputNodeRuntime.output.object) {
            subflowObject = outputNodeRuntime.output.object;
          }
        }
      }
    } catch (error) {
    }
  } else {
  }
  return { object: subflowObject, data };
};
