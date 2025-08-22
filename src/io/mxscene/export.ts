/**
 * Export workflow for creating .mxscene files
 * Coordinates asset discovery, Web Worker operations, and progress tracking
 */

import type { 
  SceneJson, 
  ExportResult, 
  ProgressUpdate, 
  WorkerMessage,
  ExportRequest
} from './types';

import { discoverAssets, validateAssets } from './asset-discovery';
import { getAssetCache } from './opfs-cache';
import { v4 as uuidv4 } from 'uuid';

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
    throw new Error('Export was cancelled');
  }
  
  try {
    // Phase 1: Discover assets from the scene graph
    onProgress?.({
      phase: 'collecting',
      percentage: 0,
      message: 'Discovering assets in scene...'
    });
    
    const discoveredAssets = await discoverAssets({
      nodes: sceneData.graph.nodes,
      subFlows: sceneData.graph.subFlows,
    });
    
    onProgress?.({
      phase: 'collecting',
      percentage: 10,
      message: `Found ${discoveredAssets.length} assets`
    });
    
    // Phase 2: Validate assets
    const { valid: validAssets, invalid: invalidAssets } = await validateAssets(discoveredAssets);
    
    if (invalidAssets.length > 0) {
      console.warn(`[exportToMxScene] ${invalidAssets.length} invalid assets:`, invalidAssets);
    }
    
    onProgress?.({
      phase: 'collecting',
      percentage: 20,
      message: `Validated ${validAssets.length} assets`
    });
    
    // Check for cancellation before heavy work
    if (signal?.aborted) {
      throw new Error('Export was cancelled');
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
      console.warn('[exportToMxScene] Failed to cache assets:', cacheError);
      // Non-fatal error - export can still succeed
    }
    
    return result;
    
  } catch (error) {
    const exportError = error instanceof Error ? error : new Error('Unknown export error');
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
    const worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module'
    });
    
    const messageId = uuidv4();
    let isResolved = false;
    
    // Handle cancellation
    const abortHandler = () => {
      if (!isResolved) {
        worker.terminate();
        reject(new Error('Export was cancelled'));
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
            const result = message.data as ExportResult;
            worker.terminate();
            signal?.removeEventListener('abort', abortHandler);
            resolve(result);
            isResolved = true;
          }
          break;
          
        case 'error':
          if (!isResolved) {
            const error = new Error(message.error?.message || 'Export failed');
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
    
    // Send export request to worker
    const workerMessage: WorkerMessage = {
      id: messageId,
      type: 'export',
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
    
    const link = document.createElement('a');
    link.href = url;
    link.download = result.fileName;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
    
    console.info(`[downloadMxSceneFile] Downloaded ${result.fileName} (${(result.size / 1024 / 1024).toFixed(2)} MB, ${result.assetCount} assets)`);
    
  } catch (error) {
    console.error('[downloadMxSceneFile] Failed to download file:', error);
    throw new Error('Failed to download .mxscene file');
  }
}

/**
 * Get current scene data from the graph store
 * This function interfaces with the existing Minimystx architecture
 */
export async function getCurrentSceneData(): Promise<SceneJson> {
  // Use the existing exportGraphWithMeta function to get most of the data
  const { exportGraphWithMeta } = await import('../../engine/graphStore');
  const existingData = await exportGraphWithMeta();
  
  // Convert the existing data structure to our SceneJson format
  const sceneData: SceneJson = {
    schemaVersion: '1.0',
    engineVersion: '0.1.0',
    units: 'meters',
    graph: {
      nodes: existingData.graph.nodes.map((node: any) => ({
        id: node.id,
        type: node.type,
        params: node.params,
      })),
      edges: existingData.graph.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
      nodeRuntime: existingData.graph.nodeRuntime,
      positions: existingData.graph.positions,
      subFlows: existingData.graph.subFlows || {},
    },
    camera: {
      position: existingData.camera.position as [number, number, number],
      target: existingData.camera.target as [number, number, number],
      fov: (existingData.camera as any).fov || 50,
    },
    renderer: {
      background: '#101014',
      exposure: 1.0,
    },
    ui: {
      gridVisible: true,
      minimapVisible: false,
      showFlowControls: true,
      connectionLineStyle: 'bezier',
      viewportStates: {
        root: existingData.viewport,
      },
    },
    assets: [], // Will be populated by asset discovery
    meta: {
      name: 'Untitled Project',
      description: '',
      projectId: uuidv4(),
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    },
  };
  
  return sceneData;
}