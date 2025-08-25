import { SpotLight as ThreeSpotLight, SpotLightHelper, Object3D, Group } from "three";
import type {
  GeneralProps,
  SpotLightProps,
  SpotLightShadowProps,
  SpotLightRenderingProps,
  NodeProcessor,
} from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import { validateAndFixShadowCamera } from "../../../utils/shadowValidation";

export interface SpotLightNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  };
  light: SpotLightProps;
  shadow: SpotLightShadowProps;
  rendering: SpotLightRenderingProps;
}

export const processor: NodeProcessor<SpotLightNodeData, { object: Object3D }> = (
  data: SpotLightNodeData
) => {
  const light = new ThreeSpotLight(
    data.light.color,
    data.light.intensity,
    data.light.distance,
    data.light.angle,
    data.light.penumbra,
    data.light.decay
  );

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

  light.castShadow = data.light.castShadow;
  if (data.light.castShadow) {
    const mapSize = parseInt(data.shadow.mapSize);
    light.shadow.mapSize.width = mapSize;
    light.shadow.mapSize.height = mapSize;
    light.shadow.bias = data.shadow.bias;
    light.shadow.normalBias = data.shadow.normalBias;

    light.shadow.camera.near = data.shadow.cameraNear;
    light.shadow.camera.far = data.shadow.cameraFar;
  }

  light.visible = data.rendering.visible;

  const lightGroup = new Group();
  lightGroup.add(light);
  lightGroup.add(light.target);

  if (data.rendering.showHelper) {
    const helper = new SpotLightHelper(light, data.light.color);
    lightGroup.add(helper);
  }

  return { object: lightGroup };
};

export const spotLightNodeParams: NodeParams = {
  general: {
    name: createParameterMetadata("string", "Spot Light", {
      displayName: "Name",
      displayMode: "name",
    }),
    description: createParameterMetadata(
      "string",
      "Cone-shaped light with distance, angle, and penumbra.",
      { displayName: "Description", displayMode: "description" }
    ),
  },
  transform: {
    position: createParameterMetadata(
      "vector3",
      { x: 5, y: 10, z: 5 },
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
    intensity: createParameterMetadata("number", 1.0, {
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
    angle: createParameterMetadata("number", 0.785, {
      displayName: "Angle (radians)",
      min: 0.017,
      max: 1.571,
      step: 0.001,
    }),
    penumbra: createParameterMetadata("number", 0.0, {
      displayName: "Penumbra",
      min: 0,
      max: 1,
      step: 0.01,
    }),
    decay: createParameterMetadata("number", 2, {
      displayName: "Decay",
      min: 0,
      max: 4,
      step: 0.1,
    }),
    castShadow: createParameterMetadata("boolean", false, { displayName: "Cast Shadow" }),
  },
  shadow: {
    mapSize: createParameterMetadata("enum", "1024", {
      displayName: "Shadow Map Size",
      enumValues: ["512", "1024", "2048"],
    }),
    bias: createParameterMetadata("number", 0, {
      displayName: "Shadow Bias",
      min: -0.01,
      max: 0.01,
      step: 0.0001,
    }),
    normalBias: createParameterMetadata("number", 0, {
      displayName: "Normal Bias",
      min: 0,
      max: 1,
      step: 0.001,
    }),
    cameraNear: createParameterMetadata("number", 0.5, {
      displayName: "Shadow Near",
      min: 0.01,
      max: 50,
      step: 0.01,
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

export const spotLightNodeCompute = (params: Record<string, unknown>) => {
  const shadowParams = params.shadow as SpotLightShadowProps;
  if (shadowParams) {
    validateAndFixShadowCamera(shadowParams);
  }

  const lightParams = params.light as SpotLightProps;
  if (lightParams?.angle) {
    if (lightParams.angle <= 0) {
      lightParams.angle = 0.017;
    }
    if (lightParams.angle > Math.PI / 2) {
      lightParams.angle = Math.PI / 2;
    }
  }

  const data: SpotLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
      target: (params.transform as { target: { x: number; y: number; z: number } }).target,
    },
    light: lightParams,
    shadow: shadowParams,
    rendering: params.rendering as SpotLightRenderingProps,
  };

  return processor(data);
};
