import * as THREE from "three";
import { useGraphStore, type NodeOutputs } from "../../engine/graphStore";
import { getDefaultObject3D } from "../../engine/containers/BaseContainer";
import { emitAppEvent } from "../../store/events";
import { SceneObjectManagerDependencies, ISceneObjectManager, NodeTransform } from "./ObjectTypes";

// What a root node currently wants displayed, before any cloning happens.
type Renderable = {
  // The engine output object whose reference identity signals "changed". Every cook
  // commits a fresh outputs record, and immer preserves identity of untouched
  // branches, so identity comparison is a correct and O(1) change detector.
  sourceOutput: NodeOutputs;
  // The geoNode transform param object (same identity argument); undefined for lights.
  transformRef: unknown;
  // The engine-owned source object (unwrapped from the container, not yet cloned).
  sourceObject: THREE.Object3D;
  // Whether the display copy is renderer-owned (deep clone, disposed on removal)
  // or borrowed live from the engine (lights: removed but never disposed).
  owned: boolean;
};

// A display entry currently in the scene, keyed by root node id.
type DisplayEntry = {
  sourceOutput: NodeOutputs;
  transformRef: unknown;
  object: THREE.Object3D;
  owned: boolean;
};

export class SceneObjectManager implements ISceneObjectManager {
  private displayEntries: Map<string, DisplayEntry> = new Map();
  private storeUnsubscribe: (() => void) | null = null;
  private rebuildRafId: number | null = null;

  constructor(private dependencies: SceneObjectManagerDependencies) {
    this.subscribeToStore();
  }

  // Diff the desired render list against the scene, keyed by root node id: entries
  // whose source output and transform are reference-identical are left untouched;
  // only changed nodes are re-cloned, and only removed nodes are disposed.
  public updateSceneFromRenderableObjects(): void {
    const desired = this.collectRenderables();
    let changed = false;

    // Remove or replace entries that are gone or stale.
    for (const [nodeId, entry] of this.displayEntries) {
      const want = desired.get(nodeId);
      if (want && want.sourceOutput === entry.sourceOutput && want.transformRef === entry.transformRef) {
        continue;
      }
      this.removeEntry(nodeId, entry);
      changed = true;
    }

    // Add entries that are new or were just removed as stale.
    for (const [nodeId, want] of desired) {
      if (this.displayEntries.has(nodeId)) continue;
      const object = this.buildDisplayObject(nodeId, want);
      if (!object) continue;
      this.dependencies.scene.add(object);
      this.displayEntries.set(nodeId, {
        sourceOutput: want.sourceOutput,
        transformRef: want.transformRef,
        object,
        owned: want.owned,
      });
      changed = true;
    }

    if (changed) {
      // Consumed by SceneManager to reapply the active display mode to the fresh
      // meshes (wireframe/xray materials do not survive re-cloning).
      emitAppEvent("minimystx:sceneUpdated");
    }
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
    for (const [nodeId, entry] of this.displayEntries) {
      this.removeEntry(nodeId, entry);
    }
    this.displayEntries.clear();
  }

  // Walk the root graph and collect what should be displayed right now.
  private collectRenderables(): Map<string, Renderable> {
    const state = useGraphStore.getState();
    const desired = new Map<string, Renderable>();

    for (const [nodeId, nodeState] of Object.entries(state.rootNodeState)) {
      if (nodeState.error) continue;
      if (nodeState.params?.rendering?.visible === false) continue;

      if (nodeState.type === "geoNode") {
        const subFlow = state.subFlows[nodeId];
        if (!subFlow || !subFlow.activeOutputNodeId) continue;
        const outputNodeState = subFlow.nodeState[subFlow.activeOutputNodeId];
        if (!outputNodeState || outputNodeState.error) continue;
        if (outputNodeState.params?.rendering?.visible === false) continue;
        if (!outputNodeState.output) continue;

        const sourceObject = getDefaultObject3D(outputNodeState.output);
        if (!sourceObject) continue;
        // Defensive backstop: an active output with no renderable mesh (e.g. an
        // empty Combine group that slipped past keep-last-good) is skipped.
        if (!this.hasRenderableMesh(sourceObject)) continue;

        desired.set(nodeId, {
          sourceOutput: outputNodeState.output,
          transformRef: nodeState.params?.transform,
          sourceObject,
          owned: true,
        });
      } else {
        // Lights (and any future root node with an Object3D output): borrowed live
        // from the engine, never cloned or disposed.
        if (!nodeState.output) continue;
        const sourceObject = getDefaultObject3D(nodeState.output);
        if (!sourceObject) continue;
        desired.set(nodeId, {
          sourceOutput: nodeState.output,
          transformRef: undefined,
          sourceObject,
          owned: false,
        });
      }
    }

    return desired;
  }

  private buildDisplayObject(nodeId: string, want: Renderable): THREE.Object3D | null {
    if (!want.owned) {
      return want.sourceObject;
    }
    let clone: THREE.Object3D;
    try {
      // Deep clone geometry + material so the display copy owns its GPU resources
      // and disposing it never frees buffers the engine outputs still reference.
      clone = this.cloneForDisplay(want.sourceObject);
    } catch (error) {
      console.error(`Failed to clone output of node ${nodeId} for display:`, error);
      return null;
    }
    if (want.transformRef) {
      this.applyTransform(clone, want.transformRef as NodeTransform);
    }
    return clone;
  }

  private removeEntry(nodeId: string, entry: DisplayEntry): void {
    this.dependencies.scene.remove(entry.object);
    if (entry.owned) {
      this.disposeObjectResources(entry.object);
    }
    this.displayEntries.delete(nodeId);
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
    // Coalesce the many store writes a single edit produces (param write plus cook
    // flush plus async resolutions) into at most one diff pass per animation frame,
    // and skip passes mid-import (a final pass runs when isImporting flips false).
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
