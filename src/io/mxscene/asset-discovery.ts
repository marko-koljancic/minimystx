import type { AssetReference } from "./types";
import { hashBytesSHA256 } from "./crypto";
interface SerializableObjFile {
  name: string;
  size: number;
  lastModified: number;
  content: string;
}
interface SerializableGltfFile {
  name: string;
  size: number;
  lastModified: number;
  content: string;
}
export interface AssetProvider {
  getAssetReferences(nodeId: string, nodeType: string, params: Record<string, unknown>): Promise<AssetReference[]>;
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
    _nodeId: string,
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
class ImportGltfAssetProvider implements AssetProvider {
  async getAssetReferences(
    _nodeId: string,
    _nodeType: string,
    params: Record<string, unknown>
  ): Promise<AssetReference[]> {
    const objectParams = params.object as {
      file?: unknown;
      scale?: number;
      centerToOrigin?: boolean;
      preserveMaterials?: boolean;
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
      } else if (this.isSerializableGltfFile(file)) {
        const binaryString = atob(file.content);
        const uint8Array = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          uint8Array[i] = binaryString.charCodeAt(i);
        }
        data = uint8Array.buffer;
        originalName = file.name;
        size = file.size;
      } else {
        return [];
      }
      const hash = await hashBytesSHA256(data);
      const mime = this.getMimeType(originalName);
      const assets: AssetReference[] = [
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
            preserveMaterials: objectParams.preserveMaterials !== false,
          },
        },
      ];
      const textureAssets = await this.extractTexturesFromGltf(data, originalName);
      assets.push(...textureAssets);
      return assets;
    } catch (error) {
      return [];
    }
  }
  private async extractTexturesFromGltf(data: ArrayBuffer, filename: string): Promise<AssetReference[]> {
    const textureAssets: AssetReference[] = [];
    try {
      const isGlb = filename.toLowerCase().endsWith(".glb");
      if (isGlb) {
        const texturesFromGlb = await this.extractTexturesFromGlb(data);
        textureAssets.push(...texturesFromGlb);
      } else {
        const texturesFromGltf = await this.extractTexturesFromGltfJson(data);
        textureAssets.push(...texturesFromGltf);
      }
    } catch (error) {}
    return textureAssets;
  }
  private async extractTexturesFromGltfJson(data: ArrayBuffer): Promise<AssetReference[]> {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(data);
    const gltf = JSON.parse(jsonString);
    return await this.extractEmbeddedTextures(gltf);
  }
  private async extractTexturesFromGlb(data: ArrayBuffer): Promise<AssetReference[]> {
    const view = new DataView(data);
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546c67) {
      return [];
    }
    let offset = 12;
    const jsonChunkLength = view.getUint32(offset, true);
    const jsonChunkType = view.getUint32(offset + 4, true);
    if (jsonChunkType !== 0x4e4f534a) {
      return [];
    }
    const jsonBytes = new Uint8Array(data, offset + 8, jsonChunkLength);
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(jsonBytes);
    const gltf = JSON.parse(jsonString);
    const embeddedTextures = await this.extractEmbeddedTextures(gltf);
    const binaryOffset = offset + 8 + jsonChunkLength;
    if (binaryOffset < data.byteLength) {
      const binaryChunkLength = view.getUint32(binaryOffset, true);
      const binaryChunkType = view.getUint32(binaryOffset + 4, true);
      if (binaryChunkType === 0x004e4942) {
        const binaryData = new Uint8Array(data, binaryOffset + 8, binaryChunkLength);
        const binaryTextures = await this.extractTexturesFromBinaryBuffer(gltf, binaryData);
        embeddedTextures.push(...binaryTextures);
      }
    }
    return embeddedTextures;
  }
  private async extractEmbeddedTextures(gltf: any): Promise<AssetReference[]> {
    const textures: AssetReference[] = [];
    if (!gltf.images || !Array.isArray(gltf.images)) {
      return textures;
    }
    for (let index = 0; index < gltf.images.length; index++) {
      const image = gltf.images[index];
      if (image.uri && image.uri.startsWith("data:")) {
        const dataUri = image.uri;
        const [header, base64Data] = dataUri.split(",");
        if (base64Data) {
          const mimeMatch = header.match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : "image/png";
          try {
            const binaryString = atob(base64Data);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              uint8Array[i] = binaryString.charCodeAt(i);
            }
            const textureData = uint8Array.buffer;
            const extension = this.getExtensionFromMime(mime);
            const textureName = `texture_${index}.${extension}`;
            try {
              const hash = await hashBytesSHA256(textureData);
              textures.push({
                hash,
                originalName: textureName,
                originalPath: undefined,
                mime,
                size: textureData.byteLength,
                data: textureData,
                role: "texture",
                importSettings: {},
              });
            } catch (error) {
              console.error("Error extracting texture:", error);
            }
          } catch (error) {
            console.error("Error decoding base64 texture:", error);
          }
        }
      }
    }
    return textures;
  }
  private async extractTexturesFromBinaryBuffer(gltf: any, binaryData: Uint8Array): Promise<AssetReference[]> {
    const textures: AssetReference[] = [];
    if (!gltf.images || !Array.isArray(gltf.images) || !gltf.bufferViews) {
      return textures;
    }
    for (let i = 0; i < gltf.images.length; i++) {
      const image = gltf.images[i];
      if (typeof image.bufferView === "number") {
        const bufferView = gltf.bufferViews[image.bufferView];
        if (bufferView && typeof bufferView.byteOffset === "number" && typeof bufferView.byteLength === "number") {
          const start = bufferView.byteOffset || 0;
          const length = bufferView.byteLength;
          if (start + length <= binaryData.length) {
            const textureData = binaryData.slice(start, start + length).buffer;
            const mime = image.mimeType || "image/png";
            const extension = this.getExtensionFromMime(mime);
            const textureName = `texture_${i}.${extension}`;
            try {
              const hash = await hashBytesSHA256(textureData);
              textures.push({
                hash,
                originalName: textureName,
                originalPath: undefined,
                mime,
                size: textureData.byteLength,
                data: textureData,
                role: "texture",
                importSettings: {},
              });
            } catch (error) {
              console.error("Error extracting texture:", error);
            }
          }
        }
      }
    }
    return textures;
  }
  private getExtensionFromMime(mime: string): string {
    switch (mime.toLowerCase()) {
      case "image/jpeg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      case "image/gif":
        return "gif";
      case "image/bmp":
        return "bmp";
      default:
        return "png";
    }
  }
  private isSerializableGltfFile(obj: unknown): obj is SerializableGltfFile {
    return (
      obj !== null &&
      typeof obj === "object" &&
      "name" in obj &&
      "size" in obj &&
      "lastModified" in obj &&
      "content" in obj &&
      typeof (obj as SerializableGltfFile).name === "string" &&
      typeof (obj as SerializableGltfFile).size === "number" &&
      typeof (obj as SerializableGltfFile).lastModified === "number" &&
      typeof (obj as SerializableGltfFile).content === "string"
    );
  }
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    switch (ext) {
      case "gltf":
        return "model/gltf+json";
      case "glb":
        return "model/gltf-binary";
      default:
        return "application/octet-stream";
    }
  }
}
assetProviderRegistry.register("importObjNode", new ImportObjAssetProvider());
assetProviderRegistry.register("importGltfNode", new ImportGltfAssetProvider());
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
        console.error("Error discovering assets for node:", error);
      }
    }
  }
  if (graphData.subFlows) {
    for (const [, subFlow] of Object.entries(graphData.subFlows)) {
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
            console.error("Error discovering assets for subflow node:", error);
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
