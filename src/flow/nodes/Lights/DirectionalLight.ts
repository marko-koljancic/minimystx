import {
  DirectionalLight as ThreeDirectionalLight,
  DirectionalLightHelper,
  Object3D,
  Group,
} from "three";
import type {
  GeneralProps,
  DirectionalLightProps,
  DirectionalLightShadowProps,
  DirectionalLightRenderingProps,
  NodeProcessor,
} from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { validateAndFixShadowCamera } from "../../../utils/shadowValidation";
export interface DirectionalLightNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  light: DirectionalLightProps;
  shadow: DirectionalLightShadowProps;
  rendering: DirectionalLightRenderingProps;
}
export const processor: NodeProcessor<DirectionalLightNodeData, { object: Object3D }> = (
  data: DirectionalLightNodeData
) => {
  const light = new ThreeDirectionalLight(data.light.color, data.light.intensity);
  light.position.set(
    data.transform.position.x,
    data.transform.position.y,
    data.transform.position.z
  );
  light.target.position.set(
    data.transform.target.x,
    data.transform.target.y,
    data.transform.target.z
  );
  light.target.updateMatrixWorld();
  light.castShadow = data.light.castShadow;
  if (data.light.castShadow) {
    const mapSize = parseInt(data.shadow.mapSize);
    light.shadow.mapSize.width = mapSize;
    light.shadow.mapSize.height = mapSize;
    light.shadow.bias = data.shadow.bias;
    light.shadow.normalBias = data.shadow.normalBias;
    light.shadow.camera.near = data.shadow.cameraNear;
    light.shadow.camera.far = data.shadow.cameraFar;
    light.shadow.camera.left = data.shadow.cameraLeft;
    light.shadow.camera.right = data.shadow.cameraRight;
    light.shadow.camera.top = data.shadow.cameraTop;
    light.shadow.camera.bottom = data.shadow.cameraBottom;
  }
  light.visible = data.rendering.visible;
  light.updateMatrixWorld();
  const lightGroup = new Group();
  lightGroup.add(light);
  lightGroup.add(light.target);
  if (data.rendering.showHelper) {
    const helper = new DirectionalLightHelper(light, data.rendering.helperSize, 0xff00ff);
    lightGroup.add(helper);
  }
  return { object: lightGroup };
};
export const directionalLightNodeParams: NodeParams = {
  general: {
    name: createParameterMetadata("string", "Directional Light", {
      displayName: "Name",
      displayMode: "name",
    }),
    description: createParameterMetadata(
      "string",
      "Parallel light rays from a distant source; good for sun/sky.",
      { displayName: "Description", displayMode: "description" }
    ),
  },
  transform: {
    position: createParameterMetadata(
      "vector3",
      { x: 10, y: 10, z: 5 },
      { displayName: "Position", step: 0.1 }
    ),
    target: createParameterMetadata(
      "vector3",
      { x: 0, y: 0, z: 0 },
      { displayName: "Target", step: 0.1 }
    ),
  },
  light: {
    color: createParameterMetadata("color", "#ffffff", { displayName: "Color" }),
    intensity: createParameterMetadata("number", 1.5, {
      displayName: "Intensity",
      min: 0,
      max: 10,
      step: 0.1,
    }),
    castShadow: createParameterMetadata("boolean", true, { displayName: "Cast Shadow" }),
  },
  shadow: {
    mapSize: createParameterMetadata("enum", "2048", {
      displayName: "Shadow Map Size",
      enumValues: ["512", "1024", "2048"],
    }),
    bias: createParameterMetadata("number", 0.0001, {
      displayName: "Shadow Bias",
      min: -0.1,
      max: 0.1,
      step: 0.0001,
    }),
    normalBias: createParameterMetadata("number", 0, {
      displayName: "Normal Bias",
      min: 0,
      max: 10,
      step: 0.001,
    }),
    cameraNear: createParameterMetadata("number", 0.1, {
      displayName: "Shadow Near",
      min: 0.01,
      max: 50,
      step: 0.01,
    }),
    cameraFar: createParameterMetadata("number", 50, {
      displayName: "Shadow Far",
      min: 1,
      max: 2000,
      step: 1,
    }),
    cameraLeft: createParameterMetadata("number", -4, {
      displayName: "Shadow Left",
      min: -500,
      max: 500,
      step: 1,
    }),
    cameraRight: createParameterMetadata("number", 4, {
      displayName: "Shadow Right",
      min: -500,
      max: 500,
      step: 1,
    }),
    cameraTop: createParameterMetadata("number", 4, {
      displayName: "Shadow Top",
      min: -500,
      max: 500,
      step: 1,
    }),
    cameraBottom: createParameterMetadata("number", -4, {
      displayName: "Shadow Bottom",
      min: -500,
      max: 500,
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
export const directionalLightNodeCompute = (params: Record<string, unknown>) => {
  const shadowParams = params.shadow as DirectionalLightShadowProps;
  if (shadowParams) {
    validateAndFixShadowCamera(shadowParams);
  }
  const renderingParams = params.rendering as any;
  if (renderingParams && renderingParams.helperSize <= 0) {
    renderingParams.helperSize = 1;
  }
  const data: DirectionalLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
      target: (params.transform as { target: { x: number; y: number; z: number } }).target,
    },
    light: (params.light as DirectionalLightProps) || {
      color: "#ffffff",
      intensity: 1.5,
      visible: true,
      castShadow: true,
    },
    shadow: shadowParams,
    rendering: params.rendering as DirectionalLightRenderingProps,
  };
  return processor(data);
};
