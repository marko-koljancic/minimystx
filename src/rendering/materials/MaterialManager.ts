import * as THREE from "three";
import { PreferencesState } from "../../store/preferencesStore";
import { MaterialManagerDependencies, IMaterialManager } from "./MaterialTypes";

type DisplayMode =
  | "shaded"
  | "wireframe"
  | "xray"
  | "shadedWireframe"
  | "xrayWireframe"
  | "normals"
  | "depth"
  | "normalsWireframe"
  | "depthWireframe";

export class MaterialManager implements IMaterialManager {
  private originalMaterials: WeakMap<THREE.Mesh, THREE.Material> = new WeakMap();
  private xRayMaterial: THREE.MeshBasicMaterial | null = null;
  private normalsMaterial: THREE.MeshNormalMaterial | null = null;
  private depthMaterial: THREE.MeshDepthMaterial | null = null;
  private depthMaterialOrtho: THREE.ShaderMaterial | null = null;

  constructor(private dependencies: MaterialManagerDependencies) {
    this.initializeXRayMaterial();
    this.initializeNormalsMaterial();
    this.initializeDepthMaterials();
  }

  public updateDisplayMode(mode: DisplayMode): void {
    this.dependencies.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (!this.originalMaterials.has(object)) {
          this.originalMaterials.set(object, object.material);
        }

        const originalMaterial = this.originalMaterials.get(object)!;

        switch (mode) {
          case "shaded":
            object.material = originalMaterial;
            if ("wireframe" in object.material) {
              (object.material as THREE.Material & { wireframe: boolean }).wireframe = false;
            }
            this.removePolygonOffset(object.material);
            break;

          case "shadedWireframe":
            object.material = originalMaterial;
            if ("wireframe" in object.material) {
              (object.material as THREE.Material & { wireframe: boolean }).wireframe = false;
            }
            this.addPolygonOffset(object.material);
            break;

          case "wireframe":
            object.material = originalMaterial;
            if ("wireframe" in object.material) {
              (object.material as THREE.Material & { wireframe: boolean }).wireframe = true;
            }
            this.removePolygonOffset(object.material);
            break;

          case "xray":
            if (this.xRayMaterial) {
              this.xRayMaterial.wireframe = false;
              object.material = this.xRayMaterial;
            }
            this.removePolygonOffset(object.material);
            break;

          case "xrayWireframe":
            if (this.xRayMaterial) {
              this.xRayMaterial.wireframe = false;
              object.material = this.xRayMaterial;
            }
            this.addPolygonOffset(object.material);
            break;

          case "normals":
            if (this.normalsMaterial) {
              this.normalsMaterial.wireframe = false;
              object.material = this.normalsMaterial;
            }
            this.removePolygonOffset(object.material);
            break;

          case "normalsWireframe":
            if (this.normalsMaterial) {
              this.normalsMaterial.wireframe = false;
              object.material = this.normalsMaterial;
            }
            this.addPolygonOffset(object.material);
            break;

          case "depth":
            const depthMat = this.getDepthMaterial();
            if (depthMat) {
              if ("wireframe" in depthMat) {
                (depthMat as any).wireframe = false;
              }
              object.material = depthMat;
            }
            this.removePolygonOffset(object.material);
            break;

          case "depthWireframe":
            const depthWireMat = this.getDepthMaterial();
            if (depthWireMat) {
              if ("wireframe" in depthWireMat) {
                (depthWireMat as any).wireframe = false;
              }
              object.material = depthWireMat;
            }
            this.addPolygonOffset(object.material);
            break;
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

  private getDepthMaterial(): THREE.Material | null {
    return this.depthMaterial;
  }

  public updateDepthMaterialUniforms(camera: THREE.Camera): void {
    if (this.depthMaterialOrtho && camera instanceof THREE.OrthographicCamera) {
      this.depthMaterialOrtho.uniforms.cameraNear.value = camera.near;
      this.depthMaterialOrtho.uniforms.cameraFar.value = camera.far;
    }
  }

  public dispose(): void {
    if (this.xRayMaterial) {
      this.xRayMaterial.dispose();
      this.xRayMaterial = null;
    }
    if (this.normalsMaterial) {
      this.normalsMaterial.dispose();
      this.normalsMaterial = null;
    }
    if (this.depthMaterial) {
      this.depthMaterial.dispose();
      this.depthMaterial = null;
    }
    if (this.depthMaterialOrtho) {
      this.depthMaterialOrtho.dispose();
      this.depthMaterialOrtho = null;
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

  private initializeNormalsMaterial(): void {
    this.normalsMaterial = new THREE.MeshNormalMaterial();
  }

  private initializeDepthMaterials(): void {
    this.depthMaterial = new THREE.MeshDepthMaterial();

    this.depthMaterialOrtho = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float cameraNear;
        uniform float cameraFar;
        varying float vLinearDepth;
        
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vLinearDepth = (-mvPosition.z - cameraNear) / (cameraFar - cameraNear);
        }
      `,
      fragmentShader: `
        varying float vLinearDepth;
        
        void main() {
          float depth = clamp(vLinearDepth, 0.0, 1.0);
          gl_FragColor = vec4(vec3(depth), 1.0);
        }
      `,
      uniforms: {
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000.0 },
      },
    });
  }

  private addPolygonOffset(material: THREE.Material): void {
    if ("polygonOffset" in material) {
      (material as any).polygonOffset = true;
      (material as any).polygonOffsetFactor = 1;
      (material as any).polygonOffsetUnits = 1;
    }
  }

  private removePolygonOffset(material: THREE.Material): void {
    if ("polygonOffset" in material) {
      (material as any).polygonOffset = false;
      (material as any).polygonOffsetFactor = 0;
      (material as any).polygonOffsetUnits = 0;
    }
  }
}
