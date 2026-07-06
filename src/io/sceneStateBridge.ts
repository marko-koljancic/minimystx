import type { CameraData, RendererData, UIData } from "./mxscene/types";
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
export async function syncCameraState(cameraData: CameraData): Promise<CameraSyncResult> {
  const { getSceneManager } = await import("../rendering/sceneManagerRegistry");
  const sceneManager = getSceneManager();
  if (!sceneManager) {
    return { success: false, error: "Scene manager not ready for camera restore" };
  }
  try {
    sceneManager.setCameraPose({
      position: cameraData.position,
      target: cameraData.target,
      fov: cameraData.fov,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to restore camera: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
export async function syncUIState(uiData: UIData, options: StateSyncOptions = {}): Promise<UISyncResult> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };
  try {
    const { useUIStore } = await import("../store/uiStore");
    const ui = useUIStore.getState();
    if (uiData.gridVisible !== undefined) {
      ui.setShowGridInRenderView(uiData.gridVisible);
    }
    if (uiData.minimapVisible !== undefined) {
      ui.setShowMinimap(uiData.minimapVisible);
    }
    if (uiData.showFlowControls !== undefined) {
      ui.setShowFlowControls(uiData.showFlowControls);
    }
    if (uiData.connectionLineStyle) {
      ui.setConnectionLineStyle(uiData.connectionLineStyle as Parameters<typeof ui.setConnectionLineStyle>[0]);
    }
    // The flow canvas viewport is a command, not state: the canvas applies it via
    // the setViewport event after it has mounted for the restored context.
    if (uiData.viewportStates?.root) {
      const { emitAppEvent } = await import("../store/events");
      setTimeout(() => {
        emitAppEvent("minimystx:setViewport", uiData.viewportStates.root);
      }, opts.delayMs);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to sync UI state: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
export async function syncRendererState(rendererData: RendererData): Promise<{ success: boolean; error?: string }> {
  try {
    const { usePreferencesStore } = await import("../store/preferencesStore");
    const preferences = usePreferencesStore.getState();
    if (rendererData.background) {
      preferences.updateRendererBackground({ color: rendererData.background });
    }
    if (rendererData.exposure !== undefined) {
      preferences.updateMaterials({ exposure: rendererData.exposure });
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to sync renderer state: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
// Ready means the SceneManager has registered itself (camera restore needs it).
export async function waitForSceneReady(timeoutMs: number = 5000): Promise<boolean> {
  const { getSceneManager } = await import("../rendering/sceneManagerRegistry");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getSceneManager()) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return getSceneManager() !== null;
}
export async function syncAllSceneState(
  cameraData: CameraData,
  uiData: UIData,
  rendererData: RendererData,
  options: StateSyncOptions = {}
): Promise<{
  camera: CameraSyncResult;
  ui: UISyncResult;
  renderer: { success: boolean; error?: string };
}> {
  // Each sync is independent: ui and renderer restores are plain store writes and
  // must not be blocked when the camera's SceneManager is not (yet) registered.
  return {
    camera: await syncCameraState(cameraData),
    ui: await syncUIState(uiData, options),
    renderer: await syncRendererState(rendererData),
  };
}
