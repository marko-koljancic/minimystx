import * as THREE from "three";
import { useGraphStore } from "../../engine/graphStore";
import { Object3DContainer } from "../../engine/containers/BaseContainer";
import { SceneObjectManagerDependencies, ISceneObjectManager, NodeTransform } from "./ObjectTypes";

export class SceneObjectManager implements ISceneObjectManager {
  private nodeObjects: Map<string, THREE.Object3D> = new Map();
  // Keys in `nodeObjects` that the renderer owns (deep-cloned display copies) and is
  // therefore allowed to dispose. Objects borrowed from the engine (e.g. lights) are
  // never disposed, only removed from the scene.
  private ownedObjects: Set<string> = new Set();
  private storeUnsubscribe: (() => void) | null = null;
  private rebuildRafId: number | null = null;

  constructor(private dependencies: SceneObjectManagerDependencies) {
    this.subscribeToStore();
  }

  public updateSceneFromRenderableObjects(): void {
    const state = useGraphStore.getState();
    // Each entry pairs a display object with whether the renderer owns it (safe to dispose).
    const renderables: { object: THREE.Object3D; owned: boolean }[] = [];

    for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {
      if (runtime.error) {
        continue;
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

          if (lightObject) {
            // Lights are engine-owned; add the live object without cloning or disposing.
            renderables.push({ object: lightObject, owned: false });
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

        if (!outputNodeRuntime.output || typeof outputNodeRuntime.output !== "object") {
          continue;
        }

        const outputNodeVisible = outputNodeRuntime.params?.rendering?.visible !== false;
        if (!outputNodeVisible) continue;

        const subFlowOutput = outputNodeRuntime.output;
        let object3D: THREE.Object3D | null = null;

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

        // Defensive backstop: an active output with no renderable mesh (e.g. an empty
        // Combine group that slipped past the engine's keep-last-good) is skipped
        // rather than added as an invisible object.
        if (object3D && !this.hasRenderableMesh(object3D)) {
          continue;
        }

        if (object3D) {
          let clonedOutput: THREE.Object3D;
          try {
            // Deep clone geometry + material so the display copy owns its GPU
            // resources and disposing it never frees buffers the engine cache reuses.
            clonedOutput = this.cloneForDisplay(object3D);
          } catch (error) {
            continue;
          }

          const transform = runtime.params?.transform;
          if (transform) {
            this.applyTransform(clonedOutput, transform);
          }

          renderables.push({ object: clonedOutput, owned: true });
        }
      } else {
        const renderingVisible = runtime.params?.rendering?.visible !== false;
        if (!renderingVisible) continue;

        const output = runtime.output;
        let rootObject3D: THREE.Object3D | null = null;

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
          // Clone so the renderer owns the display copy (protects the engine output).
          renderables.push({ object: this.cloneForDisplay(rootObject3D), owned: true });
        }
      }
    }

    this.clearAllObjects();

    renderables.forEach(({ object, owned }, index) => {
      if (object && typeof object === "object" && "isObject3D" in object) {
        const objectId = object.uuid || `renderable_${index}`;
        this.addNodeObject(objectId, object, owned);
      }
    });
  }

  public addNodeObject(nodeId: string, object: THREE.Object3D, owned: boolean = true): void {
    this.dependencies.scene.add(object);
    this.nodeObjects.set(nodeId, object);
    if (owned) {
      this.ownedObjects.add(nodeId);
    }
  }

  public removeNodeObject(nodeId: string): void {
    const object = this.nodeObjects.get(nodeId);
    if (object) {
      this.dependencies.scene.remove(object);
      if (this.ownedObjects.has(nodeId)) {
        this.disposeObjectResources(object);
      }
      this.nodeObjects.delete(nodeId);
      this.ownedObjects.delete(nodeId);
    }
  }

  public clearAllObjects(): void {
    for (const [nodeId] of this.nodeObjects) {
      this.removeNodeObject(nodeId);
    }
    this.nodeObjects.clear();
    this.ownedObjects.clear();
  }

  public dispose(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    if (this.rebuildRafId !== null) {
      cancelAnimationFrame(this.rebuildRafId);
      this.rebuildRafId = null;
    }

    this.clearAllObjects();
  }

  // True if the object (mesh or group hierarchy) contains at least one mesh to draw.
  private hasRenderableMesh(object: THREE.Object3D): boolean {
    if (object instanceof THREE.Mesh) return true;
    let found = false;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) found = true;
    });
    return found;
  }

  // Clone an object hierarchy, cloning each mesh's geometry and material so the
  // returned copy shares no GPU resources with the engine-owned source.
  private cloneForDisplay(object: THREE.Object3D): THREE.Object3D {
    const clone = object.clone(true);
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry = child.geometry.clone();
        }
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m) => m.clone());
        } else if (child.material) {
          child.material = child.material.clone();
        }
      }
    });
    return clone;
  }

  private disposeObjectResources(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m?.dispose());
        } else {
          material?.dispose();
        }
      }
    });
  }

  private subscribeToStore(): void {
    // Coalesce the many store writes a single edit produces (param write plus async
    // compute resolutions) into at most one scene rebuild per animation frame, and
    // skip rebuilds mid-import (a final rebuild runs when isImporting flips false).
    this.storeUnsubscribe = useGraphStore.subscribe(() => {
      this.scheduleRebuild();
    });
  }

  private scheduleRebuild(): void {
    if (this.rebuildRafId !== null) return;
    this.rebuildRafId = requestAnimationFrame(() => {
      this.rebuildRafId = null;
      if (useGraphStore.getState().isImporting) {
        return;
      }
      this.updateSceneFromRenderableObjects();
      window.dispatchEvent(new CustomEvent("minimystx:sceneUpdated"));
    });
  }

  private applyTransform(object: THREE.Object3D, transform: NodeTransform): void {
    if (transform.position) {
      object.position.set(
        object.position.x + (transform.position.x || 0),
        object.position.y + (transform.position.y || 0),
        object.position.z + (transform.position.z || 0)
      );
    }

    if (transform.rotation) {
      object.rotation.set(
        object.rotation.x + (transform.rotation.x || 0),
        object.rotation.y + (transform.rotation.y || 0),
        object.rotation.z + (transform.rotation.z || 0)
      );
    }

    if (transform.scale) {
      const scaleFactor = transform.scaleFactor || 1;
      object.scale.set(
        object.scale.x * (transform.scale.x || 1) * scaleFactor,
        object.scale.y * (transform.scale.y || 1) * scaleFactor,
        object.scale.z * (transform.scale.z || 1) * scaleFactor
      );
    }
  }
}
