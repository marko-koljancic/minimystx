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
      // Store the data in the event for retrieval
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

    // Ensure background and grid visibility are set correctly after store hydration
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
    this.scene.background = new THREE.Color(0xf5f5f5);

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    const aspect = width / height;

    // Initialize perspective camera
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(5, 2, 5);
    this.camera.lookAt(0, 0, 0);

    // Initialize orthographic camera
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
    // Legacy single grid (kept for compatibility)
    this.gridHelper = new THREE.GridHelper(20, 20);
    this.updateGridColors();
    this.scene.add(this.gridHelper);

    // Create three separate grid planes
    this.initializeGridPlanes();

    const { showGridInRenderView } = useUIStore.getState();
    this.updateGridVisibility(showGridInRenderView);
  }

  private initializeGridPlanes() {
    const gridSize = 20;
    const divisions = 20;

    // XY plane (for Front/Back views)
    this.xyGrid = new THREE.GridHelper(gridSize, divisions);
    this.xyGrid.rotateX(Math.PI / 2); // Rotate to XY plane
    this.updateGridPlaneColors(this.xyGrid);
    this.xyGrid.visible = false; // Start hidden
    this.scene.add(this.xyGrid);

    // XZ plane (for Top/Bottom views) - default horizontal plane
    this.xzGrid = new THREE.GridHelper(gridSize, divisions);
    this.updateGridPlaneColors(this.xzGrid);
    this.xzGrid.visible = false; // Start hidden
    this.scene.add(this.xzGrid);

    // YZ plane (for Left/Right views)
    this.yzGrid = new THREE.GridHelper(gridSize, divisions);
    this.yzGrid.rotateZ(Math.PI / 2); // Rotate to YZ plane
    this.updateGridPlaneColors(this.yzGrid);
    this.yzGrid.visible = false; // Start hidden
    this.scene.add(this.yzGrid);

    // Initially show only the default XZ grid based on store state
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

    // Create materials for constant line thickness
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

    // Create line geometries without arrows
    // X-axis (red)
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    ]);
    const xLine = new THREE.Line(xGeometry, xMaterial);
    this.axisGizmo.add(xLine);

    // Y-axis (green)
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
    ]);
    const yLine = new THREE.Line(yGeometry, yMaterial);
    this.axisGizmo.add(yLine);

    // Z-axis (blue)
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
      // In orthographic mode, allow full rotation
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = Math.PI;
    } else {
      // In perspective mode, allow looking up/down but prevent full flipping
      // This allows viewing from above and below while preventing disorienting camera flips
      this.controls.minPolarAngle = 0.1; // Slight margin from straight up
      this.controls.maxPolarAngle = Math.PI - 0.1; // Slight margin from straight down
    }
  }

  private updateGridColors() {
    if (!this.gridHelper) return;
    this.gridHelper.material.color.setHex(0xe8e8e8);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.gridHelper.material as any).color2?.setHex(0xdddddd);
    this.gridHelper.material.opacity = 0.3;
    this.gridHelper.material.transparent = true;

    // Update colors for all grid planes
    this.updateGridPlaneColors(this.xyGrid);
    this.updateGridPlaneColors(this.xzGrid);
    this.updateGridPlaneColors(this.yzGrid);
  }

  private updateGridPlaneColors(grid: THREE.GridHelper | null) {
    if (!grid) return;
    grid.material.color.setHex(0xe8e8e8);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (grid.material as any).color2?.setHex(0xdddddd);
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
  }

  private showGridPlane(plane: "xy" | "xz" | "yz") {
    if (this.currentGridPlane === plane) return;

    this.currentGridPlane = plane;
    const { showGridInRenderView } = useUIStore.getState();

    // Hide all grids
    if (this.gridHelper) this.gridHelper.visible = false;
    if (this.xyGrid) this.xyGrid.visible = false;
    if (this.xzGrid) this.xzGrid.visible = false;
    if (this.yzGrid) this.yzGrid.visible = false;

    // Show only the appropriate grid if grid display is enabled
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
        return "xz"; // Looking along Y axis, see XZ plane
      case "front":
        return "xy"; // Looking along +Z axis, see XY plane
      case "left":
        return "yz"; // Looking along -X axis, see YZ plane
      case "right":
        return "yz"; // Looking along +X axis, see YZ plane
      default:
        return "xz"; // Default to XZ plane for perspective
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.uiStoreUnsubscribe = useUIStore.subscribe((state, prevState: any) => {
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
    // Update legacy grid
    if (this.gridHelper) {
      this.gridHelper.visible = false; // Always hide legacy grid now
    }

    // Update current grid plane visibility
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
      // Hide all grids
      if (this.xyGrid) this.xyGrid.visible = false;
      if (this.xzGrid) this.xzGrid.visible = false;
      if (this.yzGrid) this.yzGrid.visible = false;
    }
  }

  private updateSceneBackground() {
    if (!this.scene) return;

    const storeState = useUIStore.getState();
    const { isDarkTheme } = storeState;

    const backgroundColor = isDarkTheme ? 0x1a1a1a : 0xf5f5f5;
    this.scene.background = new THREE.Color(backgroundColor);
  }

  private updateWireframeMode(wireframe: boolean) {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.Material) {
        if (wireframe) {
          if (!this.originalMaterials.has(object))
            this.originalMaterials.set(object, object.material);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ("wireframe" in object.material) (object.material as any).wireframe = true;
        } else {
          // Restore wireframe state
          if ("wireframe" in object.material) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (object.material as any).wireframe = false;
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
          // Cache original material if not already cached
          if (!this.originalMaterials.has(object)) {
            this.originalMaterials.set(object, object.material);
          }
          // Apply X-Ray material (respecting wireframe state)
          const wireframeState = useUIStore.getState().wireframe;
          this.xRayMaterial!.wireframe = wireframeState;
          object.material = this.xRayMaterial!;
        } else {
          // Restore original material
          const originalMaterial = this.originalMaterials.get(object);
          if (originalMaterial) {
            object.material = originalMaterial;
            // Reapply wireframe state if needed
            const wireframeState = useUIStore.getState().wireframe;
            if ("wireframe" in object.material) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (object.material as any).wireframe = wireframeState;
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
      // In orthographic view, extend axes to screen edges
      const orthoCamera = camera as THREE.OrthographicCamera;
      const left = orthoCamera.left / orthoCamera.zoom;
      const right = orthoCamera.right / orthoCamera.zoom;
      const top = orthoCamera.top / orthoCamera.zoom;
      const bottom = orthoCamera.bottom / orthoCamera.zoom;

      // Get the maximum extent in each direction
      const maxExtentX = Math.max(Math.abs(left), Math.abs(right));
      const maxExtentY = Math.max(Math.abs(top), Math.abs(bottom));
      const maxExtentZ = maxExtentX; // Use same as X for Z axis

      // Update line geometries to extend to edges
      const children = this.axisGizmo.children as THREE.Line[];
      if (children.length >= 3) {
        // X-axis
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-maxExtentX, 0, 0),
          new THREE.Vector3(maxExtentX, 0, 0),
        ]);
        children[0].geometry.dispose();
        children[0].geometry = xGeometry;

        // Y-axis
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, -maxExtentY, 0),
          new THREE.Vector3(0, maxExtentY, 0),
        ]);
        children[1].geometry.dispose();
        children[1].geometry = yGeometry;

        // Z-axis
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, -maxExtentZ),
          new THREE.Vector3(0, 0, maxExtentZ),
        ]);
        children[2].geometry.dispose();
        children[2].geometry = zGeometry;
      }
    } else {
      // In perspective view, keep small central axes
      const axisLength = 1.5;
      const children = this.axisGizmo.children as THREE.Line[];
      if (children.length >= 3) {
        // X-axis
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(axisLength, 0, 0),
        ]);
        children[0].geometry.dispose();
        children[0].geometry = xGeometry;

        // Y-axis
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, axisLength, 0),
        ]);
        children[1].geometry.dispose();
        children[1].geometry = yGeometry;

        // Z-axis
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
      // Switching TO orthographic: preserve current view
      newCamera.position.copy(currentCamera.position);
      newCamera.up.copy(currentCamera.up);
      newCamera.lookAt(target);
    } else {
      // Switching TO perspective: reset to canonical 3D view
      // Reset to a standard perspective orientation to avoid gimbal lock issues
      newCamera.up.set(0, 1, 0); // Standard up vector

      // Position camera at a reasonable distance in a 3D perspective view
      // Use a diagonal view that's commonly used in 3D modeling apps
      const distance = Math.max(currentCamera.position.distanceTo(target), 10);
      newCamera.position.set(
        target.x + distance * 0.7,
        target.y + distance * 0.5,
        target.z + distance * 0.7
      );
      newCamera.lookAt(target);
    }

    // Update controls to use new camera
    this.controls.object = newCamera;
    this.controls.update();

    this.isOrthographic = isOrthographic;
    this.updateCameraControls();
    this.updateAxisGizmo();

    // In perspective mode, switch to default XZ grid
    if (!isOrthographic) {
      this.showGridPlane("xz");
    }
  }

  private setCameraView(view: "top" | "front" | "left" | "right" | "bottom") {
    if (!this.controls) return;

    const currentTarget = this.controls.target.clone();
    const camera = this.getCurrentCamera();
    const distance = camera.position.distanceTo(currentTarget);
    const standardDistance = Math.max(distance, 10); // Use minimum of 10 units

    switch (view) {
      case "top":
        camera.position.set(currentTarget.x, currentTarget.y + standardDistance, currentTarget.z);
        camera.up.set(0, 0, -1); // Z points down in top view
        break;
      case "front":
        camera.position.set(currentTarget.x, currentTarget.y, currentTarget.z + standardDistance);
        camera.up.set(0, 1, 0); // Y points up
        break;
      case "left":
        camera.position.set(currentTarget.x - standardDistance, currentTarget.y, currentTarget.z);
        camera.up.set(0, 1, 0); // Y points up
        break;
      case "right":
        camera.position.set(currentTarget.x + standardDistance, currentTarget.y, currentTarget.z);
        camera.up.set(0, 1, 0); // Y points up
        break;
      case "bottom":
        camera.position.set(currentTarget.x, currentTarget.y - standardDistance, currentTarget.z);
        camera.up.set(0, 0, 1); // Z points up in bottom view
        break;
    }

    // Ensure camera is looking at the target
    camera.lookAt(currentTarget);

    this.controls.update();
    this.updateAxisGizmo();

    // Switch to appropriate grid plane for this orthographic view
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
      // For orthographic camera, adjust the zoom instead of distance
      const orthoCamera = camera as THREE.OrthographicCamera;
      const padding = 1.2; // 20% padding
      const newZoom = Math.min(
        Math.abs(orthoCamera.right - orthoCamera.left) / (size.x * padding),
        Math.abs(orthoCamera.top - orthoCamera.bottom) / (size.y * padding)
      );
      orthoCamera.zoom = newZoom;
      orthoCamera.updateProjectionMatrix();

      // Move camera to look at center
      const direction = camera.position.clone().sub(center).normalize();
      camera.position.copy(center).add(direction.multiplyScalar(10)); // Fixed distance for ortho
    } else {
      // For perspective camera, calculate distance
      const perspCamera = camera as THREE.PerspectiveCamera;
      const distance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(perspCamera.fov) / 2));
      const direction = camera.position.clone().sub(center).normalize();
      camera.position.copy(center).add(direction.multiplyScalar(distance * 1.5));
    }

    this.controls.target.copy(center);
    this.controls.update();
  }

  private subscribeToStore() {
    // Subscribe to the hierarchical rendering system
    this.storeUnsubscribe = useGraphStore.subscribe(() => {
      this.updateSceneFromRenderableObjects();
    });
  }

  private updateSceneFromRenderableObjects() {
    // Get the hierarchical renderable objects directly from store state
    const state = useGraphStore.getState();
    const renderableObjects: any[] = [];


    // Process root-level nodes
    for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {

      // Skip nodes with errors, but render previous output for dirty nodes
      if (runtime.error) {
        console.warn(`[SceneManager] Skipping node ${nodeId} due to error:`, runtime.error);
        continue;
      }
      
      // For dirty nodes, render the previous output if available
      if (runtime.isDirty) {
        // Continue processing to use cached output instead of skipping
      }

      if (runtime.type === "geoNode") {
        // Handle GeoNode: compute sub-flow and apply transforms
        const geoNodeVisible = runtime.params?.rendering?.visible !== false;
        if (!geoNodeVisible) continue;

        const subFlow = state.subFlows[nodeId];
        if (!subFlow || !subFlow.activeOutputNodeId) continue;

        // Get the active output node from sub-flow
        const outputNodeRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
        if (!outputNodeRuntime) {
          console.warn(`[SceneManager] No output node runtime for ${subFlow.activeOutputNodeId}`);
          continue;
        }
        
        if (outputNodeRuntime.error) {
          console.warn(`[SceneManager] Output node ${subFlow.activeOutputNodeId} has error:`, outputNodeRuntime.error);
          continue;
        }
        
        if (!outputNodeRuntime.output) {
          console.warn(`[SceneManager] Output node ${subFlow.activeOutputNodeId} has no output`);
          continue;
        }
        
        // For dirty output nodes, use cached output if available
        if (outputNodeRuntime.isDirty) {
        }

        // Check if the output node is marked as visible (render flag)
        const outputNodeVisible = outputNodeRuntime.params?.rendering?.visible === true;
        if (!outputNodeVisible) continue;

        const subFlowOutput = outputNodeRuntime.output;

        // Handle both direct Object3D and { object: Object3D } formats
        let object3D = null;
        if (subFlowOutput && typeof subFlowOutput === "object") {
          if ("isObject3D" in subFlowOutput) {
            // Direct Object3D
            object3D = subFlowOutput;
          } else if (
            "object" in subFlowOutput &&
            subFlowOutput.object &&
            typeof subFlowOutput.object === "object" &&
            "isObject3D" in subFlowOutput.object
          ) {
            // Wrapped in { object: Object3D } format
            object3D = subFlowOutput.object;
          }
        }

        if (object3D) {
          // Clone the object to avoid modifying the original
          const clonedOutput = object3D.clone();

          // Apply GeoNode transforms ADDITIVELY on top of sub-flow transforms
          const transform = runtime.params?.transform;
          if (transform) {
            
            // ADD GeoNode position to existing sub-flow position (don't overwrite)
            if (transform.position) {
              clonedOutput.position.set(
                clonedOutput.position.x + (transform.position.x || 0),
                clonedOutput.position.y + (transform.position.y || 0),
                clonedOutput.position.z + (transform.position.z || 0)
              );
            }
            
            // ADD GeoNode rotation to existing sub-flow rotation (don't overwrite)
            if (transform.rotation) {
              clonedOutput.rotation.set(
                clonedOutput.rotation.x + (transform.rotation.x || 0),
                clonedOutput.rotation.y + (transform.rotation.y || 0),
                clonedOutput.rotation.z + (transform.rotation.z || 0)
              );
            }
            
            // MULTIPLY GeoNode scale with existing sub-flow scale (don't overwrite)
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
        // Handle regular root-level nodes (like lights)
        const renderingVisible = runtime.params?.rendering?.visible !== false;
        if (!renderingVisible) continue;

        const output = runtime.output;
        // Handle both direct Object3D and { object: Object3D } formats for root nodes too
        let rootObject3D = null;
        if (output && typeof output === "object") {
          if ("isObject3D" in output) {
            // Direct Object3D (typical for lights)
            rootObject3D = output;
          } else if (
            "object" in output &&
            output.object &&
            typeof output.object === "object" &&
            "isObject3D" in output.object
          ) {
            // Wrapped in { object: Object3D } format
            rootObject3D = output.object;
          }
        }

        if (rootObject3D) {
          renderableObjects.push(rootObject3D);
        }
      }
    }

    // Clear all current objects from scene
    for (const [, object] of this.nodeObjects) {
      this.scene.remove(object);
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) object.material.dispose();
      }
    }
    this.nodeObjects.clear();

    // Add all renderable objects to scene
    renderableObjects.forEach((object3D, index) => {
      if (object3D && typeof object3D === "object" && "isObject3D" in object3D) {
        // Generate a unique ID for tracking (use object UUID or index-based ID)
        const objectId = object3D.uuid || `renderable_${index}`;
        this.scene.add(object3D);
        this.nodeObjects.set(objectId, object3D);
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

    // Use container dimensions if available, fallback to canvas dimensions
    const width = container ? container.clientWidth : canvas.clientWidth;
    const height = container ? container.clientHeight : canvas.clientHeight;
    const aspect = width / height;

    // Update perspective camera
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    // Update orthographic camera
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

    // Clean up grid planes
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
