import { zip, unzip, AsyncZipOptions, Zippable } from "fflate";
import type { ZipWriter, ZipReader } from "./types";
import { ZipError } from "./types";

export class FflateZipWriter implements ZipWriter {
  private files: Zippable = {};
  private finalized = false;

  async addFile(pathInZip: string, data: Uint8Array): Promise<void> {
    if (this.finalized) {
      throw new ZipError("Cannot add files to finalized ZIP");
    }

    if (!pathInZip || pathInZip.includes("..") || pathInZip.startsWith("/")) {
      throw new ZipError(`Invalid ZIP path: ${pathInZip}`);
    }

    this.files[pathInZip] = data;
  }

  async addText(pathInZip: string, text: string): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await this.addFile(pathInZip, data);
  }

  async finalize(): Promise<Uint8Array> {
    if (this.finalized) {
      throw new ZipError("ZIP already finalized");
    }

    this.finalized = true;

    return new Promise((resolve, reject) => {
      const options: AsyncZipOptions = {
        level: 6,
      };

      zip(this.files, options, (err, data) => {
        if (err) {
          reject(new ZipError(`ZIP creation failed: ${err.message}`));
        } else {
          resolve(data);
        }
      });
    });
  }
}

export class FflateZipReader implements ZipReader {
  private zipData: Uint8Array;
  private unzipped: { [path: string]: Uint8Array } | null = null;

  constructor(zipData: Uint8Array | ArrayBuffer) {
    this.zipData = zipData instanceof ArrayBuffer ? new Uint8Array(zipData) : zipData;
  }

  private async ensureUnzipped(): Promise<void> {
    if (this.unzipped !== null) {
      return;
    }

    return new Promise((resolve, reject) => {
      unzip(this.zipData, (err, data) => {
        if (err) {
          reject(new ZipError(`ZIP extraction failed: ${err.message}`));
        } else {
          this.unzipped = data;
          resolve();
        }
      });
    });
  }

  async list(): Promise<string[]> {
    await this.ensureUnzipped();
    return Object.keys(this.unzipped!);
  }

  async readFile(pathInZip: string): Promise<Uint8Array> {
    await this.ensureUnzipped();

    const file = this.unzipped![pathInZip];
    if (!file) {
      throw new ZipError(`File not found in ZIP: ${pathInZip}`);
    }

    return file;
  }

  async readText(pathInZip: string): Promise<string> {
    const data = await this.readFile(pathInZip);
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(data);
  }

  async has(pathInZip: string): Promise<boolean> {
    await this.ensureUnzipped();
    return pathInZip in this.unzipped!;
  }

  async getFileSize(pathInZip: string): Promise<number> {
    await this.ensureUnzipped();
    const file = this.unzipped![pathInZip];
    if (!file) {
      throw new ZipError(`File not found in ZIP: ${pathInZip}`);
    }
    return file.length;
  }
}

export function createZipWriter(): ZipWriter {
  return new FflateZipWriter();
}

export function createZipReader(data: Uint8Array | ArrayBuffer): ZipReader {
  return new FflateZipReader(data);
}

export async function validateMxSceneZip(reader: ZipReader): Promise<void> {
  const files = await reader.list();

  if (!files.includes("manifest.json")) {
    throw new ZipError("Invalid .mxscene file: missing manifest.json");
  }

  if (!files.includes("scene.json")) {
    throw new ZipError("Invalid .mxscene file: missing scene.json");
  }

  const assetFiles = files.filter((f) => f.startsWith("assets/"));

  for (const assetFile of assetFiles) {
    const fileName = assetFile.substring("assets/".length);
    if (!fileName.includes("-") || fileName.length < 65) {
      throw new ZipError(`Invalid asset filename format: ${assetFile}`);
    }
  }

}

export function generateAssetFilename(hash: string, originalName: string): string {
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `assets/${hash}-${safeName}`;
}

export function parseAssetFilename(
  filename: string
): { hash: string; originalName: string } | null {
  if (!filename.startsWith("assets/")) {
    return null;
  }

  const name = filename.substring("assets/".length);
  const dashIndex = name.indexOf("-");

  if (dashIndex < 0 || dashIndex !== 64) {
    return null;
  }

  const hash = name.substring(0, dashIndex);
  const originalName = name.substring(dashIndex + 1);

  return { hash, originalName };
}
