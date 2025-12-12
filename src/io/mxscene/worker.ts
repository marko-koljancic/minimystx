import type {
  WorkerMessage,
  ExportRequest,
  ImportRequest,
  ProgressUpdate,
  ManifestJson,
  SceneJson,
  ExportResult,
  ImportResult,
} from "./types";
import { createZipWriter, createZipReader, validateMxSceneZip, generateAssetFilename } from "./zip";
import { hashBytesSHA256, formatHashForStorage } from "./crypto";
import { IntegrityError, SchemaError, MxSceneError } from "./types";
const SUPPORTED_SCHEMA_VERSION = "1.0";
const ENGINE_VERSION = "0.1.0"; // TODO: Extract from package.json
self.addEventListener("message", async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  try {
    switch (message.type) {
      case "export":
        await handleExport(message);
        break;
      case "import":
        await handleImport(message);
        break;
      default:
        sendError(message.id, "INVALID_MESSAGE_TYPE", `Unknown message type: ${message.type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown worker error";
    const errorCode = error instanceof MxSceneError ? error.code : "WORKER_ERROR";
    sendError(message.id, errorCode, errorMessage);
  }
});
async function handleExport(message: WorkerMessage): Promise<void> {
  const request = message.data as ExportRequest;
  const { sceneData, assets, projectName } = request;
  sendProgress(message.id, {
    phase: "collecting",
    percentage: 0,
    message: "Collecting assets...",
  });
  try {
    const zipWriter = createZipWriter();
    const processedAssets: ManifestJson["assets"] = [];
    const totalAssets = assets.length;
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      sendProgress(message.id, {
        phase: "hashing",
        currentAsset: asset.originalName,
        assetIndex: i,
        totalAssets,
        percentage: Math.round((i / totalAssets) * 40),
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
    sendProgress(message.id, {
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
    sendProgress(message.id, {
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
    sendProgress(message.id, {
      phase: "writing",
      percentage: 80,
      message: "Finalizing ZIP...",
    });
    const zipData = await zipWriter.finalize();
    sendProgress(message.id, {
      phase: "writing",
      percentage: 100,
      message: "Export complete!",
    });
    const result: ExportResult = {
      blob: new Blob([zipData], { type: "application/zip" }),
      fileName: `${projectName}.mxscene`,
      size: zipData.length,
      assetCount: assets.length,
    };
    sendSuccess(message.id, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Export failed";
    const errorCode = error instanceof MxSceneError ? error.code : "EXPORT_ERROR";
    sendError(message.id, errorCode, errorMessage);
  }
}
async function handleImport(message: WorkerMessage): Promise<void> {
  const request = message.data as ImportRequest;
  const { fileBuffer } = request;
  sendProgress(message.id, {
    phase: "reading",
    percentage: 0,
    message: "Reading ZIP file...",
  });
  try {
    const zipReader = createZipReader(new Uint8Array(fileBuffer));
    await validateMxSceneZip(zipReader);
    sendProgress(message.id, {
      phase: "reading",
      percentage: 10,
      message: "Parsing manifest...",
    });
    const manifestText = await zipReader.readText("manifest.json");
    const manifest: ManifestJson = JSON.parse(manifestText);
    if (manifest.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
      throw new SchemaError("Unsupported schema version", manifest.schemaVersion, SUPPORTED_SCHEMA_VERSION);
    }
    sendProgress(message.id, {
      phase: "reading",
      percentage: 20,
      message: "Parsing scene data...",
    });
    const sceneText = await zipReader.readText("scene.json");
    const scene: SceneJson = JSON.parse(sceneText);
    sendProgress(message.id, {
      phase: "extracting",
      percentage: 30,
      message: "Extracting assets...",
    });
    const loadedAssets: string[] = [];
    const warnings: string[] = [];
    const totalAssets = manifest.assets.length;
    for (let i = 0; i < manifest.assets.length; i++) {
      const assetEntry = manifest.assets[i];
      sendProgress(message.id, {
        phase: "validating",
        currentAsset: assetEntry.name,
        assetIndex: i,
        totalAssets,
        percentage: Math.round(30 + (i / totalAssets) * 60),
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
        const computedHash = await hashBytesSHA256(assetData.buffer);
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
    sendProgress(message.id, {
      phase: "validating",
      percentage: 100,
      message: "Import complete!",
    });
    const result: ImportResult = {
      scene,
      manifest,
      loadedAssets,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    sendSuccess(message.id, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Import failed";
    const errorCode = error instanceof MxSceneError ? error.code : "IMPORT_ERROR";
    sendError(message.id, errorCode, errorMessage);
  }
}
function sendProgress(id: string, progress: ProgressUpdate): void {
  const message: WorkerMessage = {
    id,
    type: "progress",
    data: progress,
  };
  self.postMessage(message);
}
function sendSuccess(id: string, data: unknown): void {
  const message: WorkerMessage = {
    id,
    type: "success",
    data,
  };
  self.postMessage(message);
}
function sendError(id: string, code: string, errorMessage: string): void {
  const message: WorkerMessage = {
    id,
    type: "error",
    error: {
      message: errorMessage,
      code,
    },
  };
  self.postMessage(message);
}
