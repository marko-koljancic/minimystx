import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { useGraphStore } from "../engine/graphStore";
import { useUIStore, PreferencesState } from "../store/uiStore";
import { Object3DContainer } from "../engine/containers/BaseContainer";
export class SceneManager {
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private orthographicCamera!: THREE.OrthographicCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private uiStoreUnsubscribe: (() => void) | null = null;
  private nodeObjects: Map<string, THREE.Object3D> = new Map();
  private gridHelper: THREE.GridHelper | null = null;
  private xyGrid: THREE.GridHelper | null = null;
  private xzGrid: THREE.GridHelper | null = null;
  private yzGrid: THREE.GridHelper | null = null;

  // Two-level grid system
  private xyMajorGrid: THREE.GridHelper | null = null;
  private xyMinorGrid: THREE.GridHelper | null = null;
  private xzMajorGrid: THREE.GridHelper | null = null;
  private xzMinorGrid: THREE.GridHelper | null = null;
  private yzMajorGrid: THREE.GridHelper | null = null;
  private yzMinorGrid: THREE.GridHelper | null = null;
  private currentGridPlane: "xy" | "xz" | "yz" = "xz";
  private originalMaterials: WeakMap<THREE.Mesh, THREE.Material> = new WeakMap();
  private xRayMaterial: THREE.MeshBasicMaterial | null = null;
  private axisGizmo: THREE.Group | null = null;
  private groundPlane: THREE.Mesh | null = null;
  private isOrthographic = false;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private ssaoPass: SSAOPass | null = null;
  private fitViewHandler = () => {
    this.fitView();
  };
  private getCameraDataHandler = (event: CustomEvent) => {
    if (this.camera && this.controls) {
      const cameraData = {
        position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
      };
      (event as unknown as { cameraData?: typeof cameraData }).cameraData = cameraData;
    }
  };
  private setCameraDataHandler = (event: CustomEvent) => {
    const cameraData = event.detail;
    if (cameraData && this.camera && this.controls) {
      this.camera.position.set(
        cameraData.position[0],
        cameraData.position[1],
        cameraData.position[2]
      );
      this.controls.target.set(cameraData.target[0], cameraData.target[1], cameraData.target[2]);
      this.controls.update();
    }
  };
  private setCameraModeHandler = (event: CustomEvent) => {
    const { isOrthographic } = event.detail;
    this.setCameraMode(isOrthographic);
  };
  private setCameraViewHandler = (event: CustomEvent) => {
    const { view } = event.detail;
    this.setCameraView(view);
  };
  private toggleAxisGizmoHandler = () => {
    this.toggleAxisGizmo();
  };
  constructor(canvas: HTMLCanvasElement) {
    this.initializeThreeJS(canvas);
    this.initializeGrid();
    this.initializeXRayMaterial();
    this.initializeAxisGizmo();
    this.initializeGroundPlane();
    this.subscribeToStore();
    this.subscribeToUIStore();
    this.setupEventListeners();

    // Initialize post-processing if enabled in preferences
    const { preferences: currentPrefs } = useUIStore.getState();
    if (currentPrefs.renderer.postProcessing.enabled) {
      this.updatePostProcessing();
    }

    this.startRenderLoop();
    setTimeout(() => {
      this.updateSceneBackground();
      const { showGridInRenderView } = useUIStore.getState();
      this.updateGridVisibility(showGridInRenderView);
    }, 50);
    setTimeout(() => {
      this.updateSceneBackground();
      const { showGridInRenderView } = useUIStore.getState();
      this.updateGridVisibility(showGridInRenderView);
    }, 200);
    setTimeout(() => {
      this.updateSceneBackground();
      const { showGridInRenderView } = useUIStore.getState();
      this.updateGridVisibility(showGridInRenderView);
    }, 500);
  }
  private initializeThreeJS(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x191919);
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    const aspect = width / height;

    const { preferences } = useUIStore.getState();
    const { camera: cameraPrefs, renderer: rendererPrefs } = preferences;

    this.camera = new THREE.PerspectiveCamera(
      cameraPrefs.perspectiveFOV,
      aspect,
      cameraPrefs.clippingNear,
      cameraPrefs.clippingFar
    );
    this.camera.position.set(5, 2, 5);
    this.camera.lookAt(0, 0, 0);

    const frustumSize = cameraPrefs.orthoScale;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      cameraPrefs.clippingNear,
      cameraPrefs.clippingFar
    );
    this.orthographicCamera.position.set(5, 2, 5);
    this.orthographicCamera.lookAt(0, 0, 0);

    this.isOrthographic = cameraPrefs.defaultType === "orthographic";

    const shouldUseAntialiasing = rendererPrefs.antialiasing !== "none";
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: shouldUseAntialiasing,
    });
    this.renderer.setSize(width, height);

    const effectivePixelRatio = Math.min(window.devicePixelRatio, rendererPrefs.pixelRatioCap);
    this.renderer.setPixelRatio(effectivePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const { materials: materialsPrefs } = preferences;
    this.applyToneMapping(materialsPrefs.toneMapping);
    this.renderer.toneMappingExposure = materialsPrefs.exposure;
    this.renderer.outputColorSpace = materialsPrefs.sRGBEncoding
      ? THREE.SRGBColorSpace
      : THREE.LinearSRGBColorSpace;

    this.controls = new OrbitControls(this.getCurrentCamera(), canvas);
    this.controls.target.set(0, 0, 0);
    this.updateOrbitControlsFromPreferences();
    this.controls.update();
    this.updateCameraControls();
  }
  private initializeGrid() {
    this.createTwoLevelGrids();
    const { showGridInRenderView } = useUIStore.getState();
    this.updateGridVisibility(showGridInRenderView);
  }

  private createTwoLevelGrids() {
    const { preferences } = useUIStore.getState();
    const { majorSpacing, minorSubdivisions, majorGridLines } = preferences.guides.grid;

    const gridSize = majorGridLines * majorSpacing;
    const majorDivisions = majorGridLines;
    const minorDivisions = majorDivisions * minorSubdivisions;

    this.createGridPair(gridSize, majorDivisions, minorDivisions, "xz");
    this.createGridPair(gridSize, majorDivisions, minorDivisions, "xy");
    this.createGridPair(gridSize, majorDivisions, minorDivisions, "yz");
    this.showGridPlane("xz");
  }

  private createGridPair(
    size: number,
    majorDivisions: number,
    minorDivisions: number,
    plane: "xy" | "xz" | "yz"
  ) {
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

    this.scene.add(minorGrid);
    this.scene.add(majorGrid);
  }

  private setupGridMaterial(grid: THREE.GridHelper, isMajor: boolean) {
    grid.material.color.setHex(0xffffff);
    const material = grid.material as THREE.LineBasicMaterial & { color2?: THREE.Color };
    material.color2?.setHex(0xffffff);

    grid.material.opacity = isMajor ? 0.5 : 0.2;
    grid.material.transparent = true;
  }
  private initializeXRayMaterial() {
    this.xRayMaterial = new THREE.MeshBasicMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.5,
    });
  }
  private initializeAxisGizmo() {
    this.createAxisGizmo();
  }

  private createAxisGizmo() {
    if (this.axisGizmo) {
      this.scene.remove(this.axisGizmo);
      this.axisGizmo.traverse((child) => {
        if (child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
    }

    const { preferences, showAxisGizmo } = useUIStore.getState();
    const size = this.getGizmoSize(preferences.guides.axisGizmo.size);

    this.axisGizmo = new THREE.Group();
    const xMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      linewidth: 2,
      transparent: false,
    });
    const yMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      linewidth: 2,
      transparent: false,
    });
    const zMaterial = new THREE.LineBasicMaterial({
      color: 0x0000ff,
      linewidth: 2,
      transparent: false,
    });

    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(size, 0, 0),
    ]);
    const xLine = new THREE.Line(xGeometry, xMaterial);
    this.axisGizmo.add(xLine);

    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, size, 0),
    ]);
    const yLine = new THREE.Line(yGeometry, yMaterial);
    this.axisGizmo.add(yLine);

    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, size),
    ]);
    const zLine = new THREE.Line(zGeometry, zMaterial);
    this.axisGizmo.add(zLine);

    this.axisGizmo.visible = showAxisGizmo && preferences.guides.axisGizmo.enabled;
    this.scene.add(this.axisGizmo);
    this.updateAxisGizmo();
  }

  private getGizmoSize(size: "Small" | "Medium" | "Large"): number {
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

  private initializeGroundPlane() {
    this.createGroundPlane();
  }

  private createGroundPlane() {
    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry.dispose();
      if (this.groundPlane.material instanceof THREE.Material) {
        this.groundPlane.material.dispose();
      }
    }

    const { preferences } = useUIStore.getState();
    const { enabled, shadowsEnabled, elevation } = preferences.guides.groundPlane;
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.ShadowMaterial({
      opacity: 0.3,
      transparent: true,
    });

    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = elevation;
    this.groundPlane.receiveShadow = shadowsEnabled;
    this.groundPlane.visible = enabled;
    this.scene.add(this.groundPlane);
  }

  private getCurrentCamera(): THREE.Camera {
    return this.isOrthographic ? this.orthographicCamera : this.camera;
  }
  private updateCameraControls() {
    if (!this.controls) return;
    if (this.isOrthographic) {
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = Math.PI;
    } else {
      this.controls.minPolarAngle = 0.1;
      this.controls.maxPolarAngle = Math.PI - 0.1;
    }
  }

  private updateOrbitControlsFromPreferences() {
    if (!this.controls) return;

    const { preferences } = useUIStore.getState();
    const { orbitControls } = preferences.camera;

    this.controls.rotateSpeed = orbitControls.rotateSpeed;
    this.controls.panSpeed = orbitControls.panSpeed;
    this.controls.zoomSpeed = orbitControls.dollySpeed;
    this.controls.enableDamping = orbitControls.dampingEnabled;
    this.controls.dampingFactor = orbitControls.dampingEnabled ? 0.05 : 0;
  }

  private updateCameraFromPreferences(
    newCameraPrefs: PreferencesState["camera"],
    prevCameraPrefs: PreferencesState["camera"]
  ) {
    if (!this.camera || !this.orthographicCamera || !this.controls) return;

    let needsProjectionUpdate = false;

    if (newCameraPrefs.perspectiveFOV !== prevCameraPrefs.perspectiveFOV) {
      this.camera.fov = newCameraPrefs.perspectiveFOV;
      needsProjectionUpdate = true;
    }

    if (
      newCameraPrefs.clippingNear !== prevCameraPrefs.clippingNear ||
      newCameraPrefs.clippingFar !== prevCameraPrefs.clippingFar
    ) {
      this.camera.near = newCameraPrefs.clippingNear;
      this.camera.far = newCameraPrefs.clippingFar;
      this.orthographicCamera.near = newCameraPrefs.clippingNear;
      this.orthographicCamera.far = newCameraPrefs.clippingFar;
      needsProjectionUpdate = true;
    }

    if (newCameraPrefs.orthoScale !== prevCameraPrefs.orthoScale) {
      const canvas = this.renderer.domElement;
      const aspect = canvas.width / canvas.height;
      const frustumSize = newCameraPrefs.orthoScale;

      this.orthographicCamera.left = (-frustumSize * aspect) / 2;
      this.orthographicCamera.right = (frustumSize * aspect) / 2;
      this.orthographicCamera.top = frustumSize / 2;
      this.orthographicCamera.bottom = -frustumSize / 2;
      needsProjectionUpdate = true;
    }

    if (needsProjectionUpdate) {
      this.camera.updateProjectionMatrix();
      this.orthographicCamera.updateProjectionMatrix();
    }

    if (newCameraPrefs.defaultType !== prevCameraPrefs.defaultType) {
      const shouldBeOrthographic = newCameraPrefs.defaultType === "orthographic";
      if (this.isOrthographic !== shouldBeOrthographic) {
        this.setCameraMode(shouldBeOrthographic);
      }
    }

    if (
      JSON.stringify(newCameraPrefs.orbitControls) !== JSON.stringify(prevCameraPrefs.orbitControls)
    ) {
      this.updateOrbitControlsFromPreferences();
    }
  }

  private updateRendererFromPreferences(
    newRendererPrefs: PreferencesState["renderer"],
    prevRendererPrefs: PreferencesState["renderer"]
  ) {
    if (!this.renderer) return;

    if (newRendererPrefs.pixelRatioCap !== prevRendererPrefs.pixelRatioCap) {
      const effectivePixelRatio = Math.min(window.devicePixelRatio, newRendererPrefs.pixelRatioCap);
      this.renderer.setPixelRatio(effectivePixelRatio);
    }

    if (
      JSON.stringify(newRendererPrefs.background) !== JSON.stringify(prevRendererPrefs.background)
    ) {
      this.updateSceneBackground();
    }

    if (newRendererPrefs.antialiasing !== prevRendererPrefs.antialiasing) {
      console.warn("Antialiasing changes require application restart to take effect.");
      // TODO: Implement renderer recreation if needed in the future
    }

    if (
      newRendererPrefs.postProcessing.enabled !== prevRendererPrefs.postProcessing.enabled ||
      JSON.stringify(newRendererPrefs.postProcessing.passes) !==
        JSON.stringify(prevRendererPrefs.postProcessing.passes) ||
      newRendererPrefs.postProcessing.bloomStrength !==
        prevRendererPrefs.postProcessing.bloomStrength ||
      newRendererPrefs.postProcessing.ssaoKernelRadius !==
        prevRendererPrefs.postProcessing.ssaoKernelRadius ||
      newRendererPrefs.postProcessing.ssaoMinDistance !==
        prevRendererPrefs.postProcessing.ssaoMinDistance ||
      newRendererPrefs.postProcessing.ssaoMaxDistance !==
        prevRendererPrefs.postProcessing.ssaoMaxDistance ||
      newRendererPrefs.postProcessing.ssaoIntensity !==
        prevRendererPrefs.postProcessing.ssaoIntensity
    ) {
      this.updatePostProcessing();
    }
  }

  private updateMaterialsFromPreferences(
    newMaterialsPrefs: PreferencesState["materials"],
    prevMaterialsPrefs: PreferencesState["materials"]
  ) {
    if (!this.renderer) return;

    if (newMaterialsPrefs.toneMapping !== prevMaterialsPrefs.toneMapping) {
      this.applyToneMapping(newMaterialsPrefs.toneMapping);
    }

    if (newMaterialsPrefs.exposure !== prevMaterialsPrefs.exposure) {
      this.renderer.toneMappingExposure = newMaterialsPrefs.exposure;
    }

    if (newMaterialsPrefs.sRGBEncoding !== prevMaterialsPrefs.sRGBEncoding) {
      this.renderer.outputColorSpace = newMaterialsPrefs.sRGBEncoding
        ? THREE.SRGBColorSpace
        : THREE.LinearSRGBColorSpace;
    }
  }

  private applyToneMapping(toneMapping: PreferencesState["materials"]["toneMapping"]) {
    if (!this.renderer) return;
    this.applyToneMappingToRenderer(this.renderer, toneMapping);
  }

  private applyToneMappingToRenderer(
    renderer: THREE.WebGLRenderer,
    toneMapping: PreferencesState["materials"]["toneMapping"]
  ) {
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

  private updatePostProcessing() {
    const { preferences } = useUIStore.getState();
    const { postProcessing } = preferences.renderer;

    if (postProcessing.enabled && postProcessing.passes.length > 0) {
      this.initializePostProcessing();
    } else {
      this.disposePostProcessing();
    }
  }

  private initializePostProcessing() {
    if (!this.renderer || !this.scene) return;
    this.disposePostProcessing();
    const { preferences } = useUIStore.getState();
    const { passes } = preferences.renderer.postProcessing;
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.getCurrentCamera());
    this.composer.addPass(this.renderPass);
    if (passes.includes("ssao") && !this.isOrthographic) {
      try {
        const { ssaoKernelRadius, ssaoMinDistance, ssaoMaxDistance, ssaoIntensity } =
          preferences.renderer.postProcessing;
        const canvas = this.renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        console.log("Initializing SSAO pass:", {
          width,
          height,
          camera: this.getCurrentCamera().type,
        });
        this.ssaoPass = new SSAOPass(this.scene, this.getCurrentCamera(), width, height);
        this.ssaoPass.kernelRadius = Math.min(Math.max(ssaoKernelRadius, 1), 32);
        this.ssaoPass.minDistance = Math.min(Math.max(ssaoMinDistance, 0.001), 0.02);
        this.ssaoPass.maxDistance = Math.min(Math.max(ssaoMaxDistance, 0.05), 0.5);

        this.ssaoPass.output = SSAOPass.OUTPUT.Default;

        if (this.ssaoPass.ssaoMaterial && this.ssaoPass.ssaoMaterial.uniforms) {
          if (this.ssaoPass.ssaoMaterial.uniforms.intensity) {
            this.ssaoPass.ssaoMaterial.uniforms.intensity.value = Math.min(
              Math.max(ssaoIntensity, 0.1),
              2.0
            );
          }
        }

        this.composer.addPass(this.ssaoPass);
        console.log("SSAO pass initialized successfully");
      } catch (error) {
        console.error("Failed to initialize SSAO pass:", error);
        this.ssaoPass = null;
      }
    }

    if (passes.includes("bloom")) {
      const { bloomStrength } = preferences.renderer.postProcessing;
      const canvas = this.renderer.domElement;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        bloomStrength,
        0.4,
        0.4
      );
      this.composer.addPass(this.bloomPass);
    }

    const hasSSAO = passes.includes("ssao") && !this.isOrthographic;
    const hasBloom = passes.includes("bloom");

    if (hasBloom) {
      this.bloomPass!.renderToScreen = true;
    } else if (hasSSAO && this.ssaoPass) {
      this.ssaoPass.renderToScreen = true;
    }

    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.composer.setSize(width, height);
  }

  private disposePostProcessing() {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.renderPass) {
      this.renderPass = null;
    }
    if (this.bloomPass) {
      this.bloomPass = null;
    }
    if (this.ssaoPass) {
      this.ssaoPass = null;
    }
  }
  private updateGridColors() {
    if (!this.gridHelper) return;
    this.gridHelper.material.color.setHex(0xffffff);
    const material = this.gridHelper.material as THREE.LineBasicMaterial & { color2?: THREE.Color };
    material.color2?.setHex(0xffffff);
    this.gridHelper.material.opacity = 0.3;
    this.gridHelper.material.transparent = true;
    this.updateGridPlaneColors(this.xyGrid);
    this.updateGridPlaneColors(this.xzGrid);
    this.updateGridPlaneColors(this.yzGrid);
  }
  private updateGridPlaneColors(grid: THREE.GridHelper | null) {
    if (!grid) return;
    grid.material.color.setHex(0xffffff);
    const material = grid.material as THREE.LineBasicMaterial & { color2?: THREE.Color };
    material.color2?.setHex(0xffffff);
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
  }
  private showGridPlane(plane: "xy" | "xz" | "yz") {
    if (this.currentGridPlane === plane) return;
    this.currentGridPlane = plane;
    const { showGridInRenderView, preferences } = useUIStore.getState();

    this.hideAllGrids();

    if (showGridInRenderView && preferences.guides.grid.enabled) {
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

  private hideAllGrids() {
    if (this.gridHelper) this.gridHelper.visible = false;
    if (this.xyGrid) this.xyGrid.visible = false;
    if (this.xzGrid) this.xzGrid.visible = false;
    if (this.yzGrid) this.yzGrid.visible = false;
    if (this.xyMinorGrid) this.xyMinorGrid.visible = false;
    if (this.xyMajorGrid) this.xyMajorGrid.visible = false;
    if (this.xzMinorGrid) this.xzMinorGrid.visible = false;
    if (this.xzMajorGrid) this.xzMajorGrid.visible = false;
    if (this.yzMinorGrid) this.yzMinorGrid.visible = false;
    if (this.yzMajorGrid) this.yzMajorGrid.visible = false;
  }

  private recreateGridsFromPreferences() {
    this.disposeGrids();
    this.createTwoLevelGrids();
    const { showGridInRenderView } = useUIStore.getState();
    this.updateGridVisibility(showGridInRenderView);
  }

  private disposeGrids() {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
      this.gridHelper = null;
    }
    if (this.xyGrid) {
      this.scene.remove(this.xyGrid);
      this.xyGrid.dispose();
      this.xyGrid = null;
    }
    if (this.xzGrid) {
      this.scene.remove(this.xzGrid);
      this.xzGrid.dispose();
      this.xzGrid = null;
    }
    if (this.yzGrid) {
      this.scene.remove(this.yzGrid);
      this.yzGrid.dispose();
      this.yzGrid = null;
    }

    if (this.xyMinorGrid) {
      this.scene.remove(this.xyMinorGrid);
      this.xyMinorGrid.dispose();
      this.xyMinorGrid = null;
    }
    if (this.xyMajorGrid) {
      this.scene.remove(this.xyMajorGrid);
      this.xyMajorGrid.dispose();
      this.xyMajorGrid = null;
    }
    if (this.xzMinorGrid) {
      this.scene.remove(this.xzMinorGrid);
      this.xzMinorGrid.dispose();
      this.xzMinorGrid = null;
    }
    if (this.xzMajorGrid) {
      this.scene.remove(this.xzMajorGrid);
      this.xzMajorGrid.dispose();
      this.xzMajorGrid = null;
    }
    if (this.yzMinorGrid) {
      this.scene.remove(this.yzMinorGrid);
      this.yzMinorGrid.dispose();
      this.yzMinorGrid = null;
    }
    if (this.yzMajorGrid) {
      this.scene.remove(this.yzMajorGrid);
      this.yzMajorGrid.dispose();
      this.yzMajorGrid = null;
    }
  }

  private getGridPlaneForView(
    view: "top" | "front" | "left" | "right" | "bottom" | "perspective"
  ): "xy" | "xz" | "yz" {
    switch (view) {
      case "top":
      case "bottom":
        return "xz";
      case "front":
        return "xy";
      case "left":
        return "yz";
      case "right":
        return "yz";
      default:
        return "xz";
    }
  }
  private setupEventListeners() {
    window.addEventListener("minimystx:fitView", this.fitViewHandler);
    window.addEventListener("minimystx:getCameraData", this.getCameraDataHandler as EventListener);
    window.addEventListener("minimystx:setCameraData", this.setCameraDataHandler as EventListener);
    window.addEventListener("minimystx:setCameraMode", this.setCameraModeHandler as EventListener);
    window.addEventListener("minimystx:setCameraView", this.setCameraViewHandler as EventListener);
    window.addEventListener("minimystx:toggleAxisGizmo", this.toggleAxisGizmoHandler);
  }
  private subscribeToUIStore() {
    this.uiStoreUnsubscribe = useUIStore.subscribe((state, prevState) => {
      if (state.showGridInRenderView !== prevState?.showGridInRenderView) {
        this.updateGridVisibility(state.showGridInRenderView);
      }
      if (state.isDarkTheme !== prevState?.isDarkTheme) {
        this.updateSceneBackground();
        this.updateGridColors();
      }
      if (state.wireframe !== prevState?.wireframe) this.updateWireframeMode(state.wireframe);
      if (state.xRay !== prevState?.xRay) this.updateXRayMode(state.xRay);
      if (state.showAxisGizmo !== prevState?.showAxisGizmo)
        this.updateAxisGizmoVisibility(state.showAxisGizmo);
      if (
        prevState &&
        (state.preferences.guides.grid.enabled !== prevState.preferences.guides.grid.enabled ||
          state.preferences.guides.grid.majorSpacing !==
            prevState.preferences.guides.grid.majorSpacing ||
          state.preferences.guides.grid.minorSubdivisions !==
            prevState.preferences.guides.grid.minorSubdivisions ||
          state.preferences.guides.grid.majorGridLines !==
            prevState.preferences.guides.grid.majorGridLines)
      ) {
        this.recreateGridsFromPreferences();
      }

      if (
        prevState &&
        (state.preferences.guides.axisGizmo.enabled !==
          prevState.preferences.guides.axisGizmo.enabled ||
          state.preferences.guides.axisGizmo.size !== prevState.preferences.guides.axisGizmo.size)
      ) {
        this.createAxisGizmo();
      }

      if (
        prevState &&
        (state.preferences.guides.groundPlane.enabled !==
          prevState.preferences.guides.groundPlane.enabled ||
          state.preferences.guides.groundPlane.shadowsEnabled !==
            prevState.preferences.guides.groundPlane.shadowsEnabled ||
          state.preferences.guides.groundPlane.elevation !==
            prevState.preferences.guides.groundPlane.elevation)
      ) {
        this.createGroundPlane();
      }

      if (prevState && state.preferences.camera !== prevState.preferences.camera) {
        this.updateCameraFromPreferences(state.preferences.camera, prevState.preferences.camera);
      }

      if (prevState && state.preferences.renderer !== prevState.preferences.renderer) {
        this.updateRendererFromPreferences(
          state.preferences.renderer,
          prevState.preferences.renderer
        );
      }

      if (prevState && state.preferences.materials !== prevState.preferences.materials) {
        this.updateMaterialsFromPreferences(
          state.preferences.materials,
          prevState.preferences.materials
        );
      }
    });
  }
  private updateGridVisibility(visible: boolean) {
    const { preferences } = useUIStore.getState();
    const gridEnabled = preferences.guides.grid.enabled;

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
  private updateSceneBackground() {
    if (!this.scene) return;
    const storeState = useUIStore.getState();
    const { isDarkTheme, preferences } = storeState;
    const { renderer: rendererPrefs } = preferences;

    if (rendererPrefs.background.type === "gradient" && rendererPrefs.background.color2) {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        const color1 = rendererPrefs.background.color;
        const color2 = rendererPrefs.background.color2;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, 1, canvas.height);
        const topPixel = `rgb(${imageData.data[0]}, ${imageData.data[1]}, ${imageData.data[2]})`;
        const bottomIndex = (canvas.height - 1) * 4;
        const bottomPixel = `rgb(${imageData.data[bottomIndex]}, ${
          imageData.data[bottomIndex + 1]
        }, ${imageData.data[bottomIndex + 2]})`;
        console.log(`Canvas gradient verification - Top: ${topPixel}, Bottom: ${bottomPixel}`);

        const texture = new THREE.CanvasTexture(canvas);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;

        this.scene.background = texture;

        console.log(`Applied gradient background: ${color1} → ${color2}`);
      } else {
        this.scene.background = new THREE.Color(rendererPrefs.background.color);
      }
    } else {
      const themeFallbackColor = isDarkTheme ? "#191919" : "#f5f5f5";
      const backgroundColorHex =
        rendererPrefs.background.color === "#191919"
          ? themeFallbackColor
          : rendererPrefs.background.color;

      this.scene.background = new THREE.Color(backgroundColorHex);
      console.log(`Applied single color background: ${backgroundColorHex}`);
    }
  }
  private updateWireframeMode(wireframe: boolean) {
    this.scene.traverse((object) => {
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
  private updateXRayMode(xRay: boolean) {
    if (!this.xRayMaterial) return;
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (xRay) {
          if (!this.originalMaterials.has(object)) {
            this.originalMaterials.set(object, object.material);
          }
          const wireframeState = useUIStore.getState().wireframe;
          this.xRayMaterial!.wireframe = wireframeState;
          object.material = this.xRayMaterial!;
        } else {
          const originalMaterial = this.originalMaterials.get(object);
          if (originalMaterial) {
            object.material = originalMaterial;
            const wireframeState = useUIStore.getState().wireframe;
            if ("wireframe" in object.material) {
              (object.material as THREE.Material & { wireframe: boolean }).wireframe =
                wireframeState;
            }
          }
        }
      }
    });
  }
  private updateAxisGizmoVisibility(visible: boolean) {
    if (this.axisGizmo) {
      this.axisGizmo.visible = visible;
    }
  }
  private updateAxisGizmo() {
    if (!this.axisGizmo) return;

    const { preferences } = useUIStore.getState();
    const userSize = this.getGizmoSize(preferences.guides.axisGizmo.size);

    const camera = this.getCurrentCamera();
    if (this.isOrthographic) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const left = orthoCamera.left / orthoCamera.zoom;
      const right = orthoCamera.right / orthoCamera.zoom;
      const top = orthoCamera.top / orthoCamera.zoom;
      const bottom = orthoCamera.bottom / orthoCamera.zoom;
      const maxExtentX = Math.max(Math.abs(left), Math.abs(right));
      const maxExtentY = Math.max(Math.abs(top), Math.abs(bottom));
      const maxExtentZ = maxExtentX;

      const children = this.axisGizmo.children as THREE.Line[];
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
      const children = this.axisGizmo.children as THREE.Line[];
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
  private setCameraMode(isOrthographic: boolean) {
    if (this.isOrthographic === isOrthographic) return;
    const currentCamera = this.getCurrentCamera();
    const newCamera = isOrthographic ? this.orthographicCamera : this.camera;
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
    this.isOrthographic = isOrthographic;
    this.updateCameraControls();
    this.updateAxisGizmo();

    if (this.renderPass) {
      this.renderPass.camera = this.getCurrentCamera();
    }

    if (this.ssaoPass) {
      this.ssaoPass.camera = this.getCurrentCamera();
    }

    const { preferences } = useUIStore.getState();
    if (
      preferences.renderer.postProcessing.enabled &&
      preferences.renderer.postProcessing.passes.includes("ssao")
    ) {
      this.updatePostProcessing();
    }

    if (!isOrthographic) {
      this.showGridPlane("xz");
    }
  }
  private setCameraView(view: "top" | "front" | "left" | "right" | "bottom") {
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
    this.updateAxisGizmo();
    const gridPlane = this.getGridPlaneForView(view);
    this.showGridPlane(gridPlane);
  }
  private toggleAxisGizmo() {
    const { showAxisGizmo } = useUIStore.getState();
    this.updateAxisGizmoVisibility(!showAxisGizmo);
  }
  public fitView() {
    if (!this.controls || !this.scene) return;
    const box = new THREE.Box3();
    const visibleObjects: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (
        object.visible &&
        object !== this.gridHelper &&
        object !== this.xyGrid &&
        object !== this.xzGrid &&
        object !== this.yzGrid &&
        object !== this.xyMinorGrid &&
        object !== this.xyMajorGrid &&
        object !== this.xzMinorGrid &&
        object !== this.xzMajorGrid &&
        object !== this.yzMinorGrid &&
        object !== this.yzMajorGrid &&
        object !== this.axisGizmo &&
        object !== this.groundPlane &&
        object.type !== "Light"
      )
        visibleObjects.push(object);
    });
    if (visibleObjects.length === 0) return;
    visibleObjects.forEach((object) => {
      const objectBox = new THREE.Box3().setFromObject(object);
      box.union(objectBox);
    });
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const camera = this.getCurrentCamera();

    const paddingMultiplier = 1.2;

    if (this.isOrthographic) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const newZoom = Math.min(
        Math.abs(orthoCamera.right - orthoCamera.left) / (size.x * paddingMultiplier),
        Math.abs(orthoCamera.top - orthoCamera.bottom) / (size.y * paddingMultiplier)
      );
      orthoCamera.zoom = newZoom;
      orthoCamera.updateProjectionMatrix();
      const direction = camera.position.clone().sub(center).normalize();
      camera.position.copy(center).add(direction.multiplyScalar(10));
    } else {
      const perspCamera = camera as THREE.PerspectiveCamera;
      const distance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(perspCamera.fov) / 2));
      const direction = camera.position.clone().sub(center).normalize();
      camera.position.copy(center).add(direction.multiplyScalar(distance * paddingMultiplier));
    }
    this.controls.target.copy(center);
    this.controls.update();
  }

  private subscribeToStore() {
    this.storeUnsubscribe = useGraphStore.subscribe(() => {
      this.updateSceneFromRenderableObjects();
    });
  }
  private updateSceneFromRenderableObjects() {
    const state = useGraphStore.getState();
    const renderableObjects: THREE.Object3D[] = [];
    for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {
      if (runtime.error) {
        continue;
      }
      if (runtime.isDirty) {
        // To Do fix this
      }
      if (runtime.type.includes("Light")) {
        const lightVisible = runtime.params?.rendering?.visible !== false;
        if (!lightVisible) continue;
        if (runtime.output && typeof runtime.output === "object") {
          let lightObject = null;
          if (runtime.output.default instanceof Object3DContainer) {
            lightObject = runtime.output.default.value;
          } else if (runtime.output.isObject3D) {
            lightObject = runtime.output;
          } else if (runtime.output.object?.isObject3D) {
            lightObject = runtime.output.object;
          }
          if (lightObject && typeof lightObject.clone === "function") {
            try {
              const clonedLight = lightObject.clone();
              renderableObjects.push(clonedLight);
            } catch (error) {
              console.error("Error cloning light object:", error);
            }
          }
        }
        continue;
      }
      if (runtime.type === "geoNode") {
        const geoNodeVisible = runtime.params?.rendering?.visible !== false;
        if (!geoNodeVisible) continue;
        const subFlow = state.subFlows[nodeId];
        if (!subFlow || !subFlow.activeOutputNodeId) continue;
        const outputNodeRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
        if (!outputNodeRuntime) {
          continue;
        }
        if (outputNodeRuntime.error) {
          continue;
        }
        if (!outputNodeRuntime.output) {
          continue;
        }
        if (!outputNodeRuntime.output || typeof outputNodeRuntime.output !== "object") {
          continue;
        }
        if (outputNodeRuntime.isDirty) {
          // To Do fix this
        }
        const outputNodeVisible = outputNodeRuntime.params?.rendering?.visible === true;
        if (!outputNodeVisible) continue;
        const subFlowOutput = outputNodeRuntime.output;
        let object3D = null;
        if (subFlowOutput && typeof subFlowOutput === "object") {
          if (subFlowOutput.default instanceof Object3DContainer) {
            const container = subFlowOutput.default;
            if (container.value && typeof container.value.clone === "function") {
              object3D = container.value;
            }
          } else if ("isObject3D" in subFlowOutput && subFlowOutput.isObject3D) {
            if (typeof subFlowOutput.clone === "function") {
              object3D = subFlowOutput;
            }
          } else if (
            "object" in subFlowOutput &&
            subFlowOutput.object &&
            typeof subFlowOutput.object === "object" &&
            "isObject3D" in subFlowOutput.object &&
            subFlowOutput.object.isObject3D
          ) {
            if (typeof subFlowOutput.object.clone === "function") {
              object3D = subFlowOutput.object;
            }
          }
        }
        if (object3D) {
          let clonedOutput;
          try {
            clonedOutput = object3D.clone();
          } catch (error) {
            continue;
          }
          const transform = runtime.params?.transform;
          if (transform) {
            if (transform.position) {
              clonedOutput.position.set(
                clonedOutput.position.x + (transform.position.x || 0),
                clonedOutput.position.y + (transform.position.y || 0),
                clonedOutput.position.z + (transform.position.z || 0)
              );
            }
            if (transform.rotation) {
              clonedOutput.rotation.set(
                clonedOutput.rotation.x + (transform.rotation.x || 0),
                clonedOutput.rotation.y + (transform.rotation.y || 0),
                clonedOutput.rotation.z + (transform.rotation.z || 0)
              );
            }
            if (transform.scale) {
              const scaleFactor = transform.scaleFactor || 1;
              clonedOutput.scale.set(
                clonedOutput.scale.x * (transform.scale.x || 1) * scaleFactor,
                clonedOutput.scale.y * (transform.scale.y || 1) * scaleFactor,
                clonedOutput.scale.z * (transform.scale.z || 1) * scaleFactor
              );
            }
          }
          renderableObjects.push(clonedOutput);
        }
      } else {
        const renderingVisible = runtime.params?.rendering?.visible !== false;
        if (!renderingVisible) continue;
        const output = runtime.output;
        let rootObject3D = null;
        if (output && typeof output === "object") {
          if ("isObject3D" in output) {
            rootObject3D = output;
          } else if (
            "object" in output &&
            output.object &&
            typeof output.object === "object" &&
            "isObject3D" in output.object
          ) {
            rootObject3D = output.object;
          }
        }
        if (rootObject3D) {
          renderableObjects.push(rootObject3D);
        }
      }
    }
    for (const [, object] of this.nodeObjects) {
      this.scene.remove(object);
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) object.material.dispose();
      }
    }
    this.nodeObjects.clear();
    renderableObjects.forEach((object3D, index) => {
      if (object3D && typeof object3D === "object" && "isObject3D" in object3D) {
        const objectId = object3D.uuid || `renderable_${index}`;
        this.scene.add(object3D);
        this.nodeObjects.set(objectId, object3D);
      } else {
        // To Do fix this Object is not a valid 3D object, skip
      }
    });
  }
  private startRenderLoop() {
    let isRendering = false;

    const render = () => {
      if (isRendering) {
        console.warn("Render loop feedback detected, skipping frame");
        return;
      }

      this.animationId = requestAnimationFrame(render);
      isRendering = true;

      try {
        this.controls.update();
        this.updateAxisGizmo();

        if (this.composer) {
          this.composer.render();
        } else {
          this.renderer.render(this.scene, this.getCurrentCamera());
        }
      } catch (error) {
        console.error("Render failed:", error);
        try {
          this.renderer.render(this.scene, this.getCurrentCamera());
        } catch (fallbackError) {
          console.error("Fallback render also failed:", fallbackError);
        }
      } finally {
        isRendering = false;
      }
    };
    render();
  }
  public handleResize() {
    const canvas = this.renderer.domElement;
    const container = canvas.parentElement;
    const width = container ? container.clientWidth : canvas.clientWidth;
    const height = container ? container.clientHeight : canvas.clientHeight;
    const aspect = width / height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const frustumSize = 10;
    this.orthographicCamera.left = (-frustumSize * aspect) / 2;
    this.orthographicCamera.right = (frustumSize * aspect) / 2;
    this.orthographicCamera.top = frustumSize / 2;
    this.orthographicCamera.bottom = -frustumSize / 2;
    this.orthographicCamera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    if (this.composer) {
      this.composer.setSize(width, height);
      if (this.ssaoPass) {
        this.ssaoPass.setSize(width, height);
      }
      if (this.bloomPass) {
        this.bloomPass.setSize(width, height);
      }
    }

    this.updateAxisGizmo();
  }
  public captureScreenshot(dimensions: {
    width: number;
    height: number;
    multiplier: number | null;
    overlays: {
      transparentBackground: boolean;
      grid: boolean;
      gizmos: boolean;
    };
  }): string {
    if (!this.renderer || !this.scene) {
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
    const originalGizmoVisibility = this.axisGizmo?.visible || false;

    if (!dimensions.overlays.grid) {
      this.updateGridVisibility(false);
    }
    if (!dimensions.overlays.gizmos && this.axisGizmo) {
      this.axisGizmo.visible = false;
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
    tempRenderer.shadowMap.enabled = this.renderer.shadowMap.enabled;
    tempRenderer.shadowMap.type = this.renderer.shadowMap.type;

    const { preferences } = useUIStore.getState();
    const { materials } = preferences;
    this.applyToneMappingToRenderer(tempRenderer, materials.toneMapping);
    tempRenderer.toneMappingExposure = materials.exposure;
    tempRenderer.outputColorSpace = materials.sRGBEncoding
      ? THREE.SRGBColorSpace
      : THREE.LinearSRGBColorSpace;

    const originalBackground = this.scene.background;

    if (dimensions.overlays.transparentBackground) {
      this.scene.background = null;
      tempRenderer.setClearColor(new THREE.Color(0x000000), 0);
    } else {
      const clearColor = new THREE.Color();
      this.renderer.getClearColor(clearColor);
      tempRenderer.setClearColor(clearColor, this.renderer.getClearAlpha());
    }

    const camera = this.getCurrentCamera();
    const originalAspect =
      camera instanceof THREE.PerspectiveCamera
        ? camera.aspect
        : (camera as THREE.OrthographicCamera).right / (camera as THREE.OrthographicCamera).top;
    const newAspect = targetWidth / targetHeight;

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = newAspect;
      camera.updateProjectionMatrix();
    } else {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const currentHeight = orthoCamera.top - orthoCamera.bottom;
      const currentWidth = currentHeight * newAspect;
      orthoCamera.left = -currentWidth / 2;
      orthoCamera.right = currentWidth / 2;
      orthoCamera.updateProjectionMatrix();
    }

    tempRenderer.render(this.scene, camera);
    const dataURL = tempCanvas.toDataURL("image/png");

    this.scene.background = originalBackground;

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = originalAspect;
      camera.updateProjectionMatrix();
    } else {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const currentHeight = orthoCamera.top - orthoCamera.bottom;
      const currentWidth = currentHeight * originalAspect;
      orthoCamera.left = -currentWidth / 2;
      orthoCamera.right = currentWidth / 2;
      orthoCamera.updateProjectionMatrix();
    }

    this.updateGridVisibility(showGridInRenderView);
    if (this.axisGizmo) {
      this.axisGizmo.visible = originalGizmoVisibility;
    }

    tempRenderer.dispose();
    return dataURL;
  }
  public dispose() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    if (this.uiStoreUnsubscribe) {
      this.uiStoreUnsubscribe();
      this.uiStoreUnsubscribe = null;
    }

    this.disposePostProcessing();
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
      this.gridHelper = null;
    }
    if (this.xyGrid) {
      this.scene.remove(this.xyGrid);
      this.xyGrid.dispose();
      this.xyGrid = null;
    }
    if (this.xzGrid) {
      this.scene.remove(this.xzGrid);
      this.xzGrid.dispose();
      this.xzGrid = null;
    }
    if (this.yzGrid) {
      this.scene.remove(this.yzGrid);
      this.yzGrid.dispose();
      this.yzGrid = null;
    }

    if (this.xyMinorGrid) {
      this.scene.remove(this.xyMinorGrid);
      this.xyMinorGrid.dispose();
      this.xyMinorGrid = null;
    }
    if (this.xyMajorGrid) {
      this.scene.remove(this.xyMajorGrid);
      this.xyMajorGrid.dispose();
      this.xyMajorGrid = null;
    }
    if (this.xzMinorGrid) {
      this.scene.remove(this.xzMinorGrid);
      this.xzMinorGrid.dispose();
      this.xzMinorGrid = null;
    }
    if (this.xzMajorGrid) {
      this.scene.remove(this.xzMajorGrid);
      this.xzMajorGrid.dispose();
      this.xzMajorGrid = null;
    }
    if (this.yzMinorGrid) {
      this.scene.remove(this.yzMinorGrid);
      this.yzMinorGrid.dispose();
      this.yzMinorGrid = null;
    }
    if (this.yzMajorGrid) {
      this.scene.remove(this.yzMajorGrid);
      this.yzMajorGrid.dispose();
      this.yzMajorGrid = null;
    }
    if (this.groundPlane) {
      this.scene.remove(this.groundPlane);
      this.groundPlane.geometry.dispose();
      if (this.groundPlane.material instanceof THREE.Material) {
        this.groundPlane.material.dispose();
      }
      this.groundPlane = null;
    }
    if (this.xRayMaterial) {
      this.xRayMaterial.dispose();
      this.xRayMaterial = null;
    }
    this.originalMaterials = new WeakMap();
    window.removeEventListener("minimystx:fitView", this.fitViewHandler);
    window.removeEventListener(
      "minimystx:getCameraData",
      this.getCameraDataHandler as EventListener
    );
    window.removeEventListener(
      "minimystx:setCameraData",
      this.setCameraDataHandler as EventListener
    );
    window.removeEventListener(
      "minimystx:setCameraMode",
      this.setCameraModeHandler as EventListener
    );
    window.removeEventListener(
      "minimystx:setCameraView",
      this.setCameraViewHandler as EventListener
    );
    window.removeEventListener("minimystx:toggleAxisGizmo", this.toggleAxisGizmoHandler);

    this.controls.dispose();
    this.renderer.dispose();
    if (this.axisGizmo) {
      this.scene.remove(this.axisGizmo);
      this.axisGizmo.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      this.axisGizmo = null;
    }
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });
  }
}
