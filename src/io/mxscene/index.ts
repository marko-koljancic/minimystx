export { exportToMxScene, downloadMxSceneFile, getCurrentSceneData, type ExportOptions } from "./export";
export {
  importFromMxScene,
  applyImportedScene,
  selectAndImportMxSceneFile,
  createAssetReferencesFromImport,
  type ImportOptions,
} from "./import";
export { getAssetCache } from "./opfs-cache";
import { getAssetCache } from "./opfs-cache";
export {
  discoverAssets,
  registerAssetProvider,
  getRegisteredAssetProviders,
  validateAssets,
  type AssetProvider,
} from "./asset-discovery";
export {
  hashBytesSHA256,
  formatHashForStorage,
  extractHashFromStorage,
  isValidSHA256Hash,
  hashString,
  verifyHash,
  hashBytesWithProgress,
} from "./crypto";
export { createZipWriter, createZipReader, validateMxSceneZip, generateAssetFilename, parseAssetFilename } from "./zip";
export type {
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
  AssetReference,
  AssetCache,
  ProgressUpdate,
  ExportResult,
  ImportResult,
  ZipWriter,
  ZipReader,
  WorkerMessage,
  ExportRequest,
  ImportRequest,
  MxSceneError,
  IntegrityError,
  SchemaError,
  ZipError,
  OpfsError,
} from "./types";
export const MXSCENE_VERSION = "1.0";
export const ENGINE_VERSION = "0.1.0";
export async function initializeMxScene(): Promise<void> {
  try {
    const { useGraphStore } = await import("../../engine/graphStore");
    const graphStore = useGraphStore.getState();
    const existingNodes = graphStore.getNodes({ type: "root" });

    if (existingNodes.length === 0) {
      const { initializeNewScene } = await import("../sceneManager");
      await initializeNewScene({
        triggerRecomputation: true,
        restoreCamera: true,
        resetUIToDefaults: false,
      });
    }
  } catch (error) {
    console.error("Error initializing scene:", error);
  }
}
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
    assetCacheHealthy = await assetCache.isHealthy();
    if (!assetCacheHealthy) {
      errors.push("Asset cache health check failed");
    }
  } catch (error) {
    errors.push(`Asset cache error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
  return {
    opfsSupported,
    assetCacheHealthy,
    cachedAssetCount,
    errors,
  };
}
