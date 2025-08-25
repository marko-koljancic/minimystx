import type { AssetReference } from "./types";
import { hashBytesSHA256 } from "./crypto";

interface SerializableObjFile {
  name: string;
  size: number;
  lastModified: number;
  content: string;
}

export interface AssetProvider {
  getAssetReferences(
    nodeId: string,
    nodeType: string,
    params: Record<string, unknown>
  ): Promise<AssetReference[]>;
}

class AssetProviderRegistry {
  private providers = new Map<string, AssetProvider>();

  register(nodeType: string, provider: AssetProvider): void {
    this.providers.set(nodeType, provider);
  }

  get(nodeType: string): AssetProvider | undefined {
    return this.providers.get(nodeType);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}

const assetProviderRegistry = new AssetProviderRegistry();

class ImportObjAssetProvider implements AssetProvider {
  async getAssetReferences(
    nodeId: string,
    _nodeType: string,
    params: Record<string, unknown>
  ): Promise<AssetReference[]> {
    const objectParams = params.object as {
      file?: unknown;
      scale?: number;
      centerToOrigin?: boolean;
    };
    if (!objectParams?.file) {
      return [];
    }

    const file = objectParams.file;
    let data: ArrayBuffer;
    let originalName: string;
    let size: number;

    try {
      if (file instanceof File) {
        data = await file.arrayBuffer();
        originalName = file.name;
        size = file.size;
      } else if (this.isSerializableObjFile(file)) {
        const content = atob(file.content);
        data = new TextEncoder().encode(content).buffer;
        originalName = file.name;
        size = file.size;
      } else {
        return [];
      }

      const hash = await hashBytesSHA256(data);

      const mime = this.getMimeType(originalName);

      return [
        {
          hash,
          originalName,
          originalPath: undefined,
          mime,
          size,
          data,
          role: "model",
          importSettings: {
            scale: objectParams.scale || 1,
            centerToOrigin: objectParams.centerToOrigin || false,
          },
        },
      ];
    } catch (error) {
      return [];
    }
  }

  private isSerializableObjFile(obj: unknown): obj is SerializableObjFile {
    return (
      obj !== null &&
      typeof obj === "object" &&
      "name" in obj &&
      "size" in obj &&
      "lastModified" in obj &&
      "content" in obj &&
      typeof (obj as SerializableObjFile).name === "string" &&
      typeof (obj as SerializableObjFile).size === "number" &&
      typeof (obj as SerializableObjFile).lastModified === "number" &&
      typeof (obj as SerializableObjFile).content === "string"
    );
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "obj":
        return "model/obj";
      case "mtl":
        return "model/mtl";
      default:
        return "application/octet-stream";
    }
  }
}

assetProviderRegistry.register("importObjNode", new ImportObjAssetProvider());

export async function discoverAssets(graphData: {
  nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
  subFlows?: Record<
    string,
    {
      nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
    }
  >;
}): Promise<AssetReference[]> {
  const allAssets: AssetReference[] = [];
  const seenHashes = new Set<string>();

  for (const node of graphData.nodes) {
    const provider = assetProviderRegistry.get(node.type);
    if (provider && node.params) {
      try {
        const assets = await provider.getAssetReferences(node.id, node.type, node.params);

        for (const asset of assets) {
          if (!seenHashes.has(asset.hash)) {
            allAssets.push(asset);
            seenHashes.add(asset.hash);
          }
        }
      } catch (error) {
      }
    }
  }

  if (graphData.subFlows) {
    for (const [geoNodeId, subFlow] of Object.entries(graphData.subFlows)) {
      for (const node of subFlow.nodes) {
        const provider = assetProviderRegistry.get(node.type);
        if (provider && node.params) {
          try {
            const assets = await provider.getAssetReferences(node.id, node.type, node.params);

            for (const asset of assets) {
              if (!seenHashes.has(asset.hash)) {
                allAssets.push(asset);
                seenHashes.add(asset.hash);
              }
            }
          } catch (error) {
          }
        }
      }
    }
  }

  return allAssets;
}

export function registerAssetProvider(nodeType: string, provider: AssetProvider): void {
  assetProviderRegistry.register(nodeType, provider);
}

export function getRegisteredAssetProviders(): string[] {
  return assetProviderRegistry.getRegisteredTypes();
}

export async function validateAssets(assets: AssetReference[]): Promise<{
  valid: AssetReference[];
  invalid: Array<{ asset: AssetReference; error: string }>;
}> {
  const valid: AssetReference[] = [];
  const invalid: Array<{ asset: AssetReference; error: string }> = [];

  for (const asset of assets) {
    try {
      if (!/^[a-f0-9]{64}$/i.test(asset.hash)) {
        invalid.push({ asset, error: "Invalid hash format" });
        continue;
      }

      if (!asset.data || asset.data.byteLength === 0) {
        invalid.push({ asset, error: "Empty or missing data" });
        continue;
      }

      if (asset.size !== asset.data.byteLength) {
        invalid.push({
          asset,
          error: `Size mismatch: expected ${asset.size}, got ${asset.data.byteLength}`,
        });
        continue;
      }

      const computedHash = await hashBytesSHA256(asset.data);
      if (computedHash !== asset.hash) {
        invalid.push({
          asset,
          error: `Hash mismatch: expected ${asset.hash}, got ${computedHash}`,
        });
        continue;
      }

      valid.push(asset);
    } catch (error) {
      invalid.push({
        asset,
        error: error instanceof Error ? error.message : "Unknown validation error",
      });
    }
  }

  return { valid, invalid };
}
