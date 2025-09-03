import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { PreferencesState } from "../../store/preferencesStore";
import { RenderingSubsystem, PreferenceUpdateHandler } from "../types/SceneTypes";

export interface PostProcessManagerDependencies {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  getCurrentCamera: () => THREE.Camera;
  isOrthographic: boolean;
}

export interface IPostProcessManager extends RenderingSubsystem, PreferenceUpdateHandler<PreferencesState["renderer"]["postProcessing"]> {
  readonly composer: EffectComposer | null;
  
  initializePostProcessing(): void;
  updatePostProcessing(): void;
  setSize(width: number, height: number): void;
  render(): void;
}