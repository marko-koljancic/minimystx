import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { WritableDraft } from "immer";
import { nodeRegistry } from "../flow/nodes/nodeRegistry";
import { validateAndNormalizeParams } from "./parameterUtils";
import { GraphLibAdapter } from "./graph/GraphLibAdapter";
import { SubflowManager } from "./subflow/SubflowManager";
import { BaseContainer } from "./containers/BaseContainer";
import { NodeInput, NodeOutput } from "./types/NodeIO";
import { generateNodeName } from "./nameGenerator";
import { cookNode, decideOutput } from "./compute/cook";
import { CookScheduler } from "./compute/cookScheduler";
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
// Every node output is a record of containers keyed by port name ("default" is the
// primary port). This is the single typed contract between the engine and renderer.
export type NodeOutputs = Record<string, BaseContainer>;
export type NodeDefinition = {
  type: string;
  category: string;
  displayName: string;
  allowedContexts: ("root" | "subflow")[];
  params: NodeParams;
  inputs?: NodeInput[];
  outputs?: NodeOutput[];
  // Compute functions must NOT mutate input containers; clone internally before
  // mutating (inputs are shared by reference with the upstream node's output).
  computeTyped?: (
    params: Record<string, any>,
    inputs: Record<string, BaseContainer>,
    context: ComputeContext
  ) => Promise<NodeOutputs> | NodeOutputs;
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
  output: NodeOutputs | null;
  error?: string;
  // Non-fatal signal (e.g. compute produced no geometry so the last good output is
  // being kept). Distinct from `error`, which means compute threw.
  warning?: string;
  isInRenderCone: boolean;
  isRenderTarget: boolean;
};
export type SubFlowGraph = {
  nodeState: Record<string, NodeState>;
  activeOutputNodeId: string | null;
};
export type GraphState = {
  rootNodeState: Record<string, NodeState>;
  subFlows: Record<string, SubFlowGraph>;
  evaluationMode: "eager" | "lazy";
  isImporting: boolean;
  rootRenderTarget: string | null;
  graph: GraphLibAdapter;
  subflowManager: SubflowManager;
  // Monotonic counter bumped on every edge mutation so handle-aware edge selectors
  // (useContextEdges) recompute; subflow edges live in class-instance graphs that
  // are not otherwise part of the reactive Zustand state.
  edgeVersion: number;
  // Recompute a node (root or subflow) and everything downstream of it.
  recomputeFrom: (nodeId: string) => void;
  // Synchronously cook everything queued for the next animation frame. Test and
  // pre-export hook; normal operation flushes once per frame automatically.
  flushCooks: () => void;
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
  computeAll: () => Promise<void>;
  computeNode: (nodeId: string, context: GraphContext) => Promise<void>;
  getNodes: (context: GraphContext) => NodeState[];
  getEdges: (context: GraphContext) => EdgeData[];
  getSubFlows: () => Record<string, SubFlowGraph>;
};
export type SerializedSubFlow = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  // Legacy duplication of node params; emitted empty and ignored on import.
  nodeRuntime: Record<string, unknown>;
  positions: Record<string, { x: number; y: number }>;
  activeOutputNodeId: string | null;
};
export type SerializedGraph = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  // Legacy duplication of node params; emitted empty and ignored on import.
  // Removed from the file format entirely with the schemaVersion 2.0 bump.
  nodeRuntime: Record<string, unknown>;
  positions: Record<string, { x: number; y: number }>;
  subFlows: Record<string, SerializedSubFlow>;
  rootRenderTarget: string | null;
};
export { nodeRegistry } from "../flow/nodes/nodeRegistry";
const graphLibAdapter = new GraphLibAdapter();
const subflowManager = new SubflowManager();
// Monotonic per-node compute generation, keyed `${geoNodeId}:${nodeId}`. Used to
// discard stale async computeTyped results when a newer recompute has superseded them.
const nodeComputeGeneration = new Map<string, number>();
export const useGraphStore = create<GraphState>()(
  immer((set, get) => {
    // Gather a subflow node's typed inputs by reading the current outputs of its
    // predecessor nodes from the subflow runtime.
    const gatherSubflowInputs = (
      state: WritableDraft<GraphState>,
      geoNodeId: string,
      nodeId: string
    ): Record<string, BaseContainer> => {
      const inputs: Record<string, BaseContainer> = {};
      const subflow = state.subFlows[geoNodeId];
      const sfGraph = state.subflowManager.getSubflow(geoNodeId);
      if (!subflow || !sfGraph) return inputs;
      const inputConnections = sfGraph.internalGraph.getNodeInputConnections(nodeId);
      inputConnections.forEach((source, inputName) => {
        const out = subflow.nodeState[source.sourceNodeId]?.output;
        if (out) {
          const container = out[source.sourceOutput] || out.default;
          if (container) inputs[inputName] = container;
        }
      });
      return inputs;
    };
    // Commit a cook result to a node, applying the keep-last-good-on-empty rule.
    const applyComputedOutput = (nodeState: WritableDraft<NodeState>, result: NodeOutputs): void => {
      const decision = decideOutput(nodeState.output as NodeOutputs | null, result);
      nodeState.output = decision.output;
      nodeState.warning = decision.warning;
      nodeState.error = undefined;
    };
    // Recompute a single subflow node into the current immer draft, reading fresh
    // predecessor outputs. Synchronous results are written immediately so that
    // downstream nodes in the same pass observe them; async results are written on
    // resolution (guarded by generation) and then re-propagated downstream.
    const computeSubflowNodeInDraft = (state: WritableDraft<GraphState>, geoNodeId: string, nodeId: string): void => {
      const subflow = state.subFlows[geoNodeId];
      const nodeState = subflow?.nodeState[nodeId];
      if (!subflow || !nodeState) return;
      const inputs = gatherSubflowInputs(state, geoNodeId, nodeId);
      const genKey = `${geoNodeId}:${nodeId}`;
      const generation = (nodeComputeGeneration.get(genKey) || 0) + 1;
      nodeComputeGeneration.set(genKey, generation);
      const cooked = cookNode(nodeRegistry[nodeState.type], nodeState.params, inputs, nodeId);
      switch (cooked.status) {
        case "skipped":
          return;
        case "ok":
          applyComputedOutput(nodeState, cooked.outputs);
          return;
        case "error":
          nodeState.error = cooked.error;
          nodeState.warning = undefined;
          nodeState.output = null;
          return;
        case "pending":
          cooked.promise
            .then((resolved) => {
              if (nodeComputeGeneration.get(genKey) !== generation) return;
              set((draft) => {
                const sf = draft.subFlows[geoNodeId];
                const nodeState = sf?.nodeState[nodeId];
                if (!nodeState) return;
                applyComputedOutput(nodeState, resolved);
                propagateSubflowDownstream(draft, geoNodeId, nodeId);
              });
            })
            .catch((err) => {
              if (nodeComputeGeneration.get(genKey) !== generation) return;
              set((draft) => {
                const sf = draft.subFlows[geoNodeId];
                if (sf?.nodeState[nodeId]) {
                  sf.nodeState[nodeId].error = err instanceof Error ? err.message : String(err);
                  sf.nodeState[nodeId].warning = undefined;
                  sf.nodeState[nodeId].output = null;
                }
              });
            });
          return;
      }
    };
    // Recompute every node downstream of `nodeId` (excluding it), in topological order.
    const propagateSubflowDownstream = (state: WritableDraft<GraphState>, geoNodeId: string, nodeId: string): void => {
      const sfGraph = state.subflowManager.getSubflow(geoNodeId);
      const subflow = state.subFlows[geoNodeId];
      if (!sfGraph || !subflow) return;
      const downstream = sfGraph.internalGraph.getDownstreamNodes(nodeId).filter((id) => subflow.nodeState[id]);
      if (downstream.length === 0) return;
      const ordered = sfGraph.internalGraph.topologicalSort(downstream);
      for (const id of ordered) {
        computeSubflowNodeInDraft(state, geoNodeId, id);
      }
    };
    // Recompute `startNodeId` and its transitive downstream, in topological order.
    // Single entry point that keeps a subflow chain consistent after a parameter
    // change, connection change, or node add.
    const recomputeSubflowFrom = (state: WritableDraft<GraphState>, geoNodeId: string, startNodeId: string): void => {
      const sfGraph = state.subflowManager.getSubflow(geoNodeId);
      const subflow = state.subFlows[geoNodeId];
      if (!sfGraph || !subflow || !subflow.nodeState[startNodeId]) return;
      const affected = [startNodeId, ...sfGraph.internalGraph.getDownstreamNodes(startNodeId)].filter(
        (id) => subflow.nodeState[id]
      );
      const ordered = sfGraph.internalGraph.topologicalSort(affected);
      for (const id of ordered) {
        computeSubflowNodeInDraft(state, geoNodeId, id);
      }
    };
    // Eagerly compute a root node that defines computeTyped (the lights). Root nodes
    // take no inputs; a Promise result is ignored since no async root node exists.
    const computeRootNodeInDraft = (nodeState: WritableDraft<NodeState>): void => {
      const cooked = cookNode(nodeRegistry[nodeState.type], nodeState.params, {}, nodeState.id);
      if (cooked.status === "ok") {
        nodeState.output = cooked.outputs;
        nodeState.error = undefined;
      } else if (cooked.status === "error") {
        nodeState.error = cooked.error;
        nodeState.output = null;
      }
    };
    // One rAF-coalesced cook pass over the dirty union: root nodes cook directly,
    // subflow nodes cook together with their transitive downstream in topological
    // order, all committed in a single set().
    const cookScheduler = new CookScheduler((batch) => {
      set((state) => {
        batch.forEach((nodeIds, contextKey) => {
          if (contextKey === "root") {
            nodeIds.forEach((nodeId) => {
              const nodeState = state.rootNodeState[nodeId];
              if (nodeState) computeRootNodeInDraft(nodeState);
            });
            return;
          }
          const subflow = state.subFlows[contextKey];
          const sfGraph = state.subflowManager.getSubflow(contextKey);
          if (!subflow || !sfGraph) return;
          const affected = new Set<string>();
          nodeIds.forEach((nodeId) => {
            if (!subflow.nodeState[nodeId]) return;
            affected.add(nodeId);
            sfGraph.internalGraph.getDownstreamNodes(nodeId).forEach((id) => {
              if (subflow.nodeState[id]) affected.add(id);
            });
          });
          if (affected.size === 0) return;
          const ordered = sfGraph.internalGraph.topologicalSort([...affected]);
          ordered.forEach((id) => computeSubflowNodeInDraft(state, contextKey, id));
        });
      });
    });
    return {
      rootNodeState: {},
      subFlows: {},
      evaluationMode: "eager" as const,
      isImporting: false,
      rootRenderTarget: null,
      graph: graphLibAdapter,
      subflowManager,
      edgeVersion: 0,
      recomputeFrom: (nodeId: string) => {
        set((state) => {
          if (state.rootNodeState[nodeId]) {
            computeRootNodeInDraft(state.rootNodeState[nodeId]);
            return;
          }
          for (const [geoNodeId, subflow] of Object.entries(state.subFlows)) {
            if (subflow.nodeState[nodeId]) {
              recomputeSubflowFrom(state, geoNodeId, nodeId);
              return;
            }
          }
        });
      },
      flushCooks: () => {
        cookScheduler.flushNow();
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
            output: null,
            isInRenderCone: false,
            isRenderTarget: false,
          };
          if (context.type === "root") {
            state.rootNodeState[node.id] = nodeState;
            if (validatedParams.rendering?.visible !== false) {
              cookScheduler.enqueue("root", node.id);
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
              };
              state.subflowManager.createSubflow(context.geoNodeId);
            }
            state.subFlows[context.geoNodeId].nodeState[node.id] = nodeState;
            state.subflowManager.addNodeToSubflow(context.geoNodeId, node.id, node.type);
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
            } else {
              if (!validatedParams.rendering) {
                validatedParams.rendering = {};
              }
              validatedParams.rendering.visible = false;
              nodeState.params = validatedParams;
              nodeState.isRenderTarget = false;
            }
            // Cook the freshly added node (next frame) so its output is available
            // when a downstream node connects to it.
            cookScheduler.enqueue(context.geoNodeId, node.id);
          }
        });
      },
      removeNode: (nodeId: string, context: GraphContext) => {
        set((state) => {
          state.graph.removeNode(nodeId);
          if (context.type === "root") {
            if (state.rootRenderTarget === nodeId) {
              state.rootRenderTarget = null;
            }
            delete state.rootNodeState[nodeId];
          } else if (context.type === "subflow" && context.geoNodeId) {
            const subflow = state.subFlows[context.geoNodeId];
            if (subflow) {
              // Capture direct successors before the node (and its edges) are removed,
              // so we can refresh whatever fed off this node afterwards.
              const sfGraph = state.subflowManager.getSubflow(context.geoNodeId);
              const directSuccessors = sfGraph
                ? sfGraph.internalGraph.getDirectSuccessors(nodeId).map((n) => n.id)
                : [];
              delete subflow.nodeState[nodeId];
              state.subflowManager.removeNodeFromSubflow(context.geoNodeId, nodeId);
              nodeComputeGeneration.delete(`${context.geoNodeId}:${nodeId}`);
              for (const successorId of directSuccessors) {
                if (subflow.nodeState[successorId]) {
                  cookScheduler.enqueue(context.geoNodeId, successorId);
                }
              }
            }
          }
        });
      },
      setParams: (nodeId: string, params: Partial<Record<string, any>>, context: GraphContext) => {
        set((state) => {
          let nodeState: NodeState | undefined;
          if (context.type === "root") {
            nodeState = state.rootNodeState[nodeId];
            if (nodeState) {
              Object.assign(nodeState.params, params);
            }
          } else if (context.type === "subflow" && context.geoNodeId) {
            nodeState = state.subFlows[context.geoNodeId]?.nodeState[nodeId];
            if (nodeState) {
              const subflow = state.subFlows[context.geoNodeId];
              if (subflow && params.rendering?.visible === true) {
                Object.keys(subflow.nodeState).forEach((otherNodeId) => {
                  if (otherNodeId !== nodeId) {
                    const otherNodeState = subflow.nodeState[otherNodeId];
                    if (otherNodeState?.params?.rendering) {
                      otherNodeState.params.rendering.visible = false;
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
            }
          }
          if (nodeState) {
            if (context.type === "subflow" && context.geoNodeId) {
              const subflow = state.subFlows[context.geoNodeId];
              const wasVisible = nodeState?.params?.rendering?.visible === true;
              const nowVisible = params.rendering?.visible === true;
              if (!wasVisible && nowVisible && subflow) {
                Object.keys(subflow.nodeState).forEach((otherNodeId) => {
                  if (otherNodeId !== nodeId) {
                    const otherNodeState = subflow.nodeState[otherNodeId];
                    if (otherNodeState?.params?.rendering) {
                      otherNodeState.params.rendering.visible = false;
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
              // Cook the edited node and everything downstream of it (coalesced to
              // one pass per frame) so the active output reflects the change.
              cookScheduler.enqueue(context.geoNodeId, nodeId);
            } else if (context.type === "root") {
              cookScheduler.enqueue("root", nodeId);
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
        if (context.type === "root") {
          // Root connections live in the shared root graph (handle-less by design;
          // root nodes have single ports).
          if (get().graph.wouldCreateCycle(source, target)) {
            return { ok: false, error: "Connection would create a cycle" };
          }
          if (!get().graph.connect(source, target)) {
            return { ok: false, error: "Failed to create connection" };
          }
          const state = get();
          if (state.rootRenderTarget) {
            const cone = state.graph.getRenderCone(state.rootRenderTarget);
            Object.keys(state.rootNodeState).forEach((nodeId) => {
              state.rootNodeState[nodeId].isInRenderCone = cone.includes(nodeId);
            });
          }
        } else if (context.type === "subflow" && context.geoNodeId) {
          // Subflow connections are handle-aware and live ONLY in the subflow's own
          // typed graph. Routing them through the shared root graph (as before) lost
          // the handle and collapsed multi-input targets onto their first input.
          // addSubflowConnection -> connectTyped runs its own cycle check.
          const connected = get().subflowManager.addSubflowConnection(
            context.geoNodeId,
            source,
            target,
            sourceHandle,
            targetHandle
          );
          if (!connected) {
            return { ok: false, error: "Failed to create connection" };
          }
          // Cook the connection target and everything downstream of it.
          cookScheduler.enqueue(context.geoNodeId, target);
        } else {
          return { ok: false, error: "Invalid context" };
        }
        set((state) => {
          state.edgeVersion += 1;
        });
        return { ok: true };
      },
      removeEdge: (
        source: string,
        target: string,
        context: GraphContext,
        sourceHandle?: string,
        targetHandle?: string
      ) => {
        if (context.type === "root") {
          get().graph.disconnect(source, target);
          const state = get();
          if (state.rootRenderTarget) {
            const cone = state.graph.getRenderCone(state.rootRenderTarget);
            Object.keys(state.rootNodeState).forEach((nodeId) => {
              state.rootNodeState[nodeId].isInRenderCone = cone.includes(nodeId);
            });
          }
        } else if (context.type === "subflow" && context.geoNodeId) {
          get().subflowManager.removeSubflowConnection(context.geoNodeId, source, target, sourceHandle, targetHandle);
          // Cook the now-disconnected target and everything downstream of it.
          cookScheduler.enqueue(context.geoNodeId, target);
        }
        set((state) => {
          state.edgeVersion += 1;
        });
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
        nodeComputeGeneration.clear();
        cookScheduler.clear();
        set((state) => {
          state.subflowManager.clear();
          state.graph = new GraphLibAdapter();
          state.subflowManager = new SubflowManager();
          state.rootNodeState = {};
          state.subFlows = {};
          state.rootRenderTarget = null;
          state.isImporting = false;
          state.edgeVersion += 1;
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
        } catch (error) {
          console.error("Failed to import graph:", error);
          throw error;
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
          edges: state.graph
            .getAllEdges()
            .filter((e) => state.rootNodeState[e.source] && state.rootNodeState[e.target])
            .map((e) => ({ id: `${e.source}__${e.target}`, source: e.source, target: e.target })),
          nodeRuntime: {},
          positions: nodePositions || {},
          subFlows: {},
          rootRenderTarget: state.rootRenderTarget,
        };
        Object.entries(state.subFlows).forEach(([geoNodeId, subflow]) => {
          serialized.subFlows[geoNodeId] = {
            nodes: Object.keys(subflow.nodeState).map((nodeId) => ({
              id: nodeId,
              type: subflow.nodeState[nodeId].type,
              params: subflow.nodeState[nodeId].params,
            })),
            edges: (() => {
              const sfGraph = state.subflowManager.getSubflow(geoNodeId);
              return sfGraph
                ? sfGraph.internalGraph.getAllTypedEdges().map((e) => ({
                    id: `${e.source}__${e.sourceHandle}__${e.target}__${e.targetHandle}`,
                    source: e.source,
                    target: e.target,
                    sourceHandle: e.sourceHandle,
                    targetHandle: e.targetHandle,
                  }))
                : [];
            })(),
            nodeRuntime: {},
            positions: {},
            activeOutputNodeId: subflow.activeOutputNodeId,
          };
        });
        return serialized;
      },
      setSubFlowActiveOutput: (geoNodeId: string, nodeId: string) => {
        get().setRenderTarget(nodeId, { type: "subflow", geoNodeId });
      },
      // Recompute every node in the scene: eager root nodes plus every subflow in
      // topological order. Used after import and by the debounced scene recompute.
      computeAll: async () => {
        set((state) => {
          Object.values(state.rootNodeState).forEach((nodeState) => {
            computeRootNodeInDraft(nodeState);
          });
          Object.keys(state.subFlows).forEach((geoNodeId) => {
            const sfGraph = state.subflowManager.getSubflow(geoNodeId);
            const subflow = state.subFlows[geoNodeId];
            if (!sfGraph || !subflow) return;
            const ordered = sfGraph.internalGraph.topologicalSort(Object.keys(subflow.nodeState));
            ordered.forEach((id) => computeSubflowNodeInDraft(state, geoNodeId, id));
          });
        });
      },
      computeNode: async (nodeId: string, _context: GraphContext) => {
        get().recomputeFrom(nodeId);
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
      getEdges: (context: GraphContext): EdgeData[] => {
        const state = get();
        if (context.type === "root") {
          return state.graph
            .getAllEdges()
            .filter((e) => state.rootNodeState[e.source] && state.rootNodeState[e.target])
            .map((e) => ({ id: `${e.source}__${e.target}`, source: e.source, target: e.target }));
        } else if (context.type === "subflow" && context.geoNodeId) {
          const sfGraph = state.subflowManager.getSubflow(context.geoNodeId);
          return sfGraph
            ? sfGraph.internalGraph.getAllTypedEdges().map((e) => ({
                id: `${e.source}__${e.sourceHandle}__${e.target}__${e.targetHandle}`,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
              }))
            : [];
        }
        return [];
      },
      getSubFlows: (): Record<string, SubFlowGraph> => {
        const state = get();
        return state.subFlows;
      },
    };
  })
);
export const exportGraphWithMeta = async (): Promise<any> => {
  return useGraphStore.getState().exportGraph();
};
