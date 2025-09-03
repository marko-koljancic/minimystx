import * as THREE from "three";

export interface SceneManagerDependencies {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  orthographicCamera: THREE.OrthographicCamera;
}

export interface RenderingSubsystem {
  dispose(): void;
}

export interface PreferenceUpdateHandler<T> {
  updateFromPreferences(newPrefs: T, prevPrefs: T): void;
}

export type ViewType = "top" | "front" | "left" | "right" | "bottom" | "perspective";
export type GridPlane = "xy" | "xz" | "yz";
export type GizmoSize = "Small" | "Medium" | "Large";