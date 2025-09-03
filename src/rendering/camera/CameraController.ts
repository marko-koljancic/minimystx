import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useUIStore, PreferencesState } from "../../store/uiStore";
import { CameraControllerDependencies, ICameraController } from "./CameraTypes";
import { ViewType, GridPlane } from "../types/SceneTypes";

export class CameraController implements ICameraController {
  public readonly controls: OrbitControls;
  private _isOrthographic: boolean = false;

  constructor(private dependencies: CameraControllerDependencies) {
    const { preferences } = useUIStore.getState();
    const { camera: cameraPrefs } = preferences;

    this._isOrthographic = cameraPrefs.defaultType === "orthographic";

    this.controls = new OrbitControls(this.getCurrentCamera(), this.dependencies.canvas);
    this.controls.target.set(0, 0, 0);
    this.updateOrbitControlsFromPreferences();
    this.controls.update();
    this.updateCameraControls();
  }

  public get isOrthographic(): boolean {
    return this._isOrthographic;
  }

  public getCurrentCamera(): THREE.Camera {
    return this._isOrthographic ? this.dependencies.orthographicCamera : this.dependencies.camera;
  }

  public setCameraMode(isOrthographic: boolean): void {
    if (this._isOrthographic === isOrthographic) return;

    const currentCamera = this.getCurrentCamera();
    const newCamera = isOrthographic
      ? this.dependencies.orthographicCamera
      : this.dependencies.camera;
    const target = this.controls.target.clone();

    if (isOrthographic) {
      newCamera.position.copy(currentCamera.position);
      newCamera.up.copy(currentCamera.up);
      newCamera.lookAt(target);
    } else {
      newCamera.up.set(0, 1, 0);
      const distance = Math.max(currentCamera.position.distanceTo(target), 10);
      newCamera.position.set(
        target.x + distance * 0.7,
        target.y + distance * 0.5,
        target.z + distance * 0.7
      );
      newCamera.lookAt(target);
    }

    this.controls.object = newCamera;
    this.controls.update();
    this._isOrthographic = isOrthographic;
    this.updateCameraControls();
  }

  public setCameraView(view: ViewType): void {
    if (!this.controls) return;

    const currentTarget = this.controls.target.clone();
    const camera = this.getCurrentCamera();
    const distance = camera.position.distanceTo(currentTarget);
    const standardDistance = Math.max(distance, 10);

    switch (view) {
      case "top":
        camera.position.set(currentTarget.x, currentTarget.y + standardDistance, currentTarget.z);
        camera.up.set(0, 0, -1);
        break;
      case "front":
        camera.position.set(currentTarget.x, currentTarget.y, currentTarget.z + standardDistance);
        camera.up.set(0, 1, 0);
        break;
      case "left":
        camera.position.set(currentTarget.x - standardDistance, currentTarget.y, currentTarget.z);
        camera.up.set(0, 1, 0);
        break;
      case "right":
        camera.position.set(currentTarget.x + standardDistance, currentTarget.y, currentTarget.z);
        camera.up.set(0, 1, 0);
        break;
      case "bottom":
        camera.position.set(currentTarget.x, currentTarget.y - standardDistance, currentTarget.z);
        camera.up.set(0, 0, 1);
        break;
    }

    camera.lookAt(currentTarget);
    this.controls.update();
  }

  public handleResize(width: number, height: number): void {
    const aspect = width / height;

    this.dependencies.camera.aspect = aspect;
    this.dependencies.camera.updateProjectionMatrix();

    const { preferences } = useUIStore.getState();
    const frustumSize = preferences.camera.orthoScale;
    this.dependencies.orthographicCamera.left = (-frustumSize * aspect) / 2;
    this.dependencies.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.dependencies.orthographicCamera.top = frustumSize / 2;
    this.dependencies.orthographicCamera.bottom = -frustumSize / 2;
    this.dependencies.orthographicCamera.updateProjectionMatrix();
  }

  public updateCameraControls(): void {
    if (!this.controls) return;

    if (this._isOrthographic) {
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = Math.PI;
    } else {
      this.controls.minPolarAngle = 0.1;
      this.controls.maxPolarAngle = Math.PI - 0.1;
    }
  }

  public updateFromPreferences(
    newCameraPrefs: PreferencesState["camera"],
    prevCameraPrefs: PreferencesState["camera"]
  ): void {
    if (!this.dependencies.camera || !this.dependencies.orthographicCamera || !this.controls)
      return;

    let needsProjectionUpdate = false;

    if (newCameraPrefs.perspectiveFOV !== prevCameraPrefs.perspectiveFOV) {
      this.dependencies.camera.fov = newCameraPrefs.perspectiveFOV;
      needsProjectionUpdate = true;
    }

    if (
      newCameraPrefs.clippingNear !== prevCameraPrefs.clippingNear ||
      newCameraPrefs.clippingFar !== prevCameraPrefs.clippingFar
    ) {
      this.dependencies.camera.near = newCameraPrefs.clippingNear;
      this.dependencies.camera.far = newCameraPrefs.clippingFar;
      this.dependencies.orthographicCamera.near = newCameraPrefs.clippingNear;
      this.dependencies.orthographicCamera.far = newCameraPrefs.clippingFar;
      needsProjectionUpdate = true;
    }

    if (newCameraPrefs.orthoScale !== prevCameraPrefs.orthoScale) {
      const canvas = this.dependencies.renderer.domElement;
      const aspect = canvas.width / canvas.height;
      const frustumSize = newCameraPrefs.orthoScale;

      this.dependencies.orthographicCamera.left = (-frustumSize * aspect) / 2;
      this.dependencies.orthographicCamera.right = (frustumSize * aspect) / 2;
      this.dependencies.orthographicCamera.top = frustumSize / 2;
      this.dependencies.orthographicCamera.bottom = -frustumSize / 2;
      needsProjectionUpdate = true;
    }

    if (needsProjectionUpdate) {
      this.dependencies.camera.updateProjectionMatrix();
      this.dependencies.orthographicCamera.updateProjectionMatrix();
    }

    if (newCameraPrefs.defaultType !== prevCameraPrefs.defaultType) {
      const shouldBeOrthographic = newCameraPrefs.defaultType === "orthographic";
      if (this._isOrthographic !== shouldBeOrthographic) {
        this.setCameraMode(shouldBeOrthographic);
      }
    }

    if (
      JSON.stringify(newCameraPrefs.orbitControls) !== JSON.stringify(prevCameraPrefs.orbitControls)
    ) {
      this.updateOrbitControlsFromPreferences();
    }
  }

  public getGridPlaneForView(view: ViewType): GridPlane {
    switch (view) {
      case "top":
      case "bottom":
        return "xz";
      case "front":
        return "xy";
      case "left":
      case "right":
        return "yz";
      default:
        return "xz";
    }
  }

  public dispose(): void {
    this.controls.dispose();
  }

  private updateOrbitControlsFromPreferences(): void {
    if (!this.controls) return;

    const { preferences } = useUIStore.getState();
    const { orbitControls } = preferences.camera;

    this.controls.rotateSpeed = orbitControls.rotateSpeed;
    this.controls.panSpeed = orbitControls.panSpeed;
    this.controls.zoomSpeed = orbitControls.dollySpeed;
    this.controls.enableDamping = orbitControls.dampingEnabled;
    this.controls.dampingFactor = orbitControls.dampingEnabled ? 0.05 : 0;
  }
}
