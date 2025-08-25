import { GraphNode, CoreGraph } from './CoreGraph';

interface ComputeTask {
  nodeId: string;
  type: 'compute' | 'hooks';
  timestamp: number;
  trigger?: GraphNode;
  hooks?: PostDirtyHook[];
}

export type PostDirtyHook = (trigger?: GraphNode) => void;

export class Cooker {
  private queue: Map<string, ComputeTask> = new Map();
  private blockLevel: number = 0;
  private processing: boolean = false;
  private graph: CoreGraph;
  private computeFunction?: (nodeId: string) => Promise<void> | void;
  
  constructor(graph: CoreGraph) {
    this.graph = graph;
  }
  
  setComputeFunction(computeFunction: (nodeId: string) => Promise<void> | void): void {
    this.computeFunction = computeFunction;
  }
  
  block(): void {
    this.blockLevel++;
  }
  
  unblock(): void {
    this.blockLevel--;
    if (this.blockLevel <= 0) {
      this.blockLevel = 0;
      if (!this.processing) {
        Promise.resolve().then(() => this.processQueue());
      }
    }
  }
  
  enqueue(nodeId: string, taskData?: Partial<ComputeTask>): void {
    if (this.queue.has(nodeId)) {
      const existing = this.queue.get(nodeId)!;
      Object.assign(existing, taskData, { timestamp: performance.now() });
      return;
    }
    
    const task: ComputeTask = {
      nodeId,
      type: 'compute',
      timestamp: performance.now(),
      ...taskData
    };
    
    this.queue.set(nodeId, task);
    
    if (this.blockLevel === 0 && !this.processing) {
      Promise.resolve().then(() => this.processQueue());
    }
  }
  
  private async processQueue(): Promise<void> {
    if (this.processing || this.blockLevel > 0) return;
    
    this.processing = true;
    
    try {
      const tasks = Array.from(this.queue.values());
      this.queue.clear();
      
      const sortedTasks = this.topologicalSort(tasks);
      
      for (const task of sortedTasks) {
        await this.processTask(task);
      }
    } finally {
      this.processing = false;
      
      if (this.queue.size > 0) {
        Promise.resolve().then(() => this.processQueue());
      }
    }
  }
  
  private topologicalSort(tasks: ComputeTask[]): ComputeTask[] {
    const nodeIds = tasks.map(t => t.nodeId);
    const sortedIds = this.graph.topologicalSort(nodeIds);
    
    return sortedIds.map(id => tasks.find(t => t.nodeId === id)!).filter(Boolean);
  }
  
  private async processTask(task: ComputeTask): Promise<void> {
    if (task.type === 'hooks' && task.hooks) {
      for (const hook of task.hooks) {
        try {
          hook(task.trigger);
        } catch (error) {
        }
      }
    } else {
      if (this.computeFunction) {
        try {
          await this.computeFunction(task.nodeId);
        } catch (error) {
        }
      } else {
      }
    }
  }
  
  getStats(): { 
    queueSize: number; 
    processing: boolean; 
    blockLevel: number; 
  } {
    return {
      queueSize: this.queue.size,
      processing: this.processing,
      blockLevel: this.blockLevel
    };
  }
  
  clear(): void {
    this.queue.clear();
    this.processing = false;
    this.blockLevel = 0;
  }
}