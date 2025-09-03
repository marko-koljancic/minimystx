import * as THREE from "three";
import { useUIStore } from "../../store/uiStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import {
  ScreenshotCaptureDependencies,
  IScreenshotCapture,
  CaptureDimensions,
} from "./CaptureTypes";

export class ScreenshotCapture implements IScreenshotCapture {
  constructor(private dependencies: ScreenshotCaptureDependencies) {}

  public captureScreenshot(dimensions: CaptureDimensions): string {
    if (!this.dependencies.renderer || !this.dependencies.scene) {
      throw new Error("Renderer or scene not initialized");
    }

    let targetWidth = Math.floor(dimensions.width);
    let targetHeight = Math.floor(dimensions.height);

    const maxDimension = 4096;
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      const scale = Math.min(maxDimension / targetWidth, maxDimension / targetHeight);
      targetWidth = Math.floor(targetWidth * scale);
      targetHeight = Math.floor(targetHeight * scale);
    }

    const { showGridInRenderView } = useUIStore.getState();
    const originalGizmoVisibility = this.dependencies.getAxisGizmoVisibility();

    if (!dimensions.overlays.grid) {
      this.dependencies.setGridVisibility(false);
    }
    if (!dimensions.overlays.gizmos) {
      this.dependencies.setAxisGizmoVisibility(false);
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tempRenderer = new THREE.WebGLRenderer({
      canvas: tempCanvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });

    tempRenderer.setSize(targetWidth, targetHeight);
    tempRenderer.setPixelRatio(1);
    tempRenderer.shadowMap.enabled = this.dependencies.renderer.shadowMap.enabled;
    tempRenderer.shadowMap.type = this.dependencies.renderer.shadowMap.type;

    this.applyRendererSettings(tempRenderer);

    const originalBackground = this.dependencies.scene.background;
    if (dimensions.overlays.transparentBackground) {
      this.dependencies.scene.background = null;
      tempRenderer.setClearColor(new THREE.Color(0x000000), 0);
    } else {
      const clearColor = new THREE.Color();
      this.dependencies.renderer.getClearColor(clearColor);
      tempRenderer.setClearColor(clearColor, this.dependencies.renderer.getClearAlpha());
    }

    const camera = this.dependencies.getCurrentCamera();
    const originalAspect = this.getCameraAspect(camera);
    const newAspect = targetWidth / targetHeight;
    this.setCameraAspect(camera, newAspect);

    tempRenderer.render(this.dependencies.scene, camera);
    const dataURL = tempCanvas.toDataURL("image/png");

    this.dependencies.scene.background = originalBackground;
    this.setCameraAspect(camera, originalAspect);
    this.dependencies.setGridVisibility(showGridInRenderView);
    this.dependencies.setAxisGizmoVisibility(originalGizmoVisibility);

    tempRenderer.dispose();
    return dataURL;
  }

  public dispose(): void {}

  private applyRendererSettings(renderer: THREE.WebGLRenderer): void {
    const { materials } = usePreferencesStore.getState();

    switch (materials.toneMapping) {
      case "None":
        renderer.toneMapping = THREE.NoToneMapping;
        break;
      case "Linear":
        renderer.toneMapping = THREE.LinearToneMapping;
        break;
      case "Reinhard":
        renderer.toneMapping = THREE.ReinhardToneMapping;
        break;
      case "ACES Filmic":
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        break;
    }

    renderer.toneMappingExposure = materials.exposure;
    renderer.outputColorSpace = materials.sRGBEncoding
      ? THREE.SRGBColorSpace
      : THREE.LinearSRGBColorSpace;
  }

  private getCameraAspect(camera: THREE.Camera): number {
    if (camera instanceof THREE.PerspectiveCamera) {
      return camera.aspect;
    } else {
      const orthoCamera = camera as THREE.OrthographicCamera;
      return orthoCamera.right / orthoCamera.top;
    }
  }

  private setCameraAspect(camera: THREE.Camera, aspect: number): void {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    } else {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const currentHeight = orthoCamera.top - orthoCamera.bottom;
      const currentWidth = currentHeight * aspect;
      orthoCamera.left = -currentWidth / 2;
      orthoCamera.right = currentWidth / 2;
      orthoCamera.updateProjectionMatrix();
    }
  }
}
