import { EventManagerDependencies, IEventManager } from "./EventTypes";

export class EventManager implements IEventManager {
  private isSetup = false;

  constructor(private dependencies: EventManagerDependencies) {}

  public setupEventListeners(): void {
    if (this.isSetup) return;

    window.addEventListener("minimystx:fitView", this.dependencies.onFitView);
    window.addEventListener("minimystx:setCameraView", this.dependencies.onSetCameraView as EventListener);
    window.addEventListener("minimystx:sceneUpdated", this.dependencies.onSceneUpdate);

    this.isSetup = true;
  }

  public removeEventListeners(): void {
    if (!this.isSetup) return;

    window.removeEventListener("minimystx:fitView", this.dependencies.onFitView);
    window.removeEventListener("minimystx:setCameraView", this.dependencies.onSetCameraView as EventListener);
    window.removeEventListener("minimystx:sceneUpdated", this.dependencies.onSceneUpdate);

    this.isSetup = false;
  }

  public dispose(): void {
    this.removeEventListeners();
  }
}
