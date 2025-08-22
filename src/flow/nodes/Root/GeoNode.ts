import { NodeParams, useGraphStore } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createTransformParams,
  createRenderingParams,
} from "../../../engine/nodeParameterFactories";

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
  general: createGeneralParams("Geo1", "Container for sub-flow geometry"),
  transform: createTransformParams(),
  rendering: createRenderingParams(),
};

export const geoNodeCompute = (params: Record<string, any>, _inputs?: any, context?: { nodeId?: string }) => {
  console.log(`[geoNodeCompute] Starting computation for geoNode ${context?.nodeId}`);
  
  // Convert params to structured data
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

  // Get subflow output if available
  let subflowObject = null;
  if (context?.nodeId) {
    try {
      const graphStore = useGraphStore.getState();
      const subFlow = graphStore.subFlows[context.nodeId];
      
      console.log(`[geoNodeCompute] SubFlow for ${context.nodeId}:`, subFlow);
      console.log(`[geoNodeCompute] Active output node ID:`, subFlow?.activeOutputNodeId);
      
      if (subFlow && subFlow.activeOutputNodeId) {
        const outputNodeRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
        console.log(`[geoNodeCompute] Output node runtime:`, outputNodeRuntime);
        
        if (outputNodeRuntime?.output?.object) {
          subflowObject = outputNodeRuntime.output.object;
          console.log(`[geoNodeCompute] Found subflow object:`, subflowObject);
        } else {
          console.log(`[geoNodeCompute] No output object in runtime`);
        }
      } else {
        console.log(`[geoNodeCompute] No subflow or no active output node`);
      }
    } catch (error) {
      console.warn('[geoNodeCompute] Failed to get subflow output:', error);
    }
  } else {
    console.log(`[geoNodeCompute] No context nodeId provided`);
  }

  console.log(`[geoNodeCompute] Returning object:`, subflowObject);
  return { object: subflowObject, data };
};
