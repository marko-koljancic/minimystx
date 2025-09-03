import * as THREE from "three";
import { usePreferencesStore, PreferencesState } from "../../store/preferencesStore"
import { useUIStore } from "../../store/uiStore";
import { GridSystemDependencies, IGridSystem } from "./GridTypes";
import { GridPlane } from "../types/SceneTypes";

export class GridSystem implements IGridSystem {
  private xyMajorGrid: THREE.GridHelper | null = null;
  private xyMinorGrid: THREE.GridHelper | null = null;
  private xzMajorGrid: THREE.GridHelper | null = null;
  private xzMinorGrid: THREE.GridHelper | null = null;
  private yzMajorGrid: THREE.GridHelper | null = null;
  private yzMinorGrid: THREE.GridHelper | null = null;
  private currentGridPlane: GridPlane = "xz";

  constructor(private dependencies: GridSystemDependencies) {
    this.createTwoLevelGrids();
    this.showGridPlane("xz");
  }

  public showGridPlane(plane: GridPlane): void {
    if (this.currentGridPlane === plane) return;

    this.currentGridPlane = plane;
    const { showGridInRenderView } = useUIStore.getState();
    const { guides } = usePreferencesStore.getState();

    this.hideAllGrids();

    if (showGridInRenderView && guides.grid.enabled) {
      switch (plane) {
        case "xy":
          if (this.xyMinorGrid) this.xyMinorGrid.visible = true;
          if (this.xyMajorGrid) this.xyMajorGrid.visible = true;
          break;
        case "xz":
          if (this.xzMinorGrid) this.xzMinorGrid.visible = true;
          if (this.xzMajorGrid) this.xzMajorGrid.visible = true;
          break;
        case "yz":
          if (this.yzMinorGrid) this.yzMinorGrid.visible = true;
          if (this.yzMajorGrid) this.yzMajorGrid.visible = true;
          break;
      }
    }
  }

  public updateGridVisibility(visible: boolean): void {
    const { guides } = usePreferencesStore.getState();
    const gridEnabled = guides.grid.enabled;

    this.hideAllGrids();

    if (visible && gridEnabled) {
      switch (this.currentGridPlane) {
        case "xy":
          if (this.xyMinorGrid) this.xyMinorGrid.visible = true;
          if (this.xyMajorGrid) this.xyMajorGrid.visible = true;
          break;
        case "xz":
          if (this.xzMinorGrid) this.xzMinorGrid.visible = true;
          if (this.xzMajorGrid) this.xzMajorGrid.visible = true;
          break;
        case "yz":
          if (this.yzMinorGrid) this.yzMinorGrid.visible = true;
          if (this.yzMajorGrid) this.yzMajorGrid.visible = true;
          break;
      }
    }
  }

  public recreateGridsFromPreferences(): void {
    this.disposeGrids();
    this.createTwoLevelGrids();
    const { showGridInRenderView } = useUIStore.getState();
    this.updateGridVisibility(showGridInRenderView);
  }

  public updateFromPreferences(
    newGridPrefs: PreferencesState["guides"]["grid"],
    prevGridPrefs: PreferencesState["guides"]["grid"]
  ): void {
    if (
      newGridPrefs.enabled !== prevGridPrefs.enabled ||
      newGridPrefs.majorSpacing !== prevGridPrefs.majorSpacing ||
      newGridPrefs.minorSubdivisions !== prevGridPrefs.minorSubdivisions ||
      newGridPrefs.majorGridLines !== prevGridPrefs.majorGridLines
    ) {
      this.recreateGridsFromPreferences();
    }
  }

  public dispose(): void {
    this.disposeGrids();
  }

  private createTwoLevelGrids(): void {
    const { guides } = usePreferencesStore.getState();
    const { majorSpacing, minorSubdivisions, majorGridLines } = guides.grid;

    const gridSize = majorGridLines * majorSpacing;
    const majorDivisions = majorGridLines;
    const minorDivisions = majorDivisions * minorSubdivisions;

    this.createGridPair(gridSize, majorDivisions, minorDivisions, "xz");
    this.createGridPair(gridSize, majorDivisions, minorDivisions, "xy");
    this.createGridPair(gridSize, majorDivisions, minorDivisions, "yz");
  }

  private createGridPair(
    size: number,
    majorDivisions: number,
    minorDivisions: number,
    plane: GridPlane
  ): void {
    const minorGrid = new THREE.GridHelper(size, minorDivisions);
    this.setupGridMaterial(minorGrid, false);

    const majorGrid = new THREE.GridHelper(size, majorDivisions);
    this.setupGridMaterial(majorGrid, true);

    switch (plane) {
      case "xy":
        minorGrid.rotateX(Math.PI / 2);
        majorGrid.rotateX(Math.PI / 2);
        this.xyMinorGrid = minorGrid;
        this.xyMajorGrid = majorGrid;
        break;
      case "xz":
        this.xzMinorGrid = minorGrid;
        this.xzMajorGrid = majorGrid;
        break;
      case "yz":
        minorGrid.rotateZ(Math.PI / 2);
        majorGrid.rotateZ(Math.PI / 2);
        this.yzMinorGrid = minorGrid;
        this.yzMajorGrid = majorGrid;
        break;
    }

    minorGrid.visible = false;
    majorGrid.visible = false;

    this.dependencies.scene.add(minorGrid);
    this.dependencies.scene.add(majorGrid);
  }

  private setupGridMaterial(grid: THREE.GridHelper, isMajor: boolean): void {
    grid.material.color.setHex(0xffffff);
    const material = grid.material as THREE.LineBasicMaterial & { color2?: THREE.Color };
    material.color2?.setHex(0xffffff);

    grid.material.opacity = isMajor ? 0.5 : 0.2;
    grid.material.transparent = true;
  }

  private hideAllGrids(): void {
    if (this.xyMinorGrid) this.xyMinorGrid.visible = false;
    if (this.xyMajorGrid) this.xyMajorGrid.visible = false;
    if (this.xzMinorGrid) this.xzMinorGrid.visible = false;
    if (this.xzMajorGrid) this.xzMajorGrid.visible = false;
    if (this.yzMinorGrid) this.yzMinorGrid.visible = false;
    if (this.yzMajorGrid) this.yzMajorGrid.visible = false;
  }

  private disposeGrids(): void {
    const grids = [
      this.xyMinorGrid,
      this.xyMajorGrid,
      this.xzMinorGrid,
      this.xzMajorGrid,
      this.yzMinorGrid,
      this.yzMajorGrid,
    ];

    for (const grid of grids) {
      if (grid) {
        this.dependencies.scene.remove(grid);
        grid.dispose();
      }
    }

    this.xyMinorGrid = null;
    this.xyMajorGrid = null;
    this.xzMinorGrid = null;
    this.xzMajorGrid = null;
    this.yzMinorGrid = null;
    this.yzMajorGrid = null;
  }
}
