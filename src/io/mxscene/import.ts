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
    // Import graph data using the graph store's importGraph method
    const { useGraphStore } = await import('../../engine/graphStore');
    const graphStore = useGraphStore.getState();
    
    // Import the graph (this clears existing state and restores nodes/edges)
    graphStore.importGraph({
      nodes: scene.graph.nodes,
      edges: scene.graph.edges,
      nodeRuntime: scene.graph.nodeRuntime,
      positions: scene.graph.positions,
      subFlows: scene.graph.subFlows,
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