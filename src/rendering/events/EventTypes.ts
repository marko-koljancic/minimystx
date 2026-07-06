import { RenderingSubsystem } from "../types/SceneTypes";

export interface EventManagerDependencies {
  onFitView: () => void;
  onSetCameraView: (event: CustomEvent) => void;
  onSceneUpdate: () => void;
}

export interface IEventManager extends RenderingSubsystem {
  setupEventListeners(): void;
  removeEventListeners(): void;
}
