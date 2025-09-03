import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PreferencesState } from "../../store/preferencesStore";
import { RenderingSubsystem, PreferenceUpdateHandler, ViewType } from "../types/SceneTypes";

export interface CameraControllerDependencies {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  orthographicCamera: THREE.OrthographicCamera;
  canvas: HTMLCanvasElement;
}

export interface ICameraController
  extends RenderingSubsystem,
    PreferenceUpdateHandler<PreferencesState["camera"]> {
  readonly controls: OrbitControls;
  readonly isOrthographic: boolean;

  getCurrentCamera(): THREE.Camera;
  setCameraMode(isOrthographic: boolean): void;
  setCameraView(view: ViewType): void;
  handleResize(width: number, height: number): void;
  updateCameraControls(): void;
}
