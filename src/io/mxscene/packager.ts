import type { AssetReference, ImportResult, ManifestJson, ProgressUpdate, SceneJson } from "./types";
import { createZipWriter, createZipReader, validateMxSceneZip, generateAssetFilename } from "./zip";
import { hashBytesSHA256, formatHashForStorage } from "./crypto";
import { IntegrityError, SchemaError } from "./types";

// Pure .mxscene packaging: build and parse the ZIP with no worker or DOM
// dependencies, so the exact pipeline the app ships is unit-testable in node.
// worker.ts wraps these with postMessage plumbing.

// 2.0: dropped the legacy graph.nodeRuntime / subFlows[].nodeRuntime blocks
// (pure duplication of node params that the importer never read). Older files
// are rejected with a clear SchemaError; there is no migration path by design.
export const SUPPORTED_SCHEMA_VERSION = "2.0";
export const ENGINE_VERSION = "0.1.0";

export type ProgressHandler = (progress: ProgressUpdate) => void;

export async function buildMxSceneZip(
  sceneData: SceneJson,
  assets: AssetReference[],
  onProgress?: ProgressHandler
): Promise<{ zipData: Uint8Array; assetCount: number }> {
  const zipWriter = createZipWriter();
  const processedAssets: ManifestJson["assets"] = [];
  const totalAssets = assets.length;
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    onProgress?.({
      phase: "hashing",
      currentAsset: asset.originalName,
      assetIndex: i,
      totalAssets,
      percentage: Math.round((i / Math.max(totalAssets, 1)) * 40),
      message: `Processing asset: ${asset.originalName}`,
    });
    const computedHash = await hashBytesSHA256(asset.data);
    if (computedHash !== asset.hash) {
      throw new IntegrityError(`Asset hash mismatch for ${asset.originalName}`, asset.hash, computedHash);
    }
    const assetFilename = generateAssetFilename(asset.hash, asset.originalName);
    await zipWriter.addFile(assetFilename, new Uint8Array(asset.data));
    processedAssets.push({
      id: asset.hash,
      name: asset.originalName,
      mime: asset.mime,
      size: asset.size,
      hash: formatHashForStorage(asset.hash),
      source: "embedded",
      originalPath: asset.originalPath,
    });
  }
  onProgress?.({
    phase: "packaging",
    percentage: 50,
    message: "Creating manifest...",
  });
  const manifest: ManifestJson = {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    assets: processedAssets,
  };
  await zipWriter.addText("manifest.json", JSON.stringify(manifest, null, 2));
  onProgress?.({
    phase: "packaging",
    percentage: 60,
    message: "Creating scene data...",
  });
  const updatedSceneData: SceneJson = {
    ...sceneData,
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    assets: assets.map((asset) => ({
      id: asset.hash,
      role: asset.role,
      importSettings: asset.importSettings,
    })),
  };
  await zipWriter.addText("scene.json", JSON.stringify(updatedSceneData, null, 2));
  onProgress?.({
    phase: "writing",
    percentage: 80,
    message: "Finalizing ZIP...",
  });
  const zipData = await zipWriter.finalize();
  onProgress?.({
    phase: "writing",
    percentage: 100,
    message: "Export complete!",
  });
  return { zipData, assetCount: assets.length };
}

export async function parseMxSceneZip(fileBuffer: ArrayBuffer, onProgress?: ProgressHandler): Promise<ImportResult> {
  onProgress?.({
    phase: "reading",
    percentage: 0,
    message: "Reading ZIP file...",
  });
  const zipReader = createZipReader(new Uint8Array(fileBuffer));
  await validateMxSceneZip(zipReader);
  onProgress?.({
    phase: "reading",
    percentage: 10,
    message: "Parsing manifest...",
  });
  const manifestText = await zipReader.readText("manifest.json");
  const manifest: ManifestJson = JSON.parse(manifestText);
  if (manifest.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new SchemaError("Unsupported schema version", manifest.schemaVersion, SUPPORTED_SCHEMA_VERSION);
  }
  onProgress?.({
    phase: "reading",
    percentage: 20,
    message: "Parsing scene data...",
  });
  const sceneText = await zipReader.readText("scene.json");
  const scene: SceneJson = JSON.parse(sceneText);
  onProgress?.({
    phase: "extracting",
    percentage: 30,
    message: "Extracting assets...",
  });
  const loadedAssets: string[] = [];
  const warnings: string[] = [];
  const totalAssets = manifest.assets.length;
  for (let i = 0; i < manifest.assets.length; i++) {
    const assetEntry = manifest.assets[i];
    onProgress?.({
      phase: "validating",
      currentAsset: assetEntry.name,
      assetIndex: i,
      totalAssets,
      percentage: Math.round(30 + (i / Math.max(totalAssets, 1)) * 60),
      message: `Validating asset: ${assetEntry.name}`,
    });
    try {
      const expectedFilename = generateAssetFilename(assetEntry.id, assetEntry.name);
      if (!(await zipReader.has(expectedFilename))) {
        warnings.push(`Asset file not found: ${expectedFilename}`);
        continue;
      }
      const assetData = await zipReader.readFile(expectedFilename);
      if (assetData.length !== assetEntry.size) {
        throw new IntegrityError(
          `Asset size mismatch for ${assetEntry.name}`,
          assetEntry.size.toString(),
          assetData.length.toString()
        );
      }
      const computedHash = await hashBytesSHA256(assetData.buffer as ArrayBuffer);
      if (computedHash !== assetEntry.id) {
        throw new IntegrityError(`Asset hash mismatch for ${assetEntry.name}`, assetEntry.id, computedHash);
      }
      loadedAssets.push(assetEntry.id);
    } catch (error) {
      if (error instanceof IntegrityError) {
        throw error;
      }
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      warnings.push(`Failed to process asset ${assetEntry.name}: ${errorMsg}`);
    }
  }
  onProgress?.({
    phase: "validating",
    percentage: 100,
    message: "Import complete!",
  });
  return {
    scene,
    manifest,
    loadedAssets,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
