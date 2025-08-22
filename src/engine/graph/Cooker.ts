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
  
  // Set the function that handles actual node computation
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
        // Use microtask to batch synchronous operations
        Promise.resolve().then(() => this.processQueue());
      }
    }
  }
  
  enqueue(nodeId: string, taskData?: Partial<ComputeTask>): void {
    if (this.queue.has(nodeId)) {
      // Update existing task with latest data
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
      // Get all queued tasks
      const tasks = Array.from(this.queue.values());
      this.queue.clear();
      
      // Sort by dependency order using graph
      const sortedTasks = this.topologicalSort(tasks);
      
      // Process each task
      for (const task of sortedTasks) {
        await this.processTask(task);
      }
    } finally {
      this.processing = false;
      
      // Process any new tasks that were queued during processing
      if (this.queue.size > 0) {
        Promise.resolve().then(() => this.processQueue());
      }
    }
  }
  
  private topologicalSort(tasks: ComputeTask[]): ComputeTask[] {
    // Use graph to determine dependency order
    const nodeIds = tasks.map(t => t.nodeId);
    const sortedIds = this.graph.topologicalSort(nodeIds);
    
    // Return tasks in dependency order
    return sortedIds.map(id => tasks.find(t => t.nodeId === id)!).filter(Boolean);
  }
  
  private async processTask(task: ComputeTask): Promise<void> {
    if (task.type === 'hooks' && task.hooks) {
      // Execute post-dirty hooks
      for (const hook of task.hooks) {
        try {
          hook(task.trigger);
        } catch (error) {
          console.error(`Hook execution failed for node ${task.nodeId}:`, error);
        }
      }
    } else {
      // Execute node computation using the provided compute function
      if (this.computeFunction) {
        try {
          await this.computeFunction(task.nodeId);
        } catch (error) {
          console.error(`Node computation failed for ${task.nodeId}:`, error);
        }
      } else {
        console.debug(`No compute function set for processing node ${task.nodeId}`);
      }
    }
  }
  
  // Get current queue stats for debugging
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
  
  // Clear all queued tasks
  clear(): void {
    this.queue.clear();
    this.processing = false;
    this.blockLevel = 0;
  }
}