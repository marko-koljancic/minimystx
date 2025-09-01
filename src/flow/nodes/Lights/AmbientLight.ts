import { AmbientLight as ThreeAmbientLight, Object3D, Group } from "three";
import type {
  GeneralProps,
  AmbientLightProps,
  AmbientLightRenderingProps,
  NodeProcessor,
} from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createLightTransformParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams } from "../../../engine/graphStore";
export interface AmbientLightNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: {
    position: { x: number; y: number; z: number };
  };
  light: AmbientLightProps;
  rendering: AmbientLightRenderingProps;
}
export const processor: NodeProcessor<AmbientLightNodeData, { object: Object3D }> = (
  data: AmbientLightNodeData
) => {
  const light = new ThreeAmbientLight(data.light.color, data.light.intensity);
  light.position.set(
    data.transform.position.x,
    data.transform.position.y,
    data.transform.position.z
  );
  light.visible = data.rendering.visible;
  const lightGroup = new Group();
  lightGroup.add(light);
  return { object: lightGroup };
};
export const ambientLightNodeParams: NodeParams = {
  general: {
    name: createParameterMetadata("string", "Ambient Light", {
      displayName: "Name",
      displayMode: "name",
    }),
    description: createParameterMetadata(
      "string",
      "Uniform ambient illumination that affects all objects equally.",
      { displayName: "Description", displayMode: "description" }
    ),
  },
  transform: createLightTransformParams({ x: 0, y: 0, z: 0 }),
  light: {
    color: createParameterMetadata("color", "#ffffff", { displayName: "Color" }),
    intensity: createParameterMetadata("number", 0.5, {
      displayName: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};
export const ambientLightNodeCompute = (params: Record<string, unknown>) => {
  const data: AmbientLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
    },
    light: params.light as AmbientLightProps,
    rendering: params.rendering as AmbientLightRenderingProps,
  };
  return processor(data);
};
