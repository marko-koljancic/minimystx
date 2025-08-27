import type { AssetCache } from "./types";
import { OpfsError } from "./types";

export class OpfsAssetCache implements AssetCache {
  private opfsRoot: FileSystemDirectoryHandle | null = null;
  private assetsDir: FileSystemDirectoryHandle | null = null;
  private memoryCache = new Map<string, ArrayBuffer>();
  private isOpfsSupported = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (!("storage" in navigator) || !("getDirectory" in navigator.storage)) {
        return;
      }

      this.opfsRoot = await navigator.storage.getDirectory();

      this.assetsDir = await this.opfsRoot.getDirectoryHandle("assets", {
        create: true,
      });

      this.isOpfsSupported = true;
    } catch (error) {
      this.isOpfsSupported = false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async has(hash: string): Promise<boolean> {
    await this.ensureInitialized();

    if (this.isOpfsSupported && this.assetsDir) {
      try {
        await this.assetsDir.getFileHandle(hash);
        return true;
      } catch {
        return false;
      }
    }

    return this.memoryCache.has(hash);
  }

  async get(hash: string): Promise<ArrayBuffer | null> {
    await this.ensureInitialized();

    if (this.isOpfsSupported && this.assetsDir) {
      try {
        const fileHandle = await this.assetsDir.getFileHandle(hash);
        const file = await fileHandle.getFile();
        return await file.arrayBuffer();
      } catch (error) {
        if (error instanceof Error && error.name !== "NotFoundError") {
          throw new OpfsError(`Failed to read asset ${hash}: ${error.message}`);
        }
        return null;
      }
    }

    return this.memoryCache.get(hash) || null;
  }

  async put(hash: string, data: ArrayBuffer): Promise<void> {
    await this.ensureInitialized();

    if (this.isOpfsSupported && this.assetsDir) {
      try {
        const fileHandle = await this.assetsDir.getFileHandle(hash, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();

        this.memoryCache.set(hash, data.slice(0));
      } catch (error) {
        throw new OpfsError(
          `Failed to store asset ${hash}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else {
      this.memoryCache.set(hash, data.slice(0));
    }
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();

    this.memoryCache.clear();

    if (this.isOpfsSupported && this.assetsDir) {
      try {
        for await (const [name] of (this.assetsDir as any)) {
          try {
            await this.assetsDir.removeEntry(name);
          } catch (error) {
            // Ignore errors when removing individual entries during cleanup
          }
        }
      } catch (error) {
        throw new OpfsError(
          `Failed to clear asset cache: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  }

  async size(): Promise<number> {
    await this.ensureInitialized();

    if (this.isOpfsSupported && this.assetsDir) {
      try {
        let count = 0;

        for await (const _ of (this.assetsDir as any)) {
          count++;
        }
        return count;
      } catch (error) {
        return this.memoryCache.size;
      }
    }

    return this.memoryCache.size;
  }

  async getStats(): Promise<{
    isOpfsSupported: boolean;
    assetCount: number;
    memoryCount: number;
  }> {
    await this.ensureInitialized();

    const assetCount = await this.size();

    return {
      isOpfsSupported: this.isOpfsSupported,
      assetCount,
      memoryCount: this.memoryCache.size,
    };
  }

  async isHealthy(): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.isOpfsSupported) {
      return true;
    }

    try {
      const testData = new Uint8Array([1, 2, 3, 4]);
      const testHash = "test-health-check";

      await this.put(testHash, testData.buffer);
      const retrieved = await this.get(testHash);

      if (this.assetsDir) {
        try {
          await this.assetsDir.removeEntry(testHash);
        } catch {}
      }

      return retrieved !== null && new Uint8Array(retrieved).every((val, i) => val === testData[i]);
    } catch (error) {
      return false;
    }
  }

  async listAssets(): Promise<string[]> {
    await this.ensureInitialized();

    const assets: string[] = [];

    if (this.isOpfsSupported && this.assetsDir) {
      try {
        for await (const [name] of (this.assetsDir as any)) {
          assets.push(name);
        }
      } catch (error) {
      }
    }

    const allAssets = new Set([...assets, ...this.memoryCache.keys()]);

    return Array.from(allAssets);
  }
}

let globalAssetCache: OpfsAssetCache | null = null;

export function getAssetCache(): OpfsAssetCache {
  if (!globalAssetCache) {
    globalAssetCache = new OpfsAssetCache();
  }
  return globalAssetCache;
}
