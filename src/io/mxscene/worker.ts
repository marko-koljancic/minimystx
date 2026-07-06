import type { WorkerMessage, ExportRequest, ImportRequest, ProgressUpdate, ExportResult } from "./types";
import { MxSceneError } from "./types";
import { buildMxSceneZip, parseMxSceneZip } from "./packager";

// Thin worker wrapper around the pure packager: all zip building/parsing logic
// lives in packager.ts (unit-tested in node); this file only does postMessage
// plumbing so the heavy work stays off the main thread.

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
  try {
    const { zipData, assetCount } = await buildMxSceneZip(sceneData, assets, (progress) =>
      sendProgress(message.id, progress)
    );
    const result: ExportResult = {
      // fflate allocates standalone ArrayBuffers; TS 5.7+ types the view as Uint8Array<ArrayBufferLike>
      blob: new Blob([zipData as Uint8Array<ArrayBuffer>], { type: "application/zip" }),
      fileName: `${projectName}.mxscene`,
      size: zipData.length,
      assetCount,
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
  try {
    const result = await parseMxSceneZip(request.fileBuffer, (progress) => sendProgress(message.id, progress));
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
