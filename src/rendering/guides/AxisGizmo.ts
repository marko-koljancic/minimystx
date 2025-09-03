import * as THREE from "three";
import { useUIStore, PreferencesState } from "../../store/uiStore";
import { AxisGizmoDependencies, IAxisGizmo } from "./GuideTypes";
import { GizmoSize } from "../types/SceneTypes";

export class AxisGizmo implements IAxisGizmo {
  private _gizmo: THREE.Group | null = null;

  constructor(private dependencies: AxisGizmoDependencies) {
    this.createAxisGizmo();
  }

  public get gizmo(): THREE.Group | null {
    return this._gizmo;
  }

  public updateAxisGizmo(): void {
    if (!this._gizmo) return;

    const { preferences } = useUIStore.getState();
    const userSize = this.getGizmoSize(preferences.guides.axisGizmo.size);

    const camera = this.dependencies.getCurrentCamera();

    if (this.dependencies.isOrthographic) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const left = orthoCamera.left / orthoCamera.zoom;
      const right = orthoCamera.right / orthoCamera.zoom;
      const top = orthoCamera.top / orthoCamera.zoom;
      const bottom = orthoCamera.bottom / orthoCamera.zoom;
      const maxExtentX = Math.max(Math.abs(left), Math.abs(right));
      const maxExtentY = Math.max(Math.abs(top), Math.abs(bottom));
      const maxExtentZ = maxExtentX;

      const children = this._gizmo.children as THREE.Line[];
      if (children.length >= 3) {
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-maxExtentX, 0, 0),
          new THREE.Vector3(maxExtentX, 0, 0),
        ]);
        children[0].geometry.dispose();
        children[0].geometry = xGeometry;

        const yGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, -maxExtentY, 0),
          new THREE.Vector3(0, maxExtentY, 0),
        ]);
        children[1].geometry.dispose();
        children[1].geometry = yGeometry;

        const zGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, -maxExtentZ),
          new THREE.Vector3(0, 0, maxExtentZ),
        ]);
        children[2].geometry.dispose();
        children[2].geometry = zGeometry;
      }
    } else {
      const axisLength = userSize;
      const children = this._gizmo.children as THREE.Line[];
      if (children.length >= 3) {
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(axisLength, 0, 0),
        ]);
        children[0].geometry.dispose();
        children[0].geometry = xGeometry;

        const yGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, axisLength, 0),
        ]);
        children[1].geometry.dispose();
        children[1].geometry = yGeometry;

        const zGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 0, axisLength),
        ]);
        children[2].geometry.dispose();
        children[2].geometry = zGeometry;
      }
    }
  }

  public updateVisibility(visible: boolean): void {
    if (this._gizmo) {
      this._gizmo.visible = visible;
    }
  }

  public updateFromPreferences(
    newGizmoPrefs: PreferencesState["guides"]["axisGizmo"],
    prevGizmoPrefs: PreferencesState["guides"]["axisGizmo"]
  ): void {
    if (
      newGizmoPrefs.enabled !== prevGizmoPrefs.enabled ||
      newGizmoPrefs.size !== prevGizmoPrefs.size
    ) {
      this.createAxisGizmo();
    }
  }

  public dispose(): void {
    if (this._gizmo) {
      this.dependencies.scene.remove(this._gizmo);
      this._gizmo.traverse((child) => {
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      this._gizmo = null;
    }
  }

  private createAxisGizmo(): void {
    if (this._gizmo) {
      this.dispose();
    }

    const { preferences, showAxisGizmo } = useUIStore.getState();
    const size = this.getGizmoSize(preferences.guides.axisGizmo.size);

    this._gizmo = new THREE.Group();

    const xMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      linewidth: 2,
      transparent: false,
    });
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(size, 0, 0),
    ]);
    const xLine = new THREE.Line(xGeometry, xMaterial);
    this._gizmo.add(xLine);

    const yMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
      transparent: false,
    });
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, size, 0),
    ]);
    const yLine = new THREE.Line(yGeometry, yMaterial);
    this._gizmo.add(yLine);

    const zMaterial = new THREE.LineBasicMaterial({
      color: 0x0000ff,
      linewidth: 2,
      transparent: false,
    });
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, size),
    ]);
    const zLine = new THREE.Line(zGeometry, zMaterial);
    this._gizmo.add(zLine);

    this._gizmo.visible = showAxisGizmo && preferences.guides.axisGizmo.enabled;
    this.dependencies.scene.add(this._gizmo);
    this.updateAxisGizmo();
  }

  private getGizmoSize(size: GizmoSize): number {
    switch (size) {
      case "Small":
        return 1.0;
      case "Medium":
        return 2.5;
      case "Large":
        return 4.0;
      default:
        return 1.0;
    }
  }
}
