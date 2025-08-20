import { Material, Object3D } from "three";

export interface GeneralProps {
  name: string;
  description?: string;
}

export interface TransformProps {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number; factor: number };
}

export interface RenderingProps {
  material: Material | null;
  visible: boolean;
  receiveShadow?: boolean;
  castShadow?: boolean;
}

// Base light properties that all lights share
export interface BaseLightProps {
  color: string;
  intensity: number;
  visible: boolean;
  castShadow: boolean;
}

// Base rendering properties for all lights
export interface BaseLightRenderingProps {
  visible: boolean;
  showHelper: boolean;
}

// Base shadow properties for lights that support shadows
export interface BaseShadowProps {
  bias: number;
  cameraNear: number;
  cameraFar: number;
}

export interface LightProps extends BaseLightProps {
  distance: number;
  decay: number;
}

export interface AmbientLightProps extends Omit<BaseLightProps, "castShadow"> {
  // Ambient lights don't cast shadows
}

export interface DirectionalLightProps extends BaseLightProps {
  // DirectionalLight uses all base properties
}

export interface SpotLightProps extends BaseLightProps {
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
}

export interface DirectionalLightRenderingProps extends BaseLightRenderingProps {
  helperSize: number;
}

export interface SpotLightRenderingProps extends BaseLightRenderingProps {
  // SpotLight uses all base rendering properties
}

export interface HemisphereLightProps extends Omit<BaseLightProps, "color" | "castShadow"> {
  skyColor: string;
  groundColor: string;
  // Hemisphere lights don't cast shadows
}

export interface RectAreaLightProps extends Omit<BaseLightProps, "castShadow"> {
  width: number;
  height: number;
  // RectArea lights don't cast shadows in Three.js
}

export interface HemisphereLightRenderingProps extends BaseLightRenderingProps {
  helperSize: number;
}

export interface RectAreaLightRenderingProps extends BaseLightRenderingProps {
  // RectAreaLight uses all base rendering properties
}

export interface AmbientLightRenderingProps {
  visible: boolean;
  // Ambient lights don't have helpers
}

export interface DirectionalLightShadowProps extends BaseShadowProps {
  mapSize: "512" | "1024" | "2048";
  normalBias: number;
  cameraLeft: number;
  cameraRight: number;
  cameraTop: number;
  cameraBottom: number;
}

export interface SpotLightShadowProps extends BaseShadowProps {
  mapSize: "512" | "1024" | "2048";
  normalBias: number;
}

export interface ShadowProps extends BaseShadowProps {
  mapSizeWidth: number;
  mapSizeHeight: number;
  radius: number;
}

export type NodeProcessor<I = unknown, O = unknown> = (data: I, input?: Object3D | undefined) => O;
