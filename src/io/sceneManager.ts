import type { ImportResult } from "./mxscene/types";
import { applyImportedScene } from "./mxscene/import";
import { v4 as uuid } from "uuid";
export interface SceneInitializationOptions {
  triggerRecomputation?: boolean;
  restoreCamera?: boolean;
  resetUIToDefaults?: boolean;
}
export interface SceneState {
  isLoaded: boolean;
  isInitializing: boolean;
  hasError: boolean;
  errorMessage?: string;
  lastLoadedFile?: string;
}
let sceneState: SceneState = {
  isLoaded: false,
  isInitializing: false,
  hasError: false,
};
export function getSceneState(): SceneState {
  return { ...sceneState };
}

async function createDefaultScene(): Promise<void> {
  const { useGraphStore } = await import("../engine/graphStore");
  const graphStore = useGraphStore.getState();

  const directionalLightId = uuid();
  graphStore.addNode(
    {
      id: directionalLightId,
      type: "directionalLightNode",
      params: {},
    },
    { type: "root" }
  );

  const hemisphereLightId = uuid();
  graphStore.addNode(
    {
      id: hemisphereLightId,
      type: "hemisphereLightNode",
      params: {},
    },
    { type: "root" }
  );

  const geoNodeId = uuid();
  graphStore.addNode(
    {
      id: geoNodeId,
      type: "geoNode",
      params: {},
    },
    { type: "root" }
  );

  await new Promise((resolve) => setTimeout(resolve, 100));

  const torusKnotId = uuid();
  graphStore.addNode(
    {
      id: torusKnotId,
      type: "torusKnotNode",
      params: {},
    },
    { type: "subflow", geoNodeId }
  );

}
export async function initializeNewScene(options: SceneInitializationOptions = {}): Promise<void> {
  const { triggerRecomputation = true, restoreCamera = true, resetUIToDefaults = false } = options;
  try {
    sceneState = {
      isLoaded: false,
      isInitializing: true,
      hasError: false,
    };
    const { useGraphStore } = await import("../engine/graphStore");
    const graphStore = useGraphStore.getState();
    graphStore.clear();

    const { useDocumentStore } = await import("../store/documentStore");
    useDocumentStore.getState().clearDocument();

    if (resetUIToDefaults) {
      const { useUIStore } = await import("../store/uiStore");
      const uiStore = useUIStore.getState();
      uiStore.resetToDefaults();
    }
    if (restoreCamera) {
      setTimeout(async () => {
        const { getSceneManager } = await import("../rendering/sceneManagerRegistry");
        getSceneManager()?.setCameraPose({
          position: [5, 5, 5],
          target: [0, 0, 0],
          fov: 50,
        });
      }, 100);
    }
    document.title = "Minimystx";

    await createDefaultScene();

    if (triggerRecomputation) {
      await triggerSceneRecomputation();
    }
    sceneState = {
      isLoaded: true,
      isInitializing: false,
      hasError: false,
    };
  } catch (error) {
    sceneState = {
      isLoaded: false,
      isInitializing: false,
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown error during scene initialization",
    };
    throw error;
  }
}
export async function initializeFromMxScene(
  result: ImportResult,
  options: SceneInitializationOptions = {}
): Promise<void> {
  const { triggerRecomputation = true } = options;
  try {
    sceneState = {
      isLoaded: false,
      isInitializing: true,
      hasError: false,
      lastLoadedFile: result.scene.meta.name,
    };
    await applyImportedScene(result);
    await validateSceneAssets(result);
    if (triggerRecomputation) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await triggerSceneRecomputation();
    }
    sceneState = {
      isLoaded: true,
      isInitializing: false,
      hasError: false,
      lastLoadedFile: result.scene.meta.name,
    };
  } catch (error) {
    sceneState = {
      isLoaded: false,
      isInitializing: false,
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown error during scene loading",
    };
    throw error;
  }
}
let recomputeDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
export async function triggerSceneRecomputation(): Promise<void> {
  try {
    const { useGraphStore } = await import("../engine/graphStore");
    const graphStore = useGraphStore.getState();
    if (recomputeDebounceTimeout) {
      clearTimeout(recomputeDebounceTimeout);
    }
    recomputeDebounceTimeout = setTimeout(async () => {
      try {
        await graphStore.computeAll();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const subFlows = graphStore.getSubFlows();
        for (const [geoNodeId, subFlow] of Object.entries(subFlows)) {
          if (subFlow.nodeState && Object.keys(subFlow.nodeState).length > 0) {
            await graphStore.computeNode(geoNodeId, { type: "root" });
          }
        }
      } catch (error) {
        console.error("Error during scene recomputation:", error);
      }
    }, 50);
  } catch (error) {
    console.error("Error during scene recomputation:", error);
  }
}
async function validateSceneAssets(result: ImportResult): Promise<void> {
  const { getAssetCache } = await import("./mxscene/opfs-cache");
  const assetCache = getAssetCache();
  const missing: string[] = [];
  for (const manifestAsset of result.manifest.assets) {
    const isAvailable = await assetCache.has(manifestAsset.id);
    if (!isAvailable) {
      missing.push(manifestAsset.name);
    }
  }
  if (missing.length > 0) {
    // Non-fatal: the affected import nodes surface their own compute errors.
    console.warn("Scene loaded with assets missing from the cache:", missing);
  }
}
