import type {
  ImportResult,
  ProgressUpdate,
  WorkerMessage,
  ImportRequest,
  AssetReference,
} from "./types";
import { getAssetCache } from "./opfs-cache";
import { createZipReader, parseAssetFilename } from "./zip";
import { hashBytesSHA256 } from "./crypto";
import { v4 as uuidv4 } from "uuid";
export interface ImportOptions {
  onProgress?: (progress: ProgressUpdate) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}
export async function importFromMxScene(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { onProgress, onError, signal } = options;
  if (signal?.aborted) {
    throw new Error("Import was cancelled");
  }
  try {
    onProgress?.({
      phase: "reading",
      percentage: 0,
      message: "Reading .mxscene file...",
    });
    const fileBuffer = await file.arrayBuffer();
    if (signal?.aborted) {
      throw new Error("Import was cancelled");
    }
    const importRequest: ImportRequest = {
      fileBuffer,
      fileName: file.name,
    };
    const result = await executeImportInWorker(importRequest, onProgress, signal);
    await storeAssetsInCache(result, file, onProgress);
    return result;
  } catch (error) {
    const importError = error instanceof Error ? error : new Error("Unknown import error");
    onError?.(importError);
    throw importError;
  }
}
function executeImportInWorker(
  request: ImportRequest,
  onProgress?: (progress: ProgressUpdate) => void,
  signal?: AbortSignal
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const messageId = uuidv4();
    let isResolved = false;
    const abortHandler = () => {
      if (!isResolved) {
        worker.terminate();
        reject(new Error("Import was cancelled"));
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
            const result = message.data as ImportResult;
            worker.terminate();
            signal?.removeEventListener("abort", abortHandler);
            resolve(result);
            isResolved = true;
          }
          break;
        case "error":
          if (!isResolved) {
            const error = new Error(message.error?.message || "Import failed");
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
      type: "import",
      data: request,
    };
    worker.postMessage(workerMessage);
  });
}
async function storeAssetsInCache(
  result: ImportResult,
  originalFile: File,
  onProgress?: (progress: ProgressUpdate) => void
): Promise<void> {
  try {
    onProgress?.({
      phase: "extracting",
      percentage: 90,
      message: "Storing assets in cache...",
    });
    const assetCache = getAssetCache();
    const zipReader = createZipReader(await originalFile.arrayBuffer());
    for (let i = 0; i < result.manifest.assets.length; i++) {
      const assetEntry = result.manifest.assets[i];
      if (await assetCache.has(assetEntry.id)) {
        continue;
      }
      try {
        const assetFiles = await zipReader.list();
        const matchingFile = assetFiles.find((f) => {
          const parsed = parseAssetFilename(f);
          return parsed?.hash === assetEntry.id;
        });
        if (!matchingFile) {
          continue;
        }
        const assetData = await zipReader.readFile(matchingFile);
        const computedHash = await hashBytesSHA256(assetData.buffer);
        if (computedHash !== assetEntry.id) {
          continue;
        }
        await assetCache.put(assetEntry.id, assetData.buffer);
      } catch (error) {}
    }
  } catch (error) {}
}
export async function applyImportedScene(result: ImportResult): Promise<void> {
  const { scene } = result;
  try {
    const { syncAllSceneState, waitForSceneReady } = await import("../sceneStateBridge");
    await ensureAssetsReady(result);
    const restoredGraph = await restoreAssetsFromReferences(
      {
        nodes: scene.graph.nodes,
        subFlows: scene.graph.subFlows,
      },
      result
    );
    const restoredNodeRuntime = updateNodeRuntimeWithRestoredAssets(
      scene.graph.nodeRuntime,
      restoredGraph.nodes,
      restoredGraph.subFlows
    );
    const { useGraphStore } = await import("../../engine/graphStore");
    const graphStore = useGraphStore.getState();
    window.dispatchEvent(new CustomEvent("minimystx:sceneLoadingStart"));
    await graphStore.importGraph({
      nodes: restoredGraph.nodes,
      edges: scene.graph.edges,
      nodeRuntime: restoredNodeRuntime,
      positions: scene.graph.positions,
      subFlows: restoredGraph.subFlows,
      rootRenderTarget: null,
    });
    await waitForSceneReady(3000);
    const syncResults = await syncAllSceneState(scene.camera, scene.ui, scene.renderer, {
      delayMs: 150,
      retries: 2,
    });
    const failedSyncs = [];
    if (!syncResults.camera.success) failedSyncs.push("camera");
    if (!syncResults.ui.success) failedSyncs.push("ui");
    if (!syncResults.renderer.success) failedSyncs.push("renderer");
    if (failedSyncs.length > 0) {
    }
    if (scene.meta.name && scene.meta.name !== "Untitled Project") {
      document.title = `${scene.meta.name} - Minimystx`;
    } else {
      document.title = "Minimystx";
    }
    window.dispatchEvent(
      new CustomEvent("minimystx:sceneLoadingComplete", {
        detail: {
          nodesTotalCount: scene.graph.nodes.length,
          assetsCount: result.manifest.assets.length,
        },
      })
    );
  } catch (error) {
    window.dispatchEvent(
      new CustomEvent("minimystx:sceneLoadingError", {
        detail: { error: error instanceof Error ? error.message : "Unknown error" },
      })
    );
    throw new Error(
      `Failed to restore scene: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
export function selectAndImportMxSceneFile(
  options: ImportOptions = {}
): Promise<ImportResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mxscene";
    input.style.display = "none";
    input.addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        reject(
          new Error(
            `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 500MB.`
          )
        );
        return;
      }
      try {
        const result = await importFromMxScene(file, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    input.addEventListener("cancel", () => {
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}
export async function createAssetReferencesFromImport(
  result: ImportResult
): Promise<AssetReference[]> {
  const assetReferences: AssetReference[] = [];
  const assetCache = getAssetCache();
  for (const manifestAsset of result.manifest.assets) {
    try {
      const assetData = await assetCache.get(manifestAsset.id);
      if (!assetData) {
        continue;
      }
      const sceneAsset = result.scene.assets.find((a) => a.id === manifestAsset.id);
      const assetReference: AssetReference = {
        hash: manifestAsset.id,
        originalName: manifestAsset.name,
        originalPath: manifestAsset.originalPath,
        mime: manifestAsset.mime,
        size: manifestAsset.size,
        data: assetData,
        role: sceneAsset?.role || "unknown",
        importSettings: sceneAsset?.importSettings,
      };
      assetReferences.push(assetReference);
    } catch (error) {}
  }
  return assetReferences;
}
async function restoreAssetsFromReferences(
  graphData: {
    nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
    subFlows: Record<string, any>;
  },
  importResult: ImportResult
): Promise<{
  nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
  subFlows: Record<string, any>;
}> {
  const assetCache = getAssetCache();
  const restoredNodes = await Promise.all(
    graphData.nodes.map(async (node) => {
      if (
        (node.type === "importObjNode" || node.type === "importGltfNode") &&
        node.params?.object
      ) {
        const updatedParams = { ...node.params };
        const objectParams = updatedParams.object as any;
        if (objectParams?.assetHash && !objectParams?.file) {
          try {
            const restoredFile = await restoreAssetFromHash(
              objectParams.assetHash,
              importResult,
              assetCache
            );
            if (restoredFile) {
              updatedParams.object = {
                ...objectParams,
                file: restoredFile,
              };
            } else {
              updatedParams.object = {
                ...objectParams,
                assetHash: null,
              };
            }
          } catch (error) {
            updatedParams.object = {
              ...objectParams,
              assetHash: null,
            };
          }
        } else if (objectParams?.file) {
        } else if (objectParams?.assetHash) {
        } else {
        }
        return { ...node, params: updatedParams };
      }
      return node;
    })
  );
  const restoredSubFlows: Record<string, any> = {};
  for (const [geoNodeId, subFlow] of Object.entries(graphData.subFlows)) {
    const restoredSubFlowNodes = await Promise.all(
      subFlow.nodes.map(async (node: any) => {
        if (
          (node.type === "importObjNode" || node.type === "importGltfNode") &&
          node.params?.object
        ) {
          const updatedParams = { ...node.params };
          const objectParams = updatedParams.object as any;
          if (objectParams?.assetHash && !objectParams?.file) {
            try {
              const restoredFile = await restoreAssetFromHash(
                objectParams.assetHash,
                importResult,
                assetCache
              );
              if (restoredFile) {
                updatedParams.object = {
                  ...objectParams,
                  file: restoredFile,
                };
              } else {
                updatedParams.object = {
                  ...objectParams,
                  assetHash: null,
                };
              }
            } catch (error) {
              updatedParams.object = {
                ...objectParams,
                assetHash: null,
              };
            }
          } else if (objectParams?.file) {
          } else if (objectParams?.assetHash) {
          } else {
          }
          return { ...node, params: updatedParams };
        }
        return node;
      })
    );
    restoredSubFlows[geoNodeId] = {
      ...subFlow,
      nodes: restoredSubFlowNodes,
    };
  }
  return {
    nodes: restoredNodes,
    subFlows: restoredSubFlows,
  };
}
function updateNodeRuntimeWithRestoredAssets(
  originalNodeRuntime: Record<string, any>,
  restoredNodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>,
  restoredSubFlows: Record<string, any>
): Record<string, any> {
  const updatedNodeRuntime = { ...originalNodeRuntime };
  restoredNodes.forEach((node) => {
    if (node.type === "importObjNode" && updatedNodeRuntime[node.id]) {
      updatedNodeRuntime[node.id] = {
        ...updatedNodeRuntime[node.id],
        params: node.params,
      };
    }
  });
  Object.entries(restoredSubFlows).forEach(([, subFlow]) => {
    subFlow.nodes.forEach((node: any) => {
      if (node.type === "importObjNode" && subFlow.nodeRuntime[node.id]) {
        subFlow.nodeRuntime[node.id] = {
          ...subFlow.nodeRuntime[node.id],
          params: node.params,
        };
      }
    });
  });
  return updatedNodeRuntime;
}
async function restoreAssetFromHash(
  assetHash: string,
  importResult: ImportResult,
  assetCache: any
): Promise<{ name: string; size: number; lastModified: number; content: string } | null> {
  try {
    const assetData = await assetCache.get(assetHash);
    if (!assetData) {
      return null;
    }
    const manifestAsset = importResult.manifest.assets.find((a) => a.id === assetHash);
    if (!manifestAsset) {
      return null;
    }
    let encodedContent: string;
    try {
      const uint8Array = new Uint8Array(assetData);
      const binaryString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join("");
      encodedContent = btoa(binaryString);
      if (manifestAsset.name.toLowerCase().endsWith(".obj")) {
        try {
          const decoder = new TextDecoder();
          const textContent = decoder.decode(assetData);
          if (!textContent.includes("v ") && !textContent.includes("f ")) {
            return null;
          }
        } catch (error) {
          return null;
        }
      }
    } catch (encodeError) {
      return null;
    }
    const serializableFile = {
      name: manifestAsset.name,
      size: manifestAsset.size,
      lastModified: Date.now(),
      content: encodedContent,
    };
    return serializableFile;
  } catch (error) {
    return null;
  }
}
async function ensureAssetsReady(result: ImportResult): Promise<void> {
  const { getAssetCache } = await import("./opfs-cache");
  const assetCache = getAssetCache();
  const missingAssets: string[] = [];
  for (const manifestAsset of result.manifest.assets) {
    try {
      const isAvailable = await assetCache.has(manifestAsset.id);
      if (!isAvailable) {
        missingAssets.push(`${manifestAsset.name} (${manifestAsset.id})`);
      }
    } catch (error) {
      missingAssets.push(`${manifestAsset.name} (check failed)`);
    }
  }
  if (missingAssets.length > 0) {
  }
  try {
    const isHealthy = await assetCache.isHealthy();
    if (!isHealthy) {
    }
  } catch (error) {}
}
