import * as THREE from "three";
import { usePreferencesStore, PreferencesState } from "../../store/preferencesStore";
import { useUIStore } from "../../store/uiStore";
import { MaterialManagerDependencies, IMaterialManager } from "./MaterialTypes";

export class MaterialManager implements IMaterialManager {
  private originalMaterials: WeakMap<THREE.Mesh, THREE.Material> = new WeakMap();
  private xRayMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(private dependencies: MaterialManagerDependencies) {
    this.initializeXRayMaterial();
  }

  public updateWireframeMode(wireframe: boolean): void {
    this.dependencies.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.Material) {
        if (wireframe) {
          if (!this.originalMaterials.has(object))
            this.originalMaterials.set(object, object.material);
          if ("wireframe" in object.material) {
            (object.material as THREE.Material & { wireframe: boolean }).wireframe = true;
          }
        } else {
          if ("wireframe" in object.material) {
            (object.material as THREE.Material & { wireframe: boolean }).wireframe = false;
          }
        }
      }
    });
  }

  public updateXRayMode(xRay: boolean): void {
    if (!this.xRayMaterial) return;

    this.dependencies.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (xRay) {
          if (!this.originalMaterials.has(object)) {
            this.originalMaterials.set(object, object.material);
          }
          const { wireframe } = useUIStore.getState();
          this.xRayMaterial!.wireframe = wireframe;
          object.material = this.xRayMaterial!;
        } else {
          const originalMaterial = this.originalMaterials.get(object);
          if (originalMaterial) {
            object.material = originalMaterial;
            const { wireframe } = useUIStore.getState();
            if ("wireframe" in object.material) {
              (object.material as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
            }
          }
        }
      }
    });
  }

  public applyToneMapping(
    renderer: THREE.WebGLRenderer,
    toneMapping: PreferencesState["materials"]["toneMapping"]
  ): void {
    switch (toneMapping) {
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
  }

  public updateFromPreferences(
    newMaterialsPrefs: PreferencesState["materials"],
    prevMaterialsPrefs: PreferencesState["materials"]
  ): void {
    if (newMaterialsPrefs.toneMapping !== prevMaterialsPrefs.toneMapping) {
      this.applyToneMapping(this.dependencies.renderer, newMaterialsPrefs.toneMapping);
    }

    if (newMaterialsPrefs.exposure !== prevMaterialsPrefs.exposure) {
      this.dependencies.renderer.toneMappingExposure = newMaterialsPrefs.exposure;
    }

    if (newMaterialsPrefs.sRGBEncoding !== prevMaterialsPrefs.sRGBEncoding) {
      this.dependencies.renderer.outputColorSpace = newMaterialsPrefs.sRGBEncoding
        ? THREE.SRGBColorSpace
        : THREE.LinearSRGBColorSpace;
    }
  }

  public dispose(): void {
    if (this.xRayMaterial) {
      this.xRayMaterial.dispose();
      this.xRayMaterial = null;
    }
    this.originalMaterials = new WeakMap();
  }

  private initializeXRayMaterial(): void {
    this.xRayMaterial = new THREE.MeshBasicMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.5,
    });
  }
}
