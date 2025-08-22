/**
 * .mxscene Portable Project Bundle System
 * Public API for export/import operations
 */

// Main export/import functions
export { 
  exportToMxScene, 
  downloadMxSceneFile, 
  getCurrentSceneData,
  type ExportOptions 
} from './export';

export { 
  importFromMxScene, 
  applyImportedScene, 
  selectAndImportMxSceneFile,
  createAssetReferencesFromImport,
  type ImportOptions 
} from './import';

// Asset management
export { getAssetCache } from './opfs-cache';
import { getAssetCache } from './opfs-cache';
export { 
  discoverAssets, 
  registerAssetProvider, 
  getRegisteredAssetProviders,
  validateAssets,
  type AssetProvider 
} from './asset-discovery';

// Crypto utilities
export { 
  hashBytesSHA256, 
  formatHashForStorage, 
  extractHashFromStorage,
  isValidSHA256Hash,
  hashString,
  verifyHash,
  hashBytesWithProgress
} from './crypto';

// ZIP utilities
export { 
  createZipWriter, 
  createZipReader, 
  validateMxSceneZip,
  generateAssetFilename,
  parseAssetFilename 
} from './zip';

// Type definitions
export type {
  // Core data structures
  ManifestJson,
  AssetManifestEntry,
  SceneJson,
  GraphData,
  SubFlowData,
  NodeData,
  EdgeData,
  NodeRuntimeData,
  CameraData,
  RendererData,
  UIData,
  SceneAssetEntry,
  ProjectMetadata,
  
  // Asset system
  AssetReference,
  AssetCache,
  
  // Progress and results
  ProgressUpdate,
  ExportResult,
  ImportResult,
  
  // ZIP operations
  ZipWriter,
  ZipReader,
  
  // Worker communication
  WorkerMessage,
  ExportRequest,
  ImportRequest,
  
  // Error types
  MxSceneError,
  IntegrityError,
  SchemaError,
  ZipError,
  OpfsError
} from './types';

// Version information
export const MXSCENE_VERSION = '1.0';
export const ENGINE_VERSION = '0.1.0';

/**
 * Initialize the mxscene system
 * Call this once at application startup
 */
export async function initializeMxScene(): Promise<void> {
  try {
    const assetCache = getAssetCache();
    const stats = await assetCache.getStats();
    
    console.info('[initializeMxScene] Asset cache initialized:', {
      opfsSupported: stats.isOpfsSupported,
      assetCount: stats.assetCount,
      memoryCount: stats.memoryCount
    });
    
  } catch (error) {
    console.warn('[initializeMxScene] Failed to initialize asset cache:', error);
    // Non-fatal - system can still work with memory-only caching
  }
}

/**
 * Get system health status
 */
export async function getSystemHealth(): Promise<{
  opfsSupported: boolean;
  assetCacheHealthy: boolean;
  cachedAssetCount: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let opfsSupported = false;
  let assetCacheHealthy = false;
  let cachedAssetCount = 0;
  
  try {
    const assetCache = getAssetCache();
    const stats = await assetCache.getStats();
    
    opfsSupported = stats.isOpfsSupported;
    cachedAssetCount = stats.assetCount;
    
    // Check cache health
    assetCacheHealthy = await assetCache.isHealthy();
    if (!assetCacheHealthy) {
      errors.push('Asset cache health check failed');
    }
    
  } catch (error) {
    errors.push(`Asset cache error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    opfsSupported,
    assetCacheHealthy,
    cachedAssetCount,
    errors
  };
}