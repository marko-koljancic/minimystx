import * as THREE from "three";
import { useUIStore } from "../store/uiStore";
import { usePreferencesStore, PreferencesState } from "../store/preferencesStore";
import { CameraController } from "./camera/CameraController";
import { GridSystem } from "./grid/GridSystem";
import { MaterialManager } from "./materials/MaterialManager";
import { PostProcessManager } from "./postprocessing/PostProcessManager";
import { SceneObjectManager } from "./objects/SceneObjectManager";
import { AxisGizmo } from "./guides/AxisGizmo";
import { GroundPlane } from "./guides/GroundPlane";
import { ScreenshotCapture } from "./capture/ScreenshotCapture";
import { EventManager } from "./events/EventManager";
import { CaptureDimensions } from "./capture/CaptureTypes";

export class SceneManager {
  private scene!: THREE.Scene;
  private _renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private orthographicCamera!: THREE.OrthographicCamera;
  private animationId: number | null = null;
  private uiStoreUnsubscribe: (() => void) | null = null;
  private preferencesStoreUnsubscribe: (() => void) | null = null;
  private initialized: boolean = false;
  private cameraController!: CameraController;
  private gridSystem!: GridSystem;
  private materialManager!: MaterialManager;
  private postProcessManager!: PostProcessManager;
  private sceneObjectManager!: SceneObjectManager;
  private axisGizmo!: AxisGizmo;
  private groundPlane!: GroundPlane;
  private screenshotCapture!: ScreenshotCapture;
  private eventManager!: EventManager;

  constructor(canvas: HTMLCanvasElement) {
    try {
      this.initializeThreeJS(canvas);
      this.initializeSubsystems();
      this.subscribeToUIStore();
      this.subscribeToPreferencesStore();
      this.setupEventListeners();
      this.completeInitialization();
      this.startRenderLoop();
    } catch (error) {
      this.handleInitializationError(error);
    }
  }

  public get renderer(): THREE.WebGLRenderer {
    return this._renderer;
  }
  public fitView(): void {
    if (!this.cameraController.controls || !this.scene) return;

    const box = new THREE.Box3();
    const visibleObjects: THREE.Object3D[] = [];

    this.scene.traverse((object) => {
      if (
        object.visible &&
        object !== this.axisGizmo.gizmo &&
        object !== this.groundPlane.groundPlane &&
        object.type !== "Light" &&
        !this.isGridObject(object)
      ) {
        visibleObjects.push(object);
      }
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
    const camera = this.cameraController.getCurrentCamera();
    const paddingMultiplier = 1.2;

    if (this.cameraController.isOrthographic) {
      if (this.isOrthographicCamera(camera)) {
        const newZoom = Math.min(
          Math.abs(camera.right - camera.left) / (size.x * paddingMultiplier),
          Math.abs(camera.top - camera.bottom) / (size.y * paddingMultiplier)
        );
        camera.zoom = newZoom;
        camera.updateProjectionMatrix();
        const direction = camera.position.clone().sub(center).normalize();
        camera.position.copy(center).add(direction.multiplyScalar(10));
      }
    } else {
      if (this.isPerspectiveCamera(camera)) {
        const distance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
        const direction = camera.position.clone().sub(center).normalize();
        camera.position.copy(center).add(direction.multiplyScalar(distance * paddingMultiplier));
      }
    }

    this.cameraController.controls.target.copy(center);
    this.cameraController.controls.update();
  }

  public handleResize(): void {
    const canvas = this._renderer.domElement;
    const container = canvas.parentElement;
    const width = container ? container.clientWidth : canvas.clientWidth;
    const height = container ? container.clientHeight : canvas.clientHeight;

    this.cameraController.handleResize(width, height);
    this._renderer.setSize(width, height);
    this.postProcessManager.setSize(width, height);
    this.axisGizmo.updateAxisGizmo();
  }

  public captureScreenshot(dimensions: CaptureDimensions): string {
    return this.screenshotCapture.captureScreenshot(dimensions);
  }

  public dispose(): void {
    if (!this.initialized) return;

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    if (this.uiStoreUnsubscribe) {
      this.uiStoreUnsubscribe();
      this.uiStoreUnsubscribe = null;
    }

    if (this.preferencesStoreUnsubscribe) {
      this.preferencesStoreUnsubscribe();
      this.preferencesStoreUnsubscribe = null;
    }

    this.cameraController.dispose();
    this.gridSystem.dispose();
    this.materialManager.dispose();
    this.postProcessManager.dispose();
    this.sceneObjectManager.dispose();
    this.axisGizmo.dispose();
    this.groundPlane.dispose();
    this.screenshotCapture.dispose();
    this.eventManager.dispose();

    this._renderer.dispose();

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });
  }

  private initializeThreeJS(canvas: HTMLCanvasElement): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x191919);

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    const aspect = width / height;

    const { camera: cameraPrefs } = usePreferencesStore.getState();

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

    this._renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this._renderer.setSize(width, height);

    const effectivePixelRatio = Math.min(window.devicePixelRatio, 2.0);
    this._renderer.setPixelRatio(effectivePixelRatio);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const { materials: materialsPrefs } = usePreferencesStore.getState();
    this.applyToneMappingDirectly(materialsPrefs.toneMapping);
    this._renderer.toneMappingExposure = materialsPrefs.exposure;
    this._renderer.outputColorSpace = materialsPrefs.sRGBEncoding
      ? THREE.SRGBColorSpace
      : THREE.LinearSRGBColorSpace;
  }

  private initializeSubsystems(): void {
    this.cameraController = new CameraController({
      scene: this.scene,
      renderer: this._renderer,
      camera: this.camera,
      orthographicCamera: this.orthographicCamera,
      canvas: this._renderer.domElement,
    });

    this.gridSystem = new GridSystem({
      scene: this.scene,
    });

    this.materialManager = new MaterialManager({
      scene: this.scene,
      renderer: this._renderer,
    });

    this.postProcessManager = new PostProcessManager({
      scene: this.scene,
      renderer: this._renderer,
      getCurrentCamera: () => this.cameraController.getCurrentCamera(),
      isOrthographic: this.cameraController.isOrthographic,
    });

    this.sceneObjectManager = new SceneObjectManager({
      scene: this.scene,
    });

    this.axisGizmo = new AxisGizmo({
      scene: this.scene,
      getCurrentCamera: () => this.cameraController.getCurrentCamera(),
      isOrthographic: this.cameraController.isOrthographic,
    });

    this.groundPlane = new GroundPlane({
      scene: this.scene,
    });

    this.screenshotCapture = new ScreenshotCapture({
      scene: this.scene,
      renderer: this._renderer,
      getCurrentCamera: () => this.cameraController.getCurrentCamera(),
      setGridVisibility: (visible: boolean) => this.gridSystem.updateGridVisibility(visible),
      setAxisGizmoVisibility: (visible: boolean) => this.axisGizmo.updateVisibility(visible),
      getAxisGizmoVisibility: () => useUIStore.getState().showAxisGizmo,
    });

    this.eventManager = new EventManager({
      onFitView: () => this.fitView(),
      onGetCameraData: (event: CustomEvent) => this.handleGetCameraData(event),
      onSetCameraData: (event: CustomEvent) => this.handleSetCameraData(event),
      onSetCameraMode: (event: CustomEvent) => this.handleSetCameraMode(event),
      onSetCameraView: (event: CustomEvent) => this.handleSetCameraView(event),
      onToggleAxisGizmo: () => this.handleToggleAxisGizmo(),
    });
  }

  private setupEventListeners(): void {
    this.eventManager.setupEventListeners();
  }

  private subscribeToUIStore(): void {
    this.uiStoreUnsubscribe = useUIStore.subscribe((state, prevState) => {
      if (!prevState) return;

      if (state.showGridInRenderView !== prevState.showGridInRenderView) {
        this.gridSystem.updateGridVisibility(state.showGridInRenderView);
      }

      if (state.isDarkTheme !== prevState.isDarkTheme) {
        this.updateSceneBackground();
      }

      if (state.wireframe !== prevState.wireframe) {
        this.materialManager.updateWireframeMode(state.wireframe);
      }
      if (state.xRay !== prevState.xRay) {
        this.materialManager.updateXRayMode(state.xRay);
      }
    });
  }

  private subscribeToPreferencesStore(): void {
    this.preferencesStoreUnsubscribe = usePreferencesStore.subscribe((state, prevState) => {
      if (!prevState) return;

      if (state.camera && prevState.camera) {
        this.cameraController.updateFromPreferences(state.camera, prevState.camera);
      }

      if (state.guides && prevState.guides && state.guides.grid && prevState.guides.grid) {
        this.gridSystem.updateFromPreferences(state.guides.grid, prevState.guides.grid);
      }

      if (
        state.guides &&
        prevState.guides &&
        state.guides.axisGizmo &&
        prevState.guides.axisGizmo
      ) {
        this.axisGizmo.updateFromPreferences(state.guides.axisGizmo, prevState.guides.axisGizmo);
      }

      if (state.renderer && prevState.renderer) {
        this.updateRendererFromPreferences(state.renderer, prevState.renderer);
      }

      if (state.materials && prevState.materials) {
        this.updateMaterialsFromPreferences(state.materials, prevState.materials);
      }
    });
  }

  private startRenderLoop(): void {
    let isRendering = false;

    const render = () => {
      if (isRendering) {
        console.warn("Render loop feedback detected, skipping frame");
        return;
      }

      this.animationId = requestAnimationFrame(render);
      isRendering = true;

      try {
        this.handleWebGLContextLoss();
        this.cameraController.controls.update();
        this.axisGizmo.updateAxisGizmo();

        if (this.postProcessManager.composer) {
          this.postProcessManager.render();
        } else {
          this._renderer.render(this.scene, this.cameraController.getCurrentCamera());
        }
      } catch (error) {
        this.handleRenderError(error);
      } finally {
        isRendering = false;
      }
    };

    render();
  }

  private handleGetCameraData(event: CustomEvent): void {
    if (!this.isValidGetCameraDataEvent(event)) return;

    if (this.cameraController.getCurrentCamera() && this.cameraController.controls) {
      const cameraData = {
        position: [
          this.cameraController.getCurrentCamera().position.x,
          this.cameraController.getCurrentCamera().position.y,
          this.cameraController.getCurrentCamera().position.z,
        ],
        target: [
          this.cameraController.controls.target.x,
          this.cameraController.controls.target.y,
          this.cameraController.controls.target.z,
        ],
      };
      this.setCameraDataOnEvent(event, cameraData);
    }
  }

  private handleSetCameraData(event: CustomEvent): void {
    if (!this.isValidSetCameraDataEvent(event)) return;

    const cameraData = event.detail;
    if (this.cameraController.getCurrentCamera() && this.cameraController.controls) {
      this.cameraController
        .getCurrentCamera()
        .position.set(cameraData.position[0], cameraData.position[1], cameraData.position[2]);
      this.cameraController.controls.target.set(
        cameraData.target[0],
        cameraData.target[1],
        cameraData.target[2]
      );
      this.cameraController.controls.update();
    }
  }

  private handleSetCameraMode(event: CustomEvent): void {
    if (!this.isValidSetCameraModeEvent(event)) return;

    const { isOrthographic } = event.detail;
    this.cameraController.setCameraMode(isOrthographic);
    this.postProcessManager.updateCameraReference();
  }

  private handleSetCameraView(event: CustomEvent): void {
    if (!this.isValidSetCameraViewEvent(event)) return;

    const { view } = event.detail;
    this.cameraController.setCameraView(view);
    const gridPlane = this.cameraController.getGridPlaneForView(view);
    this.gridSystem.showGridPlane(gridPlane);
  }

  private handleToggleAxisGizmo(): void {
    const { showAxisGizmo } = useUIStore.getState();
    this.axisGizmo.updateVisibility(!showAxisGizmo);
  }

  private updateRendererFromPreferences(
    newRendererPrefs: PreferencesState["renderer"],
    prevRendererPrefs: PreferencesState["renderer"]
  ): void {
    if (
      JSON.stringify(newRendererPrefs.background) !== JSON.stringify(prevRendererPrefs.background)
    ) {
      this.updateSceneBackground();
    }

    if (
      newRendererPrefs.postProcessing !== prevRendererPrefs.postProcessing ||
      JSON.stringify(newRendererPrefs.postProcessing) !==
        JSON.stringify(prevRendererPrefs.postProcessing)
    ) {
      this.postProcessManager.updateFromPreferences(
        newRendererPrefs.postProcessing,
        prevRendererPrefs.postProcessing
      );
    }
  }

  private updateMaterialsFromPreferences(
    newMaterialsPrefs: PreferencesState["materials"],
    prevMaterialsPrefs: PreferencesState["materials"]
  ): void {
    this.materialManager.updateFromPreferences(newMaterialsPrefs, prevMaterialsPrefs);
  }

  private updateSceneBackground(): void {
    if (!this.scene) return;

    const { isDarkTheme } = useUIStore.getState();
    const { renderer: rendererPrefs } = usePreferencesStore.getState();

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
    }
  }

  private applyToneMappingDirectly(
    toneMapping: PreferencesState["materials"]["toneMapping"]
  ): void {
    if (!this._renderer) return;
    switch (toneMapping) {
      case "None":
        this._renderer.toneMapping = THREE.NoToneMapping;
        break;
      case "Linear":
        this._renderer.toneMapping = THREE.LinearToneMapping;
        break;
      case "Reinhard":
        this._renderer.toneMapping = THREE.ReinhardToneMapping;
        break;
      case "ACES Filmic":
        this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
        break;
    }
  }

  private isGridObject(object: THREE.Object3D): boolean {
    return object instanceof THREE.GridHelper;
  }

  private isPerspectiveCamera(camera: THREE.Camera): camera is THREE.PerspectiveCamera {
    return camera instanceof THREE.PerspectiveCamera;
  }

  private isOrthographicCamera(camera: THREE.Camera): camera is THREE.OrthographicCamera {
    return camera instanceof THREE.OrthographicCamera;
  }

  private isValidGetCameraDataEvent(event: CustomEvent): boolean {
    return event && typeof event === "object";
  }

  private isValidSetCameraDataEvent(event: CustomEvent): boolean {
    return (
      event &&
      event.detail &&
      event.detail.position &&
      Array.isArray(event.detail.position) &&
      event.detail.position.length === 3 &&
      event.detail.target &&
      Array.isArray(event.detail.target) &&
      event.detail.target.length === 3
    );
  }

  private isValidSetCameraModeEvent(event: CustomEvent): boolean {
    return event && event.detail && typeof event.detail.isOrthographic === "boolean";
  }

  private isValidSetCameraViewEvent(event: CustomEvent): boolean {
    return event && event.detail && typeof event.detail.view === "string";
  }

  private setCameraDataOnEvent(event: CustomEvent, cameraData: any): void {
    (event as any).cameraData = cameraData;
  }

  private completeInitialization(): void {
    this.updateSceneBackground();
    const storeState = useUIStore.getState();
    if (storeState && storeState.showGridInRenderView !== undefined) {
      this.gridSystem.updateGridVisibility(storeState.showGridInRenderView);
    }
    this.initialized = true;
  }

  private handleInitializationError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : "Unknown initialization error";
    this.logError("Initialization failed", errorMessage, { error });

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    throw new Error(`SceneManager initialization failed: ${errorMessage}`);
  }

  private handleWebGLContextLoss(): void {
    const gl = this._renderer.getContext();
    if (gl.isContextLost()) {
      this.logError("WebGL context lost", "Attempting recovery");

      this._renderer.forceContextRestore();

      setTimeout(() => {
        if (!gl.isContextLost()) {
          this.logError("WebGL context restored", "Recovery successful");
          this.reinitializeAfterContextRestore();
        }
      }, 100);
    }
  }

  private reinitializeAfterContextRestore(): void {
    try {
      this.postProcessManager.updatePostProcessing();
      this.gridSystem.recreateGridsFromPreferences();
      const axisGizmoPrefs = usePreferencesStore.getState().guides.axisGizmo;
      this.axisGizmo.updateFromPreferences(axisGizmoPrefs, axisGizmoPrefs);
    } catch (error) {
      this.logError("Context restore failed", error);
    }
  }

  private handleRenderError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : "Unknown render error";
    this.logError("Render error", errorMessage, { error });

    try {
      if (this._renderer && this.scene && this.cameraController) {
        this._renderer.render(this.scene, this.cameraController.getCurrentCamera());
      }
    } catch (fallbackError) {
      this.logError(
        "Fallback render failed",
        fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error",
        {
          originalError: error,
          fallbackError,
        }
      );
    }
  }

  private logError(message: string, details?: any, context?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: "ERROR",
      component: "SceneManager",
      message,
      details,
      context,
    };

    console.error(`[${timestamp}] SceneManager ERROR: ${message}`, details, context);

    if (typeof window !== "undefined" && (window as any).errorReporting) {
      (window as any).errorReporting.captureError(logEntry);
    }
  }
}
