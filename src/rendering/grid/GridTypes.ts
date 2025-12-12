import * as THREE from "three";
import { PreferencesState } from "../../store/preferencesStore";
import { RenderingSubsystem, PreferenceUpdateHandler, GridPlane } from "../types/SceneTypes";

export interface GridSystemDependencies {
  scene: THREE.Scene;
}

export interface GridConfiguration {
  majorSpacing: number;
  minorSubdivisions: number;
  majorGridLines: number;
  enabled: boolean;
}

export interface IGridSystem extends RenderingSubsystem, PreferenceUpdateHandler<PreferencesState["guides"]["grid"]> {
  showGridPlane(plane: GridPlane): void;
  updateGridVisibility(visible: boolean): void;
  recreateGridsFromPreferences(): void;
}
