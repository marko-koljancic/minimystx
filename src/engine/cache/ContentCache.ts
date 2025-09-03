import { BaseContainer } from "../containers/BaseContainer";
const createHash = () => ({
  update: (data: string) => ({
    digest: () => {
      let hash = 0;
      if (data.length === 0) return hash.toString();
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    },
  }),
});
export interface CacheEntry {
  validityHash: string;
  output: any;
  outputContainers?: Record<string, BaseContainer>;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  dependsOn: Set<string>;
  inputHashes: Record<string, string>;
}
export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  evictionCount: number;
}
export class ContentCache {
  private cache = new Map<string, CacheEntry>();
  private nodeVersions = new Map<string, number>();
  private dependencyIndex = new Map<string, Set<string>>();
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private maxSize: number;
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }
  computeValidityHash(
    nodeId: string,
    params: Record<string, any>,
    inputs: Record<string, BaseContainer> | Record<string, any>,
    resources?: Record<string, any>
  ): { validityHash: string; inputHashes: Record<string, string>; dependsOn: Set<string> } {
    const version = this.nodeVersions.get(nodeId) || 0;
    const inputHashes: Record<string, string> = {};
    const dependsOn = new Set<string>();
    const normalizedInputs: Record<string, any> = {};
    Object.entries(inputs).forEach(([key, value]) => {
      if (value instanceof BaseContainer) {
        const contentHash = value.getContentHash();
        inputHashes[key] = contentHash;
        normalizedInputs[key] = contentHash;
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
      version,
    };
    const validityHash = this.createHash(JSON.stringify(hashData));
    return { validityHash, inputHashes, dependsOn };
  }
  getCachedOutput(
    nodeId: string,
    params: Record<string, any>,
    inputs: Record<string, BaseContainer> | Record<string, any>,
    resources?: Record<string, any>
  ): { output?: any; outputContainers?: Record<string, BaseContainer> } | null {
    const hashResult = this.computeValidityHash(nodeId, params, inputs, resources);
    const entry = this.cache.get(hashResult.validityHash);
    if (entry) {
      let inputsValid = true;
      Object.entries(hashResult.inputHashes).forEach(([inputName, currentHash]) => {
        if (entry.inputHashes[inputName] !== currentHash) {
          inputsValid = false;
        }
      });
      if (inputsValid) {
        entry.accessCount++;
        entry.lastAccess = Date.now();
        this.hitCount++;
        return {
          output: entry.output,
          outputContainers: entry.outputContainers,
        };
      } else {
        this.removeFromDependencyIndex(hashResult.validityHash);
        this.cache.delete(hashResult.validityHash);
      }
    }
    this.missCount++;
    return null;
  }
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
      inputHashes: hashResult.inputHashes,
    };
    this.cache.set(hashResult.validityHash, entry);
    hashResult.dependsOn.forEach((dependencyNodeId) => {
      if (!this.dependencyIndex.has(dependencyNodeId)) {
        this.dependencyIndex.set(dependencyNodeId, new Set());
      }
      this.dependencyIndex.get(dependencyNodeId)!.add(hashResult.validityHash);
    });
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }
  invalidateNode(nodeId: string): number {
    const currentVersion = this.nodeVersions.get(nodeId) || 0;
    this.nodeVersions.set(nodeId, currentVersion + 1);
    const dependentEntries = this.dependencyIndex.get(nodeId);
    if (!dependentEntries) {
      return 0;
    }
    let invalidatedCount = 0;
    dependentEntries.forEach((cacheKey) => {
      const entry = this.cache.get(cacheKey);
      if (entry) {
        entry.dependsOn.forEach((depNodeId) => {
          const depSet = this.dependencyIndex.get(depNodeId);
          if (depSet) {
            depSet.delete(cacheKey);
            if (depSet.size === 0) {
              this.dependencyIndex.delete(depNodeId);
            }
          }
        });
        this.cache.delete(cacheKey);
        invalidatedCount++;
      }
    });
    this.dependencyIndex.delete(nodeId);
    return invalidatedCount;
  }
  invalidateByInputChange(nodeId: string, inputName: string, newInputHash: string): number {
    let invalidatedCount = 0;
    const keysToRemove: string[] = [];
    this.cache.forEach((entry, key) => {
      if (
        entry.validityHash.includes(nodeId) &&
        entry.inputHashes[inputName] &&
        entry.inputHashes[inputName] !== newInputHash
      ) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((key) => {
      this.removeFromDependencyIndex(key);
      this.cache.delete(key);
      invalidatedCount++;
    });
    return invalidatedCount;
  }
  private removeFromDependencyIndex(cacheKey: string): void {
    const entry = this.cache.get(cacheKey);
    if (entry) {
      entry.dependsOn.forEach((depNodeId) => {
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
  cloneForMutation(originalHash: string, mutatedOutput: any): string {
    const originalEntry = this.cache.get(originalHash);
    if (!originalEntry) {
      throw new Error(`Original cache entry not found: ${originalHash}`);
    }
    const mutatedHash = this.createHash(
      JSON.stringify({
        original: originalHash,
        mutated: Date.now(),
        random: Math.random(),
      })
    );
    const mutatedEntry: CacheEntry = {
      validityHash: mutatedHash,
      output: mutatedOutput,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccess: Date.now(),
      dependsOn: new Set<string>(),
      inputHashes: {},
    };
    this.cache.set(mutatedHash, mutatedEntry);
    return mutatedHash;
  }
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;
    let memoryUsage = 0;
    this.cache.forEach((entry) => {
      memoryUsage += JSON.stringify(entry.output).length;
    });
    return {
      totalEntries: this.cache.size,
      hitRate,
      memoryUsage,
      evictionCount: this.evictionCount,
    };
  }
  clear(): void {
    this.cache.clear();
    this.nodeVersions.clear();
    this.dependencyIndex.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }
  private createHash(data: string): string {
    return createHash().update(data).digest();
  }
  private normalizeForHashing(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeForHashing(item));
    }
    const normalized: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>)
      .sort()
      .forEach((key) => {
        normalized[key] = this.normalizeForHashing((obj as Record<string, unknown>)[key]);
      });
    return normalized;
  }
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
      this.removeFromDependencyIndex(oldestEntry);
      this.cache.delete(oldestEntry);
      this.evictionCount++;
    }
  }
  hasCachedOutput(
    nodeId: string,
    params: Record<string, any>,
    inputs: Record<string, BaseContainer> | Record<string, any>,
    resources?: Record<string, any>
  ): boolean {
    const hashResult = this.computeValidityHash(nodeId, params, inputs, resources);
    return this.cache.has(hashResult.validityHash);
  }
  getAllEntries(): Map<string, CacheEntry> {
    return new Map(this.cache);
  }
  removeEntry(validityHash: string): boolean {
    return this.cache.delete(validityHash);
  }
  pruneOlderThan(maxAge: number): number {
    const cutoffTime = Date.now() - maxAge;
    const keysToRemove: string[] = [];
    this.cache.forEach((entry, key) => {
      if (entry.timestamp < cutoffTime) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach((key) => this.cache.delete(key));
    this.evictionCount += keysToRemove.length;
    return keysToRemove.length;
  }
}
