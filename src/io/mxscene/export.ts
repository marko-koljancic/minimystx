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

export interface ExportOptions {
  projectName: string;
  onProgress?: (progress: ProgressUpdate) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

export async function exportToMxScene(
  sceneData: SceneJson,
  options: ExportOptions
): Promise<ExportResult> {
  const { projectName, onProgress, onError, signal } = options;

  if (signal?.aborted) {
    throw new Error("Export was cancelled");
  }

  try {
    onProgress?.({
      phase: "collecting",
      percentage: 0,
      message: "Getting scene data...",
    });

    const { exportGraphWithMeta } = await import("../../engine/graphStore");
    const existingData = await exportGraphWithMeta();

    const originalGraph = {
      nodes: existingData.graph.nodes,
      subFlows: existingData.graph.subFlows || {},
    };

    const discoveredAssets = await discoverAssets(originalGraph);

    onProgress?.({
      phase: "collecting",
      percentage: 10,
      message: `Found ${discoveredAssets.length} assets`,
    });

    const { valid: validAssets, invalid: invalidAssets } = await validateAssets(discoveredAssets);

    if (invalidAssets.length > 0) {
    }

    onProgress?.({
      phase: "collecting",
      percentage: 20,
      message: `Validated ${validAssets.length} assets`,
    });

    if (signal?.aborted) {
      throw new Error("Export was cancelled");
    }

    const exportRequest: ExportRequest = {
      sceneData,
      assets: validAssets,
      projectName,
    };

    const result = await executeExportInWorker(exportRequest, onProgress, signal);

    try {
      const assetCache = getAssetCache();
      for (const asset of validAssets) {
        if (!(await assetCache.has(asset.hash))) {
          await assetCache.put(asset.hash, asset.data);
        }
      }
    } catch (cacheError) {
    }

    return result;
  } catch (error) {
    const exportError = error instanceof Error ? error : new Error("Unknown export error");
    onError?.(exportError);
    throw exportError;
  }
}

function executeExportInWorker(
  request: ExportRequest,
  onProgress?: (progress: ProgressUpdate) => void,
  signal?: AbortSignal
): Promise<ExportResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    const messageId = uuidv4();
    let isResolved = false;

    const abortHandler = () => {
      if (!isResolved) {
        worker.terminate();
        reject(new Error("Export was cancelled"));
        isResolved = true;
      }
    };

    signal?.addEventListener("abort", abortHandler);

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

    worker.addEventListener("error", (error) => {
      if (!isResolved) {
        worker.terminate();
        signal?.removeEventListener("abort", abortHandler);
        reject(new Error(`Worker error: ${error.message}`));
        isResolved = true;
      }
    });

    const workerMessage: WorkerMessage = {
      id: messageId,
      type: "export",
      data: request,
    };

    worker.postMessage(workerMessage);
  });
}

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

    URL.revokeObjectURL(url);

  } catch (error) {
    throw new Error("Failed to download .mxscene file");
  }
}

export async function getCurrentSceneData(): Promise<SceneJson> {
  const { useGraphStore } = await import("../../engine/graphStore");
  const graphStore = useGraphStore.getState();
  const rawGraphData = await graphStore.exportGraph({});

  let rootPositions: Record<string, { x: number; y: number }> = {};
  const subFlowPositions: Record<string, Record<string, { x: number; y: number }>> = {};

  try {
    const { useUIStore } = await import("../../store/uiStore");
    const { getNodePositions } = useUIStore.getState();

    rootPositions = getNodePositions("root") || {};

    Object.keys(rawGraphData.subFlows || {}).forEach((geoNodeId) => {
      const contextKey = `subflow-${geoNodeId}`;
      subFlowPositions[geoNodeId] = getNodePositions(contextKey) || {};
    });

  } catch (error) {
    try {
      const event = new CustomEvent("minimystx:getNodePositions");
      window.dispatchEvent(event);
      const eventData = event as unknown as { nodePositions?: typeof rootPositions };
      if (eventData.nodePositions) {
        rootPositions = eventData.nodePositions;
      }
    } catch (e) {
      // Ignore errors when dispatching layout event
    }
  }

  const { exportGraphWithMeta } = await import("../../engine/graphStore");
  const existingData = await exportGraphWithMeta();

  const originalGraph = {
    nodes: rawGraphData.nodes,
    subFlows: rawGraphData.subFlows || {},
  };

  const processedGraph = await replaceAssetsWithReferences(originalGraph);

  const subFlowsWithPositions = { ...processedGraph.subFlows };
  Object.entries(subFlowsWithPositions).forEach(([geoNodeId, subFlow]) => {
    if (subFlowPositions[geoNodeId]) {
      subFlowsWithPositions[geoNodeId] = {
        ...subFlow,
        positions: subFlowPositions[geoNodeId],
      };
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
    assets: [],
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
          const assetHash = await computeAssetHash(objectParams.file);
          if (assetHash) {

            updatedParams.object = {
              ...objectParams,
              file: null,
              assetHash,
            };
          } else {
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
            const assetHash = await computeAssetHash(objectParams.file);
            if (assetHash) {
              updatedParams.object = {
                ...objectParams,
                file: null,
                assetHash,
              };
            } else {
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
    return null;
  }
}

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
