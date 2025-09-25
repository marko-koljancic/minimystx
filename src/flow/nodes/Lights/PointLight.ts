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
import { validateAndFixShadowCamera } from "../../../utils/shadowValidation";
export interface PointLightNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: {
    position: { x: number; y: number; z: number };
  };
  light: LightProps;
  shadow: ShadowProps & {
    mapSize: string;
  };
  rendering: BaseLightRenderingProps & {
    helperSize: number;
  };
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
    const mapSize = parseInt(data.shadow.mapSize);
    light.shadow.mapSize.width = mapSize;
    light.shadow.mapSize.height = mapSize;
    light.shadow.bias = data.shadow.bias;
    light.shadow.radius = data.shadow.radius;
    light.shadow.camera.near = data.shadow.cameraNear;
    light.shadow.camera.far = data.shadow.cameraFar;
  }
  light.visible = data.rendering.visible;
  const lightGroup = new Group();
  lightGroup.add(light);
  if (data.rendering.showHelper) {
    const helper = new PointLightHelper(light, data.rendering.helperSize, data.light.color);
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
      "Creates a point light source that emits light in all directions.",
      { displayName: "Description", displayMode: "description" }
    ),
  },
  transform: {
    position: createParameterMetadata("vector3", { x: 10, y: 10, z: 5 }, { displayName: "Position" }),
  },
  light: {
    color: createParameterMetadata("color", "#ffffff", { displayName: "Color" }),
    intensity: createParameterMetadata("number", 1.5, {
      displayName: "Intensity",
      min: 0,
      max: 10,
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
    mapSize: createParameterMetadata("enum", "1024", {
      displayName: "Shadow Map Size",
      enumValues: ["512", "1024", "2048"],
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
    helperSize: createParameterMetadata("number", 1, {
      displayName: "Helper Size",
      min: 0.1,
      max: 10,
      step: 0.1,
    }),
  },
};
export const pointLightNodeCompute = (params: Record<string, unknown>) => {
  const shadowParams = params.shadow as ShadowProps;
  if (shadowParams) {
    validateAndFixShadowCamera(shadowParams);
  }
  const renderingParams = params.rendering as any;
  if (renderingParams && renderingParams.helperSize <= 0) {
    renderingParams.helperSize = 1;
  }
  const data: PointLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
    },
    light: params.light as LightProps,
    shadow: {
      mapSize: (params.shadow as any)?.mapSize || "1024",
      ...(shadowParams || {}),
    } as ShadowProps & { mapSize: string },
    rendering: {
      visible: (params.rendering as any)?.visible !== false,
      showHelper: (params.rendering as any)?.showHelper || false,
      helperSize: (params.rendering as any)?.helperSize || 1,
      ...(params.rendering || {}),
    } as BaseLightRenderingProps & { helperSize: number },
  };
  return processor(data);
};
