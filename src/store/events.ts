// The typed registry for the surviving cross-world window events: commands and
// notifications that cross the React/imperative boundary where a store
// subscription does not fit (re-firing the same value must re-trigger, or the
// payload is transient). Every event name and payload is declared here; all
// emitters go through emitAppEvent, and listeners use onAppEvent (or a plain
// addEventListener with a name from this interface).

export interface AppEvents {
  // Flow canvas commands
  "minimystx:fitNodes": undefined;
  "minimystx:setViewport": { x: number; y: number; zoom: number };
  "minimystx:saveCurrentViewport": undefined;
  "minimystx:restoreViewportAfterMaximize": undefined;
  "minimystx:createNode": { nodeType: string; position?: { x: number; y: number } };
  "minimystx:applyAutoLayout": { algorithm: "dagre" | "elk" };
  "minimystx:applyLayout": {
    nodes: Array<{ id: string; position?: { x: number; y: number } }>;
    algorithm: string;
    selectedOnly?: boolean;
    selectedCount?: number;
  };
  // Viewport (3D) commands
  "minimystx:fitView": undefined;
  "minimystx:setCameraView": { view: "top" | "front" | "left" | "right" | "bottom" };
  // Renderer notification: scene objects were added/replaced, reapply display mode
  "minimystx:sceneUpdated": undefined;
}

export function emitAppEvent<K extends keyof AppEvents>(
  name: K,
  ...detail: AppEvents[K] extends undefined ? [] : [AppEvents[K]]
): void {
  window.dispatchEvent(new CustomEvent(name, { detail: detail[0] }));
}

// Returns the unsubscribe function.
export function onAppEvent<K extends keyof AppEvents>(name: K, handler: (detail: AppEvents[K]) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent).detail as AppEvents[K]);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
