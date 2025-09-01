import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nodeRegistry } from "./nodeRegistry";
import { validateAndNormalizeParams } from "./parameterUtils";
import { GraphLibAdapter } from "./graph/GraphLibAdapter";
import { RenderConeScheduler, type SchedulerEvent } from "./scheduler/RenderConeScheduler";
import { ContentCache } from "./cache/ContentCache";
import { SubflowManager } from "./subflow/SubflowManager";
import { BaseContainer, Object3DContainer } from './containers/BaseContainer';
import { NodeInput, NodeOutput } from './types/NodeIO';
import { Object3D } from 'three';
import { generateNodeName } from './nameGenerator';

export type Result<T = void> =
  | {
      ok: true;
      data?: T;
    }
  | {
      ok: false;
      error: string;
    };

type ParameterValue =
  | string
  | number
  | boolean
  | { x: number; y: number; z?: number; w?: number }
  | File
  | null;

export interface ParameterMetadata {
  default: ParameterValue;
  type:
    | "number"
    | "boolean"
    | "string"
    | "vector2"
    | "vector3"
    | "vector4"
    | "color"
    | "enum"
    | "file";
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
  ALWAYS = 'always',      // Always clone inputs
  NEVER = 'never',        // Never clone (performance)
  FROM_NODE = 'from_node' // Node decides based on params
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

// Modern render-cone node state
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
  // Compatibility property for legacy UI components
  nodeRuntime: Record<string, any>;
};

export type GraphState = {
  rootNodeState: Record<string, NodeState>;
  subFlows: Record<string, SubFlowGraph>;
  evaluationMode: "eager" | "lazy";
  isImporting: boolean;
  rootRenderTarget: string | null;

  // Modern render-cone architecture
  graph: GraphLibAdapter;
  scheduler: RenderConeScheduler;
  cache: ContentCache;
  subflowManager: SubflowManager;

  // Compatibility properties for legacy UI components
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

  // Render-cone specific methods
  setRenderTarget: (nodeId: string | null, context: GraphContext) => void;
  getRenderTarget: (context: GraphContext) => string | null;
  isInRenderCone: (nodeId: string, context: GraphContext) => boolean;

  clear: () => void;
  importGraph: (serialized: SerializedGraph) => Promise<void>;
  exportGraph: (
    nodePositions?: Record<string, { x: number; y: number }>
  ) => Promise<SerializedGraph>;
  setSubFlowActiveOutput: (geoNodeId: string, nodeId: string) => void;

  preloadImportObjAssets: () => Promise<void>;
  preloadAssetForNode: (nodeId: string, state: NodeState, context: GraphContext) => Promise<void>;
  validatePostImportComputation: () => Promise<void>;
  forceResetImportedNodeTracking: (nodeIds: string[], contexts: GraphContext[]) => void;
};

export type SerializedSubFlow = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  nodeRuntime: Record<
    string,
    Omit<NodeState, "output" | "error" | "isInRenderCone" | "isRenderTarget">
  >;
  positions: Record<string, { x: number; y: number }>;
  activeOutputNodeId: string | null;
};

export type SerializedGraph = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  nodeRuntime: Record<
    string,
    Omit<NodeState, "output" | "error" | "isInRenderCone" | "isRenderTarget">
  >;
  positions: Record<string, { x: number; y: number }>;
  subFlows: Record<string, SerializedSubFlow>;
  rootRenderTarget: string | null;
};

export { nodeRegistry } from "./nodeRegistry";

// Initialize render-cone architecture
const graphLibAdapter = new GraphLibAdapter();
const renderConeScheduler = new RenderConeScheduler(graphLibAdapter);
const contentCache = new ContentCache();
const subflowManager = new SubflowManager(graphLibAdapter);

export const useGraphStore = create<GraphState>()(
  immer((set, get) => {
    // Set up scheduler event listener to update UI state
    renderConeScheduler.addListener((event: SchedulerEvent) => {
      set((state) => {
        const nodeState = state.rootNodeState[event.nodeId];
        if (nodeState) {
          nodeState.output = event.output || null;
          nodeState.error = event.error;
        } else {
          // Check subflows
          Object.values(state.subFlows).forEach((subflow) => {
            if (subflow.nodeState[event.nodeId]) {
              subflow.nodeState[event.nodeId].output = event.output || null;
              subflow.nodeState[event.nodeId].error = event.error;
              
              // Update compatibility layer for SceneManager
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

      // Compatibility properties for legacy UI components
      rootNodeRuntime: {},
      connectionManager: {}, // Empty object for compatibility
      recomputeFrom: (nodeId: string) => {
        // Delegate to render cone scheduler
        renderConeScheduler.onParameterChange(nodeId, {});
      },
      markDirty: (nodeId: string) => {
        // Delegate to render cone scheduler
        renderConeScheduler.onParameterChange(nodeId, {});
      },

      addNode: (node: NodeInitData, context: GraphContext) => {
        const nodeDefinition = nodeRegistry[node.type];
        if (!nodeDefinition) {
          console.warn(`Unknown node type: ${node.type}`);
          return;
        }

        const validatedParams = validateAndNormalizeParams(
          node.params || {},
          nodeDefinition.params
        );

        set((state) => {
          // DEBUG: Log parameter structure and values
          console.log('🐛 AUTO-NAMING DEBUG:', {
            nodeType: node.type,
            context: context,
            validatedParams: validatedParams,
            hasGeneral: !!validatedParams.general,
            generalName: validatedParams.general?.name,
            generalNameType: typeof validatedParams.general?.name
          });
          
          // Generate automatic name if not provided or if using default template
          if (validatedParams.general && validatedParams.general.name) {
            const currentName = validatedParams.general.name as string;
            console.log('🐛 Current name exists:', currentName);
            
            // Get the expected base name for this node type
            const expectedBaseName = nodeDefinition.displayName;
            console.log('🐛 Expected base name:', expectedBaseName);
            
            // Check if this is a base name that needs auto-generation
            // (either exact match like "Geo" or old template like "Geo 1")
            const isBaseName = currentName === expectedBaseName;
            const isOldTemplate = /^[A-Za-z\s]+\s+1$/.test(currentName);
            const shouldAutoGenerate = isBaseName || isOldTemplate;
            
            console.log('🐛 Should auto-generate?', shouldAutoGenerate, 'isBaseName:', isBaseName, 'isOldTemplate:', isOldTemplate);
            
            if (shouldAutoGenerate) {
              const autoGeneratedName = generateNodeName(
                node.type, 
                context, 
                state.rootNodeState, 
                state.subFlows
              );
              console.log('🐛 Generated name:', autoGeneratedName);
              validatedParams.general.name = autoGeneratedName;
            } else {
              console.log('🐛 Using existing name (no auto-generation):', currentName);
            }
          } else if (validatedParams.general) {
            // No name provided at all - generate one
            console.log('🐛 No name provided, generating one');
            const autoGeneratedName = generateNodeName(
              node.type, 
              context, 
              state.rootNodeState, 
              state.subFlows
            );
            console.log('🐛 Generated name (no existing):', autoGeneratedName);
            validatedParams.general.name = autoGeneratedName;
          } else {
            console.log('🐛 No general params found!');
          }
          // Add to graph
          state.graph.addNode({
            id: node.id,
            type: node.type,
          });

          // Create node state
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

            // Populate compatibility property for UI components
            state.rootNodeRuntime[node.id] = {
              id: node.id,
              type: node.type,
              params: validatedParams,
            };

            // Add to root scheduler
            state.scheduler.addNode(node.id, node.type, validatedParams);

            // Manual computation for root nodes (especially lights)
            if (node.type.includes('Light') && validatedParams.rendering?.visible !== false) {
              // Light node computation
              try {
                const nodeDefinition = nodeRegistry[node.type];
                if (nodeDefinition?.compute) {
                  const result = nodeDefinition.compute(validatedParams, undefined, { nodeId: node.id });
                  // Light computation completed
                  state.rootNodeRuntime[node.id].output = result;
                  nodeState.output = result;
                }
              } catch (error) {
                console.warn(`Could not compute root light ${node.id}:`, error);
              }
            }

            // Update render cone status
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
                nodeRuntime: {}, // Compatibility property
              };
              state.subflowManager.createSubflow(context.geoNodeId);
            }

            state.subFlows[context.geoNodeId].nodeState[node.id] = nodeState;

            // Populate compatibility property for UI components
            state.subFlows[context.geoNodeId].nodeRuntime[node.id] = {
              id: node.id,
              type: node.type,
              params: validatedParams,
            };

            // Add to subflow first
            state.subflowManager.addNodeToSubflow(
              context.geoNodeId,
              node.id,
              node.type,
              validatedParams
            );

            // Auto-toggle visibility logic for subflows
            const subflow = state.subFlows[context.geoNodeId];
            const existingNodes = Object.keys(subflow.nodeState);
            
            if (existingNodes.length === 1) {
              // First node in subflow - automatically set it as visible and active output
              console.log(`🔧 First node in subflow ${context.geoNodeId}:`, {
                nodeId: node.id,
                nodeType: node.type,
                visible: validatedParams.rendering?.visible,
                rendering: validatedParams.rendering
              });
              
              // Force first node to be visible
              if (!validatedParams.rendering) {
                validatedParams.rendering = {};
              }
              validatedParams.rendering.visible = true;
              nodeState.params = validatedParams; // Update stored params
              
              subflow.activeOutputNodeId = node.id;
              nodeState.isRenderTarget = true;
              state.subflowManager.setActiveOutput(context.geoNodeId, node.id);
              console.log(`✅ Set activeOutputNodeId to ${node.id} in subflow ${context.geoNodeId} (auto-visible)`);
              
              // Cache invalidation and trigger SubflowManager computation
              state.cache.invalidateNode(node.id);
              console.log(`✅ Set activeOutputNodeId and invalidated cache for ${node.id}`);
              
              // Force immediate computation since SubflowManager doesn't auto-compute
              // Computing active output node
              try {
                const nodeDefinition = nodeRegistry[node.type];
                if (nodeDefinition?.computeTyped) {
                  // Get inputs from connected nodes for proper computation
                  const inputs: Record<string, BaseContainer> = {};
                  
                  // Get subflow internal graph and find predecessor nodes
                  const subflowManager = state.subflowManager.getSubflow(context.geoNodeId);
                  if (subflowManager) {
                    try {
                      const predecessors = subflowManager.internalGraph.getAllPredecessors(node.id);
                      // Found predecessors for computation
                      
                      if (predecessors.length > 0) {
                        // Use first predecessor as default input
                        const inputNodeId = predecessors[0].id;
                        const inputNodeRuntime = subflow.nodeRuntime[inputNodeId];
                        if (inputNodeRuntime?.output) {
                          inputs.default = inputNodeRuntime.output.default || new Object3DContainer(new Object3D());
                          // Connected input for computation
                        }
                      }
                    } catch (error) {
                      console.warn(`Could not get predecessors for ${node.id}:`, error);
                    }
                  }
                  
                  // Computation inputs prepared
                  const result = nodeDefinition.computeTyped(validatedParams, inputs, { nodeId: node.id });
                  // Computation completed
                  
                  // Handle async results (Promises)
                  if (result && typeof result.then === 'function') {
                    // Async computation detected
                    result.then((resolvedResult: any) => {
                      // Async computation resolved
                      // Use set() to properly update state in async context
                      set((draft) => {
                        if (draft.subFlows[context.geoNodeId]?.nodeRuntime[node.id]) {
                          draft.subFlows[context.geoNodeId].nodeRuntime[node.id].output = resolvedResult;
                          // Store updated with async result
                        }
                      });
                    }).catch((error: any) => {
                      console.error(`❌ Async computation failed for ${node.id}:`, error);
                    });
                  } else {
                    // Store synchronous result
                    state.subFlows[context.geoNodeId].nodeRuntime[node.id].output = result;
                    // Stored synchronous result
                  }
                } else {
                  console.log(`❌ No computeTyped function for ${node.type}`);
                }
              } catch (error) {
                console.warn(`Could not compute node ${node.id}:`, error);
              }
            } else {
              // Additional node - should start with visible = false by default
              if (!validatedParams.rendering) {
                validatedParams.rendering = {};
              }
              validatedParams.rendering.visible = false;
              nodeState.params = validatedParams; // Update stored params
              
              console.log(`🔧 Additional node in subflow ${context.geoNodeId} - set to invisible by default:`, {
                nodeId: node.id,
                nodeType: node.type
              });
              
              // Only make active output if user explicitly enables visibility later
              nodeState.isRenderTarget = false;
            }
          }
        });
      },

      removeNode: (nodeId: string, context: GraphContext) => {
        set((state) => {
          // Remove from graph
          state.graph.removeNode(nodeId);

          if (context.type === "root") {
            // Remove from scheduler
            state.scheduler.removeNode(nodeId);

            // Clear render target if this was it
            if (state.rootRenderTarget === nodeId) {
              state.rootRenderTarget = null;
            }

            delete state.rootNodeState[nodeId];
            delete state.rootNodeRuntime[nodeId]; // Cleanup compatibility property
          } else if (context.type === "subflow" && context.geoNodeId) {
            const subflow = state.subFlows[context.geoNodeId];
            if (subflow) {
              delete subflow.nodeState[nodeId];
              delete subflow.nodeRuntime[nodeId]; // Cleanup compatibility property
              state.subflowManager.removeNodeFromSubflow(context.geoNodeId, nodeId);
            }
          }

          // Invalidate cache
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
              // Update compatibility property
              if (state.rootNodeRuntime[nodeId]) {
                Object.assign(state.rootNodeRuntime[nodeId].params, params);
              }
              // Update scheduler
              state.scheduler.onParameterChange(nodeId, params);
            }
          } else if (context.type === "subflow" && context.geoNodeId) {
            nodeState = state.subFlows[context.geoNodeId]?.nodeState[nodeId];
            if (nodeState) {
              // Auto-toggle visibility logic: only one node per subflow can have visible=true
              const subflow = state.subFlows[context.geoNodeId];
              if (subflow && params.rendering?.visible === true) {
                // Turn off visibility for all other nodes in this subflow
                Object.keys(subflow.nodeState).forEach(otherNodeId => {
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
                
                // Update activeOutputNodeId to the newly visible node
                subflow.activeOutputNodeId = nodeId;
                nodeState.isRenderTarget = true;
                state.subflowManager.setActiveOutput(context.geoNodeId, nodeId);
              } else if (subflow && params.rendering?.visible === false) {
                // If turning this node off and it was the active output, clear active output
                if (subflow.activeOutputNodeId === nodeId) {
                  subflow.activeOutputNodeId = null;
                  nodeState.isRenderTarget = false;
                  // Note: SubflowManager doesn't have a clear method, so we just clear our state
                }
              }
              
              Object.assign(nodeState.params, params);
              // Update compatibility property
              const subflowRuntime = state.subFlows[context.geoNodeId]?.nodeRuntime[nodeId];
              if (subflowRuntime) {
                Object.assign(subflowRuntime.params, params);
              }
              // Update subflow manager
              state.subflowManager.onSubflowParameterChange(context.geoNodeId, nodeId, params);
            }
          }

          // Invalidate cache and trigger recomputation
          if (nodeState) {
            state.cache.invalidateNode(nodeId);
            
            // Handle visibility changes and active output switching for subflows
            if (context.type === "subflow" && context.geoNodeId) {
              const subflow = state.subFlows[context.geoNodeId];
              
              // Check if visibility changed from false to true
              const wasVisible = nodeState?.params?.rendering?.visible === true;
              const nowVisible = params.rendering?.visible === true;
              
              if (!wasVisible && nowVisible && subflow) {
                // Node became visible - make it the active output and turn off others
                console.log(`Node ${nodeId} became visible - switching active output`);
                
                // Turn off visibility for all other nodes in this subflow
                Object.keys(subflow.nodeState).forEach(otherNodeId => {
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
                
                // Set this node as the active output
                subflow.activeOutputNodeId = nodeId;
                nodeState.isRenderTarget = true;
                state.subflowManager.setActiveOutput(context.geoNodeId, nodeId);
                console.log(`✅ Set activeOutputNodeId to ${nodeId} via visibility change`);
              }
              
              // Recompute if this is the active output node (either already was, or just became)
              if (subflow && subflow.activeOutputNodeId === nodeId) {
                // Recomputing subflow node on parameter change
                try {
                  const nodeDefinition = nodeRegistry[nodeState.type];
                  if (nodeDefinition?.computeTyped) {
                    // Get inputs from connected nodes for proper computation
                    const inputs: Record<string, BaseContainer> = {};
                    
                    // Get subflow internal graph and find predecessor nodes
                    const subflowManager = state.subflowManager.getSubflow(context.geoNodeId);
                    if (subflowManager) {
                      try {
                        const predecessors = subflowManager.internalGraph.getAllPredecessors(nodeId);
                        // Found predecessors for parameter change
                        
                        if (predecessors.length > 0) {
                          // Use first predecessor as default input (typical for Transform nodes)
                          const inputNodeId = predecessors[0].id;
                          const inputNodeRuntime = subflow.nodeRuntime[inputNodeId];
                          if (inputNodeRuntime?.output) {
                            inputs.default = inputNodeRuntime.output.default || new Object3DContainer(new Object3D());
                            // Connected input for parameter change
                          }
                        }
                      } catch (error) {
                        console.warn(`Could not get predecessors for ${nodeId}:`, error);
                      }
                    }
                    
                    // Parameter change inputs prepared
                    const result = nodeDefinition.computeTyped(nodeState.params, inputs, { nodeId });
                    // Parameter change computation completed
                    
                    // Handle async results
                    if (result && typeof result.then === 'function') {
                      result.then((resolvedResult: any) => {
                        // Parameter change async resolved
                        // Use set() to properly update state in async context
                        set((draft) => {
                          if (draft.subFlows[context.geoNodeId]?.nodeRuntime[nodeId]) {
                            draft.subFlows[context.geoNodeId].nodeRuntime[nodeId].output = resolvedResult;
                            // Parameter change async store updated
                          }
                        });
                      });
                    } else {
                      // Store synchronous result
                      subflow.nodeRuntime[nodeId].output = result;
                      // Parameter change stored synchronous result
                    }
                  }
                } catch (error) {
                  console.warn(`Could not recompute node ${nodeId} after parameter change:`, error);
                }
              }
              // Also notify SubflowManager for future scheduler integration
              state.subflowManager.onSubflowParameterChange(context.geoNodeId, nodeId, nodeState.params);
            } else if (context.type === "root" && nodeState.type.includes('Light')) {
              // Recompute root light nodes on parameter change
              // Recomputing root light node
              try {
                const nodeDefinition = nodeRegistry[nodeState.type];
                if (nodeDefinition?.compute) {
                  const result = nodeDefinition.compute(nodeState.params, undefined, { nodeId });
                  // Light parameter change completed
                  state.rootNodeRuntime[nodeId].output = result;
                  nodeState.output = result;
                }
              } catch (error) {
                console.warn(`Could not recompute light ${nodeId} after parameter change:`, error);
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
        // Check if connection would create cycle
        if (get().graph.wouldCreateCycle(source, target)) {
          return { ok: false, error: "Connection would create a cycle" };
        }

        // Add to graph structure
        const connected = get().graph.connect(source, target);
        if (!connected) {
          return { ok: false, error: "Failed to create connection" };
        }

        if (context.type === "root") {
          // Notify scheduler about connection change
          get().scheduler.onConnectionChange(source, target, true);

          // Update render cone status
          const state = get();
          if (state.rootRenderTarget) {
            const cone = state.graph.getRenderCone(state.rootRenderTarget);
            Object.keys(state.rootNodeState).forEach((nodeId) => {
              state.rootNodeState[nodeId].isInRenderCone = cone.includes(nodeId);
            });
          }
        } else if (context.type === "subflow" && context.geoNodeId) {
          // Add connection to subflow
          // Adding subflow connection
          const connected = get().subflowManager.addSubflowConnection(
            context.geoNodeId,
            source,
            target,
            sourceHandle,
            targetHandle
          );
          
          // CRITICAL FIX: Trigger recomputation of target node after connection
          if (connected) {
            set((state) => {
              const subflow = state.subFlows[context.geoNodeId];
              if (subflow?.nodeRuntime[target]) {
                const nodeState = subflow.nodeState[target];
                if (nodeState) {
                  try {
                    const nodeDefinition = nodeRegistry[nodeState.type];
                    if (nodeDefinition?.computeTyped) {
                      // Get inputs from connected nodes for immediate recomputation
                      const inputs: Record<string, BaseContainer> = {};
                      
                      // Get subflow internal graph and find predecessor nodes
                      const subflowManager = state.subflowManager.getSubflow(context.geoNodeId);
                      if (subflowManager) {
                        try {
                          const predecessors = subflowManager.internalGraph.getAllPredecessors(target);
                          
                          if (predecessors.length > 0) {
                            // Use first predecessor as default input (typical for Transform nodes)
                            const inputNodeId = predecessors[0].id;
                            const inputNodeRuntime = subflow.nodeRuntime[inputNodeId];
                            if (inputNodeRuntime?.output) {
                              inputs.default = inputNodeRuntime.output.default || new Object3DContainer(new Object3D());
                            }
                          }
                        } catch (error) {
                          console.warn(`Could not get predecessors for ${target}:`, error);
                        }
                      }
                      
                      const result = nodeDefinition.computeTyped(nodeState.params, inputs, { nodeId: target });
                      
                      // Handle both sync and async results
                      if (result && typeof result.then === 'function') {
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
                  } catch (error) {
                    console.warn(`Could not recompute node ${target} after connection:`, error);
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
        _sourceHandle?: string,
        _targetHandle?: string
      ) => {
        // Remove from graph structure
        get().graph.disconnect(source, target);

        if (context.type === "root") {
          // Notify scheduler
          get().scheduler.onConnectionChange(source, target, false);

          // Update render cone status
          const state = get();
          if (state.rootRenderTarget) {
            const cone = state.graph.getRenderCone(state.rootRenderTarget);
            Object.keys(state.rootNodeState).forEach((nodeId) => {
              state.rootNodeState[nodeId].isInRenderCone = cone.includes(nodeId);
            });
          }
        } else if (context.type === "subflow" && context.geoNodeId) {
          // Remove connection from subflow
          get().subflowManager.removeSubflowConnection(context.geoNodeId, source, target);
          
          // CRITICAL FIX: Trigger recomputation of target node after disconnection
          console.log(`🔌 Disconnecting ${source} → ${target}, triggering recomputation of target`);
          set((state) => {
            const subflow = state.subFlows[context.geoNodeId];
            if (subflow?.nodeRuntime[target]) {
              const nodeState = subflow.nodeState[target];
              if (nodeState) {
                try {
                  const nodeDefinition = nodeRegistry[nodeState.type];
                  if (nodeDefinition?.computeTyped) {
                    // Recompute target node with no inputs (disconnected)
                    const inputs: Record<string, BaseContainer> = {};
                    console.log(`🔌 Recomputing ${target} with empty inputs after disconnection`);
                    const result = nodeDefinition.computeTyped(nodeState.params, inputs, { nodeId: target });
                    
                    console.log(`🔌 Disconnection recomputation result for ${target}:`, result);
                    
                    // Handle both sync and async results
                    if (result && typeof result.then === 'function') {
                      result.then((resolvedResult: any) => {
                        console.log(`🔌 Disconnection async resolved for ${target}:`, resolvedResult);
                        set((draft) => {
                          if (draft.subFlows[context.geoNodeId]?.nodeRuntime[target]) {
                            draft.subFlows[context.geoNodeId].nodeRuntime[target].output = resolvedResult;
                          }
                        });
                      });
                    } else {
                      subflow.nodeRuntime[target].output = result;
                      console.log(`🔌 Disconnection recomputation stored for ${target}`);
                    }
                  }
                } catch (error) {
                  console.warn(`Could not recompute node ${target} after disconnection:`, error);
                }
              }
            }
          });
        }

        return { ok: true };
      },

      resetEdges: (edges: EdgeData[], context: GraphContext) => {
        const state = get();

        // Clear all existing edges
        // TODO: Implement proper edge clearing

        // Add new edges
        edges.forEach((edge) => {
          state.addEdge(edge.source, edge.target, context, edge.sourceHandle, edge.targetHandle);
        });

        return { ok: true };
      },

      setRenderTarget: (nodeId: string | null, context: GraphContext) => {
        set((state) => {
          if (context.type === "root") {
            // Clear previous render target
            if (state.rootRenderTarget) {
              const prevNode = state.rootNodeState[state.rootRenderTarget];
              if (prevNode) {
                prevNode.isRenderTarget = false;
              }
            }

            state.rootRenderTarget = nodeId;
            state.scheduler.setRenderTarget(nodeId);

            // Update render target flag and cone status
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
              // No render target - nothing is in cone
              Object.keys(state.rootNodeState).forEach((id) => {
                state.rootNodeState[id].isInRenderCone = false;
              });
            }
          } else if (context.type === "subflow" && context.geoNodeId && nodeId) {
            // Set subflow active output
            state.subflowManager.setActiveOutput(context.geoNodeId, nodeId);

            const subflow = state.subFlows[context.geoNodeId];
            if (subflow) {
              // Clear previous active output flag
              if (subflow.activeOutputNodeId) {
                const prevNode = subflow.nodeState[subflow.activeOutputNodeId];
                if (prevNode) {
                  prevNode.isRenderTarget = false;
                }
              }

              subflow.activeOutputNodeId = nodeId;

              // Set new active output flag
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
          // Clear scheduler and cache
          state.scheduler.clear();
          state.cache.clear();
          state.subflowManager.clear();

          // Clear graph - create outside Immer context
          const newGraph = new GraphLibAdapter();
          const newScheduler = new RenderConeScheduler(newGraph);
          const newSubflowManager = new SubflowManager(newGraph);
          const newCache = new ContentCache();

          state.graph = newGraph;
          state.scheduler = newScheduler;
          state.subflowManager = newSubflowManager;
          state.cache = newCache;

          // Clear state
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

          // Import root nodes
          serialized.nodes.forEach((nodeData) => {
            state.addNode(nodeData, { type: "root" });
          });

          // Import subflows
          Object.entries(serialized.subFlows).forEach(([geoNodeId, subflow]) => {
            subflow.nodes.forEach((nodeData) => {
              state.addNode(nodeData, { type: "subflow", geoNodeId });
            });
          });

          // Import edges
          serialized.edges.forEach((edge) => {
            state.addEdge(
              edge.source,
              edge.target,
              { type: "root" },
              edge.sourceHandle,
              edge.targetHandle
            );
          });

          // Import subflow edges
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

          // Set render targets
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
          edges: [], // TODO: Extract from graph connections
          nodeRuntime: {},
          positions: nodePositions || {},
          subFlows: {},
          rootRenderTarget: state.rootRenderTarget,
        };

        // Export node runtime (without transient data)
        Object.entries(state.rootNodeState).forEach(([nodeId, nodeState]) => {
          serialized.nodeRuntime[nodeId] = {
            id: nodeState.id,
            type: nodeState.type,
            params: nodeState.params,
            inputs: nodeState.inputs,
          };
        });

        // Export subflows
        Object.entries(state.subFlows).forEach(([geoNodeId, subflow]) => {
          serialized.subFlows[geoNodeId] = {
            nodes: Object.keys(subflow.nodeState).map((nodeId) => ({
              id: nodeId,
              type: subflow.nodeState[nodeId].type,
              params: subflow.nodeState[nodeId].params,
            })),
            edges: [], // TODO: Extract from subflow connections
            nodeRuntime: {},
            positions: {},
            activeOutputNodeId: subflow.activeOutputNodeId,
          };

          // Export subflow node runtime
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

      preloadImportObjAssets: async () => {
        // TODO: Implement asset preloading if needed
      },

      preloadAssetForNode: async (
        _nodeId: string,
        _nodeState: NodeState,
        _context: GraphContext
      ) => {
        // TODO: Implement per-node asset preloading if needed
      },

      validatePostImportComputation: async () => {
        // Render-cone system handles validation automatically
        // No manual validation needed
      },

      forceResetImportedNodeTracking: (nodeIds: string[], _contexts: GraphContext[]) => {
        // Force recomputation by invalidating cache
        nodeIds.forEach((nodeId) => {
          get().cache.invalidateNode(nodeId);
        });
      },
    };
  })
);

// Export singleton instances for direct access when needed
export { graphLibAdapter, renderConeScheduler, contentCache, subflowManager };

// Legacy compatibility export (deprecated)
export const exportGraphWithMeta = async (): Promise<any> => {
  console.warn(
    "exportGraphWithMeta is deprecated - use useGraphStore.getState().exportGraph() instead"
  );
  return useGraphStore.getState().exportGraph();
};
