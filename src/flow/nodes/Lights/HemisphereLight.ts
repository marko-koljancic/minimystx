import {
  HemisphereLight as ThreeHemisphereLight,
  HemisphereLightHelper,
  Object3D,
  Group,
} from "three";
import type {
  GeneralProps,
  HemisphereLightProps,
  HemisphereLightRenderingProps,
  NodeProcessor,
} from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createLightTransformParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams } from "../../../engine/graphStore";
export interface HemisphereLightNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: {
    position: { x: number; y: number; z: number };
  };
  light: HemisphereLightProps;
  rendering: HemisphereLightRenderingProps;
}
export const processor: NodeProcessor<HemisphereLightNodeData, { object: Object3D }> = (
  data: HemisphereLightNodeData
) => {
  const light = new ThreeHemisphereLight(
    data.light.skyColor,
    data.light.groundColor,
    data.light.intensity
  );
  light.position.set(
    data.transform.position.x,
    data.transform.position.y,
    data.transform.position.z
  );
  light.visible = data.rendering.visible;
  const lightGroup = new Group();
  lightGroup.add(light);
  if (data.rendering.showHelper) {
    const helper = new HemisphereLightHelper(light, data.rendering.helperSize);
    lightGroup.add(helper);
  }
  return { object: lightGroup };
};
export const hemisphereLightNodeParams: NodeParams = {
  general: {
    name: createParameterMetadata("string", "Hemisphere Light", {
      displayName: "Name",
      displayMode: "name",
    }),
    description: createParameterMetadata(
      "string",
      "Provides ambient illumination from sky and ground colors",
      { displayName: "Description", displayMode: "description" }
    ),
  },
  transform: createLightTransformParams({ x: 0, y: 0, z: 0 }),
  light: {
    skyColor: createParameterMetadata("color", "#ffffff", { displayName: "Sky Color" }),
    groundColor: createParameterMetadata("color", "#444444", { displayName: "Ground Color" }),
    intensity: createParameterMetadata("number", 1.0, {
      displayName: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
    showHelper: createParameterMetadata("boolean", false, { displayName: "Show Helper" }),
    helperSize: createParameterMetadata("number", 1, {
      displayName: "Helper Size",
      min: 0.1,
      max: 10,
      step: 0.1,
    }),
  },
};
export const hemisphereLightNodeCompute = (params: Record<string, unknown>) => {
  const lightParams = params.light as HemisphereLightProps;
  if (lightParams && lightParams.intensity < 0) {
    lightParams.intensity = 0;
  }
  const renderingParams = params.rendering as HemisphereLightRenderingProps;
  if (renderingParams && renderingParams.helperSize <= 0) {
    renderingParams.helperSize = 1;
  }
  const data: HemisphereLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
    },
    light: lightParams,
    rendering: renderingParams,
  };
  return processor(data);
};
