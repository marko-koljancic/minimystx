type EventCallback = (detail?: unknown) => void;

class EventBus {
  private events: Map<string, Set<EventCallback>> = new Map();

  emit(eventType: string, detail?: unknown): void {
    const callbacks = this.events.get(eventType);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(detail);
        } catch (error) {
          console.error(`Error in event callback for ${eventType}:`, error);
        }
      });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(eventType, { detail }));
    }
  }

  on(eventType: string, callback: EventCallback): void {
    if (!this.events.has(eventType)) {
      this.events.set(eventType, new Set());
    }
    this.events.get(eventType)!.add(callback);
  }

  off(eventType: string, callback: EventCallback): void {
    const callbacks = this.events.get(eventType);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.events.delete(eventType);
      }
    }
  }

  clear(): void {
    this.events.clear();
  }
}

export const eventBus = new EventBus();

export const emitSetCameraMode = (isOrthographic: boolean) =>
  eventBus.emit("minimystx:setCameraMode", { isOrthographic });
export const emitToggleAxisGizmo = () => eventBus.emit("minimystx:toggleAxisGizmo");
export const emitSetCameraView = (view: string) =>
  eventBus.emit("minimystx:setCameraView", { view });
