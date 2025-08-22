import { GraphNode } from './CoreGraph';
import { Cooker } from './Cooker';

export type PostDirtyHook = (trigger?: GraphNode) => void;

export class DirtyController {
  private isDirtyFlag: boolean = false;
  private dirtyTimestamp: number | undefined;
  private postDirtyHooks: Map<string, PostDirtyHook> = new Map();
  
  constructor(
    private node: GraphNode,
    private cooker: Cooker,
    private getSuccessors: (nodeId: string) => GraphNode[]
  ) {}
  
  setDirty(trigger?: GraphNode): void {
    if (this.isDirtyFlag) return; // Prevent redundant dirty marking
    
    this.isDirtyFlag = true;
    this.dirtyTimestamp = performance.now();
    
    // Queue hooks instead of immediate execution
    this.queuePostDirtyHooks(trigger);
    this.propagateDirtyToSuccessors(trigger);
  }
  
  private queuePostDirtyHooks(trigger?: GraphNode): void {
    if (this.postDirtyHooks.size > 0) {
      // Add to cooker queue for batched processing
      this.cooker.enqueue(this.node.id, {
        type: 'hooks',
        hooks: Array.from(this.postDirtyHooks.values()),
        trigger
      });
    }
  }
  
  private propagateDirtyToSuccessors(trigger?: GraphNode): void {
    // Block cooker during propagation to batch all updates
    this.cooker.block();
    
    try {
      const successors = this.getSuccessors(this.node.id);
      for (const successor of successors) {
        // Access successor's dirty controller if available
        if ('dirtyController' in successor && successor.dirtyController instanceof DirtyController) {
          successor.dirtyController.setDirty(trigger || this.node);
        }
      }
    } finally {
      this.cooker.unblock(); // Triggers batch processing
    }
  }
  
  removeDirtyState(): void {
    this.isDirtyFlag = false;
    this.dirtyTimestamp = undefined;
  }
  
  isDirty(): boolean {
    return this.isDirtyFlag;
  }
  
  getDirtyTimestamp(): number | undefined {
    return this.dirtyTimestamp;
  }
  
  addPostDirtyHook(name: string, hook: PostDirtyHook): void {
    this.postDirtyHooks.set(name, hook);
  }
  
  removePostDirtyHook(name: string): void {
    this.postDirtyHooks.delete(name);
  }
  
  clearPostDirtyHooks(): void {
    this.postDirtyHooks.clear();
  }
  
  getPostDirtyHookNames(): string[] {
    return Array.from(this.postDirtyHooks.keys());
  }
  
  hasPostDirtyHooks(): boolean {
    return this.postDirtyHooks.size > 0;
  }
  
  // Debug and introspection methods
  getStats(): {
    isDirty: boolean;
    dirtyTimestamp?: number;
    hookCount: number;
  } {
    return {
      isDirty: this.isDirtyFlag,
      dirtyTimestamp: this.dirtyTimestamp,
      hookCount: this.postDirtyHooks.size
    };
  }
}