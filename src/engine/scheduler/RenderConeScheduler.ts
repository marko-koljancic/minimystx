import { GraphLibAdapter } from "../graph/GraphLibAdapter";
import { nodeRegistry } from "../../flow/nodes/nodeRegistry";
import { BaseContainer } from "../containers/BaseContainer";
import { InputCloneMode } from "../graphStore";
export interface ComputeContext {
  nodeId: string;
  renderTarget: string | null;
  isInRenderCone: boolean;
  abortSignal?: AbortSignal;
  inputs: Record<string, BaseContainer>;
  outputs: Record<string, BaseContainer>;
}
export interface SchedulerEvent {
  type: "node-computed" | "cone-updated" | "render-target-changed" | "input-connected" | "input-disconnected";
  nodeId: string;
  output?: any;
  outputs?: Record<string, BaseContainer>;
  error?: string;
  inputKey?: string;
  sourceNodeId?: string;
}
export type SchedulerListener = (event: SchedulerEvent) => void;
export class RenderConeScheduler {
  private graph: GraphLibAdapter;
  private renderTarget: string | null = null;
  private listeners = new Set<SchedulerListener>();
  private nodeOutputs = new Map<string, Record<string, BaseContainer>>();
  private nodeParams = new Map<string, Record<string, any>>();
  private nodeInputs = new Map<string, Record<string, BaseContainer>>();
  private inputConnections = new Map<string, Map<string, string>>();
  private outputConnections = new Map<string, Map<string, Set<string>>>();
  private dirtyNodes = new Set<string>();
  private computingNodes = new Set<string>();
  private abortControllers = new Map<string, AbortController>();
  constructor(graph: GraphLibAdapter) {
    this.graph = graph;
  }
  setRenderTarget(nodeId: string | null): void {
    const previousTarget = this.renderTarget;
    this.renderTarget = nodeId;
    const newCone = this.computeRenderCone();
    const previousCone = previousTarget ? this.computeRenderConeFor(previousTarget) : [];
    const newlyIncluded = newCone.filter((id) => !previousCone.includes(id));
    newlyIncluded.forEach((nodeId) => this.dirtyNodes.add(nodeId));
    this.emitEvent({ type: "render-target-changed", nodeId: nodeId || "" });
    if (newCone.length > 0) {
      this.scheduleComputation();
    }
  }
  onParameterChange(nodeId: string, params: Record<string, any>): void {
    this.nodeParams.set(nodeId, { ...this.nodeParams.get(nodeId), ...params });
    if (!this.isInRenderCone(nodeId)) {
      return;
    }
    this.markDirtyInCone(nodeId);
    this.scheduleComputation();
  }
  onInputChange(nodeId: string, inputKey: string, container: BaseContainer): void {
    const inputs = this.nodeInputs.get(nodeId) || {};
    inputs[inputKey] = container;
    this.nodeInputs.set(nodeId, inputs);
    if (this.isInRenderCone(nodeId)) {
      this.markDirtyInCone(nodeId);
      this.scheduleComputation();
    }
  }
  connectInput(sourceNodeId: string, sourceOutput: string, targetNodeId: string, targetInput: string): boolean {
    if (!this.inputConnections.has(targetNodeId)) {
      this.inputConnections.set(targetNodeId, new Map());
    }
    this.inputConnections.get(targetNodeId)!.set(targetInput, sourceNodeId);
    if (!this.outputConnections.has(sourceNodeId)) {
      this.outputConnections.set(sourceNodeId, new Map());
    }
    if (!this.outputConnections.get(sourceNodeId)!.has(sourceOutput)) {
      this.outputConnections.get(sourceNodeId)!.set(sourceOutput, new Set());
    }
    this.outputConnections.get(sourceNodeId)!.get(sourceOutput)!.add(targetNodeId);
    const sourceOutputs = this.nodeOutputs.get(sourceNodeId);
    if (sourceOutputs && sourceOutputs[sourceOutput]) {
      this.onInputChange(targetNodeId, targetInput, sourceOutputs[sourceOutput]);
    }
    this.emitEvent({
      type: "input-connected",
      nodeId: targetNodeId,
      inputKey: targetInput,
      sourceNodeId,
    });
    return true;
  }
  disconnectInput(targetNodeId: string, targetInput: string): boolean {
    const inputConnections = this.inputConnections.get(targetNodeId);
    if (!inputConnections) return false;
    const sourceNodeId = inputConnections.get(targetInput);
    if (!sourceNodeId) return false;
    inputConnections.delete(targetInput);
    if (inputConnections.size === 0) {
      this.inputConnections.delete(targetNodeId);
    }
    const outputConnections = this.outputConnections.get(sourceNodeId);
    if (outputConnections) {
      outputConnections.forEach((targets, outputName) => {
        targets.delete(targetNodeId);
        if (targets.size === 0) {
          outputConnections.delete(outputName);
        }
      });
      if (outputConnections.size === 0) {
        this.outputConnections.delete(sourceNodeId);
      }
    }
    const inputs = this.nodeInputs.get(targetNodeId);
    if (inputs) {
      delete inputs[targetInput];
    }
    if (this.isInRenderCone(targetNodeId)) {
      this.markDirtyInCone(targetNodeId);
      this.scheduleComputation();
    }
    this.emitEvent({
      type: "input-disconnected",
      nodeId: targetNodeId,
      inputKey: targetInput,
      sourceNodeId,
    });
    return true;
  }
  onConnectionChange(sourceId: string, targetId: string, added: boolean): void {
    if (added) {
      if (this.isInRenderCone(targetId)) {
        this.markDirtyInCone(targetId);
        this.scheduleComputation();
      }
    } else {
      const inputs = this.nodeInputs.get(targetId) || {};
      delete inputs[sourceId];
      this.nodeInputs.set(targetId, inputs);
      if (this.isInRenderCone(targetId)) {
        this.markDirtyInCone(targetId);
        this.scheduleComputation();
      }
    }
  }
  getNodeOutputs(nodeId: string): Record<string, BaseContainer> | null {
    return this.nodeOutputs.get(nodeId) || null;
  }
  getNodeOutput(nodeId: string, outputName = "default"): BaseContainer | null {
    const outputs = this.nodeOutputs.get(nodeId);
    return outputs ? outputs[outputName] || null : null;
  }
  addListener(listener: SchedulerListener): void {
    this.listeners.add(listener);
  }
  removeListener(listener: SchedulerListener): void {
    this.listeners.delete(listener);
  }
  private isInRenderCone(nodeId: string): boolean {
    if (!this.renderTarget) return false;
    const cone = this.computeRenderCone();
    return cone.includes(nodeId);
  }
  private computeRenderCone(): string[] {
    if (!this.renderTarget) return [];
    return this.computeRenderConeFor(this.renderTarget);
  }
  private computeRenderConeFor(targetId: string): string[] {
    try {
      const predecessors = this.graph.getAllPredecessors(targetId);
      const cone = [targetId, ...predecessors.map((node) => node.id)];
      return cone;
    } catch (error) {
      return [targetId];
    }
  }
  private markDirtyInCone(nodeId: string): void {
    const cone = this.computeRenderCone();
    const successors = this.graph.getAllSuccessors(nodeId);
    this.dirtyNodes.add(nodeId);
    successors.forEach((successor) => {
      if (cone.includes(successor.id)) {
        this.dirtyNodes.add(successor.id);
      }
    });
  }
  private prepareInputs(
    inputs: Record<string, BaseContainer>,
    cloneMode: InputCloneMode = InputCloneMode.NEVER,
    params?: Record<string, any>
  ): Record<string, BaseContainer> {
    switch (cloneMode) {
      case InputCloneMode.ALWAYS:
        return this.cloneInputContainers(inputs);
      case InputCloneMode.FROM_NODE:
        const shouldClone = params?.general?.clone === true;
        return shouldClone ? this.cloneInputContainers(inputs) : inputs;
      case InputCloneMode.NEVER:
      default:
        return inputs;
    }
  }
  private cloneInputContainers(inputs: Record<string, BaseContainer>): Record<string, BaseContainer> {
    const cloned: Record<string, BaseContainer> = {};
    for (const [key, container] of Object.entries(inputs)) {
      cloned[key] = container.clone();
    }
    return cloned;
  }
  private scheduleComputation(): void {
    requestAnimationFrame(() => this.processComputation());
  }
  private async processComputation(): Promise<void> {
    if (!this.renderTarget) return;
    const cone = this.computeRenderCone();
    const dirtyInCone = Array.from(this.dirtyNodes).filter((nodeId) => cone.includes(nodeId));
    if (dirtyInCone.length === 0) return;
    try {
      const sortedDirtyNodes = this.graph.topologicalSort(dirtyInCone);
      for (const nodeId of sortedDirtyNodes) {
        if (this.computingNodes.has(nodeId)) continue;
        await this.computeNode(nodeId);
      }
      this.emitEvent({ type: "cone-updated", nodeId: this.renderTarget });
    } catch (error) {
      console.error("Error processing computation:", error);
    }
  }
  private async computeNode(nodeId: string): Promise<void> {
    if (!this.isInRenderCone(nodeId)) return;
    const node = this.graph.getNode(nodeId);
    const nodeDefinition = node?.type ? nodeRegistry[node.type as keyof typeof nodeRegistry] : undefined;
    if (!nodeDefinition) {
      return;
    }
    const existingAbort = this.abortControllers.get(nodeId);
    if (existingAbort) {
      existingAbort.abort();
    }
    const abortController = new AbortController();
    this.abortControllers.set(nodeId, abortController);
    this.computingNodes.add(nodeId);
    try {
      const params = this.nodeParams.get(nodeId) || {};
      const rawInputs = this.nodeInputs.get(nodeId) || {};
      const cloneMode = nodeDefinition.inputCloneMode || InputCloneMode.NEVER;
      const inputs = this.prepareInputs(rawInputs, cloneMode, params);
      const context: ComputeContext = {
        nodeId,
        renderTarget: this.renderTarget,
        isInRenderCone: true,
        abortSignal: abortController.signal,
        inputs,
        outputs: {},
      };
      if (abortController.signal.aborted) return;
      let result: Record<string, BaseContainer> | undefined;
      if (nodeDefinition.computeTyped) {
        result = await nodeDefinition.computeTyped(params, inputs, context);
      } else if (nodeDefinition.compute) {
        result = undefined;
      } else {
        result = undefined;
      }
      if (abortController.signal.aborted) return;
      if (result) {
        this.nodeOutputs.set(nodeId, result);
        this.propagateOutputs(nodeId, result);
      }
      this.dirtyNodes.delete(nodeId);
      this.emitEvent({
        type: "node-computed",
        nodeId,
        output: result?.default,
        outputs: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitEvent({ type: "node-computed", nodeId, error: errorMessage });
    } finally {
      this.computingNodes.delete(nodeId);
      this.abortControllers.delete(nodeId);
    }
  }
  private propagateOutputs(nodeId: string, outputs: Record<string, BaseContainer>): void {
    const outputConnections = this.outputConnections.get(nodeId);
    if (!outputConnections) return;
    outputConnections.forEach((targetNodes, outputName) => {
      const outputContainer = outputs[outputName];
      if (!outputContainer) return;
      targetNodes.forEach((targetNodeId) => {
        const inputConnections = this.inputConnections.get(targetNodeId);
        if (!inputConnections) return;
        inputConnections.forEach((sourceId, inputName) => {
          if (sourceId === nodeId) {
            this.onInputChange(targetNodeId, inputName, outputContainer);
          }
        });
      });
    });
  }
  private emitEvent(event: SchedulerEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {}
    });
  }
  getStats() {
    return {
      renderTarget: this.renderTarget,
      coneSize: this.computeRenderCone().length,
      dirtyNodes: this.dirtyNodes.size,
      computingNodes: this.computingNodes.size,
      cachedOutputs: this.nodeOutputs.size,
      listeners: this.listeners.size,
    };
  }
  clear(): void {
    this.abortControllers.forEach((controller) => controller.abort());
    this.renderTarget = null;
    this.nodeOutputs.clear();
    this.nodeParams.clear();
    this.nodeInputs.clear();
    this.inputConnections.clear();
    this.outputConnections.clear();
    this.dirtyNodes.clear();
    this.computingNodes.clear();
    this.abortControllers.clear();
  }
  addNode(nodeId: string, _type: string, params?: Record<string, any>): void {
    if (params) {
      this.nodeParams.set(nodeId, params);
    }
    if (this.isInRenderCone(nodeId)) {
      this.dirtyNodes.add(nodeId);
      this.scheduleComputation();
    }
  }
  removeNode(nodeId: string): void {
    const abortController = this.abortControllers.get(nodeId);
    if (abortController) {
      abortController.abort();
    }
    const inputConnections = this.inputConnections.get(nodeId);
    if (inputConnections) {
      inputConnections.forEach((_sourceId, inputName) => {
        this.disconnectInput(nodeId, inputName);
      });
    }
    const outputConnections = this.outputConnections.get(nodeId);
    if (outputConnections) {
      outputConnections.forEach((targetNodes, _outputName) => {
        targetNodes.forEach((targetNodeId) => {
          const targetInputs = this.inputConnections.get(targetNodeId);
          if (targetInputs) {
            targetInputs.forEach((sourceId, inputName) => {
              if (sourceId === nodeId) {
                this.disconnectInput(targetNodeId, inputName);
              }
            });
          }
        });
      });
    }
    this.nodeOutputs.delete(nodeId);
    this.nodeParams.delete(nodeId);
    this.nodeInputs.delete(nodeId);
    this.inputConnections.delete(nodeId);
    this.outputConnections.delete(nodeId);
    this.dirtyNodes.delete(nodeId);
    this.computingNodes.delete(nodeId);
    this.abortControllers.delete(nodeId);
    if (this.renderTarget === nodeId) {
      this.renderTarget = null;
    }
  }
}
