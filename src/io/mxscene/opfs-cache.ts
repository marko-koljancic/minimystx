/**
 * OPFS (Origin Private File System) based asset cache for persistent storage
 * Falls back to in-memory storage for browsers without OPFS support
 */

import type { AssetCache } from './types';
import { OpfsError } from './types';

/**
 * OPFS-based asset cache with in-memory fallback
 */
export class OpfsAssetCache implements AssetCache {
  private opfsRoot: FileSystemDirectoryHandle | null = null;
  private assetsDir: FileSystemDirectoryHandle | null = null;
  private memoryCache = new Map<string, ArrayBuffer>();
  private isOpfsSupported = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Initialize OPFS or fall back to memory cache
   */
  private async initialize(): Promise<void> {
    try {
      // Check if OPFS is supported
      if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
        console.warn('[OpfsAssetCache] OPFS not supported, using in-memory cache');
        return;
      }

      // Get OPFS root directory
      this.opfsRoot = await navigator.storage.getDirectory();
      
      // Create or get assets directory
      this.assetsDir = await this.opfsRoot.getDirectoryHandle('assets', { 
        create: true 
      });
      
      this.isOpfsSupported = true;
      console.info('[OpfsAssetCache] OPFS initialized successfully');
      
    } catch (error) {
      console.warn('[OpfsAssetCache] Failed to initialize OPFS:', error);
      this.isOpfsSupported = false;
    }
  }

  /**
   * Ensure initialization is complete
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Check if an asset exists in cache
   */
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

  /**
   * Get an asset from cache
   */
  async get(hash: string): Promise<ArrayBuffer | null> {
    await this.ensureInitialized();
    
    if (this.isOpfsSupported && this.assetsDir) {
      try {
        const fileHandle = await this.assetsDir.getFileHandle(hash);
        const file = await fileHandle.getFile();
        return await file.arrayBuffer();
      } catch (error) {
        if (error instanceof Error && error.name !== 'NotFoundError') {
          throw new OpfsError(`Failed to read asset ${hash}: ${error.message}`);
        }
        return null;
      }
    }
    
    return this.memoryCache.get(hash) || null;
  }

  /**
   * Store an asset in cache
   */
  async put(hash: string, data: ArrayBuffer): Promise<void> {
    await this.ensureInitialized();
    
    if (this.isOpfsSupported && this.assetsDir) {
      try {
        const fileHandle = await this.assetsDir.getFileHandle(hash, { 
          create: true 
        });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
        
        // Also store in memory cache for immediate access
        this.memoryCache.set(hash, data.slice(0)); // Create a copy
        
      } catch (error) {
        throw new OpfsError(`Failed to store asset ${hash}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Fall back to memory cache
      this.memoryCache.set(hash, data.slice(0)); // Create a copy
    }
  }

  /**
   * Clear all cached assets
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();
    
    this.memoryCache.clear();
    
    if (this.isOpfsSupported && this.assetsDir) {
      try {
        // Get all files in assets directory
        // @ts-expect-error - OPFS entries() method not in official TypeScript types yet
        const entries = this.assetsDir.entries();
        for await (const [name] of entries) {
          try {
            await this.assetsDir.removeEntry(name);
          } catch (error) {
            console.warn(`[OpfsAssetCache] Failed to remove ${name}:`, error);
          }
        }
      } catch (error) {
        throw new OpfsError(`Failed to clear asset cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Get approximate cache size (number of assets)
   */
  async size(): Promise<number> {
    await this.ensureInitialized();
    
    if (this.isOpfsSupported && this.assetsDir) {
      try {
        let count = 0;
        // @ts-expect-error - OPFS entries() method not in official TypeScript types yet
        const entries = this.assetsDir.entries();
        for await (const _ of entries) {
          count++;
        }
        return count;
      } catch (error) {
        console.warn('[OpfsAssetCache] Failed to count OPFS entries:', error);
        return this.memoryCache.size;
      }
    }
    
    return this.memoryCache.size;
  }

  /**
   * Get cache statistics
   */
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

  /**
   * Check if OPFS is available and working
   */
  async isHealthy(): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!this.isOpfsSupported) {
      return true; // Memory cache is always "healthy"
    }
    
    try {
      // Try to write and read a test file
      const testData = new Uint8Array([1, 2, 3, 4]);
      const testHash = 'test-health-check';
      
      await this.put(testHash, testData.buffer);
      const retrieved = await this.get(testHash);
      
      // Clean up test file
      if (this.assetsDir) {
        try {
          await this.assetsDir.removeEntry(testHash);
        } catch {
          // Ignore cleanup errors
        }
      }
      
      return retrieved !== null && 
             new Uint8Array(retrieved).every((val, i) => val === testData[i]);
             
    } catch (error) {
      console.warn('[OpfsAssetCache] Health check failed:', error);
      return false;
    }
  }

  /**
   * List all cached asset hashes
   */
  async listAssets(): Promise<string[]> {
    await this.ensureInitialized();
    
    const assets: string[] = [];
    
    if (this.isOpfsSupported && this.assetsDir) {
      try {
        // @ts-expect-error - OPFS entries() method not in official TypeScript types yet
        const entries = this.assetsDir.entries();
        for await (const [name] of entries) {
          assets.push(name);
        }
      } catch (error) {
        console.warn('[OpfsAssetCache] Failed to list OPFS assets:', error);
      }
    }
    
    // Add memory cache assets (deduplication handled by Set)
    const allAssets = new Set([...assets, ...this.memoryCache.keys()]);
    
    return Array.from(allAssets);
  }
}

// Singleton instance for global use
let globalAssetCache: OpfsAssetCache | null = null;

/**
 * Get the global asset cache instance
 */
export function getAssetCache(): OpfsAssetCache {
  if (!globalAssetCache) {
    globalAssetCache = new OpfsAssetCache();
  }
  return globalAssetCache;
}