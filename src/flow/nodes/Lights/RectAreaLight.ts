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
import { createTransformParams } from "../../../engine/nodeParameterFactories";
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
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    scaleFactor: number;
  };
  light: RectAreaLightProps;
  rendering: RectAreaLightRenderingProps & {
    helperSize: number;
  };
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
  light.rotation.set(
    data.transform.rotation.x * (Math.PI / 180),
    data.transform.rotation.y * (Math.PI / 180),
    data.transform.rotation.z * (Math.PI / 180)
  );
  const scaleFactor = data.transform.scaleFactor;
  light.scale.set(
    data.transform.scale.x * scaleFactor,
    data.transform.scale.y * scaleFactor,
    data.transform.scale.z * scaleFactor
  );
  light.visible = data.rendering.visible;
  const lightGroup = new Group();
  lightGroup.add(light);
  if (data.rendering.showHelper) {
    const helper = new RectAreaLightHelper(light);
    helper.scale.setScalar(data.rendering.helperSize);
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
  transform: createTransformParams(),
  light: {
    color: createParameterMetadata("color", "#ffffff", { displayName: "Color" }),
    intensity: createParameterMetadata("number", 1.5, {
      displayName: "Intensity",
      min: 0,
      max: 10,
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
    helperSize: createParameterMetadata("number", 1, {
      displayName: "Helper Size",
      min: 0.1,
      max: 10,
      step: 0.1,
    }),
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
  const renderingParams = params.rendering as any;
  if (renderingParams && renderingParams.helperSize <= 0) {
    renderingParams.helperSize = 1;
  }
  const data: RectAreaLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as any).position || { x: 0, y: 0, z: 0 },
      rotation: (params.transform as any).rotation || { x: 0, y: 0, z: 0 },
      scale: (params.transform as any).scale || { x: 1, y: 1, z: 1 },
      scaleFactor: (params.transform as any).scaleFactor || 1,
    },
    light: lightParams,
    rendering: params.rendering as RectAreaLightRenderingProps & { helperSize: number },
  };
  return processor(data);
};
