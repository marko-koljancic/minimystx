import { PointLight, PointLightHelper, Object3D, Group } from "three";
import type {
  GeneralProps,
  LightProps,
  ShadowProps,
  BaseLightRenderingProps,
  NodeProcessor,
} from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { validateAndFixShadowCamera, validateShadowMapSize } from "../../../utils/shadowValidation";

export interface PointLightNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: {
    position: { x: number; y: number; z: number };
  };
  light: LightProps;
  shadow: ShadowProps;
  rendering: BaseLightRenderingProps;
}

export const processor: NodeProcessor<PointLightNodeData, { object: Object3D }> = (
  data: PointLightNodeData
) => {
  const light = new PointLight(
    data.light.color,
    data.light.intensity,
    data.light.distance,
    data.light.decay
  );

  light.position.set(
    data.transform.position.x,
    data.transform.position.y,
    data.transform.position.z
  );

  light.castShadow = data.light.castShadow;
  if (data.light.castShadow) {
    light.shadow.mapSize.width = data.shadow.mapSizeWidth;
    light.shadow.mapSize.height = data.shadow.mapSizeHeight;
    light.shadow.bias = data.shadow.bias;
    light.shadow.radius = data.shadow.radius;
    light.shadow.camera.near = data.shadow.cameraNear;
    light.shadow.camera.far = data.shadow.cameraFar;

    validateShadowMapSize(data.shadow.mapSizeWidth, data.shadow.mapSizeHeight, "PointLight");
  }

  light.visible = data.rendering.visible;

  const lightGroup = new Group();
  lightGroup.add(light);

  if (data.rendering.showHelper) {
    const helper = new PointLightHelper(light, 0.5, data.light.color);
    lightGroup.add(helper);
  }

  return { object: lightGroup };
};

export const pointLightNodeParams: NodeParams = {
  general: {
    name: createParameterMetadata("string", "Point Light", {
      displayName: "Name",
      displayMode: "name",
    }),
    description: createParameterMetadata(
      "string",
      "Creates a point light source that emits light in all directions",
      { displayName: "Description", displayMode: "description" }
    ),
  },
  transform: {
    position: createParameterMetadata("vector3", { x: 0, y: 5, z: 0 }, { displayName: "Position" }),
  },
  light: {
    color: createParameterMetadata("color", "#ffffff", { displayName: "Color" }),
    intensity: createParameterMetadata("number", 1.5, {
      displayName: "Intensity",
      min: 0,
      max: 100,
      step: 0.1,
    }),
    distance: createParameterMetadata("number", 0, {
      displayName: "Distance",
      min: 0,
      max: 1000,
      step: 1,
    }),
    decay: createParameterMetadata("number", 2, {
      displayName: "Decay",
      min: 0,
      max: 10,
      step: 0.1,
    }),
    castShadow: createParameterMetadata("boolean", true, { displayName: "Cast Shadow" }),
  },
  shadow: {
    mapSizeWidth: createParameterMetadata("number", 1024, {
      displayName: "Shadow Map Width",
      min: 16,
      max: 4096,
      step: 1,
    }),
    mapSizeHeight: createParameterMetadata("number", 1024, {
      displayName: "Shadow Map Height",
      min: 16,
      max: 4096,
      step: 1,
    }),
    bias: createParameterMetadata("number", -0.0001, {
      displayName: "Shadow Bias",
      min: -0.01,
      max: 0.01,
      step: 0.0001,
    }),
    radius: createParameterMetadata("number", 1, {
      displayName: "Shadow Radius",
      min: 0,
      max: 25,
      step: 0.1,
    }),
    cameraNear: createParameterMetadata("number", 0.5, {
      displayName: "Shadow Near",
      min: 0.01,
      max: 100,
      step: 0.1,
    }),
    cameraFar: createParameterMetadata("number", 500, {
      displayName: "Shadow Far",
      min: 1,
      max: 2000,
      step: 1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
    showHelper: createParameterMetadata("boolean", false, { displayName: "Show Helper" }),
  },
};

export const pointLightNodeCompute = (params: Record<string, unknown>) => {
  const shadowParams = params.shadow as ShadowProps;

  if (shadowParams) {
    validateAndFixShadowCamera(shadowParams);
  }

  const data: PointLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
    },
    light: params.light as LightProps,
    shadow: shadowParams,
    rendering: params.rendering as BaseLightRenderingProps,
  };

  return processor(data);
};
