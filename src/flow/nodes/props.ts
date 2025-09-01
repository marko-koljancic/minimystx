import { Material, Object3D, BufferGeometry } from "three";
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
export interface BaseLightProps {
  color: string;
  intensity: number;
  visible: boolean;
  castShadow: boolean;
}
export interface BaseLightRenderingProps {
  visible: boolean;
  showHelper: boolean;
}
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
}
export interface DirectionalLightProps extends BaseLightProps {
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
}
export interface HemisphereLightProps extends Omit<BaseLightProps, "color" | "castShadow"> {
  skyColor: string;
  groundColor: string;
}
export interface RectAreaLightProps extends Omit<BaseLightProps, "castShadow"> {
  width: number;
  height: number;
}
export interface HemisphereLightRenderingProps extends BaseLightRenderingProps {
  helperSize: number;
}
export interface RectAreaLightRenderingProps extends BaseLightRenderingProps {}
export interface AmbientLightRenderingProps {
  visible: boolean;
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
export type NodeProcessor<I = unknown, O = unknown> = (
  data: I,
  input?: { object: Object3D; geometry?: BufferGeometry } | undefined
) => O;
