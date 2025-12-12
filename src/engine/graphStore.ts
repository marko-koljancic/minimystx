import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nodeRegistry } from "../flow/nodes/nodeRegistry";
import { validateAndNormalizeParams } from "./parameterUtils";
import { GraphLibAdapter } from "./graph/GraphLibAdapter";
import { RenderConeScheduler, type SchedulerEvent } from "./scheduler/RenderConeScheduler";
import { ContentCache } from "./cache/ContentCache";
import { SubflowManager } from "./subflow/SubflowManager";
import { BaseContainer, Object3DContainer } from "./containers/BaseContainer";
import { NodeInput, NodeOutput } from "./types/NodeIO";
import { Object3D } from "three";
import { generateNodeName } from "./nameGenerator";
export type Result<T = void> =
  | {
      ok: true;
      data?: T;
    }
  | {
      ok: false;
      error: string;
    };
type ParameterValue = string | number | boolean | { x: number; y: number; z?: number; w?: number } | File | null;
export interface ParameterMetadata {
  default: ParameterValue;
  type: "number" | "boolean" | "string" | "vector2" | "vector3" | "vector4" | "color" | "enum" | "file";
  min?: number;
  max?: number;
  step?: number;
  enumValues?: string[];
  displayName?: string;
  displayMode?: "name" | "description";
  accept?: string;
}
export interface CategoryParams {
  [key: string]: ParameterMetadata;
}
export interface NodeParams {
  [category: string]: CategoryParams;
}
export interface ComputeContext {
  nodeId: string;
  renderTarget: string | null;
  isInRenderCone: boolean;
  abortSignal?: AbortSignal;
}
export enum InputCloneMode {
  ALWAYS = "always",
  NEVER = "never",
  FROM_NODE = "from_node",
}
export type NodeDefinition = {
  type: string;
  category: string;
  displayName: string;
  allowedContexts: ("root" | "subflow")[];
  params: NodeParams;
  inputs?: NodeInput[];
  outputs?: NodeOutput[];
  compute?: (params: any, inputs?: any) => any;
  computeTyped?: (
    params: Record<string, any>,
    inputs: Record<string, BaseContainer>,
    context: ComputeContext
  ) => Promise<Record<string, BaseContainer>> | Record<string, BaseContainer>;
  inputCloneMode?: InputCloneMode;
  description?: string;
};
export type GraphContext = {
  type: "root" | "subflow";
  geoNodeId?: string;
};
export type NodeInitData = {
  id: string;
  type: string;
  params?: Record<string, any>;
};
export type EdgeData = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};
export type NodeState = {
  id: string;
  type: string;
  params: Record<string, any>;
  inputs: Record<string, any>;
  output: any;
  error?: string;
  isInRenderCone: boolean;
  isRenderTarget: boolean;
};
export type SubFlowGraph = {
  nodeState: Record<string, NodeState>;
  activeOutputNodeId: string | null;
  nodeRuntime: Record<string, any>;
};
export type GraphState = {
  rootNodeState: Record<string, NodeState>;
  subFlows: Record<string, SubFlowGraph>;
  evaluationMode: "eager" | "lazy";
  isImporting: boolean;
  rootRenderTarget: string | null;
  graph: GraphLibAdapter;
  scheduler: RenderConeScheduler;
  cache: ContentCache;
  subflowManager: SubflowManager;
  rootNodeRuntime: Record<string, any>;
  connectionManager: any;
  recomputeFrom: (nodeId: string) => void;
  markDirty: (nodeId: string) => void;
  addNode: (node: NodeInitData, context: GraphContext) => void;
  removeNode: (nodeId: string, context: GraphContext) => void;
  setParams: (nodeId: string, params: Partial<Record<string, any>>, context: GraphContext) => void;
  addEdge: (
    source: string,
    target: string,
    context: GraphContext,
    sourceHandle?: string,
    targetHandle?: string
  ) => Result;
  removeEdge: (
    source: string,
    target: string,
    context: GraphContext,
    sourceHandle?: string,
    targetHandle?: string
  ) => Result;
  resetEdges: (edges: EdgeData[], context: GraphContext) => Result;
  setRenderTarget: (nodeId: string | null, context: GraphContext) => void;
  getRenderTarget: (context: GraphContext) => string | null;
  isInRenderCone: (nodeId: string, context: GraphContext) => boolean;
  clear: () => void;
  importGraph: (serialized: SerializedGraph) => Promise<void>;
  exportGraph: (nodePositions?: Record<string, { x: number; y: number }>) => Promise<SerializedGraph>;
  setSubFlowActiveOutput: (geoNodeId: string, nodeId: string) => void;
  preloadImportObjAssets: () => Promise<void>;
  preloadAssetForNode: (nodeId: string, state: NodeState, context: GraphContext) => Promise<void>;
  validatePostImportComputation: () => Promise<void>;
  forceResetImportedNodeTracking: (nodeIds: string[], contexts: GraphContext[]) => void;
  computeAll: () => Promise<void>;
  computeNode: (nodeId: string, context: GraphContext) => Promise<void>;
  getNodes: (context: GraphContext) => NodeState[];
  getEdges: (context: GraphContext) => EdgeData[];
  getSubFlows: () => Record<string, SubFlowGraph>;
};
export type SerializedSubFlow = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  nodeRuntime: Record<string, Omit<NodeState, "output" | "error" | "isInRenderCone" | "isRenderTarget">>;
  positions: Record<string, { x: number; y: number }>;
  activeOutputNodeId: string | null;
};
export type SerializedGraph = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  nodeRuntime: Record<string, Omit<NodeState, "output" | "error" | "isInRenderCone" | "isRenderTarget">>;
  positions: Record<string, { x: number; y: number }>;
  subFlows: Record<string, SerializedSubFlow>;
  rootRenderTarget: string | null;
};
export { nodeRegistry } from "../flow/nodes/nodeRegistry";
const graphLibAdapter = new GraphLibAdapter();
const renderConeScheduler = new RenderConeScheduler(graphLibAdapter);
const contentCache = new ContentCache();
const subflowManager = new SubflowManager(graphLibAdapter);
export const useGraphStore = create<GraphState>()(
  immer((set, get) => {
    renderConeScheduler.addListener((event: SchedulerEvent) => {
      set((state) => {
        const nodeState = state.rootNodeState[event.nodeId];
        if (nodeState) {
          nodeState.output = event.output || null;
          nodeState.error = event.error;
        } else {
          Object.values(state.subFlows).forEach((subflow) => {
            if (subflow.nodeState[event.nodeId]) {
              subflow.nodeState[event.nodeId].output = event.output || null;
              subflow.nodeState[event.nodeId].error = event.error;
              if (subflow.nodeRuntime[event.nodeId]) {
                subflow.nodeRuntime[event.nodeId].output = event.output || null;
                subflow.nodeRuntime[event.nodeId].error = event.error;
              }
            }
          });
        }
      });
    });
    return {
      rootNodeState: {},
      subFlows: {},
      evaluationMode: "eager" as const,
      isImporting: false,
      rootRenderTarget: null,
      graph: graphLibAdapter,
      scheduler: renderConeScheduler,
      cache: contentCache,
      subflowManager,
      rootNodeRuntime: {},
      connectionManager: {},
      recomputeFrom: (nodeId: string) => {
        renderConeScheduler.onParameterChange(nodeId, {});
      },
      markDirty: (nodeId: string) => {
        renderConeScheduler.onParameterChange(nodeId, {});
      },
      addNode: (node: NodeInitData, context: GraphContext) => {
        const nodeDefinition = nodeRegistry[node.type];
        if (!nodeDefinition) {
          return;
        }
        const validatedParams = validateAndNormalizeParams(node.params || {}, nodeDefinition.params);
        set((state) => {
          if (validatedParams.general && validatedParams.general.name) {
            const currentName = validatedParams.general.name as string;
            const expectedBaseName = nodeDefinition.displayName;
            const isBaseName = currentName === expectedBaseName;
            const isOldTemplate = /^[A-Za-z\s]+\s+1$/.test(currentName);
            const shouldAutoGenerate = isBaseName || isOldTemplate;
            if (shouldAutoGenerate) {
              const autoGeneratedName = generateNodeName(node.type, context, state.rootNodeState, state.subFlows);
              validatedParams.general.name = autoGeneratedName;
            }
          } else if (validatedParams.general) {
            const autoGeneratedName = generateNodeName(node.type, context, state.rootNodeState, state.subFlows);
            validatedParams.general.name = autoGeneratedName;
          }
          state.graph.addNode({
            id: node.id,
            type: node.type,
          });
          const nodeState: NodeState = {
            id: node.id,
            type: node.type,
            params: validatedParams,
            inputs: {},
            output: null,
            isInRenderCone: false,
            isRenderTarget: false,
          };
          if (context.type === "root") {
            state.rootNodeState[node.id] = nodeState;
            state.rootNodeRuntime[node.id] = {
              id: node.id,
              type: node.type,
              params: validatedParams,
            };
            state.scheduler.addNode(node.id, node.type, validatedParams);
            if (node.type.includes("Light") && validatedParams.rendering?.visible !== false) {
              try {
                const nodeDefinition = nodeRegistry[node.type];
                if (nodeDefinition?.compute) {
                  const result = nodeDefinition.compute(validatedParams, undefined, {
                    nodeId: node.id,
                  });
                  state.rootNodeRuntime[node.id].output = result;
                  nodeState.output = result;
                }
              } catch {
                void 0;
              }
            }
            const renderTarget = state.rootRenderTarget;
            if (renderTarget) {
              const cone = state.graph.getRenderCone(renderTarget);
              nodeState.isInRenderCone = cone.includes(node.id);
            }
          } else if (context.type === "subflow" && context.geoNodeId) {
            if (!state.subFlows[context.geoNodeId]) {
              state.subFlows[context.geoNodeId] = {
                nodeState: {},
                activeOutputNodeId: null,
                nodeRuntime: {},
              };
              state.subflowManager.createSubflow(context.geoNodeId);
            }
            state.subFlows[context.geoNodeId].nodeState[node.id] = nodeState;
            state.subFlows[context.geoNodeId].nodeRuntime[node.id] = {
              id: node.id,
              type: node.type,
              params: validatedParams,
            };
            state.subflowManager.addNodeToSubflow(context.geoNodeId, node.id, node.type, validatedParams);
            const subflow = state.subFlows[context.geoNodeId];
            const existingNodes = Object.keys(subflow.nodeState);
            if (existingNodes.length === 1) {
              if (!validatedParams.rendering) {
                validatedParams.rendering = {};
              }
              validatedParams.rendering.visible = true;
              nodeState.params = validatedParams;
              subflow.activeOutputNodeId = node.id;
              nodeState.isRenderTarget = true;
              state.subflowManager.setActiveOutput(context.geoNodeId, node.id);
              state.cache.invalidateNode(node.id);
              try {
                const nodeDefinition = nodeRegistry[node.type];
                if (nodeDefinition?.computeTyped) {
                  const inputs: Record<string, BaseContainer> = {};
                  const subflowManager = state.subflowManager.getSubflow(context.geoNodeId);
                  if (subflowManager) {
                    try {
                      const inputConnections = subflowManager.internalGraph.getNodeInputConnections(node.id);
                      inputConnections.forEach((source, inputName) => {
                        const sourceNodeRuntime = subflow.nodeRuntime[source.sourceNodeId];
                        if (sourceNodeRuntime?.output) {
                          const outputContainer =
                            sourceNodeRuntime.output[source.sourceOutput] || sourceNodeRuntime.output.default;
                          if (outputContainer) {
                            inputs[inputName] = outputContainer;
                          }
                        }
                      });
                    } catch {
                      void 0;
                    }
                  }
                  const result = nodeDefinition.computeTyped(validatedParams, inputs, {
                    nodeId: node.id,
                  });
                  if (result && typeof result.then === "function") {
                    result
                      .then((resolvedResult: any) => {
                        set((draft) => {
                          if (draft.subFlows[context.geoNodeId]?.nodeRuntime[node.id]) {
                            draft.subFlows[context.geoNodeId].nodeRuntime[node.id].output = resolvedResult;
                          }
                        });
                      })
                      .catch(() => {});
                  } else {
                    state.subFlows[context.geoNodeId].nodeRuntime[node.id].output = result;
                  }
                } else {
                }
              } catch {
                void 0;
              }
            } else {
              if (!validatedParams.rendering) {
                validatedParams.rendering = {};
              }
              validatedParams.rendering.visible = false;
              nodeState.params = validatedParams;
              nodeState.isRenderTarget = false;
            }
          }
        });
      },
      removeNode: (nodeId: string, context: GraphContext) => {
        set((state) => {
          state.graph.removeNode(nodeId);
          if (context.type === "root") {
            state.scheduler.removeNode(nodeId);
            if (state.rootRenderTarget === nodeId) {
              state.rootRenderTarget = null;
            }
            delete state.rootNodeState[nodeId];
            delete state.rootNodeRuntime[nodeId];
          } else if (context.type === "subflow" && context.geoNodeId) {
            const subflow = state.subFlows[context.geoNodeId];
            if (subflow) {
              delete subflow.nodeState[nodeId];
              delete subflow.nodeRuntime[nodeId];
              state.subflowManager.removeNodeFromSubflow(context.geoNodeId, nodeId);
            }
          }
          state.cache.invalidateNode(nodeId);
        });
      },
      setParams: (nodeId: string, params: Partial<Record<string, any>>, context: GraphContext) => {
        set((state) => {
          let nodeState: NodeState | undefined;
          if (context.type === "root") {
            nodeState = state.rootNodeState[nodeId];
            if (nodeState) {
              Object.assign(nodeState.params, params);
              if (state.rootNodeRuntime[nodeId]) {
                Object.assign(state.rootNodeRuntime[nodeId].params, params);
              }
              state.scheduler.onParameterChange(nodeId, params);
            }
          } else if (context.type === "subflow" && context.geoNodeId) {
            nodeState = state.subFlows[context.geoNodeId]?.nodeState[nodeId];
            if (nodeState) {
              const subflow = state.subFlows[context.geoNodeId];
              if (subflow && params.rendering?.visible === true) {
                Object.keys(subflow.nodeState).forEach((otherNodeId) => {
                  if (otherNodeId !== nodeId) {
                    const otherNodeState = subflow.nodeState[otherNodeId];
                    const otherNodeRuntime = subflow.nodeRuntime[otherNodeId];
                    if (otherNodeState?.params?.rendering) {
                      otherNodeState.params.rendering.visible = false;
                    }
                    if (otherNodeRuntime?.params?.rendering) {
                      otherNodeRuntime.params.rendering.visible = false;
                    }
                    if (otherNodeState) {
                      otherNodeState.isRenderTarget = false;
                    }
                  }
                });
                subflow.activeOutputNodeId = nodeId;
                nodeState.isRenderTarget = true;
                state.subflowManager.setActiveOutput(context.geoNodeId, nodeId);
              } else if (subflow && params.rendering?.visible === false) {
                if (subflow.activeOutputNodeId === nodeId) {
                  subflow.activeOutputNodeId = null;
                  nodeState.isRenderTarget = false;
                }
              }
              Object.assign(nodeState.params, params);
              const subflowRuntime = state.subFlows[context.geoNodeId]?.nodeRuntime[nodeId];
              if (subflowRuntime) {
                Object.assign(subflowRuntime.params, params);
              }
              state.subflowManager.onSubflowParameterChange(context.geoNodeId, nodeId, params);
            }
          }
          if (nodeState) {
            state.cache.invalidateNode(nodeId);
            if (context.type === "subflow" && context.geoNodeId) {
              const subflow = state.subFlows[context.geoNodeId];
              const wasVisible = nodeState?.params?.rendering?.visible === true;
              const nowVisible = params.rendering?.visible === true;
              if (!wasVisible && nowVisible && subflow) {
                Object.keys(subflow.nodeState).forEach((otherNodeId) => {
                  if (otherNodeId !== nodeId) {
                    const otherNodeState = subflow.nodeState[otherNodeId];
                    const otherNodeRuntime = subflow.nodeRuntime[otherNodeId];
                    if (otherNodeState?.params?.rendering) {
                      otherNodeState.params.rendering.visible = false;
                    }
                    if (otherNodeRuntime?.params?.rendering) {
                      otherNodeRuntime.params.rendering.visible = false;
                    }
                    if (otherNodeState) {
                      otherNodeState.isRenderTarget = false;
                    }
                  }
                });
                subflow.activeOutputNodeId = nodeId;
                nodeState.isRenderTarget = true;
                state.subflowManager.setActiveOutput(context.geoNodeId, nodeId);
              }
              if (subflow && subflow.activeOutputNodeId === nodeId) {
                try {
                  const nodeDefinition = nodeRegistry[nodeState.type];
                  if (nodeDefinition?.computeTyped) {
                    const inputs: Record<string, BaseContainer> = {};
                    const subflowManager = state.subflowManager.getSubflow(context.geoNodeId);
                    if (subflowManager) {
                      const inputConnections = subflowManager.internalGraph.getNodeInputConnections(nodeId);
                      inputConnections.forEach((source, inputName) => {
                        const sourceNodeRuntime = subflow.nodeRuntime[source.sourceNodeId];
                        if (sourceNodeRuntime?.output) {
                          const outputContainer =
                            sourceNodeRuntime.output[source.sourceOutput] || sourceNodeRuntime.output.default;
                          if (outputContainer) {
                            inputs[inputName] = outputContainer;
                          }
                        }
                      });
                    }
                    const result = nodeDefinition.computeTyped(nodeState.params, inputs, {
                      nodeId,
                    });
                    if (result && typeof result.then === "function") {
                      result.then((resolvedResult: any) => {
                        set((draft) => {
                          if (draft.subFlows[context.geoNodeId]?.nodeRuntime[nodeId]) {
                            draft.subFlows[context.geoNodeId].nodeRuntime[nodeId].output = resolvedResult;
                          }
                        });
                      });
                    } else {
                      subflow.nodeRuntime[nodeId].output = result;
                    }
                  }
                } catch {
                  void 0;
                }
              }
              state.subflowManager.onSubflowParameterChange(context.geoNodeId, nodeId, nodeState.params);
            } else if (context.type === "root" && nodeState.type.includes("Light")) {
              try {
                const nodeDefinition = nodeRegistry[nodeState.type];
                if (nodeDefinition?.compute) {
                  const result = nodeDefinition.compute(nodeState.params, undefined, { nodeId });
                  state.rootNodeRuntime[nodeId].output = result;
                  nodeState.output = result;
                }
              } catch {
                void 0;
              }
            }
          }
        });
      },
      addEdge: (
        source: string,
        target: string,
        context: GraphContext,
        sourceHandle?: string,
        targetHandle?: string
      ) => {
        if (get().graph.wouldCreateCycle(source, target)) {
          return { ok: false, error: "Connection would create a cycle" };
        }
        const connected = get().graph.connect(source, target);
        if (!connected) {
          return { ok: false, error: "Failed to create connection" };
        }
        if (context.type === "root") {
          get().scheduler.onConnectionChange(source, target, true);
          const state = get();
          if (state.rootRenderTarget) {
            const cone = state.graph.getRenderCone(state.rootRenderTarget);
            Object.keys(state.rootNodeState).forEach((nodeId) => {
              state.rootNodeState[nodeId].isInRenderCone = cone.includes(nodeId);
            });
          }
        } else if (context.type === "subflow" && context.geoNodeId) {
          const connected = get().subflowManager.addSubflowConnection(
            context.geoNodeId,
            source,
            target,
            sourceHandle,
            targetHandle
          );
          if (connected) {
            set((state) => {
              const subflow = state.subFlows[context.geoNodeId];
              if (subflow?.nodeRuntime[target]) {
                const nodeState = subflow.nodeState[target];
                if (nodeState) {
                  try {
                    const nodeDefinition = nodeRegistry[nodeState.type];
                    if (nodeDefinition?.computeTyped) {
                      const inputs: Record<string, BaseContainer> = {};
                      const subflowManager = state.subflowManager.getSubflow(context.geoNodeId);
                      if (subflowManager) {
                        const inputConnections = subflowManager.internalGraph.getNodeInputConnections(target);
                        inputConnections.forEach((source, inputName) => {
                          const sourceNodeRuntime = subflow.nodeRuntime[source.sourceNodeId];
                          if (sourceNodeRuntime?.output) {
                            const outputContainer =
                              sourceNodeRuntime.output[source.sourceOutput] || sourceNodeRuntime.output.default;
                            if (outputContainer) {
                              inputs[inputName] = outputContainer;
                            }
                          }
                        });
                      }
                      const result = nodeDefinition.computeTyped(nodeState.params, inputs, {
                        nodeId: target,
                      });
                      if (result && typeof result.then === "function") {
                        result.then((resolvedResult: any) => {
                          set((draft) => {
                            if (draft.subFlows[context.geoNodeId]?.nodeRuntime[target]) {
                              draft.subFlows[context.geoNodeId].nodeRuntime[target].output = resolvedResult;
                            }
                          });
                        });
                      } else {
                        subflow.nodeRuntime[target].output = result;
                      }
                    }
                  } catch {
                    void 0;
                  }
                }
              }
            });
          }
        }
        return { ok: true };
      },
      removeEdge: (
        source: string,
        target: string,
        context: GraphContext,
        sourceHandle?: string,
        targetHandle?: string
      ) => {
        get().graph.disconnect(source, target);
        if (context.type === "root") {
          get().scheduler.onConnectionChange(source, target, false);
          const state = get();
          if (state.rootRenderTarget) {
            const cone = state.graph.getRenderCone(state.rootRenderTarget);
            Object.keys(state.rootNodeState).forEach((nodeId) => {
              state.rootNodeState[nodeId].isInRenderCone = cone.includes(nodeId);
            });
          }
        } else if (context.type === "subflow" && context.geoNodeId) {
          get().subflowManager.removeSubflowConnection(context.geoNodeId, source, target, sourceHandle, targetHandle);
          set((state) => {
            const subflow = state.subFlows[context.geoNodeId];
            if (subflow?.nodeRuntime[target]) {
              const nodeState = subflow.nodeState[target];
              if (nodeState) {
                try {
                  const nodeDefinition = nodeRegistry[nodeState.type];
                  if (nodeDefinition?.computeTyped) {
                    const inputs: Record<string, BaseContainer> = {};
                    const result = nodeDefinition.computeTyped(nodeState.params, inputs, {
                      nodeId: target,
                    });
                    if (result && typeof result.then === "function") {
                      result.then((resolvedResult: any) => {
                        set((draft) => {
                          if (draft.subFlows[context.geoNodeId]?.nodeRuntime[target]) {
                            draft.subFlows[context.geoNodeId].nodeRuntime[target].output = resolvedResult;
                          }
                        });
                      });
                    } else {
                      subflow.nodeRuntime[target].output = result;
                    }
                  }
                } catch {
                  void 0;
                }
              }
            }
          });
        }
        return { ok: true };
      },
      resetEdges: (edges: EdgeData[], context: GraphContext) => {
        const state = get();
        edges.forEach((edge) => {
          state.addEdge(edge.source, edge.target, context, edge.sourceHandle, edge.targetHandle);
        });
        return { ok: true };
      },
      setRenderTarget: (nodeId: string | null, context: GraphContext) => {
        set((state) => {
          if (context.type === "root") {
            if (state.rootRenderTarget) {
              const prevNode = state.rootNodeState[state.rootRenderTarget];
              if (prevNode) {
                prevNode.isRenderTarget = false;
              }
            }
            state.rootRenderTarget = nodeId;
            state.scheduler.setRenderTarget(nodeId);
            if (nodeId) {
              const targetNode = state.rootNodeState[nodeId];
              if (targetNode) {
                targetNode.isRenderTarget = true;
              }
              const cone = state.graph.getRenderCone(nodeId);
              Object.keys(state.rootNodeState).forEach((id) => {
                state.rootNodeState[id].isInRenderCone = cone.includes(id);
              });
            } else {
              Object.keys(state.rootNodeState).forEach((id) => {
                state.rootNodeState[id].isInRenderCone = false;
              });
            }
          } else if (context.type === "subflow" && context.geoNodeId && nodeId) {
            state.subflowManager.setActiveOutput(context.geoNodeId, nodeId);
            const subflow = state.subFlows[context.geoNodeId];
            if (subflow) {
              if (subflow.activeOutputNodeId) {
                const prevNode = subflow.nodeState[subflow.activeOutputNodeId];
                if (prevNode) {
                  prevNode.isRenderTarget = false;
                }
              }
              subflow.activeOutputNodeId = nodeId;
              const activeNode = subflow.nodeState[nodeId];
              if (activeNode) {
                activeNode.isRenderTarget = true;
              }
            }
          }
        });
      },
      getRenderTarget: (context: GraphContext) => {
        const state = get();
        if (context.type === "root") {
          return state.rootRenderTarget;
        } else if (context.type === "subflow" && context.geoNodeId) {
          return state.subflowManager.getActiveOutputNodeId(context.geoNodeId);
        }
        return null;
      },
      isInRenderCone: (nodeId: string, context: GraphContext) => {
        const state = get();
        if (context.type === "root") {
          return state.rootNodeState[nodeId]?.isInRenderCone || false;
        } else if (context.type === "subflow" && context.geoNodeId) {
          return state.subflowManager.shouldComputeInSubflow(context.geoNodeId, nodeId);
        }
        return false;
      },
      clear: () => {
        set((state) => {
          state.scheduler.clear();
          state.cache.clear();
          state.subflowManager.clear();
          const newGraph = new GraphLibAdapter();
          const newScheduler = new RenderConeScheduler(newGraph);
          const newSubflowManager = new SubflowManager(newGraph);
          const newCache = new ContentCache();
          state.graph = newGraph;
          state.scheduler = newScheduler;
          state.subflowManager = newSubflowManager;
          state.cache = newCache;
          state.rootNodeState = {};
          state.subFlows = {};
          state.rootRenderTarget = null;
          state.isImporting = false;
        });
      },
      importGraph: async (serialized: SerializedGraph) => {
        set((state) => {
          state.isImporting = true;
        });
        try {
          const state = get();
          state.clear();
          serialized.nodes.forEach((nodeData) => {
            state.addNode(nodeData, { type: "root" });
          });
          Object.entries(serialized.subFlows).forEach(([geoNodeId, subflow]) => {
            subflow.nodes.forEach((nodeData) => {
              state.addNode(nodeData, { type: "subflow", geoNodeId });
            });
          });
          serialized.edges.forEach((edge) => {
            state.addEdge(edge.source, edge.target, { type: "root" }, edge.sourceHandle, edge.targetHandle);
          });
          Object.entries(serialized.subFlows).forEach(([geoNodeId, subflow]) => {
            subflow.edges.forEach((edge) => {
              state.addEdge(
                edge.source,
                edge.target,
                { type: "subflow", geoNodeId },
                edge.sourceHandle,
                edge.targetHandle
              );
            });
          });
          if (serialized.rootRenderTarget) {
            state.setRenderTarget(serialized.rootRenderTarget, { type: "root" });
          }
          Object.entries(serialized.subFlows).forEach(([geoNodeId, subflow]) => {
            if (subflow.activeOutputNodeId) {
              state.setSubFlowActiveOutput(geoNodeId, subflow.activeOutputNodeId);
            }
          });
        } catch {
          void 0;
        } finally {
          set((state) => {
            state.isImporting = false;
          });
        }
      },
      exportGraph: async (nodePositions?: Record<string, { x: number; y: number }>) => {
        const state = get();
        const serialized: SerializedGraph = {
          nodes: Object.keys(state.rootNodeState).map((nodeId) => ({
            id: nodeId,
            type: state.rootNodeState[nodeId].type,
            params: state.rootNodeState[nodeId].params,
          })),
          edges: [],
          nodeRuntime: {},
          positions: nodePositions || {},
          subFlows: {},
          rootRenderTarget: state.rootRenderTarget,
        };
        Object.entries(state.rootNodeState).forEach(([nodeId, nodeState]) => {
          serialized.nodeRuntime[nodeId] = {
            id: nodeState.id,
            type: nodeState.type,
            params: nodeState.params,
            inputs: nodeState.inputs,
          };
        });
        Object.entries(state.subFlows).forEach(([geoNodeId, subflow]) => {
          serialized.subFlows[geoNodeId] = {
            nodes: Object.keys(subflow.nodeState).map((nodeId) => ({
              id: nodeId,
              type: subflow.nodeState[nodeId].type,
              params: subflow.nodeState[nodeId].params,
            })),
            edges: [],
            nodeRuntime: {},
            positions: {},
            activeOutputNodeId: subflow.activeOutputNodeId,
          };
          Object.entries(subflow.nodeState).forEach(([nodeId, nodeState]) => {
            serialized.subFlows[geoNodeId].nodeRuntime[nodeId] = {
              id: nodeState.id,
              type: nodeState.type,
              params: nodeState.params,
              inputs: nodeState.inputs,
            };
          });
        });
        return serialized;
      },
      setSubFlowActiveOutput: (geoNodeId: string, nodeId: string) => {
        get().setRenderTarget(nodeId, { type: "subflow", geoNodeId });
      },
      preloadImportObjAssets: async () => {},
      preloadAssetForNode: async (_nodeId: string, _nodeState: NodeState, _context: GraphContext) => {},
      validatePostImportComputation: async () => {},
      forceResetImportedNodeTracking: (nodeIds: string[], _contexts: GraphContext[]) => {
        nodeIds.forEach((nodeId) => {
          get().cache.invalidateNode(nodeId);
        });
      },
      computeAll: async () => {
        const store = useGraphStore.getState();
        try {
          store.cache.clear();
          const allNodeIds = [
            ...Object.keys(store.rootNodeState),
            ...Object.values(store.subFlows).flatMap((subFlow) => Object.keys(subFlow.nodeState)),
          ];
          allNodeIds.forEach((nodeId) => {
            store.markDirty(nodeId);
          });
          const rootNodes = Object.values(store.rootNodeState);
          for (const node of rootNodes) {
            if (node.isRenderTarget || node.type === "geoNode") {
              store.recomputeFrom(node.id);
            }
          }
          for (const subFlow of Object.values(store.subFlows)) {
            const subFlowNodes = Object.values(subFlow.nodeState);
            for (const node of subFlowNodes) {
              if (node.isRenderTarget) {
                store.recomputeFrom(node.id);
              }
            }
          }
        } catch {
          void 0;
        }
      },
      computeNode: async (nodeId: string, _context: GraphContext) => {
        const store = useGraphStore.getState();
        try {
          store.cache.invalidateNode(nodeId);
          store.markDirty(nodeId);
          store.recomputeFrom(nodeId);
        } catch {
          void 0;
        }
      },
      getNodes: (context: GraphContext): NodeState[] => {
        const state = get();
        if (context.type === "root") {
          return Object.values(state.rootNodeState);
        } else if (context.type === "subflow" && context.geoNodeId) {
          const subFlow = state.subFlows[context.geoNodeId];
          return subFlow ? Object.values(subFlow.nodeState) : [];
        }
        return [];
      },
      getEdges: (_context: GraphContext): EdgeData[] => {
        return [];
      },
      getSubFlows: (): Record<string, SubFlowGraph> => {
        const state = get();
        return state.subFlows;
      },
    };
  })
);
export { graphLibAdapter, renderConeScheduler, contentCache, subflowManager };
export const exportGraphWithMeta = async (): Promise<any> => {
  return useGraphStore.getState().exportGraph();
};
