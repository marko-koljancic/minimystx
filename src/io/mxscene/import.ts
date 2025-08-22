/**
 * Import workflow for loading .mxscene files
 * Coordinates asset extraction, validation, OPFS storage, and scene reconstruction
 */

import type { 
  ImportResult, 
  ProgressUpdate, 
  WorkerMessage,
  ImportRequest,
  AssetReference
} from './types';

import { getAssetCache } from './opfs-cache';
import { createZipReader, parseAssetFilename } from './zip';
import { hashBytesSHA256 } from './crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Import options for .mxscene loading
 */
export interface ImportOptions {
  onProgress?: (progress: ProgressUpdate) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal; // For cancellation support
}

/**
 * Import a .mxscene file and restore the scene
 */
export async function importFromMxScene(
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { onProgress, onError, signal } = options;
  
  // Check for cancellation
  if (signal?.aborted) {
    throw new Error('Import was cancelled');
  }
  
  try {
    onProgress?.({
      phase: 'reading',
      percentage: 0,
      message: 'Reading .mxscene file...'
    });
    
    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Check for cancellation before heavy work
    if (signal?.aborted) {
      throw new Error('Import was cancelled');
    }
    
    // Create import request for worker
    const importRequest: ImportRequest = {
      fileBuffer,
      fileName: file.name,
    };
    
    // Execute import in Web Worker
    const result = await executeImportInWorker(importRequest, onProgress, signal);
    
    // Store extracted assets in OPFS cache
    await storeAssetsInCache(result, file, onProgress);
    
    return result;
    
  } catch (error) {
    const importError = error instanceof Error ? error : new Error('Unknown import error');
    onError?.(importError);
    throw importError;
  }
}

/**
 * Execute the import operation in a Web Worker
 */
function executeImportInWorker(
  request: ImportRequest,
  onProgress?: (progress: ProgressUpdate) => void,
  signal?: AbortSignal
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    // Create worker
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module'
    });
    
    const messageId = uuidv4();
    let isResolved = false;
    
    // Handle cancellation
    const abortHandler = () => {
      if (!isResolved) {
        worker.terminate();
        reject(new Error('Import was cancelled'));
        isResolved = true;
      }
    };
    
    signal?.addEventListener('abort', abortHandler);
    
    // Handle worker messages
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      
      if (message.id !== messageId) return;
      
      switch (message.type) {
        case 'progress':
          onProgress?.(message.data as ProgressUpdate);
          break;
          
        case 'success':
          if (!isResolved) {
            const result = message.data as ImportResult;
            worker.terminate();
            signal?.removeEventListener('abort', abortHandler);
            resolve(result);
            isResolved = true;
          }
          break;
          
        case 'error':
          if (!isResolved) {
            const error = new Error(message.error?.message || 'Import failed');
            worker.terminate();
            signal?.removeEventListener('abort', abortHandler);
            reject(error);
            isResolved = true;
          }
          break;
      }
    });
    
    // Handle worker errors
    worker.addEventListener('error', (error) => {
      if (!isResolved) {
        worker.terminate();
        signal?.removeEventListener('abort', abortHandler);
        reject(new Error(`Worker error: ${error.message}`));
        isResolved = true;
      }
    });
    
    // Send import request to worker
    const workerMessage: WorkerMessage = {
      id: messageId,
      type: 'import',
      data: request,
    };
    
    worker.postMessage(workerMessage);
  });
}

/**
 * Store extracted assets in OPFS cache
 */
async function storeAssetsInCache(
  result: ImportResult,
  originalFile: File,
  onProgress?: (progress: ProgressUpdate) => void
): Promise<void> {
  try {
    onProgress?.({
      phase: 'extracting',
      percentage: 90,
      message: 'Storing assets in cache...'
    });
    
    const assetCache = getAssetCache();
    const zipReader = createZipReader(await originalFile.arrayBuffer());
    
    // Process each asset from the manifest
    for (let i = 0; i < result.manifest.assets.length; i++) {
      const assetEntry = result.manifest.assets[i];
      
      // Skip if already cached
      if (await assetCache.has(assetEntry.id)) {
        continue;
      }
      
      try {
        // Read asset from ZIP
        const assetFiles = await zipReader.list();
        const matchingFile = assetFiles.find(f => {
          const parsed = parseAssetFilename(f);
          return parsed?.hash === assetEntry.id;
        });
        
        if (!matchingFile) {
          console.warn(`[storeAssetsInCache] Asset file not found: ${assetEntry.name}`);
          continue;
        }
        
        const assetData = await zipReader.readFile(matchingFile);
        
        // Verify hash before storing
        const computedHash = await hashBytesSHA256(assetData.buffer);
        if (computedHash !== assetEntry.id) {
          console.warn(`[storeAssetsInCache] Hash mismatch for ${assetEntry.name}, skipping cache`);
          continue;
        }
        
        // Store in cache
        await assetCache.put(assetEntry.id, assetData.buffer);
        
      } catch (error) {
        console.warn(`[storeAssetsInCache] Failed to cache asset ${assetEntry.name}:`, error);
        // Non-fatal - continue with other assets
      }
    }
    
  } catch (error) {
    console.warn('[storeAssetsInCache] Failed to store assets in cache:', error);
    // Non-fatal error - import can still succeed
  }
}

/**
 * Apply imported scene data to the current Minimystx session
 * This function interfaces with the existing Minimystx architecture
 */
export async function applyImportedScene(result: ImportResult): Promise<void> {
  const { scene } = result;
  
  try {
    // First, restore asset references in node parameters
    const restoredGraph = await restoreAssetsFromReferences({
      nodes: scene.graph.nodes,
      subFlows: scene.graph.subFlows,
    }, result);
    
    // Update nodeRuntime with restored file objects
    const restoredNodeRuntime = updateNodeRuntimeWithRestoredAssets(
      scene.graph.nodeRuntime, 
      restoredGraph.nodes, 
      restoredGraph.subFlows
    );
    
    // Import graph data using the graph store's importGraph method
    const { useGraphStore } = await import('../../engine/graphStore');
    const graphStore = useGraphStore.getState();
    
    // Import the graph (this clears existing state and restores nodes/edges)
    await graphStore.importGraph({
      nodes: restoredGraph.nodes,
      edges: scene.graph.edges,
      nodeRuntime: restoredNodeRuntime,
      positions: scene.graph.positions,
      subFlows: restoredGraph.subFlows,
    });
    
    // Restore viewport
    if (scene.ui.viewportStates.root) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('minimystx:setViewport', { 
          detail: scene.ui.viewportStates.root 
        }));
      }, 100);
    }
    
    // Restore camera
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('minimystx:setCameraData', { 
        detail: scene.camera 
      }));
    }, 200);
    
    // Restore project name to document title
    if (scene.meta.name && scene.meta.name !== 'Untitled Project') {
      document.title = `${scene.meta.name} - Minimystx`;
    } else {
      document.title = 'Minimystx';
    }
    
    console.info(`[applyImportedScene] Scene restored: ${scene.meta.name}`);
    
  } catch (error) {
    console.error('[applyImportedScene] Failed to apply imported scene:', error);
    throw new Error(`Failed to restore scene: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Open file picker and import .mxscene file
 */
export function selectAndImportMxSceneFile(options: ImportOptions = {}): Promise<ImportResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mxscene';
    input.style.display = 'none';
    
    input.addEventListener('change', async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      
      if (!file) {
        resolve(null);
        return;
      }
      
      // Check file size (500MB limit as per requirements)
      const maxSize = 500 * 1024 * 1024; // 500 MB
      if (file.size > maxSize) {
        reject(new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum size is 500MB.`));
        return;
      }
      
      try {
        const result = await importFromMxScene(file, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
    input.addEventListener('cancel', () => {
      resolve(null);
    });
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/**
 * Create asset references from imported scene data
 * This helps integrate imported assets with the existing asset system
 */
export async function createAssetReferencesFromImport(
  result: ImportResult
): Promise<AssetReference[]> {
  const assetReferences: AssetReference[] = [];
  const assetCache = getAssetCache();
  
  for (const manifestAsset of result.manifest.assets) {
    try {
      // Get asset data from cache
      const assetData = await assetCache.get(manifestAsset.id);
      if (!assetData) {
        console.warn(`[createAssetReferencesFromImport] Asset not found in cache: ${manifestAsset.name}`);
        continue;
      }
      
      // Find corresponding scene asset entry
      const sceneAsset = result.scene.assets.find(a => a.id === manifestAsset.id);
      
      const assetReference: AssetReference = {
        hash: manifestAsset.id,
        originalName: manifestAsset.name,
        originalPath: manifestAsset.originalPath,
        mime: manifestAsset.mime,
        size: manifestAsset.size,
        data: assetData,
        role: sceneAsset?.role || 'unknown',
        importSettings: sceneAsset?.importSettings,
      };
      
      assetReferences.push(assetReference);
      
    } catch (error) {
      console.warn(`[createAssetReferencesFromImport] Failed to create reference for ${manifestAsset.name}:`, error);
    }
  }
  
  return assetReferences;
}

/**
 * Restore asset hash references back to loadable SerializableObjFile objects in node parameters
 * This enables nodes to load assets that were cached during export
 */
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
      if (node.type === 'importObjNode' && node.params?.object) {
        const updatedParams = { ...node.params };
        const objectParams = updatedParams.object as any;
        
        if (objectParams?.assetHash && !objectParams?.file) {
          console.log(`[restoreAssetsFromReferences] Restoring asset for node ${node.id}, hash: ${objectParams.assetHash}`);
          try {
            const restoredFile = await restoreAssetFromHash(objectParams.assetHash, importResult, assetCache);
            if (restoredFile) {
              console.log(`[restoreAssetsFromReferences] Successfully restored file: ${restoredFile.name}`);
              // Add the restored file while preserving the asset hash
              updatedParams.object = {
                ...objectParams,
                file: restoredFile,
                // Keep the assetHash for asset tracking
              };
            } else {
              console.warn(`[restoreAssetsFromReferences] Failed to restore asset for node ${node.id}, will skip file loading`);
              // Keep the original object params but clear the asset hash to prevent repeated attempts
              updatedParams.object = {
                ...objectParams,
                assetHash: null,
              };
            }
          } catch (error) {
            console.error(`[restoreAssetsFromReferences] Error during asset restoration for node ${node.id}:`, error);
            // Clear the asset hash to prevent repeated attempts
            updatedParams.object = {
              ...objectParams,
              assetHash: null,
            };
          }
        } else if (objectParams?.file) {
          console.log(`[restoreAssetsFromReferences] Node ${node.id} already has file:`, objectParams.file);
        } else if (objectParams?.assetHash) {
          console.log(`[restoreAssetsFromReferences] Node ${node.id} has both file and assetHash`);
        } else {
          console.log(`[restoreAssetsFromReferences] Node ${node.id} has no file or assetHash`);
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
        if (node.type === 'importObjNode' && node.params?.object) {
          const updatedParams = { ...node.params };
          const objectParams = updatedParams.object as any;
          
          if (objectParams?.assetHash && !objectParams?.file) {
            console.log(`[restoreAssetsFromReferences] [SubFlow] Restoring asset for node ${node.id}, hash: ${objectParams.assetHash}`);
            try {
              const restoredFile = await restoreAssetFromHash(objectParams.assetHash, importResult, assetCache);
              if (restoredFile) {
                console.log(`[restoreAssetsFromReferences] [SubFlow] Successfully restored file: ${restoredFile.name}`);
                // Add the restored file while preserving the asset hash
                updatedParams.object = {
                  ...objectParams,
                  file: restoredFile,
                  // Keep the assetHash for asset tracking
                };
              } else {
                console.warn(`[restoreAssetsFromReferences] [SubFlow] Failed to restore asset for node ${node.id}, will skip file loading`);
                // Keep the original object params but clear the asset hash to prevent repeated attempts
                updatedParams.object = {
                  ...objectParams,
                  assetHash: null,
                };
              }
            } catch (error) {
              console.error(`[restoreAssetsFromReferences] [SubFlow] Error during asset restoration for node ${node.id}:`, error);
              // Clear the asset hash to prevent repeated attempts
              updatedParams.object = {
                ...objectParams,
                assetHash: null,
              };
            }
          } else if (objectParams?.file) {
            console.log(`[restoreAssetsFromReferences] [SubFlow] Node ${node.id} already has file:`, objectParams.file);
          } else if (objectParams?.assetHash) {
            console.log(`[restoreAssetsFromReferences] [SubFlow] Node ${node.id} has both file and assetHash`);
          } else {
            console.log(`[restoreAssetsFromReferences] [SubFlow] Node ${node.id} has no file or assetHash`);
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

/**
 * Update nodeRuntime with restored file objects from asset restoration
 * This ensures that the runtime state includes the properly restored files
 */
function updateNodeRuntimeWithRestoredAssets(
  originalNodeRuntime: Record<string, any>,
  restoredNodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>,
  restoredSubFlows: Record<string, any>
): Record<string, any> {
  const updatedNodeRuntime = { ...originalNodeRuntime };
  
  // Update root level nodes
  restoredNodes.forEach(node => {
    if (node.type === 'importObjNode' && updatedNodeRuntime[node.id]) {
      console.log(`[updateNodeRuntimeWithRestoredAssets] Updating runtime for root node ${node.id}`);
      updatedNodeRuntime[node.id] = {
        ...updatedNodeRuntime[node.id],
        params: node.params,
      };
    }
  });
  
  // Update subflow nodes
  Object.entries(restoredSubFlows).forEach(([geoNodeId, subFlow]) => {
    subFlow.nodes.forEach((node: any) => {
      if (node.type === 'importObjNode' && subFlow.nodeRuntime[node.id]) {
        console.log(`[updateNodeRuntimeWithRestoredAssets] Updating runtime for subflow node ${node.id} in ${geoNodeId}`);
        subFlow.nodeRuntime[node.id] = {
          ...subFlow.nodeRuntime[node.id],
          params: node.params,
        };
      }
    });
  });
  
  return updatedNodeRuntime;
}

/**
 * Restore an asset from its hash using the OPFS cache and import result metadata
 */
async function restoreAssetFromHash(
  assetHash: string, 
  importResult: ImportResult, 
  assetCache: any
): Promise<{ name: string; size: number; lastModified: number; content: string } | null> {
  try {
    // Get asset data from cache
    const assetData = await assetCache.get(assetHash);
    if (!assetData) {
      console.warn(`[restoreAssetFromHash] Asset not found in cache: ${assetHash}`);
      return null;
    }

    // Find asset metadata from import result
    const manifestAsset = importResult.manifest.assets.find(a => a.id === assetHash);
    if (!manifestAsset) {
      console.warn(`[restoreAssetFromHash] Asset metadata not found: ${assetHash}`);
      return null;
    }

    // Convert asset data to text content with proper error handling
    let content: string;
    try {
      const decoder = new TextDecoder();
      content = decoder.decode(assetData);
      
      // Validate that the content is not empty
      if (!content || content.length === 0) {
        console.warn(`[restoreAssetFromHash] Asset content is empty: ${assetHash}`);
        return null;
      }
      
      // Basic validation for OBJ files
      if (manifestAsset.name.toLowerCase().endsWith('.obj')) {
        if (!content.includes('v ') && !content.includes('f ')) {
          console.warn(`[restoreAssetFromHash] Asset content does not appear to be valid OBJ format: ${assetHash}`);
          return null;
        }
      }
    } catch (decodeError) {
      console.error(`[restoreAssetFromHash] Failed to decode asset content for ${assetHash}:`, decodeError);
      return null;
    }
    
    // Create a SerializableObjFile object with validation
    let encodedContent: string;
    try {
      encodedContent = btoa(content); // Base64 encode the content
    } catch (encodeError) {
      console.error(`[restoreAssetFromHash] Failed to encode asset content for ${assetHash}:`, encodeError);
      return null;
    }
    
    const serializableFile = {
      name: manifestAsset.name,
      size: manifestAsset.size,
      lastModified: Date.now(), // Use current time since we don't have original
      content: encodedContent,
    };

    console.debug(`[restoreAssetFromHash] Restored asset: ${manifestAsset.name} (${content.length} chars, ${encodedContent.length} encoded)`);
    return serializableFile;

  } catch (error) {
    console.error(`[restoreAssetFromHash] Failed to restore asset ${assetHash}:`, error);
    return null;
  }
}