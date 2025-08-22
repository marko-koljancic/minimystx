/**
 * Export workflow for creating .mxscene files
 * Coordinates asset discovery, Web Worker operations, and progress tracking
 */

import type {
  SceneJson,
  ExportResult,
  ProgressUpdate,
  WorkerMessage,
  ExportRequest,
} from "./types";

import { discoverAssets, validateAssets } from "./asset-discovery";
import { getAssetCache } from "./opfs-cache";
import { hashBytesSHA256 } from "./crypto";
import { v4 as uuidv4 } from "uuid";

/**
 * Export options for .mxscene creation
 */
export interface ExportOptions {
  projectName: string;
  onProgress?: (progress: ProgressUpdate) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal; // For cancellation support
}

/**
 * Export the current scene as a .mxscene file
 */
export async function exportToMxScene(
  sceneData: SceneJson,
  options: ExportOptions
): Promise<ExportResult> {
  const { projectName, onProgress, onError, signal } = options;

  // Check for cancellation
  if (signal?.aborted) {
    throw new Error("Export was cancelled");
  }

  try {
    // Phase 1: Discover assets from the scene graph
    onProgress?.({
      phase: "collecting",
      percentage: 0,
      message: "Getting scene data...",
    });

    // Get current scene data
    const { exportGraphWithMeta } = await import("../../engine/graphStore");
    const existingData = await exportGraphWithMeta();

    // Asset discovery must happen BEFORE asset replacement to get the original File objects
    const originalGraph = {
      nodes: existingData.graph.nodes,
      subFlows: existingData.graph.subFlows || {},
    };

    // Phase 1: Discover assets from the original graph (before replacement)
    const discoveredAssets = await discoverAssets(originalGraph);

    onProgress?.({
      phase: "collecting",
      percentage: 10,
      message: `Found ${discoveredAssets.length} assets`,
    });

    // Phase 2: Validate assets
    const { valid: validAssets, invalid: invalidAssets } = await validateAssets(discoveredAssets);

    if (invalidAssets.length > 0) {
      console.warn(`[exportToMxScene] ${invalidAssets.length} invalid assets:`, invalidAssets);
    }

    onProgress?.({
      phase: "collecting",
      percentage: 20,
      message: `Validated ${validAssets.length} assets`,
    });

    // Check for cancellation before heavy work
    if (signal?.aborted) {
      throw new Error("Export was cancelled");
    }

    // Phase 3: Create export request for worker
    const exportRequest: ExportRequest = {
      sceneData,
      assets: validAssets,
      projectName,
    };

    // Phase 4: Execute export in Web Worker
    const result = await executeExportInWorker(exportRequest, onProgress, signal);

    // Phase 5: Store assets in OPFS cache for future use
    try {
      const assetCache = getAssetCache();
      for (const asset of validAssets) {
        if (!(await assetCache.has(asset.hash))) {
          await assetCache.put(asset.hash, asset.data);
        }
      }
    } catch (cacheError) {
      console.warn("[exportToMxScene] Failed to cache assets:", cacheError);
      // Non-fatal error - export can still succeed
    }

    return result;
  } catch (error) {
    const exportError = error instanceof Error ? error : new Error("Unknown export error");
    onError?.(exportError);
    throw exportError;
  }
}

/**
 * Execute the export operation in a Web Worker
 */
function executeExportInWorker(
  request: ExportRequest,
  onProgress?: (progress: ProgressUpdate) => void,
  signal?: AbortSignal
): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    // Create worker
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    const messageId = uuidv4();
    let isResolved = false;

    // Handle cancellation
    const abortHandler = () => {
      if (!isResolved) {
        worker.terminate();
        reject(new Error("Export was cancelled"));
        isResolved = true;
      }
    };

    signal?.addEventListener("abort", abortHandler);

    // Handle worker messages
    worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.id !== messageId) return;

      switch (message.type) {
        case "progress":
          onProgress?.(message.data as ProgressUpdate);
          break;

        case "success":
          if (!isResolved) {
            const result = message.data as ExportResult;
            worker.terminate();
            signal?.removeEventListener("abort", abortHandler);
            resolve(result);
            isResolved = true;
          }
          break;

        case "error":
          if (!isResolved) {
            const error = new Error(message.error?.message || "Export failed");
            worker.terminate();
            signal?.removeEventListener("abort", abortHandler);
            reject(error);
            isResolved = true;
          }
          break;
      }
    });

    // Handle worker errors
    worker.addEventListener("error", (error) => {
      if (!isResolved) {
        worker.terminate();
        signal?.removeEventListener("abort", abortHandler);
        reject(new Error(`Worker error: ${error.message}`));
        isResolved = true;
      }
    });

    // Send export request to worker
    const workerMessage: WorkerMessage = {
      id: messageId,
      type: "export",
      data: request,
    };

    worker.postMessage(workerMessage);
  });
}

/**
 * Trigger browser download of the exported .mxscene file
 */
export function downloadMxSceneFile(result: ExportResult): void {
  try {
    const url = URL.createObjectURL(result.blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = result.fileName;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);

    console.info(
      `[downloadMxSceneFile] Downloaded ${result.fileName} (${(result.size / 1024 / 1024).toFixed(
        2
      )} MB, ${result.assetCount} assets)`
    );
  } catch (error) {
    console.error("[downloadMxSceneFile] Failed to download file:", error);
    throw new Error("Failed to download .mxscene file");
  }
}

/**
 * Get current scene data from the graph store
 * This function interfaces with the existing Minimystx architecture
 */
export async function getCurrentSceneData(): Promise<SceneJson> {
  // We need to capture positions from ALL contexts, not just the current one
  // The existing exportGraphWithMeta only captures from the current context

  // Get the raw graph data without positions first
  const { useGraphStore } = await import("../../engine/graphStore");
  const graphStore = useGraphStore.getState();
  const rawGraphData = await graphStore.exportGraph({});

  // Now capture positions from both root and subflow contexts
  let rootPositions: Record<string, { x: number; y: number }> = {};
  const subFlowPositions: Record<string, Record<string, { x: number; y: number }>> = {};

  try {
    // Get positions from UI store which should have all contexts
    const { useUIStore } = await import("../../store/uiStore");
    const { getNodePositions } = useUIStore.getState();

    // Get root context positions
    rootPositions = getNodePositions("root") || {};

    // Get subflow context positions for all subflows
    Object.keys(rawGraphData.subFlows || {}).forEach((geoNodeId) => {
      const contextKey = `subflow-${geoNodeId}`;
      subFlowPositions[geoNodeId] = getNodePositions(contextKey) || {};
    });

    console.log(
      "[getCurrentSceneData] Captured positions - Root:",
      Object.keys(rootPositions),
      "SubFlows:",
      Object.keys(subFlowPositions)
    );
  } catch (error) {
    console.warn("[getCurrentSceneData] Failed to capture positions:", error);
    // Fallback to current context positions
    try {
      const event = new CustomEvent("minimystx:getNodePositions");
      window.dispatchEvent(event);
      const eventData = event as unknown as { nodePositions?: typeof rootPositions };
      if (eventData.nodePositions) {
        rootPositions = eventData.nodePositions;
      }
    } catch (e) {
      // Use empty positions as final fallback
    }
  }

  // Get other metadata (camera, viewport)
  const { exportGraphWithMeta } = await import("../../engine/graphStore");
  const existingData = await exportGraphWithMeta();

  // Asset discovery must happen BEFORE asset replacement to get the original File objects
  const originalGraph = {
    nodes: rawGraphData.nodes,
    subFlows: rawGraphData.subFlows || {},
  };

  // Convert the existing data structure to our SceneJson format
  // First, we need to create a copy and replace asset references
  const processedGraph = await replaceAssetsWithReferences(originalGraph);

  // Update subflows with correct positions
  const subFlowsWithPositions = { ...processedGraph.subFlows };
  Object.entries(subFlowsWithPositions).forEach(([geoNodeId, subFlow]) => {
    if (subFlowPositions[geoNodeId]) {
      subFlowsWithPositions[geoNodeId] = {
        ...subFlow,
        positions: subFlowPositions[geoNodeId],
      };
      console.log(
        `[getCurrentSceneData] Added positions to subflow ${geoNodeId}:`,
        subFlowPositions[geoNodeId]
      );
    }
  });

  const sceneData: SceneJson = {
    schemaVersion: "1.0",
    engineVersion: "0.1.0",
    units: "meters",
    graph: {
      nodes: processedGraph.nodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        params: node.params,
      })),
      edges: rawGraphData.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
      nodeRuntime: rawGraphData.nodeRuntime,
      positions: rootPositions,
      subFlows: subFlowsWithPositions,
    },
    camera: {
      position: existingData.camera.position as [number, number, number],
      target: existingData.camera.target as [number, number, number],
      fov: (existingData.camera as any).fov || 50,
    },
    renderer: {
      background: "#101014",
      exposure: 1.0,
    },
    ui: {
      gridVisible: true,
      minimapVisible: false,
      showFlowControls: true,
      connectionLineStyle: "bezier",
      viewportStates: {
        root: existingData.viewport,
      },
    },
    assets: [], // Will be populated by asset discovery
    meta: {
      name: "Untitled Project",
      description: "",
      projectId: uuidv4(),
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    },
  };

  return sceneData;
}

/**
 * Replace asset File/SerializableObjFile objects with asset hash references in node parameters
 * This ensures that when scenes are loaded, assets can be restored from the cache
 */
async function replaceAssetsWithReferences(graphData: {
  nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
  subFlows: Record<string, any>;
}): Promise<{
  nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
  subFlows: Record<string, any>;
}> {
  const processedNodes = await Promise.all(
    graphData.nodes.map(async (node) => {
      if (node.type === "importObjNode" && node.params?.object) {
        const updatedParams = { ...node.params };
        const objectParams = updatedParams.object as any;

        if (objectParams?.file) {
          console.log(
            `[replaceAssetsWithReferences] Processing file for node ${node.id}:`,
            objectParams.file
          );
          const assetHash = await computeAssetHash(objectParams.file);
          if (assetHash) {
            console.log(
              `[replaceAssetsWithReferences] Computed hash ${assetHash} for node ${node.id}`
            );
            // Replace the file with an asset reference
            updatedParams.object = {
              ...objectParams,
              file: null, // Clear the file
              assetHash, // Add the hash reference
            };
          } else {
            console.warn(
              `[replaceAssetsWithReferences] Failed to compute hash for node ${node.id}`
            );
          }
        }

        return { ...node, params: updatedParams };
      }
      return node;
    })
  );

  const processedSubFlows: Record<string, any> = {};
  for (const [geoNodeId, subFlow] of Object.entries(graphData.subFlows)) {
    const processedSubFlowNodes = await Promise.all(
      subFlow.nodes.map(async (node: any) => {
        if (node.type === "importObjNode" && node.params?.object) {
          const updatedParams = { ...node.params };
          const objectParams = updatedParams.object as any;

          if (objectParams?.file) {
            console.log(
              `[replaceAssetsWithReferences] [SubFlow] Processing file for node ${node.id}:`,
              objectParams.file
            );
            const assetHash = await computeAssetHash(objectParams.file);
            if (assetHash) {
              console.log(
                `[replaceAssetsWithReferences] [SubFlow] Computed hash ${assetHash} for node ${node.id}`
              );
              // Replace the file with an asset reference
              updatedParams.object = {
                ...objectParams,
                file: null, // Clear the file
                assetHash, // Add the hash reference
              };
            } else {
              console.warn(
                `[replaceAssetsWithReferences] [SubFlow] Failed to compute hash for node ${node.id}`
              );
            }
          }

          return { ...node, params: updatedParams };
        }
        return node;
      })
    );

    processedSubFlows[geoNodeId] = {
      ...subFlow,
      nodes: processedSubFlowNodes,
    };
  }

  return {
    nodes: processedNodes,
    subFlows: processedSubFlows,
  };
}

/**
 * Compute asset hash for a File or SerializableObjFile
 */
async function computeAssetHash(file: unknown): Promise<string | null> {
  try {
    let content: string;

    if (file instanceof File) {
      content = await file.text();
    } else if (isSerializableObjFile(file)) {
      content = atob(file.content);
    } else {
      return null;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    return await hashBytesSHA256(data.buffer);
  } catch (error) {
    console.warn("[computeAssetHash] Failed to compute hash:", error);
    return null;
  }
}

/**
 * Type guard for SerializableObjFile
 */
function isSerializableObjFile(
  obj: unknown
): obj is { name: string; size: number; lastModified: number; content: string } {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "name" in obj &&
    "size" in obj &&
    "lastModified" in obj &&
    "content" in obj &&
    typeof (obj as any).name === "string" &&
    typeof (obj as any).size === "number" &&
    typeof (obj as any).lastModified === "number" &&
    typeof (obj as any).content === "string"
  );
}
