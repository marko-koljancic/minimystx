import * as THREE from "three";
import { RenderingSubsystem } from "../types/SceneTypes";

export interface ScreenshotCaptureDependencies {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  getCurrentCamera: () => THREE.Camera;
  setGridVisibility: (visible: boolean) => void;
  setAxisGizmoVisibility: (visible: boolean) => void;
  getAxisGizmoVisibility: () => boolean;
}

export interface CaptureOverlays {
  transparentBackground: boolean;
  grid: boolean;
  gizmos: boolean;
}

export interface CaptureDimensions {
  width: number;
  height: number;
  multiplier: number | null;
  overlays: CaptureOverlays;
}

export interface IScreenshotCapture extends RenderingSubsystem {
  captureScreenshot(dimensions: CaptureDimensions): string;
}
