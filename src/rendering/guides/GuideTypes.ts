import * as THREE from "three";
import { PreferencesState } from "../../store/uiStore";
import { RenderingSubsystem, PreferenceUpdateHandler } from "../types/SceneTypes";

export interface AxisGizmoDependencies {
  scene: THREE.Scene;
  getCurrentCamera: () => THREE.Camera;
  isOrthographic: boolean;
}

export interface GroundPlaneDependencies {
  scene: THREE.Scene;
}

export interface IAxisGizmo
  extends RenderingSubsystem,
    PreferenceUpdateHandler<PreferencesState["guides"]["axisGizmo"]> {
  readonly gizmo: THREE.Group | null;

  updateAxisGizmo(): void;
  updateVisibility(visible: boolean): void;
}

export interface IGroundPlane
  extends RenderingSubsystem,
    PreferenceUpdateHandler<PreferencesState["guides"]["groundPlane"]> {
  readonly groundPlane: THREE.Mesh | null;

  recreateGroundPlane(): void;
  updateVisibility(visible: boolean): void;
}
