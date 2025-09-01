/**
 * Cook-On-Demand System for Minimystx
 * 
 * Orchestrates the interaction between RenderConeScheduler, ContentCache, 
 * and GraphLibAdapter to provide intelligent, fine-grained computation
 * that only processes what's needed when it's needed.
 */

import { RenderConeScheduler, type SchedulerEvent } from '../scheduler/RenderConeScheduler';
import { ContentCache } from '../cache/ContentCache';
import { GraphLibAdapter } from '../graph/GraphLibAdapter';
import { BaseContainer } from '../containers/BaseContainer';

export interface CookRequest {
  nodeId: string;
  reason: 'parameter_change' | 'input_change' | 'connection_change' | 'render_target_change';
  details?: {
    parameterName?: string;
    inputName?: string;
    oldValue?: unknown;
    newValue?: unknown;
  };
}

export interface CookResult {
  nodeId: string;
  success: boolean;
  outputs?: Record<string, BaseContainer>;
  error?: string;
  cacheHit: boolean;
  computeTime: number;
  affectedNodes: string[];
}

export interface CookStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  avgComputeTime: number;
  nodesCooked: number;
  redundantCooks: number; // Cooks that were unnecessary
}

/**
 * Central orchestrator for intelligent computation
 */
export class CookOnDemandSystem {
  private scheduler: RenderConeScheduler;
  private cache: ContentCache;
  private graph: GraphLibAdapter;
  private stats: CookStats;
  private cookQueue: Map<string, CookRequest> = new Map();
  private processingQueue = false;
  private listeners = new Set<(event: SchedulerEvent) => void>();

  constructor(graph: GraphLibAdapter, scheduler: RenderConeScheduler, cache: ContentCache) {
    this.graph = graph;
    this.scheduler = scheduler;
    this.cache = cache;
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgComputeTime: 0,
      nodesCooked: 0,
      redundantCooks: 0
    };

    // Listen to scheduler events to update statistics
    this.scheduler.addListener(this.handleSchedulerEvent.bind(this));
  }

  /**
   * Request a node to be cooked with specific reason tracking
   */
  requestCook(request: CookRequest): void {
    this.stats.totalRequests++;

    // For now, we'll process all requests since the scheduler handles render cone filtering
    // In the future, we could add render cone checking here for even better optimization

    // Queue the request (later requests override earlier ones for same node)
    this.cookQueue.set(request.nodeId, request);

    // Process queue on next tick
    if (!this.processingQueue) {
      this.processingQueue = true;
      requestAnimationFrame(() => this.processQueue());
    }
  }

  /**
   * Request cook due to parameter change with fine-grained tracking
   */
  requestCookForParameterChange(
    nodeId: string, 
    parameterName: string, 
    oldValue: unknown, 
    newValue: unknown
  ): void {
    // Check if this parameter change actually affects computation
    if (this.isParameterChangeSignificant(nodeId, parameterName, oldValue, newValue)) {
      this.requestCook({
        nodeId,
        reason: 'parameter_change',
        details: { parameterName, oldValue, newValue }
      });
    } else {
      console.log(`Ignoring insignificant parameter change: ${nodeId}.${parameterName}`);
      this.stats.redundantCooks++;
    }
  }

  /**
   * Request cook due to input connection change
   */
  requestCookForInputChange(nodeId: string, inputName: string, newValue: BaseContainer): void {
    const oldConnection = this.graph.getInputSource(nodeId, inputName);
    
    this.requestCook({
      nodeId,
      reason: 'input_change',
      details: { 
        inputName, 
        oldValue: oldConnection, 
        newValue: newValue.getContentHash() 
      }
    });
  }

  /**
   * Request cook due to connection topology change
   */
  requestCookForConnectionChange(_sourceId: string, targetId: string, added: boolean): void {
    // Get all affected downstream nodes
    const affectedNodes = added 
      ? [targetId, ...this.graph.getDownstreamNodes(targetId)]
      : [targetId, ...this.graph.getDownstreamNodes(targetId)];

    affectedNodes.forEach(nodeId => {
      this.requestCook({
        nodeId,
        reason: 'connection_change',
        details: { 
          oldValue: !added, 
          newValue: added 
        }
      });
    });
  }

  /**
   * Request cook due to render target change
   */
  requestCookForRenderTargetChange(oldTargetId: string | null, newTargetId: string | null): void {
    // Cook new render cone
    if (newTargetId) {
      const newCone = this.graph.getRenderCone(newTargetId);
      newCone.forEach(nodeId => {
        this.requestCook({
          nodeId,
          reason: 'render_target_change',
          details: { oldValue: oldTargetId, newValue: newTargetId }
        });
      });
    }
  }

  /**
   * Process the accumulated cook queue
   */
  private async processQueue(): Promise<void> {
    if (this.cookQueue.size === 0) {
      this.processingQueue = false;
      return;
    }

    const requests = Array.from(this.cookQueue.values());
    this.cookQueue.clear();

    // Sort requests by topology to ensure proper order
    const nodeIds = requests.map(req => req.nodeId);
    const sortedNodeIds = this.graph.topologicalSort(nodeIds);
    const sortedRequests = sortedNodeIds
      .map(nodeId => requests.find(req => req.nodeId === nodeId))
      .filter(Boolean) as CookRequest[];

    // Process each request
    for (const request of sortedRequests) {
      await this.processRequest(request);
    }

    // Check if more requests were queued during processing
    if (this.cookQueue.size > 0) {
      requestAnimationFrame(() => this.processQueue());
    } else {
      this.processingQueue = false;
    }
  }

  /**
   * Process a single cook request with caching
   */
  private async processRequest(request: CookRequest): Promise<CookResult> {
    const startTime = performance.now();
    
    try {
      // Get node parameters and inputs for cache lookup
      const params = this.getNodeParameters(request.nodeId);
      const inputs = this.getNodeInputs(request.nodeId);

      // Check cache first
      const cacheResult = this.cache.getCachedOutput(request.nodeId, params, inputs);
      
      if (cacheResult && cacheResult.outputContainers) {
        // Cache hit - update stats and return
        const computeTime = performance.now() - startTime;
        this.updateStats(true, computeTime);
        
        // Still need to propagate outputs through scheduler
        this.scheduler.onParameterChange(request.nodeId, {});
        
        return {
          nodeId: request.nodeId,
          success: true,
          outputs: cacheResult.outputContainers,
          cacheHit: true,
          computeTime,
          affectedNodes: []
        };
      }

      // Cache miss - trigger actual computation through scheduler
      this.stats.cacheMisses++;
      
      // Use scheduler's existing computation logic
      this.scheduler.onParameterChange(request.nodeId, params);
      
      const computeTime = performance.now() - startTime;
      this.updateStats(false, computeTime);
      
      return {
        nodeId: request.nodeId,
        success: true,
        cacheHit: false,
        computeTime,
        affectedNodes: this.graph.getDownstreamNodes(request.nodeId)
      };

    } catch (error) {
      const computeTime = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        nodeId: request.nodeId,
        success: false,
        error: errorMessage,
        cacheHit: false,
        computeTime,
        affectedNodes: []
      };
    }
  }

  /**
   * Check if a parameter change is significant enough to require recomputation
   */
  private isParameterChangeSignificant(
    _nodeId: string,
    _parameterName: string,
    oldValue: unknown,
    newValue: unknown
  ): boolean {
    // For now, treat all parameter changes as significant
    // In the future, this could be enhanced with:
    // - Threshold-based checking for numeric values
    // - Semantic analysis of parameter importance
    // - Node-specific parameter change handlers
    
    if (oldValue === newValue) {
      return false;
    }

    // Special handling for numeric parameters
    if (typeof oldValue === 'number' && typeof newValue === 'number') {
      const threshold = 0.0001;
      return Math.abs(newValue - oldValue) > threshold;
    }

    return true;
  }

  /**
   * Get current parameters for a node (placeholder - would integrate with graph store)
   */
  private getNodeParameters(_nodeId: string): Record<string, unknown> {
    // This would integrate with the actual parameter storage system
    // For now, return empty object as placeholder
    return {};
  }

  /**
   * Get current inputs for a node from typed connections
   */
  private getNodeInputs(nodeId: string): Record<string, BaseContainer> {
    const inputs: Record<string, BaseContainer> = {};
    
    const inputConnections = this.graph.getNodeInputConnections(nodeId);
    inputConnections.forEach((source, inputName) => {
      const sourceOutputs = this.scheduler.getNodeOutputs(source.sourceNodeId);
      if (sourceOutputs && sourceOutputs[source.sourceOutput]) {
        inputs[inputName] = sourceOutputs[source.sourceOutput];
      }
    });
    
    return inputs;
  }

  /**
   * Handle scheduler events to update statistics and cache
   */
  private handleSchedulerEvent(event: SchedulerEvent): void {
    if (event.type === 'node-computed') {
      this.stats.nodesCooked++;
      
      // Cache the result if successful
      if (event.outputs && !event.error) {
        const params = this.getNodeParameters(event.nodeId);
        const inputs = this.getNodeInputs(event.nodeId);
        this.cache.setCachedOutput(event.nodeId, params, inputs, event.output, event.outputs);
      }
    }

    // Forward event to external listeners
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.warn('Cook system listener error:', error);
      }
    });
  }

  /**
   * Update computation statistics
   */
  private updateStats(cacheHit: boolean, computeTime: number): void {
    if (cacheHit) {
      this.stats.cacheHits++;
    }

    // Update rolling average compute time
    const totalComputes = this.stats.cacheHits + this.stats.cacheMisses;
    this.stats.avgComputeTime = (this.stats.avgComputeTime * (totalComputes - 1) + computeTime) / totalComputes;
  }

  /**
   * Add listener for cook events
   */
  addListener(listener: (event: SchedulerEvent) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove listener
   */
  removeListener(listener: (event: SchedulerEvent) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Get cooking statistics
   */
  getStats(): CookStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgComputeTime: 0,
      nodesCooked: 0,
      redundantCooks: 0
    };
  }

  /**
   * Clear all pending cook requests
   */
  clearQueue(): void {
    this.cookQueue.clear();
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return total > 0 ? this.stats.cacheHits / total : 0;
  }

  /**
   * Get efficiency metrics
   */
  getEfficiencyMetrics(): {
    cacheHitRate: number;
    redundantCookRate: number;
    avgComputeTime: number;
    totalNodesCooked: number;
  } {
    return {
      cacheHitRate: this.getCacheHitRate(),
      redundantCookRate: this.stats.totalRequests > 0 ? 
        this.stats.redundantCooks / this.stats.totalRequests : 0,
      avgComputeTime: this.stats.avgComputeTime,
      totalNodesCooked: this.stats.nodesCooked
    };
  }
}