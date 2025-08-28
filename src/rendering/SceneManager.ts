import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useGraphStore } from "../engine/graphStore";
import { useUIStore } from "../store";

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
  private currentGridPlane: "xy" | "xz" | "yz" = "xz";
  private originalMaterials: WeakMap<THREE.Mesh, THREE.Material> = new WeakMap();
  private xRayMaterial: THREE.MeshBasicMaterial | null = null;
  private axisGizmo: THREE.Group | null = null;
  private isOrthographic = false;
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
    this.subscribeToStore();
    this.subscribeToUIStore();
    this.setupEventListeners();
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
    this.scene.background = new THREE.Color(0x2a2a2a);

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    const aspect = width / height;

    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(5, 2, 5);
    this.camera.lookAt(0, 0, 0);

    const frustumSize = 10;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    this.orthographicCamera.position.set(5, 2, 5);
    this.orthographicCamera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.getCurrentCamera(), canvas);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.update();

    this.updateCameraControls();
  }

  private initializeGrid() {
    this.gridHelper = new THREE.GridHelper(20, 20);
    this.updateGridColors();
    this.scene.add(this.gridHelper);

    this.initializeGridPlanes();

    const { showGridInRenderView } = useUIStore.getState();
    this.updateGridVisibility(showGridInRenderView);
  }

  private initializeGridPlanes() {
    const gridSize = 20;
    const divisions = 20;

    this.xyGrid = new THREE.GridHelper(gridSize, divisions);
    this.xyGrid.rotateX(Math.PI / 2);
    this.updateGridPlaneColors(this.xyGrid);
    this.xyGrid.visible = false;
    this.scene.add(this.xyGrid);

    this.xzGrid = new THREE.GridHelper(gridSize, divisions);
    this.updateGridPlaneColors(this.xzGrid);
    this.xzGrid.visible = false;
    this.scene.add(this.xzGrid);

    this.yzGrid = new THREE.GridHelper(gridSize, divisions);
    this.yzGrid.rotateZ(Math.PI / 2);
    this.updateGridPlaneColors(this.yzGrid);
    this.yzGrid.visible = false;
    this.scene.add(this.yzGrid);

    this.showGridPlane("xz");
  }

  private initializeXRayMaterial() {
    this.xRayMaterial = new THREE.MeshBasicMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.5,
    });
  }

  private initializeAxisGizmo() {
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
      new THREE.Vector3(1, 0, 0),
    ]);
    const xLine = new THREE.Line(xGeometry, xMaterial);
    this.axisGizmo.add(xLine);

    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]);
    const yLine = new THREE.Line(yGeometry, yMaterial);
    this.axisGizmo.add(yLine);

    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    ]);
    const zLine = new THREE.Line(zGeometry, zMaterial);
    this.axisGizmo.add(zLine);

    const { showAxisGizmo } = useUIStore.getState();
    this.axisGizmo.visible = showAxisGizmo;
    this.scene.add(this.axisGizmo);

    this.updateAxisGizmo();
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
    const { showGridInRenderView } = useUIStore.getState();

    if (this.gridHelper) this.gridHelper.visible = false;
    if (this.xyGrid) this.xyGrid.visible = false;
    if (this.xzGrid) this.xzGrid.visible = false;
    if (this.yzGrid) this.yzGrid.visible = false;

    if (showGridInRenderView) {
      switch (plane) {
        case "xy":
          if (this.xyGrid) this.xyGrid.visible = true;
          break;
        case "xz":
          if (this.xzGrid) this.xzGrid.visible = true;
          break;
        case "yz":
          if (this.yzGrid) this.yzGrid.visible = true;
          break;
      }
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
    });
  }

  private updateGridVisibility(visible: boolean) {
    if (this.gridHelper) {
      this.gridHelper.visible = false;
    }

    if (visible) {
      switch (this.currentGridPlane) {
        case "xy":
          if (this.xyGrid) this.xyGrid.visible = true;
          break;
        case "xz":
          if (this.xzGrid) this.xzGrid.visible = true;
          break;
        case "yz":
          if (this.yzGrid) this.yzGrid.visible = true;
          break;
      }
    } else {
      if (this.xyGrid) this.xyGrid.visible = false;
      if (this.xzGrid) this.xzGrid.visible = false;
      if (this.yzGrid) this.yzGrid.visible = false;
    }
  }

  private updateSceneBackground() {
    if (!this.scene) return;

    const storeState = useUIStore.getState();
    const { isDarkTheme } = storeState;

    const backgroundColor = isDarkTheme ? 0x2a2a2a : 0xf5f5f5;
    this.scene.background = new THREE.Color(backgroundColor);
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
      const axisLength = 1.5;
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
        object !== this.axisGizmo &&
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

    if (this.isOrthographic) {
      const orthoCamera = camera as THREE.OrthographicCamera;
      const padding = 1.2;
      const newZoom = Math.min(
        Math.abs(orthoCamera.right - orthoCamera.left) / (size.x * padding),
        Math.abs(orthoCamera.top - orthoCamera.bottom) / (size.y * padding)
      );
      orthoCamera.zoom = newZoom;
      orthoCamera.updateProjectionMatrix();

      const direction = camera.position.clone().sub(center).normalize();
      camera.position.copy(center).add(direction.multiplyScalar(10));
    } else {
      const perspCamera = camera as THREE.PerspectiveCamera;
      const distance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(perspCamera.fov) / 2));
      const direction = camera.position.clone().sub(center).normalize();
      camera.position.copy(center).add(direction.multiplyScalar(distance * 1.5));
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
        // Skip dirty nodes during rendering
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
          // Skip dirty output nodes
        }

        const outputNodeVisible = outputNodeRuntime.params?.rendering?.visible === true;
        if (!outputNodeVisible) continue;

        const subFlowOutput = outputNodeRuntime.output;

        let object3D = null;
        if (subFlowOutput && typeof subFlowOutput === "object") {
          if ("isObject3D" in subFlowOutput && subFlowOutput.isObject3D) {
            if (typeof subFlowOutput.clone === "function") {
              object3D = subFlowOutput;
            } else {
              // Object3D cannot be cloned, skip
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
            } else {
              // Subflow object cannot be cloned, skip
            }
          } else {
            // Subflow output is not a valid Object3D
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
        // Invalid object3D, skip rendering
      }
    });
  }

  private startRenderLoop() {
    const render = () => {
      this.animationId = requestAnimationFrame(render);
      this.controls.update();
      this.updateAxisGizmo();
      this.renderer.render(this.scene, this.getCurrentCamera());
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
    this.updateAxisGizmo();
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
