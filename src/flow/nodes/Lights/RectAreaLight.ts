import { RectAreaLight as ThreeRectAreaLight, Object3D, Group } from "three";
import { RectAreaLightHelper } from "three/addons/helpers/RectAreaLightHelper.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import type {
  GeneralProps,
  RectAreaLightProps,
  RectAreaLightRenderingProps,
  NodeProcessor,
} from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createLightTransformParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams } from "../../../engine/graphStore";

let rectAreaLibInitialized = false;
if (!rectAreaLibInitialized) {
  RectAreaLightUniformsLib.init();
  rectAreaLibInitialized = true;
}

export interface RectAreaLightNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: {
    position: { x: number; y: number; z: number };
  };
  light: RectAreaLightProps;
  rendering: RectAreaLightRenderingProps;
}

export const processor: NodeProcessor<RectAreaLightNodeData, { object: Object3D }> = (
  data: RectAreaLightNodeData
) => {
  const light = new ThreeRectAreaLight(
    data.light.color,
    data.light.intensity,
    data.light.width,
    data.light.height
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
    const helper = new RectAreaLightHelper(light);
    lightGroup.add(helper);
  }


  return { object: lightGroup };
};

export const rectAreaLightNodeParams: NodeParams = {
  general: {
    name: createParameterMetadata("string", "Rect Area Light", {
      displayName: "Name",
      displayMode: "name",
    }),
    description: createParameterMetadata(
      "string",
      "Rectangular area light for realistic lighting effects",
      { displayName: "Description", displayMode: "description" }
    ),
  },
  transform: createLightTransformParams({ x: 0, y: 0, z: 5 }),
  light: {
    color: createParameterMetadata("color", "#ffffff", { displayName: "Color" }),
    intensity: createParameterMetadata("number", 1.0, {
      displayName: "Intensity",
      min: 0,
      max: 100,
      step: 0.1,
    }),
    width: createParameterMetadata("number", 10, {
      displayName: "Width",
      min: 0.1,
      max: 1000,
      step: 0.1,
    }),
    height: createParameterMetadata("number", 10, {
      displayName: "Height",
      min: 0.1,
      max: 1000,
      step: 0.1,
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
    showHelper: createParameterMetadata("boolean", false, { displayName: "Show Helper" }),
  },
};

export const rectAreaLightNodeCompute = (params: Record<string, unknown>) => {
  const lightParams = params.light as RectAreaLightProps;
  if (lightParams) {
    if (lightParams.intensity < 0) {
      lightParams.intensity = 0;
    }

    if (lightParams.width <= 0) {
      lightParams.width = 0.1;
    }

    if (lightParams.height <= 0) {
      lightParams.height = 0.1;
    }
  }

  const data: RectAreaLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
    },
    light: lightParams,
    rendering: params.rendering as RectAreaLightRenderingProps,
  };

  return processor(data);
};
