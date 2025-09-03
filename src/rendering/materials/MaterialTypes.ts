import * as THREE from "three";
import { PreferencesState } from "../../store/uiStore";
import { RenderingSubsystem, PreferenceUpdateHandler } from "../types/SceneTypes";

export interface MaterialManagerDependencies {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
}

export interface IMaterialManager
  extends RenderingSubsystem,
    PreferenceUpdateHandler<PreferencesState["materials"]> {
  updateWireframeMode(wireframe: boolean): void;
  updateXRayMode(xRay: boolean): void;
  applyToneMapping(
    renderer: THREE.WebGLRenderer,
    toneMapping: PreferencesState["materials"]["toneMapping"]
  ): void;
}
