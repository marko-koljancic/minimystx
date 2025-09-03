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

  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("minimystx:setNodePosition", {
        detail: { nodeId: directionalLightId, position: { x: -200, y: -50 } },
      })
    );
    window.dispatchEvent(
      new CustomEvent("minimystx:setNodePosition", {
        detail: { nodeId: hemisphereLightId, position: { x: 0, y: -50 } },
      })
    );
    window.dispatchEvent(
      new CustomEvent("minimystx:setNodePosition", {
        detail: { nodeId: geoNodeId, position: { x: 200, y: 50 } },
      })
    );
    window.dispatchEvent(
      new CustomEvent("minimystx:setSubflowNodePosition", {
        detail: { geoNodeId, nodeId: torusKnotId, position: { x: 0, y: 0 } },
      })
    );
  }, 200);
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

    if (resetUIToDefaults) {
      const { useUIStore } = await import("../store/uiStore");
      const uiStore = useUIStore.getState();
      uiStore.resetToDefaults();
    }
    if (restoreCamera) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("minimystx:setCameraData", {
            detail: {
              position: [5, 5, 5],
              target: [0, 0, 0],
              fov: 50,
            },
          })
        );
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
    window.dispatchEvent(
      new CustomEvent("minimystx:sceneInitialized", {
        detail: { type: "new" },
      })
    );
  } catch (error) {
    sceneState = {
      isLoaded: false,
      isInitializing: false,
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : "Unknown error during scene initialization",
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
    window.dispatchEvent(
      new CustomEvent("minimystx:sceneInitialized", {
        detail: {
          type: "loaded",
          fileName: result.scene.meta.name,
          nodeCount: result.scene.graph.nodes.length,
        },
      })
    );
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
export async function triggerSceneRecomputation(): Promise<void> {
  try {
    const { useGraphStore } = await import("../engine/graphStore");
    const graphStore = useGraphStore.getState();
    if ((triggerSceneRecomputation as any)._debounceTimeout) {
      clearTimeout((triggerSceneRecomputation as any)._debounceTimeout);
    }
    (triggerSceneRecomputation as any)._debounceTimeout = setTimeout(async () => {
      try {
        await graphStore.computeAll();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const subFlows = graphStore.getSubFlows();
        for (const [geoNodeId, subFlow] of Object.entries(subFlows)) {
          if (subFlow.nodeState && Object.keys(subFlow.nodeState).length > 0) {
            await graphStore.computeNode(geoNodeId, { type: "root" });
          }
        }
      } catch (error) {}
    }, 50);
  } catch (error) {
    console.error("Error during scene recomputation:", error);
  }
}
(triggerSceneRecomputation as any)._debounceTimeout = null;
export async function validateSceneState(): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    const { useGraphStore } = await import("../engine/graphStore");
    const graphStore = useGraphStore.getState();
    const nodes = graphStore.getNodes({ type: "root" });
    const edges = graphStore.getEdges({ type: "root" });
    for (const node of nodes) {
      if (!node.id || !node.type) {
        errors.push(`Invalid node found: missing id or type`);
      }
      const { nodeRegistry } = await import("../flow/nodes/nodeRegistry");
      if (!nodeRegistry[node.type]) {
        errors.push(`Unknown node type: ${node.type}`);
      }
    }
    for (const edge of edges) {
      if (!edge.source || !edge.target) {
        errors.push(`Invalid edge found: missing source or target`);
        continue;
      }
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode) {
        errors.push(`Edge references non-existent source node: ${edge.source}`);
      }
      if (!targetNode) {
        errors.push(`Edge references non-existent target node: ${edge.target}`);
      }
    }
    const { getAssetCache } = await import("./mxscene/opfs-cache");
    const assetCache = getAssetCache();
    try {
      const isHealthy = await assetCache.isHealthy();
      if (!isHealthy) {
        warnings.push("Asset cache health check failed");
      }
    } catch (error) {
      warnings.push("Unable to verify asset cache health");
    }
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(
      `Scene validation failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return {
      isValid: false,
      errors,
      warnings,
    };
  }
}
async function validateSceneAssets(result: ImportResult): Promise<void> {
  const { getAssetCache } = await import("./mxscene/opfs-cache");
  const assetCache = getAssetCache();
  for (const manifestAsset of result.manifest.assets) {
    const isAvailable = await assetCache.has(manifestAsset.id);
    if (!isAvailable) {
      // To Do fix this
    }
  }
}
export function setupSceneEventListeners(): void {
  window.addEventListener("minimystx:resetScene", () => {
    initializeNewScene().catch(() => {});
  });
  window.addEventListener("minimystx:recomputeScene", () => {
    triggerSceneRecomputation().catch(() => {});
  });
}
