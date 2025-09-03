import { EventManagerDependencies, IEventManager } from "./EventTypes";

export class EventManager implements IEventManager {
  private isSetup = false;

  constructor(private dependencies: EventManagerDependencies) {}

  public setupEventListeners(): void {
    if (this.isSetup) return;

    window.addEventListener("minimystx:fitView", this.dependencies.onFitView);
    window.addEventListener(
      "minimystx:getCameraData",
      this.dependencies.onGetCameraData as EventListener
    );
    window.addEventListener(
      "minimystx:setCameraData",
      this.dependencies.onSetCameraData as EventListener
    );
    window.addEventListener(
      "minimystx:setCameraMode",
      this.dependencies.onSetCameraMode as EventListener
    );
    window.addEventListener(
      "minimystx:setCameraView",
      this.dependencies.onSetCameraView as EventListener
    );
    window.addEventListener("minimystx:toggleAxisGizmo", this.dependencies.onToggleAxisGizmo);

    this.isSetup = true;
  }

  public removeEventListeners(): void {
    if (!this.isSetup) return;

    window.removeEventListener("minimystx:fitView", this.dependencies.onFitView);
    window.removeEventListener(
      "minimystx:getCameraData",
      this.dependencies.onGetCameraData as EventListener
    );
    window.removeEventListener(
      "minimystx:setCameraData",
      this.dependencies.onSetCameraData as EventListener
    );
    window.removeEventListener(
      "minimystx:setCameraMode",
      this.dependencies.onSetCameraMode as EventListener
    );
    window.removeEventListener(
      "minimystx:setCameraView",
      this.dependencies.onSetCameraView as EventListener
    );
    window.removeEventListener("minimystx:toggleAxisGizmo", this.dependencies.onToggleAxisGizmo);

    this.isSetup = false;
  }

  public dispose(): void {
    this.removeEventListeners();
  }
}
