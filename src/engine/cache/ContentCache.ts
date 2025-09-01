import { BaseContainer } from '../containers/BaseContainer';

// Browser-compatible hashing
const createHash = () => ({
  update: (data: string) => ({
    digest: () => {
      // Simple hash for browser compatibility - in production use crypto.subtle
      let hash = 0;
      if (data.length === 0) return hash.toString();
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash).toString(16);
    }
  })
});

export interface CacheEntry {
  validityHash: string;
  output: any;
  outputContainers?: Record<string, BaseContainer>;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  dependsOn: Set<string>; // nodeIds this entry depends on
  inputHashes: Record<string, string>; // hash of each input for precise invalidation
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  evictionCount: number;
}

/**
 * ContentCache - Content-addressed caching system for render-cone scheduler
 * 
 * Implements requirement I2 from minimystx-reactive-recompute.md:
 * - Content-addressed cache: Compute validityHash = hash(inputs, params, version, resources)
 * - If unchanged, reuse cached output
 * - Structural sharing: Shared outputs across multiple consumers kept once in cache
 * - Copy-on-write enforcement: Clone lazily if consumer requires mutated variant
 */
export class ContentCache {
  private cache = new Map<string, CacheEntry>();
  private nodeVersions = new Map<string, number>();
  private dependencyIndex = new Map<string, Set<string>>(); // nodeId -> Set of cache keys that depend on it
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private maxSize: number;
  
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * I2: Compute validity hash from inputs, params, version, resources
   * Enhanced to work with typed containers and provide fine-grained input tracking
   */
  computeValidityHash(
    nodeId: string,
    params: Record<string, any>,
    inputs: Record<string, BaseContainer> | Record<string, any>,
    resources?: Record<string, any>
  ): { validityHash: string; inputHashes: Record<string, string>; dependsOn: Set<string> } {
    const version = this.nodeVersions.get(nodeId) || 0;
    
    // Compute individual input hashes for fine-grained invalidation
    const inputHashes: Record<string, string> = {};
    const dependsOn = new Set<string>();
    
    // Handle typed containers or raw inputs
    const normalizedInputs: Record<string, any> = {};
    Object.entries(inputs).forEach(([key, value]) => {
      if (value instanceof BaseContainer) {
        const contentHash = value.getContentHash();
        inputHashes[key] = contentHash;
        normalizedInputs[key] = contentHash;
        
        // Track dependency on source node if available
        const sourceNodeMatch = contentHash.match(/^(\w+)-/);
        if (sourceNodeMatch) {
          dependsOn.add(sourceNodeMatch[1]);
        }
      } else {
        const inputStr = JSON.stringify(this.normalizeForHashing(value));
        inputHashes[key] = this.createHash(inputStr);
        normalizedInputs[key] = this.normalizeForHashing(value);
      }
    });
    
    const hashData = {
      nodeId,
      params: this.normalizeForHashing(params),
      inputs: normalizedInputs,
      resources: resources ? this.normalizeForHashing(resources) : null,
      version
    };
    
    const validityHash = this.createHash(JSON.stringify(hashData));
    
    return { validityHash, inputHashes, dependsOn };
  }

  /**
   * Get cached output if validity hash matches
   * Enhanced with fine-grained invalidation checking
   */
  getCachedOutput(
    nodeId: string,
    params: Record<string, any>,
    inputs: Record<string, BaseContainer> | Record<string, any>,
    resources?: Record<string, any>
  ): { output?: any; outputContainers?: Record<string, BaseContainer> } | null {
    const hashResult = this.computeValidityHash(nodeId, params, inputs, resources);
    const entry = this.cache.get(hashResult.validityHash);
    
    if (entry) {
      // Check if any input has changed since caching
      let inputsValid = true;
      Object.entries(hashResult.inputHashes).forEach(([inputName, currentHash]) => {
        if (entry.inputHashes[inputName] !== currentHash) {
          inputsValid = false;
        }
      });
      
      if (inputsValid) {
        // Update access statistics
        entry.accessCount++;
        entry.lastAccess = Date.now();
        this.hitCount++;
        
        return {
          output: entry.output,
          outputContainers: entry.outputContainers
        };
      } else {
        // Input changed, remove stale entry
        this.removeFromDependencyIndex(hashResult.validityHash);
        this.cache.delete(hashResult.validityHash);
      }
    }
    
    this.missCount++;
    return null;
  }

  /**
   * Store computed output with validity hash and dependency tracking
   */
  setCachedOutput(
    nodeId: string,
    params: Record<string, any>,
    inputs: Record<string, BaseContainer> | Record<string, any>,
    output: any,
    outputContainers?: Record<string, BaseContainer>,
    resources?: Record<string, any>
  ): void {
    const hashResult = this.computeValidityHash(nodeId, params, inputs, resources);
    
    const entry: CacheEntry = {
      validityHash: hashResult.validityHash,
      output,
      outputContainers,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
      dependsOn: hashResult.dependsOn,
      inputHashes: hashResult.inputHashes
    };
    
    this.cache.set(hashResult.validityHash, entry);
    
    // Update dependency index for intelligent invalidation
    hashResult.dependsOn.forEach(dependencyNodeId => {
      if (!this.dependencyIndex.has(dependencyNodeId)) {
        this.dependencyIndex.set(dependencyNodeId, new Set());
      }
      this.dependencyIndex.get(dependencyNodeId)!.add(hashResult.validityHash);
    });
    
    // Enforce cache size limit with LRU eviction
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Intelligent invalidation for a specific node
   * Only invalidates entries that actually depend on this node
   */
  invalidateNode(nodeId: string): number {
    // Increment node version to invalidate future lookups
    const currentVersion = this.nodeVersions.get(nodeId) || 0;
    this.nodeVersions.set(nodeId, currentVersion + 1);
    
    // Get all cache entries that depend on this node
    const dependentEntries = this.dependencyIndex.get(nodeId);
    if (!dependentEntries) {
      return 0; // Nothing to invalidate
    }
    
    let invalidatedCount = 0;
    
    // Remove dependent cache entries
    dependentEntries.forEach(cacheKey => {
      const entry = this.cache.get(cacheKey);
      if (entry) {
        // Remove from dependency index
        entry.dependsOn.forEach(depNodeId => {
          const depSet = this.dependencyIndex.get(depNodeId);
          if (depSet) {
            depSet.delete(cacheKey);
            if (depSet.size === 0) {
              this.dependencyIndex.delete(depNodeId);
            }
          }
        });
        
        // Remove from cache
        this.cache.delete(cacheKey);
        invalidatedCount++;
      }
    });
    
    // Clear dependency index for this node
    this.dependencyIndex.delete(nodeId);
    
    return invalidatedCount;
  }

  /**
   * Invalidate entries that use a specific input
   */
  invalidateByInputChange(nodeId: string, inputName: string, newInputHash: string): number {
    let invalidatedCount = 0;
    const keysToRemove: string[] = [];
    
    // Find cache entries for this node where the specific input has changed
    this.cache.forEach((entry, key) => {
      if (entry.validityHash.includes(nodeId) && 
          entry.inputHashes[inputName] && 
          entry.inputHashes[inputName] !== newInputHash) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      this.removeFromDependencyIndex(key);
      this.cache.delete(key);
      invalidatedCount++;
    });
    
    return invalidatedCount;
  }

  /**
   * Helper to remove entry from dependency index
   */
  private removeFromDependencyIndex(cacheKey: string): void {
    const entry = this.cache.get(cacheKey);
    if (entry) {
      entry.dependsOn.forEach(depNodeId => {
        const depSet = this.dependencyIndex.get(depNodeId);
        if (depSet) {
          depSet.delete(cacheKey);
          if (depSet.size === 0) {
            this.dependencyIndex.delete(depNodeId);
          }
        }
      });
    }
  }

  /**
   * I6: Copy-on-write support for shared outputs
   * If consumer needs to mutate output, create new cache entry
   */
  cloneForMutation(originalHash: string, mutatedOutput: any): string {
    const originalEntry = this.cache.get(originalHash);
    if (!originalEntry) {
      throw new Error(`Original cache entry not found: ${originalHash}`);
    }

    // Create new hash for mutated version
    const mutatedHash = this.createHash(JSON.stringify({
      original: originalHash,
      mutated: Date.now(),
      random: Math.random()
    }));

    // Store mutated version
    const mutatedEntry: CacheEntry = {
      validityHash: mutatedHash,
      output: mutatedOutput,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
      dependsOn: new Set<string>(),
      inputHashes: {}
    };

    this.cache.set(mutatedHash, mutatedEntry);
    return mutatedHash;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    
    // Estimate memory usage (rough approximation)
    let memoryUsage = 0;
    this.cache.forEach(entry => {
      memoryUsage += JSON.stringify(entry.output).length;
    });

    return {
      totalEntries: this.cache.size,
      hitRate,
      memoryUsage,
      evictionCount: this.evictionCount
    };
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.nodeVersions.clear();
    this.dependencyIndex.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }

  /**
   * I5: Policy-configurable cache management
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
    
    // Evict entries if we're over the new limit
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Private: Create hash from string data
   */
  private createHash(data: string): string {
    return createHash().update(data).digest();
  }

  /**
   * Private: Normalize data structures for consistent hashing
   */
  private normalizeForHashing(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeForHashing(item));
    }
    
    // Sort object keys for consistent hashing
    const normalized: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>)
      .sort()
      .forEach(key => {
        normalized[key] = this.normalizeForHashing((obj as Record<string, unknown>)[key]);
      });
    
    return normalized;
  }

  /**
   * Private: Evict least recently used entry with dependency index cleanup
   */
  private evictLRU(): void {
    let oldestEntry: string | null = null;
    let oldestTime = Infinity;
    
    this.cache.forEach((entry, key) => {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestEntry = key;
      }
    });
    
    if (oldestEntry) {
      // Clean up dependency index
      this.removeFromDependencyIndex(oldestEntry);
      
      // Remove from cache
      this.cache.delete(oldestEntry);
      this.evictionCount++;
    }
  }

  /**
   * Check if output exists in cache
   */
  hasCachedOutput(
    nodeId: string,
    params: Record<string, any>,
    inputs: Record<string, BaseContainer> | Record<string, any>,
    resources?: Record<string, any>
  ): boolean {
    const hashResult = this.computeValidityHash(nodeId, params, inputs, resources);
    return this.cache.has(hashResult.validityHash);
  }

  /**
   * Get all cache entries for debugging
   */
  getAllEntries(): Map<string, CacheEntry> {
    return new Map(this.cache);
  }

  /**
   * Remove specific cache entry by hash
   */
  removeEntry(validityHash: string): boolean {
    return this.cache.delete(validityHash);
  }

  /**
   * Prune cache entries older than specified age (in milliseconds)
   */
  pruneOlderThan(maxAge: number): number {
    const cutoffTime = Date.now() - maxAge;
    const keysToRemove: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < cutoffTime) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => this.cache.delete(key));
    this.evictionCount += keysToRemove.length;
    
    return keysToRemove.length;
  }
}