import * as THREE from "three";
import { RenderingSubsystem } from "../types/SceneTypes";

export interface SceneObjectManagerDependencies {
  scene: THREE.Scene;
}

export interface NodeTransform {
  position?: { x?: number; y?: number; z?: number };
  rotation?: { x?: number; y?: number; z?: number };
  scale?: { x?: number; y?: number; z?: number };
  scaleFactor?: number;
}

export interface NodeRenderingParams {
  visible?: boolean;
}

export interface NodeParams {
  rendering?: NodeRenderingParams;
  transform?: NodeTransform;
}

export interface ISceneObjectManager extends RenderingSubsystem {
  updateSceneFromRenderableObjects(): void;
  addNodeObject(nodeId: string, object: THREE.Object3D): void;
  removeNodeObject(nodeId: string): void;
  clearAllObjects(): void;
}
