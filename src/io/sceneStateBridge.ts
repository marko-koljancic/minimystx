import type { CameraData, UIData } from "./mxscene/types";
export interface StateSyncOptions {
  delayMs?: number;
  retries?: number;
  timeout?: number;
}
export interface CameraSyncResult {
  success: boolean;
  error?: string;
}
export interface UISyncResult {
  success: boolean;
  error?: string;
}
const DEFAULT_SYNC_OPTIONS: Required<StateSyncOptions> = {
  delayMs: 100,
  retries: 3,
  timeout: 5000,
};
export async function syncCameraState(
  cameraData: CameraData,
  options: StateSyncOptions = {}
): Promise<CameraSyncResult> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
  return new Promise((resolve) => {
    let attempts = 0;
    const attemptSync = () => {
      attempts++;
      try {
        window.dispatchEvent(
          new CustomEvent("minimystx:setCameraData", {
            detail: cameraData,
          })
        );
        setTimeout(() => {
          resolve({ success: true });
        }, opts.delayMs);
      } catch (error) {
        if (attempts < opts.retries) {
          setTimeout(attemptSync, opts.delayMs * attempts);
        } else {
          resolve({
            success: false,
            error: `Failed to sync camera after ${opts.retries} attempts: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          });
        }
      }
    };
    setTimeout(() => {
      resolve({
        success: false,
        error: `Camera sync timed out after ${opts.timeout}ms`,
      });
    }, opts.timeout);
    attemptSync();
  });
}
export async function syncUIState(uiData: UIData, options: StateSyncOptions = {}): Promise<UISyncResult> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
  return new Promise(async (resolve) => {
    try {
      if (uiData.gridVisible !== undefined) {
        window.dispatchEvent(
          new CustomEvent("minimystx:setGridVisibility", {
            detail: { visible: uiData.gridVisible },
          })
        );
      }
      if (uiData.viewportStates?.root) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("minimystx:setViewport", {
              detail: uiData.viewportStates.root,
            })
          );
        }, opts.delayMs);
      }
      setTimeout(() => {
        resolve({ success: true });
      }, opts.delayMs * 2);
    } catch (error) {
      resolve({
        success: false,
        error: `Failed to sync UI state: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  });
}
export async function syncRendererState(rendererData: any): Promise<{ success: boolean; error?: string }> {
  try {
    if (rendererData.background) {
      window.dispatchEvent(
        new CustomEvent("minimystx:setBackground", {
          detail: { color: rendererData.background },
        })
      );
    }
    if (rendererData.exposure !== undefined) {
      window.dispatchEvent(
        new CustomEvent("minimystx:setExposure", {
          detail: { exposure: rendererData.exposure },
        })
      );
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to sync renderer state: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
export async function waitForSceneReady(timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    let isResolved = false;
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        resolve(false);
      }
    }, timeoutMs);
    const checkReady = () => {
      try {
        if ((window as any).minimystx || document.querySelector('[data-testid="rendering-canvas"]')) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            resolve(true);
          }
        } else {
          setTimeout(checkReady, 100);
        }
      } catch (error) {
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  });
}
export function createStateSyncQueue() {
  const queue: Array<() => Promise<any>> = [];
  let isProcessing = false;
  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;
    while (queue.length > 0) {
      const task = queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {}
      }
    }
    isProcessing = false;
  };
  return {
    add: (task: () => Promise<any>) => {
      queue.push(task);
      processQueue();
    },
    clear: () => {
      queue.length = 0;
    },
    size: () => queue.length,
  };
}
const globalSyncQueue = createStateSyncQueue();
export async function syncAllSceneState(
  cameraData: CameraData,
  uiData: UIData,
  rendererData: any,
  options: StateSyncOptions = {}
): Promise<{
  camera: CameraSyncResult;
  ui: UISyncResult;
  renderer: { success: boolean; error?: string };
}> {
  const sceneReady = await waitForSceneReady();
  if (!sceneReady) {
    const error = "Scene not ready for state synchronization";
    return {
      camera: { success: false, error },
      ui: { success: false, error },
      renderer: { success: false, error },
    };
  }
  const results = {
    camera: await syncCameraState(cameraData, options),
    ui: await syncUIState(uiData, options),
    renderer: await syncRendererState(rendererData),
  };
  return results;
}
export function createDelayedSync<T>(
  syncFn: (data: T, options?: StateSyncOptions) => Promise<any>,
  delay: number = 100
) {
  return (data: T, options?: StateSyncOptions) => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await syncFn(data, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}
export const syncCameraStateDelayed = createDelayedSync(syncCameraState, 200);
export const syncUIStateDelayed = createDelayedSync(syncUIState, 100);
export { globalSyncQueue };
