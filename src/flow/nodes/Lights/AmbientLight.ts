import { AmbientLight as ThreeAmbientLight, Object3D, Group, SphereGeometry, MeshBasicMaterial, Mesh } from "three";
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
  rendering: AmbientLightRenderingProps & {
    showHelper: boolean;
    helperSize: number;
  };
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
  light.updateMatrixWorld();
  const lightGroup = new Group();
  lightGroup.add(light);
  if (data.rendering.showHelper) {
    const helperGeometry = new SphereGeometry(data.rendering.helperSize * 0.1, 8, 6);
    const helperMaterial = new MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const helper = new Mesh(helperGeometry, helperMaterial);
    lightGroup.add(helper);
  }
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
    showHelper: createParameterMetadata("boolean", false, { displayName: "Show Helper" }),
    helperSize: createParameterMetadata("number", 1, {
      displayName: "Helper Size",
      min: 0.1,
      max: 10,
      step: 0.1,
    }),
  },
};
export const ambientLightNodeCompute = (params: Record<string, unknown>) => {
  const renderingParams = params.rendering as any;
  if (renderingParams && renderingParams.helperSize <= 0) {
    renderingParams.helperSize = 1;
  }
  const data: AmbientLightNodeData = {
    general: params.general as GeneralProps,
    transform: {
      position: (params.transform as { position: { x: number; y: number; z: number } }).position,
    },
    light: (params.light as AmbientLightProps) || {
      color: "#ffffff",
      intensity: 0.5,
      visible: true,
    },
    rendering: {
      visible: (params.rendering as any)?.visible !== false,
      showHelper: (params.rendering as any)?.showHelper || false,
      helperSize: (params.rendering as any)?.helperSize || 1,
      ...(params.rendering || {}),
    } as AmbientLightRenderingProps & { showHelper: boolean; helperSize: number },
  };
  return processor(data);
};
