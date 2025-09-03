import { RenderingSubsystem, ViewType } from "../types/SceneTypes";

export interface CustomEventData {
  cameraData?: {
    position: [number, number, number];
    target: [number, number, number];
  };
  isOrthographic?: boolean;
  view?: ViewType;
}

export interface EventManagerDependencies {
  onFitView: () => void;
  onGetCameraData: (event: CustomEvent) => void;
  onSetCameraData: (event: CustomEvent) => void;
  onSetCameraMode: (event: CustomEvent) => void;
  onSetCameraView: (event: CustomEvent) => void;
  onToggleAxisGizmo: () => void;
}

export interface IEventManager extends RenderingSubsystem {
  setupEventListeners(): void;
  removeEventListeners(): void;
}
