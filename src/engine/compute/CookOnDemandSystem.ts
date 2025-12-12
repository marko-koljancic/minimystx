import { RenderConeScheduler, type SchedulerEvent } from "../scheduler/RenderConeScheduler";
import { ContentCache } from "../cache/ContentCache";
import { GraphLibAdapter } from "../graph/GraphLibAdapter";
import { BaseContainer } from "../containers/BaseContainer";
export interface CookRequest {
  nodeId: string;
  reason: "parameter_change" | "input_change" | "connection_change" | "render_target_change";
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
  redundantCooks: number;
}
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
      redundantCooks: 0,
    };
    this.scheduler.addListener(this.handleSchedulerEvent.bind(this));
  }
  requestCook(request: CookRequest): void {
    this.stats.totalRequests++;
    this.cookQueue.set(request.nodeId, request);
    if (!this.processingQueue) {
      this.processingQueue = true;
      requestAnimationFrame(() => this.processQueue());
    }
  }
  requestCookForParameterChange(nodeId: string, parameterName: string, oldValue: unknown, newValue: unknown): void {
    if (this.isParameterChangeSignificant(nodeId, parameterName, oldValue, newValue)) {
      this.requestCook({
        nodeId,
        reason: "parameter_change",
        details: { parameterName, oldValue, newValue },
      });
    } else {
      this.stats.redundantCooks++;
    }
  }
  requestCookForInputChange(nodeId: string, inputName: string, newValue: BaseContainer): void {
    const oldConnection = this.graph.getInputSource(nodeId, inputName);
    this.requestCook({
      nodeId,
      reason: "input_change",
      details: {
        inputName,
        oldValue: oldConnection,
        newValue: newValue.getContentHash(),
      },
    });
  }
  requestCookForConnectionChange(_sourceId: string, targetId: string, added: boolean): void {
    const affectedNodes = added
      ? [targetId, ...this.graph.getDownstreamNodes(targetId)]
      : [targetId, ...this.graph.getDownstreamNodes(targetId)];
    affectedNodes.forEach((nodeId) => {
      this.requestCook({
        nodeId,
        reason: "connection_change",
        details: {
          oldValue: !added,
          newValue: added,
        },
      });
    });
  }
  requestCookForRenderTargetChange(oldTargetId: string | null, newTargetId: string | null): void {
    if (newTargetId) {
      const newCone = this.graph.getRenderCone(newTargetId);
      newCone.forEach((nodeId) => {
        this.requestCook({
          nodeId,
          reason: "render_target_change",
          details: { oldValue: oldTargetId, newValue: newTargetId },
        });
      });
    }
  }
  private async processQueue(): Promise<void> {
    if (this.cookQueue.size === 0) {
      this.processingQueue = false;
      return;
    }
    const requests = Array.from(this.cookQueue.values());
    this.cookQueue.clear();
    const nodeIds = requests.map((req) => req.nodeId);
    const sortedNodeIds = this.graph.topologicalSort(nodeIds);
    const sortedRequests = sortedNodeIds
      .map((nodeId) => requests.find((req) => req.nodeId === nodeId))
      .filter(Boolean) as CookRequest[];
    for (const request of sortedRequests) {
      await this.processRequest(request);
    }
    if (this.cookQueue.size > 0) {
      requestAnimationFrame(() => this.processQueue());
    } else {
      this.processingQueue = false;
    }
  }
  private async processRequest(request: CookRequest): Promise<CookResult> {
    const startTime = performance.now();
    try {
      const params = this.getNodeParameters(request.nodeId);
      const inputs = this.getNodeInputs(request.nodeId);
      const cacheResult = this.cache.getCachedOutput(request.nodeId, params, inputs);
      if (cacheResult && cacheResult.outputContainers) {
        const computeTime = performance.now() - startTime;
        this.updateStats(true, computeTime);
        this.scheduler.onParameterChange(request.nodeId, {});
        return {
          nodeId: request.nodeId,
          success: true,
          outputs: cacheResult.outputContainers,
          cacheHit: true,
          computeTime,
          affectedNodes: [],
        };
      }
      this.stats.cacheMisses++;
      this.scheduler.onParameterChange(request.nodeId, params);
      const computeTime = performance.now() - startTime;
      this.updateStats(false, computeTime);
      return {
        nodeId: request.nodeId,
        success: true,
        cacheHit: false,
        computeTime,
        affectedNodes: this.graph.getDownstreamNodes(request.nodeId),
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
        affectedNodes: [],
      };
    }
  }
  private isParameterChangeSignificant(
    _nodeId: string,
    _parameterName: string,
    oldValue: unknown,
    newValue: unknown
  ): boolean {
    if (oldValue === newValue) {
      return false;
    }
    if (typeof oldValue === "number" && typeof newValue === "number") {
      const threshold = 0.0001;
      return Math.abs(newValue - oldValue) > threshold;
    }
    return true;
  }
  private getNodeParameters(_nodeId: string): Record<string, unknown> {
    return {};
  }
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
  private handleSchedulerEvent(event: SchedulerEvent): void {
    if (event.type === "node-computed") {
      this.stats.nodesCooked++;
      if (event.outputs && !event.error) {
        const params = this.getNodeParameters(event.nodeId);
        const inputs = this.getNodeInputs(event.nodeId);
        this.cache.setCachedOutput(event.nodeId, params, inputs, event.output, event.outputs);
      }
    }
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {}
    });
  }
  private updateStats(cacheHit: boolean, computeTime: number): void {
    if (cacheHit) {
      this.stats.cacheHits++;
    }
    const totalComputes = this.stats.cacheHits + this.stats.cacheMisses;
    this.stats.avgComputeTime = (this.stats.avgComputeTime * (totalComputes - 1) + computeTime) / totalComputes;
  }
  addListener(listener: (event: SchedulerEvent) => void): void {
    this.listeners.add(listener);
  }
  removeListener(listener: (event: SchedulerEvent) => void): void {
    this.listeners.delete(listener);
  }
  getStats(): CookStats {
    return { ...this.stats };
  }
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgComputeTime: 0,
      nodesCooked: 0,
      redundantCooks: 0,
    };
  }
  clearQueue(): void {
    this.cookQueue.clear();
  }
  getCacheHitRate(): number {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return total > 0 ? this.stats.cacheHits / total : 0;
  }
  getEfficiencyMetrics(): {
    cacheHitRate: number;
    redundantCookRate: number;
    avgComputeTime: number;
    totalNodesCooked: number;
  } {
    return {
      cacheHitRate: this.getCacheHitRate(),
      redundantCookRate: this.stats.totalRequests > 0 ? this.stats.redundantCooks / this.stats.totalRequests : 0,
      avgComputeTime: this.stats.avgComputeTime,
      totalNodesCooked: this.stats.nodesCooked,
    };
  }
}
