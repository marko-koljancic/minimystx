/**
 * Asset discovery system for collecting external file references from nodes
 * Extensible design to support future node types with asset dependencies
 */

import type { AssetReference } from './types';
import { hashBytesSHA256 } from './crypto';

// Define SerializableObjFile interface here to avoid import issues
interface SerializableObjFile {
  name: string;
  size: number;
  lastModified: number;
  content: string; // Base64 encoded OBJ content
}

/**
 * Interface for nodes that reference external assets
 */
export interface AssetProvider {
  /**
   * Extract asset references from node parameters
   */
  getAssetReferences(nodeId: string, nodeType: string, params: Record<string, unknown>): Promise<AssetReference[]>;
}

/**
 * Registry of asset providers by node type
 */
class AssetProviderRegistry {
  private providers = new Map<string, AssetProvider>();

  /**
   * Register an asset provider for a node type
   */
  register(nodeType: string, provider: AssetProvider): void {
    this.providers.set(nodeType, provider);
  }

  /**
   * Get asset provider for a node type
   */
  get(nodeType: string): AssetProvider | undefined {
    return this.providers.get(nodeType);
  }

  /**
   * Get all registered node types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Global registry instance
const assetProviderRegistry = new AssetProviderRegistry();

/**
 * Asset provider for ImportObj nodes
 */
class ImportObjAssetProvider implements AssetProvider {
  async getAssetReferences(nodeId: string, _nodeType: string, params: Record<string, unknown>): Promise<AssetReference[]> {
    const objectParams = params.object as { file?: unknown; scale?: number; centerToOrigin?: boolean };
    if (!objectParams?.file) {
      return [];
    }

    const file = objectParams.file;
    let data: ArrayBuffer;
    let originalName: string;
    let size: number;

    try {
      if (file instanceof File) {
        // Handle File objects
        data = await file.arrayBuffer();
        originalName = file.name;
        size = file.size;
      } else if (this.isSerializableObjFile(file)) {
        // Handle SerializableObjFile objects
        const content = atob(file.content);
        data = new TextEncoder().encode(content).buffer;
        originalName = file.name;
        size = file.size;
      } else {
        console.warn(`[ImportObjAssetProvider] Unknown file type for node ${nodeId}`);
        return [];
      }

      // Compute hash
      const hash = await hashBytesSHA256(data);

      // Determine MIME type
      const mime = this.getMimeType(originalName);

      return [{
        hash,
        originalName,
        originalPath: undefined, // No path information in current implementation
        mime,
        size,
        data,
        role: 'model',
        importSettings: {
          scale: objectParams.scale || 1,
          centerToOrigin: objectParams.centerToOrigin || false,
        }
      }];

    } catch (error) {
      console.error(`[ImportObjAssetProvider] Failed to process asset for node ${nodeId}:`, error);
      return [];
    }
  }

  private isSerializableObjFile(obj: unknown): obj is SerializableObjFile {
    return obj !== null &&
           typeof obj === 'object' && 
           'name' in obj &&
           'size' in obj &&
           'lastModified' in obj &&
           'content' in obj &&
           typeof (obj as SerializableObjFile).name === 'string' &&
           typeof (obj as SerializableObjFile).size === 'number' &&
           typeof (obj as SerializableObjFile).lastModified === 'number' &&
           typeof (obj as SerializableObjFile).content === 'string';
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'obj':
        return 'model/obj';
      case 'mtl':
        return 'model/mtl';
      default:
        return 'application/octet-stream';
    }
  }
}

// Register built-in asset providers
assetProviderRegistry.register('importObjNode', new ImportObjAssetProvider());

/**
 * Discover all asset references in a graph
 */
export async function discoverAssets(graphData: {
  nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
  subFlows?: Record<string, {
    nodes: Array<{ id: string; type: string; params?: Record<string, unknown> }>;
  }>;
}): Promise<AssetReference[]> {
  const allAssets: AssetReference[] = [];
  const seenHashes = new Set<string>();

  // Process root-level nodes
  for (const node of graphData.nodes) {
    const provider = assetProviderRegistry.get(node.type);
    if (provider && node.params) {
      try {
        const assets = await provider.getAssetReferences(node.id, node.type, node.params);
        
        // Deduplicate by hash
        for (const asset of assets) {
          if (!seenHashes.has(asset.hash)) {
            allAssets.push(asset);
            seenHashes.add(asset.hash);
          }
        }
      } catch (error) {
        console.error(`[discoverAssets] Failed to get assets from node ${node.id}:`, error);
      }
    }
  }

  // Process subflow nodes
  if (graphData.subFlows) {
    for (const [geoNodeId, subFlow] of Object.entries(graphData.subFlows)) {
      for (const node of subFlow.nodes) {
        const provider = assetProviderRegistry.get(node.type);
        if (provider && node.params) {
          try {
            const assets = await provider.getAssetReferences(node.id, node.type, node.params);
            
            // Deduplicate by hash
            for (const asset of assets) {
              if (!seenHashes.has(asset.hash)) {
                allAssets.push(asset);
                seenHashes.add(asset.hash);
              }
            }
          } catch (error) {
            console.error(`[discoverAssets] Failed to get assets from subflow node ${geoNodeId}/${node.id}:`, error);
          }
        }
      }
    }
  }

  console.info(`[discoverAssets] Found ${allAssets.length} unique assets`);
  return allAssets;
}

/**
 * Register a custom asset provider for a node type
 */
export function registerAssetProvider(nodeType: string, provider: AssetProvider): void {
  assetProviderRegistry.register(nodeType, provider);
}

/**
 * Get all registered asset provider types
 */
export function getRegisteredAssetProviders(): string[] {
  return assetProviderRegistry.getRegisteredTypes();
}

/**
 * Validate that all assets are accessible and computable
 */
export async function validateAssets(assets: AssetReference[]): Promise<{
  valid: AssetReference[];
  invalid: Array<{ asset: AssetReference; error: string }>;
}> {
  const valid: AssetReference[] = [];
  const invalid: Array<{ asset: AssetReference; error: string }> = [];

  for (const asset of assets) {
    try {
      // Validate hash
      if (!/^[a-f0-9]{64}$/i.test(asset.hash)) {
        invalid.push({ asset, error: 'Invalid hash format' });
        continue;
      }

      // Validate data
      if (!asset.data || asset.data.byteLength === 0) {
        invalid.push({ asset, error: 'Empty or missing data' });
        continue;
      }

      // Validate size matches
      if (asset.size !== asset.data.byteLength) {
        invalid.push({ asset, error: `Size mismatch: expected ${asset.size}, got ${asset.data.byteLength}` });
        continue;
      }

      // Verify hash matches data
      const computedHash = await hashBytesSHA256(asset.data);
      if (computedHash !== asset.hash) {
        invalid.push({ asset, error: `Hash mismatch: expected ${asset.hash}, got ${computedHash}` });
        continue;
      }

      valid.push(asset);

    } catch (error) {
      invalid.push({ 
        asset, 
        error: error instanceof Error ? error.message : 'Unknown validation error' 
      });
    }
  }

  return { valid, invalid };
}