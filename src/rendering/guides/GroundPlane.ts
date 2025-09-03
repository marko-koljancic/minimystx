import * as THREE from "three";
import { usePreferencesStore, PreferencesState } from "../../store/preferencesStore";
import { GroundPlaneDependencies, IGroundPlane } from "./GuideTypes";

export class GroundPlane implements IGroundPlane {
  private _groundPlane: THREE.Mesh | null = null;

  constructor(private dependencies: GroundPlaneDependencies) {
    this.createGroundPlane();
  }

  public get groundPlane(): THREE.Mesh | null {
    return this._groundPlane;
  }

  public recreateGroundPlane(): void {
    this.createGroundPlane();
  }

  public updateVisibility(visible: boolean): void {
    if (this._groundPlane) {
      this._groundPlane.visible = visible;
    }
  }

  public updateFromPreferences(
    newGroundPlanePrefs: PreferencesState["guides"]["groundPlane"],
    prevGroundPlanePrefs: PreferencesState["guides"]["groundPlane"]
  ): void {
    if (
      newGroundPlanePrefs.enabled !== prevGroundPlanePrefs.enabled ||
      newGroundPlanePrefs.shadowsEnabled !== prevGroundPlanePrefs.shadowsEnabled ||
      newGroundPlanePrefs.elevation !== prevGroundPlanePrefs.elevation
    ) {
      this.recreateGroundPlane();
    }
  }

  public dispose(): void {
    if (this._groundPlane) {
      this.dependencies.scene.remove(this._groundPlane);
      this._groundPlane.geometry.dispose();
      if (this._groundPlane.material instanceof THREE.Material) {
        this._groundPlane.material.dispose();
      }
      this._groundPlane = null;
    }
  }

  private createGroundPlane(): void {
    if (this._groundPlane) {
      this.dispose();
    }

    const preferences = usePreferencesStore.getState();
    const { enabled, shadowsEnabled, elevation } = preferences.guides.groundPlane;

    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.ShadowMaterial({
      opacity: 0.3,
      transparent: true,
    });

    this._groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this._groundPlane.rotation.x = -Math.PI / 2;
    this._groundPlane.position.y = elevation;
    this._groundPlane.receiveShadow = shadowsEnabled;
    this._groundPlane.visible = enabled;

    this.dependencies.scene.add(this._groundPlane);
  }
}
