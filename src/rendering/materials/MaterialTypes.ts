import * as THREE from "three";
import { PreferencesState } from "../../store/preferencesStore";
import { RenderingSubsystem, PreferenceUpdateHandler } from "../types/SceneTypes";

export interface MaterialManagerDependencies {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
}

type DisplayMode = "shaded" | "wireframe" | "xray" | "shadedWireframe" | "xrayWireframe" | "normals" | "depth" | "normalsWireframe" | "depthWireframe";

export interface IMaterialManager
  extends RenderingSubsystem,
    PreferenceUpdateHandler<PreferencesState["materials"]> {
  updateDisplayMode(mode: DisplayMode): void;
  applyToneMapping(
    renderer: THREE.WebGLRenderer,
    toneMapping: PreferencesState["materials"]["toneMapping"]
  ): void;
}
