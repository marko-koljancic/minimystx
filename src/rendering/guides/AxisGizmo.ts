import * as THREE from "three";
import { usePreferencesStore, PreferencesState } from "../../store/preferencesStore";
import { useCameraStore } from "../../store/cameraStore";
import { AxisGizmoDependencies, IAxisGizmo } from "./GuideTypes";
import { GizmoSize } from "../types/SceneTypes";

export class AxisGizmo implements IAxisGizmo {
  private _gizmo: THREE.Group | null = null;
  // Cache of the last applied line extents. updateAxisGizmo runs every frame from
  // the render loop; geometry positions are only rewritten when this changes
  // (camera zoom in ortho, size preference), never allocated per frame.
  private lastExtentsKey = "";

  constructor(private dependencies: AxisGizmoDependencies) {
    this.createAxisGizmo();
  }

  public get gizmo(): THREE.Group | null {
    return this._gizmo;
  }

  public updateAxisGizmo(): void {
    if (!this._gizmo) return;

    const preferences = usePreferencesStore.getState();
    const userSize = this.getGizmoSize(preferences.guides.axisGizmo.size);
    const camera = this.dependencies.getCurrentCamera();

    let extentX: number;
    let extentY: number;
    let extentZ: number;
    let centered: boolean;
    if (this.dependencies.isOrthographic) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const left = orthoCamera.left / orthoCamera.zoom;
      const right = orthoCamera.right / orthoCamera.zoom;
      const top = orthoCamera.top / orthoCamera.zoom;
      const bottom = orthoCamera.bottom / orthoCamera.zoom;
      extentX = Math.max(Math.abs(left), Math.abs(right));
      extentY = Math.max(Math.abs(top), Math.abs(bottom));
      extentZ = extentX;
      centered = true;
    } else {
      extentX = userSize;
      extentY = userSize;
      extentZ = userSize;
      centered = false;
    }

    const key = `${centered ? "o" : "p"}:${extentX}:${extentY}:${extentZ}`;
    if (key === this.lastExtentsKey) return;
    this.lastExtentsKey = key;

    const children = this._gizmo.children as THREE.Line[];
    if (children.length < 3) return;
    this.setLineExtent(children[0], new THREE.Vector3(1, 0, 0), extentX, centered);
    this.setLineExtent(children[1], new THREE.Vector3(0, 1, 0), extentY, centered);
    this.setLineExtent(children[2], new THREE.Vector3(0, 0, 1), extentZ, centered);
  }

  // Rewrite a line's two endpoints in place (no allocation, no dispose).
  private setLineExtent(line: THREE.Line, axis: THREE.Vector3, extent: number, centered: boolean): void {
    const position = line.geometry.attributes.position as THREE.BufferAttribute;
    const start = centered ? -extent : 0;
    position.setXYZ(0, axis.x * start, axis.y * start, axis.z * start);
    position.setXYZ(1, axis.x * extent, axis.y * extent, axis.z * extent);
    position.needsUpdate = true;
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
    if (newGizmoPrefs.enabled !== prevGizmoPrefs.enabled || newGizmoPrefs.size !== prevGizmoPrefs.size) {
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

    const { showAxisGizmo } = useCameraStore.getState();
    const preferences = usePreferencesStore.getState();
    const size = this.getGizmoSize(preferences.guides.axisGizmo.size);

    this._gizmo = new THREE.Group();
    this.lastExtentsKey = "";

    const axes: Array<{ color: number; direction: THREE.Vector3 }> = [
      { color: 0xff0000, direction: new THREE.Vector3(1, 0, 0) },
      { color: 0x00ff00, direction: new THREE.Vector3(0, 1, 0) },
      { color: 0x0000ff, direction: new THREE.Vector3(0, 0, 1) },
    ];
    for (const { color, direction } of axes) {
      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        transparent: false,
      });
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        direction.clone().multiplyScalar(size),
      ]);
      const line = new THREE.Line(geometry, material);
      // Endpoints are rewritten in place as the camera zooms; skip culling rather
      // than recomputing bounding spheres per change.
      line.frustumCulled = false;
      this._gizmo.add(line);
    }

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
