import * as THREE from "three";
import { useGraphStore } from "../../engine/graphStore";
import { Object3DContainer } from "../../engine/containers/BaseContainer";
import { SceneObjectManagerDependencies, ISceneObjectManager, NodeTransform } from "./ObjectTypes";

export class SceneObjectManager implements ISceneObjectManager {
  private nodeObjects: Map<string, THREE.Object3D> = new Map();
  private storeUnsubscribe: (() => void) | null = null;

  constructor(private dependencies: SceneObjectManagerDependencies) {
    this.subscribeToStore();
  }

  public updateSceneFromRenderableObjects(): void {
    const state = useGraphStore.getState();
    const renderableObjects: THREE.Object3D[] = [];

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
            this.applyTransform(clonedOutput, transform);
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

    this.clearAllObjects();

    renderableObjects.forEach((object3D, index) => {
      if (object3D && typeof object3D === "object" && "isObject3D" in object3D) {
        const objectId = object3D.uuid || `renderable_${index}`;
        this.addNodeObject(objectId, object3D);
      }
    });
  }

  public addNodeObject(nodeId: string, object: THREE.Object3D): void {
    this.dependencies.scene.add(object);
    this.nodeObjects.set(nodeId, object);
  }

  public removeNodeObject(nodeId: string): void {
    const object = this.nodeObjects.get(nodeId);
    if (object) {
      this.dependencies.scene.remove(object);
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
      this.nodeObjects.delete(nodeId);
    }
  }

  public clearAllObjects(): void {
    for (const [nodeId] of this.nodeObjects) {
      this.removeNodeObject(nodeId);
    }
    this.nodeObjects.clear();
  }

  public dispose(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    this.clearAllObjects();
  }

  private subscribeToStore(): void {
    this.storeUnsubscribe = useGraphStore.subscribe(() => {
      this.updateSceneFromRenderableObjects();
      
      const event = new CustomEvent("minimystx:sceneUpdated");
      window.dispatchEvent(event);
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
