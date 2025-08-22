import React from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import * as computeEngine from "./computeEngine";
import { nodeRegistry } from "./nodeRegistry";
import { GRAPH_SCHEMA } from "../constants";
import { extractDefaultValues, validateAndNormalizeParams } from "./parameterUtils";
import { CoreGraph, ConnectionManager, Cooker, DirtyController, type Connection, type GraphNode } from "./graph";

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

export type NodeDefinition = {
  type: string;
  category: string;
  displayName: string;
  allowedContexts: ("root" | "subflow")[];
  params: NodeParams;
  compute: (params: any, inputs?: any) => any;
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

export type NodeRuntime = {
  type: string;
  params: Record<string, any>;
  inputs: Record<string, any>;
  output: any;
  isDirty: boolean;
  error?: string;
  dirtyController?: DirtyController;
};

export type SubFlowGraph = {
  nodeRuntime: Record<string, NodeRuntime>;
  activeOutputNodeId: string | null;
};

export type GraphState = {
  rootNodeRuntime: Record<string, NodeRuntime>;
  subFlows: Record<string, SubFlowGraph>;
  evaluationMode: "eager" | "lazy";
  isImporting: boolean;
  
  // Phase 1-2 architecture components (complete)
  graph: CoreGraph;
  connectionManager: ConnectionManager;
  cooker: Cooker;

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

  recomputeFrom: (nodeId: string, context: GraphContext) => void;
  markDirty: (nodeId: string, context: GraphContext) => void;

  clear: () => void;
  importGraph: (serialized: SerializedGraph) => Promise<void>;
  exportGraph: (
    nodePositions?: Record<string, { x: number; y: number }>
  ) => Promise<SerializedGraph>;
  setSubFlowActiveOutput: (geoNodeId: string, nodeId: string) => void;
  
  preloadImportObjAssets: () => Promise<void>;
  preloadAssetForNode: (nodeId: string, runtime: NodeRuntime, context: GraphContext) => Promise<void>;
  markAllNodesAsDirty: () => void;
  validatePostImportComputation: () => Promise<void>;
  clearRecomputationTracking: () => void;
  forceResetImportedNodeTracking: (nodeIds: string[], contexts: GraphContext[]) => void;
  recomputeFromSync: (nodeId: string, context: GraphContext) => Promise<void>;
};

export type SerializedSubFlow = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  nodeRuntime: Record<string, Omit<NodeRuntime, "output" | "isDirty" | "error">>;
  positions: Record<string, { x: number; y: number }>;
  activeOutputNodeId: string | null;
};

export type SerializedGraph = {
  nodes: NodeInitData[];
  edges: EdgeData[];
  nodeRuntime: Record<string, Omit<NodeRuntime, "output" | "isDirty" | "error">>;
  positions: Record<string, { x: number; y: number }>;
  subFlows: Record<string, SerializedSubFlow>;
};

export { nodeRegistry } from "./nodeRegistry";


// Create singleton instances of the new architecture components
const coreGraph = new CoreGraph();
const connectionManager = new ConnectionManager();
const cooker = new Cooker(coreGraph);

// Set up the cooker's compute function
cooker.setComputeFunction(async (nodeId: string) => {
  const state = useGraphStore.getState();
  
  // Find the node in root or subflow context
  let nodeRuntime: NodeRuntime | undefined;
  let context: GraphContext | undefined;
  
  if (state.rootNodeRuntime[nodeId]) {
    nodeRuntime = state.rootNodeRuntime[nodeId];
    context = { type: "root" };
  } else {
    // Search in subflows
    for (const [geoNodeId, subFlow] of Object.entries(state.subFlows)) {
      if (subFlow.nodeRuntime[nodeId]) {
        nodeRuntime = subFlow.nodeRuntime[nodeId];
        context = { type: "subflow", geoNodeId };
        break;
      }
    }
  }
  
  if (!nodeRuntime || !context) {
    console.error(`[Cooker] Node ${nodeId} not found in any context`);
    return;
  }
  
  if (!nodeRuntime.isDirty) {
    console.debug(`[Cooker] Node ${nodeId} is not dirty, skipping computation`);
    return;
  }
  
  const nodeDef = nodeRegistry[nodeRuntime.type];
  if (!nodeDef) {
    console.error(`[Cooker] Node definition not found for type ${nodeRuntime.type}`);
    return;
  }
  
  // Get inputs using connection manager
  const inputConnections = connectionManager.getInputConnections(nodeId);
  const inputs: Record<string, any> = {};
  
  const sourceRuntime = context.type === "root" 
    ? state.rootNodeRuntime 
    : state.subFlows[context.geoNodeId!]?.nodeRuntime;
  
  if (sourceRuntime) {
    for (const connection of inputConnections) {
      const sourceNode = sourceRuntime[connection.sourceNodeId];
      if (sourceNode && sourceNode.output !== undefined) {
        const inputHandle = connection.targetHandle || connection.sourceNodeId;
        inputs[inputHandle] = sourceNode.output;
      }
    }
  }
  
  try {
    const result = computeEngine.evaluateNode(nodeId, nodeRuntime.params, inputs, nodeDef.compute);
    
    // Update the node runtime directly
    useGraphStore.setState((state) => {
      const targetRuntime = context.type === "root"
        ? state.rootNodeRuntime[nodeId]
        : state.subFlows[context.geoNodeId!]?.nodeRuntime[nodeId];
        
      if (targetRuntime) {
        targetRuntime.output = result;
        targetRuntime.isDirty = false;
        targetRuntime.error = undefined;
      }
    });
    
    console.debug(`[Cooker] Successfully computed node ${nodeId}`);
    
  } catch (err) {
    useGraphStore.setState((state) => {
      const targetRuntime = context.type === "root"
        ? state.rootNodeRuntime[nodeId]
        : state.subFlows[context.geoNodeId!]?.nodeRuntime[nodeId];
        
      if (targetRuntime) {
        targetRuntime.error = err instanceof Error ? err.message : String(err);
        targetRuntime.isDirty = false;
      }
    });
    
    console.error(`[Cooker] Error computing node ${nodeId}:`, err);
  }
});

export const useGraphStore = create<GraphState>()(
  immer((set, get) => ({
    rootNodeRuntime: {},
    subFlows: {},
    evaluationMode: "eager",
    isImporting: false,
    
    // Phase 1-2 architecture components (complete)
    graph: coreGraph,
    connectionManager: connectionManager,
    cooker: cooker,

    addNode: (node: NodeInitData, context: GraphContext) => {
      const { id, type, params: overrideParams } = node;
      const nodeDef = nodeRegistry[type];
      if (!nodeDef) {
        console.error(`Node type "${type}" not found in registry`);
        return;
      }

      // Validate context
      if (!nodeDef.allowedContexts.includes(context.type)) {
        console.error(`Node type "${type}" is not allowed in ${context.type} context`);
        return;
      }

      set((state) => {
        const defaultParams = extractDefaultValues(nodeDef.params);

        // Deep merge overrideParams with defaults
        const mergedParams: Record<string, any> = {};
        for (const [category] of Object.entries(nodeDef.params)) {
          mergedParams[category] = {
            ...defaultParams[category],
            ...(overrideParams?.[category] || {}),
          };
        }

        // For sub-flow nodes, default render flag to OFF unless explicitly overridden
        if (context.type === "subflow" && !overrideParams?.rendering?.hasOwnProperty("visible")) {
          if (mergedParams.rendering) {
            mergedParams.rendering.visible = false;
          }
        }

        // Get the appropriate runtime based on context
        const targetRuntime =
          context.type === "root"
            ? state.rootNodeRuntime
            : context.geoNodeId
            ? state.subFlows[context.geoNodeId]?.nodeRuntime
            : undefined;

        if (!targetRuntime && context.type === "subflow") {
          console.error(`Sub-flow for GeoNode "${context.geoNodeId}" not found`);
          return;
        }

        // Generate unique name if not provided in overrideParams
        if (!overrideParams?.general?.name && mergedParams.general?.name) {
          const baseName = nodeDef.displayName; // Use displayName as base (e.g., "Box", "Sphere")
          const existingNames = new Set(
            Object.values(targetRuntime || {})
              .filter((runtime) => runtime.type === type)
              .map((runtime) => runtime.params.general?.name)
              .filter(Boolean)
          );

          let counter = 1;
          let uniqueName = `${baseName} ${counter}`;
          while (existingNames.has(uniqueName)) {
            counter++;
            uniqueName = `${baseName} ${counter}`;
          }

          mergedParams.general.name = uniqueName;
        }

        const validatedParams = validateAndNormalizeParams(mergedParams, nodeDef.params);

        const newNodeRuntime: NodeRuntime = {
          type,
          params: validatedParams,
          inputs: {},
          output: null,
          isDirty: true,
        };
        
        // Initialize DirtyController for Phase 2 enhanced dirty management
        const graphNodeForDirty: GraphNode = { 
          id, 
          isDirty: () => newNodeRuntime.isDirty,
          cook: async () => {
            // This will be enhanced in Phase 3 with proper cooking
            console.log(`Cooking node ${id}`);
          }
        };
        newNodeRuntime.dirtyController = new DirtyController(
          graphNodeForDirty, 
          get().cooker, 
          (nodeId: string) => get().graph.getAllSuccessors(nodeId)
        );

        if (context.type === "root") {
          state.rootNodeRuntime[id] = newNodeRuntime;

          // Initialize sub-flow for GeoNode
          if (type === "geoNode") {
            state.subFlows[id] = {
              nodeRuntime: {},
              activeOutputNodeId: null,
            };
          }
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          subFlow.nodeRuntime[id] = newNodeRuntime;
        }

        // Add node to new graph system
        const graphNodeForGraph: GraphNode = { id };
        state.graph.addNode(graphNodeForGraph);
      });

      if (get().evaluationMode === "eager") {
        // Use new batched recomputation system
        get().cooker.enqueue(id);
      }
    },

    removeNode: (nodeId: string, context: GraphContext) => {
      set((state) => {
        if (context.type === "root") {
          // If removing GeoNode, delete its entire sub-flow
          if (state.rootNodeRuntime[nodeId]?.type === "geoNode") {
            delete state.subFlows[nodeId];
          }

          delete state.rootNodeRuntime[nodeId];
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          if (!subFlow) return;

          // Clear active output if this was the active node
          if (subFlow.activeOutputNodeId === nodeId) {
            subFlow.activeOutputNodeId = null;
          }

          delete subFlow.nodeRuntime[nodeId];
        }

        // Remove from graph system and connection manager (handles all dependency cleanup)
        state.graph.removeNode(nodeId);
        state.connectionManager.removeAllConnectionsForNode(nodeId);
      });

      // Node removal is handled entirely by the graph system and connection manager
      // No additional cleanup needed as connections are automatically managed
    },

    setParams: (nodeId: string, params: Partial<Record<string, any>>, context: GraphContext) => {

      // CRITICAL FIX: Batch all state updates including dirty marking and recomputation
      // This prevents Scene Manager from rendering between dirty marking and recomputation
      set((state) => {
        const targetRuntime =
          context.type === "root"
            ? state.rootNodeRuntime
            : state.subFlows[context.geoNodeId!]?.nodeRuntime;

        if (!targetRuntime?.[nodeId]) {
          console.error(`Node "${nodeId}" not found in ${context.type} context`);
          return;
        }

        // Handle render flag auto-toggle for sub-flow nodes
        // ONLY trigger this when visibility is actually being changed, not just when it's true
        const wasVisible = targetRuntime[nodeId].params.rendering?.visible;
        const willBeVisible = params.rendering?.visible;
        
        if (context.type === "subflow" && willBeVisible === true && wasVisible !== true && !state.isImporting) {
          const subFlow = state.subFlows[context.geoNodeId!];
          // Turn OFF all other nodes in same sub-flow
          Object.keys(subFlow.nodeRuntime).forEach((id) => {
            if (id !== nodeId && subFlow.nodeRuntime[id].params.rendering?.visible) {
              subFlow.nodeRuntime[id].params.rendering.visible = false;
            }
          });
          // Update activeOutputNodeId
          subFlow.activeOutputNodeId = nodeId;
        }

        const oldParams = targetRuntime[nodeId].params;
        
        // Deep merge parameters to prevent property loss
        const newParams = { ...oldParams };
        for (const [category, categoryParams] of Object.entries(params)) {
          if (typeof categoryParams === 'object' && categoryParams !== null) {
            newParams[category] = {
              ...oldParams[category],
              ...categoryParams,
            };
          } else {
            newParams[category] = categoryParams;
          }
        }

        targetRuntime[nodeId].params = newParams;

        // BATCH: Mark dirty within the same state update
        targetRuntime[nodeId].isDirty = true;

        // BATCH: Also mark parent GeoNode as dirty if this is a subflow change
        if (context.type === "subflow" && context.geoNodeId) {
          state.rootNodeRuntime[context.geoNodeId].isDirty = true;
        }
      });

      // BATCH: Perform recomputation AFTER state updates are complete
      if (get().evaluationMode === "eager") {
        // Use new batched recomputation system
        get().cooker.enqueue(nodeId);
        
        // Then recompute parent GeoNode if needed
        if (context.type === "subflow" && context.geoNodeId) {
          get().cooker.enqueue(context.geoNodeId);
        }
      }
    },

    addEdge: (
      source: string,
      target: string,
      context: GraphContext,
      sourceHandle?: string,
      targetHandle?: string
    ): Result => {
      if (source === target) return { ok: false, error: "Self-connections are not allowed" };

      const state = get();
      const nodeRuntime =
        context.type === "root"
          ? state.rootNodeRuntime
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;

      if (!nodeRuntime) {
        return { ok: false, error: `Context not found` };
      }

      if (!nodeRuntime[source] || !nodeRuntime[target])
        return { ok: false, error: `Node "${source}" or "${target}" not found` };

      // Use new graph system for cycle detection - MUCH MORE EFFICIENT
      if (state.graph.wouldCreateCycle(source, target)) {
        return { ok: false, error: "Connection creates a cycle—edge not added" };
      }

      // NEW SYSTEM: Use connection manager and graph - SOLVES ONE-TO-MANY ISSUE
      set((state) => {
        // Create connection using new system
        const connection: Connection = {
          id: state.connectionManager.generateConnectionId(),
          sourceNodeId: source,
          targetNodeId: target,
          sourceHandle,
          targetHandle
        };

        // Add connection to new system - SUPPORTS MULTIPLE CONNECTIONS PER OUTPUT
        state.connectionManager.addConnection(connection);
        
        // Add to graph for efficient cycle detection and traversal
        state.graph.connect(source, target);

        // Mark target node as dirty
        const targetNodeRuntime = context.type === "root"
          ? state.rootNodeRuntime[target]
          : state.subFlows[context.geoNodeId!]?.nodeRuntime[target];
        
        if (targetNodeRuntime) {
          targetNodeRuntime.isDirty = true;
        }
      });

      // Use new batched recomputation system
      if (get().evaluationMode === "eager") {
        get().cooker.enqueue(target);
      }

      return { ok: true };
    },

    removeEdge: (
      source: string,
      target: string,
      context: GraphContext,
      sourceHandle?: string,
      targetHandle?: string
    ): Result => {
      const state = get();
      const nodeRuntime =
        context.type === "root"
          ? state.rootNodeRuntime
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;

      if (!nodeRuntime) {
        return { ok: false, error: `Context not found` };
      }

      if (!nodeRuntime[source] || !nodeRuntime[target])
        return { ok: false, error: `Node "${source}" or "${target}" not found` };

      // Check connection exists using new system
      const connections = state.connectionManager.getConnectionsBetweenNodes(source, target);
      if (connections.length === 0) {
        return { ok: false, error: `Edge from "${source}" to "${target}" does not exist` };
      }

      set((state) => {
        // Find and remove connection using new system
        const connectionsToRemove = state.connectionManager.getConnectionsBetweenNodes(source, target);
        
        // Remove specific connection if handles provided, otherwise remove first matching
        let connectionToRemove = connectionsToRemove[0];
        if (sourceHandle && targetHandle) {
          connectionToRemove = connectionsToRemove.find(conn => 
            conn.sourceHandle === sourceHandle && conn.targetHandle === targetHandle
          ) || connectionsToRemove[0];
        }

        if (connectionToRemove) {
          // Remove from new connection system
          state.connectionManager.removeConnection(connectionToRemove.id);
          
          // Remove from graph if this was the last connection between these nodes
          const remainingConnections = state.connectionManager.getConnectionsBetweenNodes(source, target);
          if (remainingConnections.length === 0) {
            state.graph.disconnect(source, target);
          }
        }

        // Handle input clearing and mark target node as dirty
        const targetNodeRuntime = context.type === "root"
          ? state.rootNodeRuntime[target]
          : state.subFlows[context.geoNodeId!]?.nodeRuntime[target];
        
        if (targetNodeRuntime) {
          // Clear specific input handle if provided
          if (sourceHandle && targetHandle && targetNodeRuntime.inputs[targetHandle]) {
            delete targetNodeRuntime.inputs[targetHandle];
          }
          
          // Mark target as dirty since it lost a connection
          targetNodeRuntime.isDirty = true;
        }
      });

      // Use new batched recomputation system
      if (get().evaluationMode === "eager") {
        get().cooker.enqueue(target);
      }

      return { ok: true };
    },

    resetEdges: (edges: EdgeData[], context: GraphContext): Result => {
      
      set((state) => {
        // Clear all existing connections using new system
        const nodeRuntime = context.type === "root" 
          ? state.rootNodeRuntime 
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;
        
        if (nodeRuntime) {
          // Get all node IDs in this context
          const nodeIds = Object.keys(nodeRuntime);
          
          // Remove all connections between nodes in this context
          for (const nodeId of nodeIds) {
            state.connectionManager.removeAllConnectionsForNode(nodeId);
            state.graph.removeNode(nodeId);
            // Re-add node to graph (without connections)
            state.graph.addNode({ id: nodeId });
            // Mark as dirty since connections changed
            nodeRuntime[nodeId].isDirty = true;
          }
        }
      });

      for (const edge of edges) {
        const result = get().addEdge(
          edge.source,
          edge.target,
          context,
          edge.sourceHandle,
          edge.targetHandle
        );
        if (!result.ok) {
          return { ok: false, error: `Failed to add edge ${edge.id}: ${result.error}` };
        }
      }

      return { ok: true };
    },

    markDirty: (nodeId: string, context: GraphContext) => {
      const state = get();
      
      // Phase 2: Use DirtyController for proper dirty propagation
      const targetNodeRuntime = context.type === "root"
        ? state.rootNodeRuntime
        : state.subFlows[context.geoNodeId!]?.nodeRuntime;
        
      if (!targetNodeRuntime?.[nodeId]) {
        console.error(`[markDirty] Node ${nodeId} not found in context`);
        return;
      }
      
      const runtime = targetNodeRuntime[nodeId];
      if (runtime.dirtyController) {
        // Use DirtyController for proper propagation and batching
        runtime.dirtyController.setDirty();
        console.log(`[markDirty] Used DirtyController to mark ${nodeId} as dirty`);
      } else {
        // Fallback to old system for nodes without DirtyController
        const successors = state.graph.getAllSuccessors(nodeId);
        const nodesToMark = [nodeId, ...successors.map(n => n.id)];
        set((_state) => {
          for (const id of nodesToMark) {
            if (targetNodeRuntime[id]) {
              targetNodeRuntime[id].isDirty = true;
            }
          }
        });
        console.log(`[markDirty] Fallback: marked ${nodesToMark.length} nodes as dirty`);
      }
    },

    recomputeFrom: (nodeId: string, context: GraphContext) => {
      const state = get();
      
      // Skip recomputation during import to prevent cascading updates
      if (state.isImporting) {
        console.debug(`[recomputeFrom] Skipping recomputation for ${nodeId} during import`);
        return;
      }
      
      // NEW SYSTEM: Use Cooker for batched recomputation - ELIMINATES ALL COMPLEX LOGIC
      state.cooker.enqueue(nodeId, {
        type: 'compute',
        trigger: state.graph.getNode(nodeId)
      });
      
      console.log(`[recomputeFrom] Enqueued node ${nodeId} for batched recomputation in ${context.type} context`);
    },

    clear: () => {
      // Clear new architecture components
      const state = get();
      state.graph = new CoreGraph();
      state.connectionManager = new ConnectionManager(); 
      state.cooker = new Cooker(state.graph);
      
      set({
        rootNodeRuntime: {},
        subFlows: {},
      });
    },

    importGraph: async (serialized: SerializedGraph) => {
      const { nodes, edges, nodeRuntime, positions, subFlows } = serialized;
      
      // Set importing flag to prevent auto-active-output behavior
      set((state) => {
        state.isImporting = true;
      });
      
      // Clear existing graph state
      get().clear();
      
      // Add nodes first (this creates the runtime entries)
      const rootContext: GraphContext = { type: "root" };
      nodes.forEach(node => {
        get().addNode(node, rootContext);
      });
      
      // Then add edges to establish connections
      edges.forEach(edge => {
        get().addEdge(edge.source, edge.target, rootContext, edge.sourceHandle, edge.targetHandle);
      });
      
      // Restore subflows
      if (subFlows) {
        Object.entries(subFlows).forEach(([geoNodeId, subFlow]) => {
          const subFlowContext: GraphContext = { type: "subflow", geoNodeId };
          
          console.log(`[importGraph] Processing subflow ${geoNodeId} with edges:`, subFlow.edges);
          
          // Add subflow nodes
          subFlow.nodes.forEach(node => {
            get().addNode(node, subFlowContext);
          });
          
          // Add subflow edges
          subFlow.edges.forEach(edge => {
            console.log(`[importGraph] Adding edge:`, edge);
            
            const result = get().addEdge(edge.source, edge.target, subFlowContext, edge.sourceHandle, edge.targetHandle);
            if (!result.ok) {
              console.error(`[importGraph] Failed to add subflow edge ${edge.source} -> ${edge.target}:`, result.error);
            } else {
              console.log(`[importGraph] Successfully added subflow edge ${edge.source} -> ${edge.target}`);
            }
          });
          
          // Update subflow runtime data and active output
          set((state) => {
            const targetSubFlow = state.subFlows[geoNodeId];
            if (targetSubFlow) {
              // Restore inputs from serialized data
              Object.entries(subFlow.nodeRuntime).forEach(([nodeId, runtime]) => {
                if (targetSubFlow.nodeRuntime[nodeId]) {
                  targetSubFlow.nodeRuntime[nodeId].inputs = runtime.inputs;
                }
              });
              
              // Restore active output node from serialized data
              targetSubFlow.activeOutputNodeId = subFlow.activeOutputNodeId;
              console.log(`[importGraph] Restored active output node for subflow ${geoNodeId}:`, subFlow.activeOutputNodeId);
              
              // Connections are automatically managed by ConnectionManager and CoreGraph
            }
          });
        });
      }
      
      // Update root node runtime data (inputs) after connections are established
      set((state) => {
        Object.entries(nodeRuntime).forEach(([nodeId, runtime]) => {
          if (state.rootNodeRuntime[nodeId]) {
            // Restore inputs from serialized data
            state.rootNodeRuntime[nodeId].inputs = runtime.inputs;
          }
        });
      });
      
      // Store positions for React Flow by context - do this synchronously to avoid timing issues
      (async () => {
        try {
          const { useUIStore } = await import("../store/uiStore");
          const { saveNodePositions } = useUIStore.getState();
          
          // Save root positions
          if (positions && Object.keys(positions).length > 0) {
            saveNodePositions("root", positions);
            console.log("[importGraph] Restored root positions:", positions);
          }
          
          // Save subflow positions
          if (subFlows) {
            Object.entries(subFlows).forEach(([geoNodeId, subFlow]) => {
              if (subFlow.positions && Object.keys(subFlow.positions).length > 0) {
                const contextKey = `subflow-${geoNodeId}`;
                saveNodePositions(contextKey, subFlow.positions);
                console.log(`[importGraph] Restored subflow positions for ${geoNodeId}:`, subFlow.positions);
              }
            });
          }
        } catch (error) {
          console.warn("[importGraph] Failed to save positions to UI store:", error);
        }
      })();
      
      // Edge validation is handled by ConnectionManager and CoreGraph
      console.log('[importGraph] Edges restored via ConnectionManager');

      // Clear importing flag BEFORE triggering recomputation
      set((state) => {
        state.isImporting = false;
      });
      
      // Trigger post-import computation of the entire graph
      if (get().evaluationMode === "eager") {
        console.log('[importGraph] Starting post-import computation');
        
        // Pre-load assets for ImportObj nodes before computation
        await get().preloadImportObjAssets();
        
        // Ensure all nodes are marked as dirty after import
        get().markAllNodesAsDirty();
        
        // Temporarily disable cycle detection during import computation
        get().clearRecomputationTracking();
        
        // First, recompute subflow nodes to generate their outputs
        if (subFlows) {
          console.log('[importGraph] Recomputing subflow nodes...');
          
          for (const [geoNodeId, subFlow] of Object.entries(subFlows)) {
            console.log(`[importGraph] Recomputing subflow for geoNode ${geoNodeId}, nodes:`, subFlow.nodes.map(n => n.id));
            const subFlowContext: GraphContext = { type: "subflow", geoNodeId };
            
            // Recompute nodes synchronously in dependency order
            for (const node of subFlow.nodes) {
              console.log(`[importGraph] Recomputing subflow node ${node.id}`);
              await get().recomputeFromSync(node.id, subFlowContext);
            }
          }
        }
        
        // Then, recompute root nodes so geoNodes can collect subflow outputs
        console.log('[importGraph] Recomputing root nodes...');
        for (const node of nodes) {
          console.log(`[importGraph] Recomputing root node ${node.id} (${node.type})`);
          await get().recomputeFromSync(node.id, rootContext);
        }
        
        // Wait for any pending async operations
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Validate that critical nodes have outputs after computation
        await get().validatePostImportComputation();
        
        console.log('[importGraph] Post-import computation complete');
      }
      
      // Force reset recomputation tracking for all imported nodes
      const allNodeIds = [
        ...nodes.map(n => n.id),
        ...Object.values(subFlows || {}).flatMap(sf => sf.nodes.map(n => n.id))
      ];
      const allContexts = [
        { type: "root" as const },
        ...Object.keys(subFlows || {}).map(geoNodeId => ({ type: "subflow" as const, geoNodeId }))
      ];
      get().forceResetImportedNodeTracking(allNodeIds, allContexts);
      
      console.log('[importGraph] Import completed');
    },

    preloadImportObjAssets: async () => {
      const state = get();
      
      console.log('[preloadImportObjAssets] Pre-loading ImportObj assets...');
      
      // Check all root nodes
      for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {
        if (runtime.type === 'importObjNode') {
          await get().preloadAssetForNode(nodeId, runtime, { type: 'root' });
        }
      }
      
      // Check all subflow nodes
      for (const [geoNodeId, subFlow] of Object.entries(state.subFlows)) {
        for (const [nodeId, runtime] of Object.entries(subFlow.nodeRuntime)) {
          if (runtime.type === 'importObjNode') {
            await get().preloadAssetForNode(nodeId, runtime, { type: 'subflow', geoNodeId });
          }
        }
      }
      
      console.log('[preloadImportObjAssets] Asset pre-loading completed');
    },

    preloadAssetForNode: async (nodeId: string, runtime: NodeRuntime, context: GraphContext) => {
      if (runtime.type !== 'importObjNode' || !runtime.params?.object) return;
      
      const objectParams = runtime.params.object as any;
      if (!objectParams?.assetHash || objectParams?.file) return; // Already has file or no hash
      
      try {
        console.log(`[preloadAssetForNode] Loading asset for node ${nodeId}, hash: ${objectParams.assetHash}`);
        
        // Use OPFS cache to get asset data  
        const { getAssetCache } = await import('../io/mxscene/opfs-cache');
        const assetCache = getAssetCache();
        const assetData = await assetCache.get(objectParams.assetHash);
        
        if (!assetData) {
          console.warn(`[preloadAssetForNode] Asset not found in cache: ${objectParams.assetHash}`);
          return;
        }
        
        // Convert to SerializableObjFile format
        const decoder = new TextDecoder();
        const content = decoder.decode(assetData);
        const encodedContent = btoa(content);
        
        const serializableFile = {
          name: `restored-${objectParams.assetHash.slice(0, 8)}.obj`,
          size: assetData.byteLength,
          lastModified: Date.now(),
          content: encodedContent,
        };
        
        // Update the node parameters with the loaded asset
        set((state) => {
          const targetRuntime = context.type === 'root' 
            ? state.rootNodeRuntime[nodeId]
            : state.subFlows[context.geoNodeId!]?.nodeRuntime[nodeId];
            
          if (targetRuntime && targetRuntime.params?.object) {
            const objParams = targetRuntime.params.object as any;
            objParams.file = serializableFile;
            // Mark as dirty to trigger recomputation
            targetRuntime.isDirty = true;
            
            console.log(`[preloadAssetForNode] Asset pre-loaded for node ${nodeId}: ${serializableFile.name}`);
          }
        });
      } catch (error) {
        console.warn(`[preloadAssetForNode] Failed to pre-load asset for node ${nodeId}:`, error);
      }
    },

    markAllNodesAsDirty: () => {
      console.log('[markAllNodesAsDirty] Marking all imported nodes as dirty');
      
      set((state) => {
        // Mark all root nodes as dirty
        for (const runtime of Object.values(state.rootNodeRuntime)) {
          runtime.isDirty = true;
          runtime.output = null; // Clear cached output
        }
        
        // Mark all subflow nodes as dirty
        for (const subFlow of Object.values(state.subFlows)) {
          for (const runtime of Object.values(subFlow.nodeRuntime)) {
            runtime.isDirty = true;
            runtime.output = null; // Clear cached output
          }
        }
      });
    },

    validatePostImportComputation: async () => {
      const state = get();
      console.log('[validatePostImportComputation] Validating node outputs...');
      
      let hasIssues = false;
      
      // Check root nodes
      for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {
        if (runtime.isDirty) {
          console.warn(`[validatePostImportComputation] Root node ${nodeId} (${runtime.type}) is still dirty after computation`);
          hasIssues = true;
        } else if (!runtime.output && runtime.type !== 'noteNode') {
          console.warn(`[validatePostImportComputation] Root node ${nodeId} (${runtime.type}) has no output after computation`);
          hasIssues = true;
        } else if (runtime.error) {
          console.warn(`[validatePostImportComputation] Root node ${nodeId} (${runtime.type}) has error:`, runtime.error);
          hasIssues = true;
        } else {
          console.debug(`[validatePostImportComputation] Root node ${nodeId} (${runtime.type}) OK`);
        }
      }
      
      // Check subflow nodes
      for (const [geoNodeId, subFlow] of Object.entries(state.subFlows)) {
        for (const [nodeId, runtime] of Object.entries(subFlow.nodeRuntime)) {
          if (runtime.isDirty) {
            console.warn(`[validatePostImportComputation] Subflow node ${nodeId} (${runtime.type}) in ${geoNodeId} is still dirty`);
            hasIssues = true;
          } else if (!runtime.output && runtime.type !== 'noteNode') {
            console.warn(`[validatePostImportComputation] Subflow node ${nodeId} (${runtime.type}) in ${geoNodeId} has no output`);
            hasIssues = true;
          } else if (runtime.error) {
            console.warn(`[validatePostImportComputation] Subflow node ${nodeId} (${runtime.type}) in ${geoNodeId} has error:`, runtime.error);
            hasIssues = true;
          } else {
            console.debug(`[validatePostImportComputation] Subflow node ${nodeId} (${runtime.type}) in ${geoNodeId} OK`);
          }
        }
        
        // Check active output nodes specifically
        if (subFlow.activeOutputNodeId) {
          const outputRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
          if (!outputRuntime?.output) {
            console.error(`[validatePostImportComputation] Active output node ${subFlow.activeOutputNodeId} in ${geoNodeId} has no output!`);
            hasIssues = true;
          }
        }
      }
      
      if (hasIssues) {
        console.warn('[validatePostImportComputation] Some nodes failed to compute properly after import');
      } else {
        console.log('[validatePostImportComputation] All nodes computed successfully');
      }
    },

    clearRecomputationTracking: () => {
      // NEW SYSTEM: Clear cooker queue instead of complex tracking
      const state = get();
      state.cooker.clear();
      console.log('[clearRecomputationTracking] Cleared cooker queue (new batching system)');
    },

    forceResetImportedNodeTracking: (nodeIds: string[], _contexts: GraphContext[]) => {
      // NEW SYSTEM: Simply clear cooker queue - no complex tracking needed
      const state = get();
      state.cooker.clear();
      console.log(`[forceResetImportedNodeTracking] Cleared cooker queue for ${nodeIds.length} imported nodes (new system)`);
    },

    recomputeFromSync: async (nodeId: string, context: GraphContext) => {
      // NEW SYSTEM: Use simple direct computation for sync operations
      const state = get();
      
      console.log(`[recomputeFromSync] Starting synchronous recomputation for ${nodeId} in ${context.type} context`);
      
      // For sync operations during import, bypass the cooker and compute directly
      const nodeRuntime = context.type === "root" 
        ? state.rootNodeRuntime 
        : state.subFlows[context.geoNodeId!]?.nodeRuntime;
        
      if (!nodeRuntime || !nodeRuntime[nodeId]) {
        console.error(`[recomputeFromSync] Node ${nodeId} not found in context`);
        return;
      }
      
      const node = nodeRuntime[nodeId];
      if (!node.isDirty) {
        console.debug(`[recomputeFromSync] Node ${nodeId} is not dirty, skipping`);
        return;
      }
      
      const nodeDef = nodeRegistry[node.type];
      if (!nodeDef) {
        console.error(`[recomputeFromSync] Node definition not found for type ${node.type}`);
        return;
      }
      
      // Get inputs using new connection system
      const inputConnections = state.connectionManager.getInputConnections(nodeId);
      const inputs: Record<string, any> = {};
      
      for (const connection of inputConnections) {
        const sourceNode = nodeRuntime[connection.sourceNodeId];
        if (sourceNode && sourceNode.output !== undefined) {
          const inputHandle = connection.targetHandle || connection.sourceNodeId;
          inputs[inputHandle] = sourceNode.output;
        }
      }
      
      try {
        const result = computeEngine.evaluateNode(nodeId, node.params, inputs, nodeDef.compute);
        
        // Apply result directly
        set((state) => {
          const targetRuntime = context.type === "root"
            ? state.rootNodeRuntime[nodeId]
            : state.subFlows[context.geoNodeId!]?.nodeRuntime[nodeId];
            
          if (targetRuntime) {
            targetRuntime.output = result;
            targetRuntime.isDirty = false;
            targetRuntime.error = undefined;
          }
        });
        
        console.log(`[recomputeFromSync] Successfully computed node ${nodeId}`);
        
      } catch (err) {
        set((state) => {
          const targetRuntime = context.type === "root"
            ? state.rootNodeRuntime[nodeId]
            : state.subFlows[context.geoNodeId!]?.nodeRuntime[nodeId];
            
          if (targetRuntime) {
            targetRuntime.error = err instanceof Error ? err.message : String(err);
            targetRuntime.isDirty = false;
          }
        });
        
        console.error(`[recomputeFromSync] Error computing node ${nodeId}:`, err);
      }
    },

    exportGraph: async (nodePositions?: Record<string, { x: number; y: number }>) => {
      const state = get();
      
      // Convert rootNodeRuntime to NodeInitData format
      const nodes: NodeInitData[] = Object.entries(state.rootNodeRuntime).map(([id, runtime]) => ({
        id,
        type: runtime.type,
        params: runtime.params,
      }));
      
      // Convert ConnectionManager connections to EdgeData format
      const edges: EdgeData[] = [];
      const rootNodeIds = Object.keys(state.rootNodeRuntime);
      
      for (const nodeId of rootNodeIds) {
        const connections = state.connectionManager.getOutputConnections(nodeId);
        
        for (const connection of connections) {
          // Only include connections between root context nodes
          if (rootNodeIds.includes(connection.targetNodeId)) {
            edges.push({
              id: connection.id,
              source: connection.sourceNodeId,
              target: connection.targetNodeId,
              sourceHandle: connection.sourceHandle,
              targetHandle: connection.targetHandle,
            });
          }
        }
      }
      
      // Extract node runtime data (excluding output, isDirty, error for serialization)
      const nodeRuntime: Record<string, Omit<NodeRuntime, "output" | "isDirty" | "error">> = {};
      Object.entries(state.rootNodeRuntime).forEach(([id, runtime]) => {
        nodeRuntime[id] = {
          type: runtime.type,
          params: runtime.params,
          inputs: runtime.inputs,
        };
      });
      
      // Serialize subflows
      const subFlows: Record<string, SerializedSubFlow> = {};
      Object.entries(state.subFlows).forEach(([geoNodeId, subFlow]) => {
        // Convert subflow nodeRuntime to NodeInitData format
        const subFlowNodes: NodeInitData[] = Object.entries(subFlow.nodeRuntime).map(([id, runtime]) => ({
          id,
          type: runtime.type,
          params: runtime.params,
        }));
        
        // Convert subflow connections to EdgeData format
        const subFlowEdges: EdgeData[] = [];
        const subFlowNodeIds = Object.keys(subFlow.nodeRuntime);
        
        for (const nodeId of subFlowNodeIds) {
          const connections = state.connectionManager.getOutputConnections(nodeId);
          
          for (const connection of connections) {
            // Only include connections between subflow nodes
            if (subFlowNodeIds.includes(connection.targetNodeId)) {
              subFlowEdges.push({
                id: connection.id,
                source: connection.sourceNodeId,
                target: connection.targetNodeId,
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
              });
            }
          }
        }
        
        // Extract subflow node runtime data
        const subFlowNodeRuntime: Record<string, Omit<NodeRuntime, "output" | "isDirty" | "error">> = {};
        Object.entries(subFlow.nodeRuntime).forEach(([id, runtime]) => {
          subFlowNodeRuntime[id] = {
            type: runtime.type,
            params: runtime.params,
            inputs: runtime.inputs,
          };
        });
        
        // Get subflow node positions - for now, leave empty as positions will be
        // captured by the export caller through events and passed to this function
        const subFlowPositions: Record<string, { x: number; y: number }> = {};
        
        subFlows[geoNodeId] = {
          nodes: subFlowNodes,
          edges: subFlowEdges,
          nodeRuntime: subFlowNodeRuntime,
          positions: subFlowPositions,
          activeOutputNodeId: subFlow.activeOutputNodeId,
        };
      });
      
      return {
        nodes,
        edges,
        nodeRuntime,
        positions: nodePositions || {},
        subFlows,
      };
    },

    setSubFlowActiveOutput: (geoNodeId: string, nodeId: string) => {
      set((state) => {
        const subFlow = state.subFlows[geoNodeId];
        if (subFlow) {
          subFlow.activeOutputNodeId = nodeId;
          console.log(`[setSubFlowActiveOutput] Set active output: geoNode=${geoNodeId}, outputNode=${nodeId}`);
        }
      });
    },
  }))
);

export const useNodeOutputs = () =>
  useGraphStore((state) => {
    const outputs: Record<string, any> = {};

    // TODO: Update for context-aware output retrieval in Phase 2
    for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {
      outputs[nodeId] = runtime.output;
    }

    return outputs;
  });

export const useNodes = () => {
  const rootNodeRuntime = useGraphStore((state) => state.rootNodeRuntime);

  // Use useMemo to prevent creating new objects unless nodeRuntime actually changes
  // TODO: Update for context-aware node retrieval in Phase 2
  return React.useMemo(() => {
    return Object.entries(rootNodeRuntime)
      .map(([id, runtime]) => ({
        id,
        type: runtime.type,
        data: runtime.params,
        position: { x: 0, y: 0 },
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [rootNodeRuntime]);
};

export const useEdges = () => {
  const connectionManager = useGraphStore((state) => state.connectionManager);
  const rootNodeRuntime = useGraphStore((state) => state.rootNodeRuntime);

  return React.useMemo(() => {
    const edges: EdgeData[] = [];

    // Get all connections from connection manager for root context nodes
    const rootNodeIds = Object.keys(rootNodeRuntime);
    
    for (const nodeId of rootNodeIds) {
      const connections = connectionManager.getOutputConnections(nodeId);
      
      for (const connection of connections) {
        // Only include connections between nodes in root context
        if (rootNodeIds.includes(connection.targetNodeId)) {
          edges.push({
            id: connection.id,
            source: connection.sourceNodeId,
            target: connection.targetNodeId,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
          });
        }
      }
    }

    return edges.sort((a, b) => a.id.localeCompare(b.id));
  }, [connectionManager, rootNodeRuntime]);
};

export const useRenderableNodes = () => {
  const rootNodeRuntime = useGraphStore((state) => state.rootNodeRuntime);

  // TODO: Update for context-aware rendering in Phase 4
  return React.useMemo(() => {
    return Object.entries(rootNodeRuntime)
      .filter(([_, runtime]) => runtime.output && !runtime.error)
      .map(([id, runtime]) => ({
        id,
        output: runtime.output,
      }));
  }, [rootNodeRuntime]);
};

export const useRenderableObjects = () => {
  const { rootNodeRuntime, subFlows } = useGraphStore((state) => ({
    rootNodeRuntime: state.rootNodeRuntime,
    subFlows: state.subFlows,
  }));

  return React.useMemo(() => {
    const result: any[] = [];

    // Process root-level nodes
    for (const [nodeId, runtime] of Object.entries(rootNodeRuntime)) {
      // Skip nodes with errors or dirty state
      if (runtime.isDirty || runtime.error) continue;

      if (runtime.type === "geoNode") {
        // Handle GeoNode: compute sub-flow and apply transforms
        const geoNodeVisible = runtime.params?.rendering?.visible !== false;
        if (!geoNodeVisible) continue;

        const subFlow = subFlows[nodeId];
        if (!subFlow || !subFlow.activeOutputNodeId) continue;

        // Get the active output node from sub-flow
        const outputNodeRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
        if (
          !outputNodeRuntime ||
          outputNodeRuntime.isDirty ||
          outputNodeRuntime.error ||
          !outputNodeRuntime.output
        )
          continue;

        // Check if the output node is marked as visible (render flag)
        const outputNodeVisible = outputNodeRuntime.params?.rendering?.visible === true;
        if (!outputNodeVisible) continue;

        const subFlowOutput = outputNodeRuntime.output;
        if (subFlowOutput && typeof subFlowOutput === "object" && "isObject3D" in subFlowOutput) {
          // Clone the object to avoid modifying the original
          const clonedOutput = subFlowOutput.clone();

          // Apply GeoNode transforms
          const transform = runtime.params?.transform;
          if (transform) {
            if (transform.position) {
              clonedOutput.position.set(
                transform.position.x || 0,
                transform.position.y || 0,
                transform.position.z || 0
              );
            }
            if (transform.rotation) {
              clonedOutput.rotation.set(
                transform.rotation.x || 0,
                transform.rotation.y || 0,
                transform.rotation.z || 0
              );
            }
            if (transform.scale) {
              // scaleFactor is at the transform level, not nested in scale
              const scaleFactor = transform.scaleFactor || 1;
              clonedOutput.scale.set(
                (transform.scale.x || 1) * scaleFactor,
                (transform.scale.y || 1) * scaleFactor,
                (transform.scale.z || 1) * scaleFactor
              );
            }
          }

          // Apply GeoNode rendering properties (color, shadows)
          const rendering = runtime.params?.rendering;
          if (rendering) {
            // Apply color to all mesh materials in the object hierarchy
            clonedOutput.traverse((child: any) => {
              if (child.isMesh && child.material) {
                if (rendering.color && child.material.color) {
                  child.material.color.setStyle(rendering.color);
                }
                // Apply shadow properties
                child.castShadow = rendering.castShadow ?? false;
                child.receiveShadow = rendering.receiveShadow ?? false;
              }
            });
          }

          result.push(clonedOutput);
        }
      } else {
        // Handle regular root-level nodes (like lights)
        const renderingVisible = runtime.params?.rendering?.visible !== false;
        if (!renderingVisible) continue;

        const output = runtime.output;
        if (output && typeof output === "object" && "isObject3D" in output) {
          result.push(output);
        }
      }
    }

    return result;
  }, [rootNodeRuntime, subFlows]);
};

export const useDirtyNodes = () =>
  useGraphStore((state) =>
    // TODO: Update for context-aware dirty node tracking in Phase 2
    Object.entries(state.rootNodeRuntime)
      .filter(([_, runtime]) => runtime.isDirty)
      .map(([id, runtime]) => ({ id, ...runtime }))
  );

export const useErroredNodes = () =>
  useGraphStore((state) =>
    // TODO: Update for context-aware error tracking in Phase 2
    Object.entries(state.rootNodeRuntime)
      .filter(([_, runtime]) => runtime.error)
      .map(([id, runtime]) => ({ id, ...runtime }))
  );

export const useCleanNodes = () =>
  useGraphStore((state) =>
    // TODO: Update for context-aware clean node tracking in Phase 2
    Object.entries(state.rootNodeRuntime)
      .filter(([_, runtime]) => !runtime.isDirty && !runtime.error)
      .map(([id, runtime]) => ({ id, ...runtime }))
  );

export async function exportGraphWithMeta() {
  // Capture React Flow viewport data
  let viewport = { x: 0, y: 0, zoom: 1 };
  try {
    const event = new CustomEvent("minimystx:getViewport");
    window.dispatchEvent(event);
    const eventData = event as unknown as { viewportData?: typeof viewport };
    if (eventData.viewportData) {
      viewport = eventData.viewportData;
    }
  } catch (e) {
    // Fallback viewport
  }

  // Capture React Flow node positions
  let nodePositions: Record<string, { x: number; y: number }> = {};
  try {
    const event = new CustomEvent("minimystx:getNodePositions");
    window.dispatchEvent(event);
    const eventData = event as unknown as { nodePositions?: typeof nodePositions };
    if (eventData.nodePositions) {
      nodePositions = eventData.nodePositions;
    }
  } catch (e) {
    // Fallback positions - will be empty
  }

  // Capture Three.js camera data
  let camera = { position: [5, 2, 5], target: [0, 0, 0] };
  try {
    const event = new CustomEvent("minimystx:getCameraData");
    window.dispatchEvent(event);
    const eventData = event as unknown as { cameraData?: typeof camera };
    if (eventData.cameraData) {
      camera = eventData.cameraData;
    }
  } catch (e) {
    // Fallback camera
  }

  const graph = await useGraphStore.getState().exportGraph(nodePositions);

  return {
    schema: GRAPH_SCHEMA,
    created: Date.now(),
    graph,
    viewport,
    camera,
  };
}

export function importGraphWithMeta(json: unknown) {
  const data = json as { schema?: number; graph?: unknown; viewport?: unknown; camera?: unknown };

  if (data.schema !== GRAPH_SCHEMA) {
    throw new Error(`Unsupported schema ${data.schema}`);
  }

  const state = useGraphStore.getState();
  const graph = data.graph as SerializedGraph;

  state.importGraph(graph);

  // Trigger React Flow graph rebuild with saved positions
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("minimystx:rebuildFlowGraph", {
        detail: { positions: graph.positions },
      })
    );
  }, 50);

  // Restore viewport if available (with a small delay to ensure nodes are rendered first)
  if (data.viewport) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("minimystx:setViewport", { detail: data.viewport }));
    }, 300);
  }

  // Restore camera if available
  if (data.camera) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("minimystx:setCameraData", { detail: data.camera }));
    }, 200);
  }
}
