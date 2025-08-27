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


const coreGraph = new CoreGraph();
const connectionManager = new ConnectionManager();
const cooker = new Cooker(coreGraph);

cooker.setComputeFunction(async (nodeId: string) => {
  const state = useGraphStore.getState();
  
  let nodeRuntime: NodeRuntime | undefined;
  let context: GraphContext | undefined;
  
  if (state.rootNodeRuntime[nodeId]) {
    nodeRuntime = state.rootNodeRuntime[nodeId];
    context = { type: "root" };
  } else {
    for (const [geoNodeId, subFlow] of Object.entries(state.subFlows)) {
      if (subFlow.nodeRuntime[nodeId]) {
        nodeRuntime = subFlow.nodeRuntime[nodeId];
        context = { type: "subflow", geoNodeId };
        break;
      }
    }
  }
  
  if (!nodeRuntime || !context) {
    return;
  }
  
  if (!nodeRuntime.isDirty) {
    return;
  }
  
  const nodeDef = nodeRegistry[nodeRuntime.type];
  if (!nodeDef) {
    return;
  }
  
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
    
  }
});

export const useGraphStore = create<GraphState>()(
  immer((set, get) => ({
    rootNodeRuntime: {},
    subFlows: {},
    evaluationMode: "eager",
    isImporting: false,
    
    graph: coreGraph,
    connectionManager: connectionManager,
    cooker: cooker,

    addNode: (node: NodeInitData, context: GraphContext) => {
      const { id, type, params: overrideParams } = node;
      const nodeDef = nodeRegistry[type];
      if (!nodeDef) {
        return;
      }

      if (!nodeDef.allowedContexts.includes(context.type)) {
        return;
      }

      set((state) => {
        const defaultParams = extractDefaultValues(nodeDef.params);

        const mergedParams: Record<string, any> = {};
        for (const [category] of Object.entries(nodeDef.params)) {
          mergedParams[category] = {
            ...defaultParams[category],
            ...(overrideParams?.[category] || {}),
          };
        }

        if (context.type === "subflow" && !Object.prototype.hasOwnProperty.call(overrideParams?.rendering, "visible")) {
          if (mergedParams.rendering) {
            mergedParams.rendering.visible = false;
          }
        }

        const targetRuntime =
          context.type === "root"
            ? state.rootNodeRuntime
            : context.geoNodeId
            ? state.subFlows[context.geoNodeId]?.nodeRuntime
            : undefined;

        if (!targetRuntime && context.type === "subflow") {
          return;
        }

        if (!overrideParams?.general?.name && mergedParams.general?.name) {
          const baseName = nodeDef.displayName;
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
        
        const graphNodeForDirty: GraphNode = { 
          id, 
          isDirty: () => newNodeRuntime.isDirty,
          cook: async () => {
          }
        };
        newNodeRuntime.dirtyController = new DirtyController(
          graphNodeForDirty, 
          get().cooker, 
          (nodeId: string) => get().graph.getAllSuccessors(nodeId)
        );

        if (context.type === "root") {
          state.rootNodeRuntime[id] = newNodeRuntime;

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

        const graphNodeForGraph: GraphNode = { id };
        state.graph.addNode(graphNodeForGraph);
      });

      if (get().evaluationMode === "eager") {
        get().cooker.enqueue(id);
      }
    },

    removeNode: (nodeId: string, context: GraphContext) => {
      set((state) => {
        if (context.type === "root") {
          if (state.rootNodeRuntime[nodeId]?.type === "geoNode") {
            delete state.subFlows[nodeId];
          }

          delete state.rootNodeRuntime[nodeId];
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          if (!subFlow) return;

          if (subFlow.activeOutputNodeId === nodeId) {
            subFlow.activeOutputNodeId = null;
          }

          delete subFlow.nodeRuntime[nodeId];
        }

        state.graph.removeNode(nodeId);
        state.connectionManager.removeAllConnectionsForNode(nodeId);
      });

    },

    setParams: (nodeId: string, params: Partial<Record<string, any>>, context: GraphContext) => {

      set((state) => {
        const targetRuntime =
          context.type === "root"
            ? state.rootNodeRuntime
            : state.subFlows[context.geoNodeId!]?.nodeRuntime;

        if (!targetRuntime?.[nodeId]) {
          return;
        }

        const wasVisible = targetRuntime[nodeId].params.rendering?.visible;
        const willBeVisible = params.rendering?.visible;
        
        if (context.type === "subflow" && willBeVisible === true && wasVisible !== true && !state.isImporting) {
          const subFlow = state.subFlows[context.geoNodeId!];
          Object.keys(subFlow.nodeRuntime).forEach((id) => {
            if (id !== nodeId && subFlow.nodeRuntime[id].params.rendering?.visible) {
              subFlow.nodeRuntime[id].params.rendering.visible = false;
            }
          });
          subFlow.activeOutputNodeId = nodeId;
        }

        const oldParams = targetRuntime[nodeId].params;
        
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

        targetRuntime[nodeId].isDirty = true;

        if (context.type === "subflow" && context.geoNodeId) {
          state.rootNodeRuntime[context.geoNodeId].isDirty = true;
        }
      });

      if (get().evaluationMode === "eager") {
        get().cooker.enqueue(nodeId);
        
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

      if (state.graph.wouldCreateCycle(source, target)) {
        return { ok: false, error: "Connection creates a cycle—edge not added" };
      }

      set((state) => {
        const connection: Connection = {
          id: state.connectionManager.generateConnectionId(),
          sourceNodeId: source,
          targetNodeId: target,
          sourceHandle,
          targetHandle
        };

        state.connectionManager.addConnection(connection);
        
        state.graph.connect(source, target);

        const targetNodeRuntime = context.type === "root"
          ? state.rootNodeRuntime[target]
          : state.subFlows[context.geoNodeId!]?.nodeRuntime[target];
        
        if (targetNodeRuntime) {
          targetNodeRuntime.isDirty = true;
        }
      });

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

      const connections = state.connectionManager.getConnectionsBetweenNodes(source, target);
      if (connections.length === 0) {
        return { ok: false, error: `Edge from "${source}" to "${target}" does not exist` };
      }

      set((state) => {
        const connectionsToRemove = state.connectionManager.getConnectionsBetweenNodes(source, target);
        
        let connectionToRemove = connectionsToRemove[0];
        if (sourceHandle && targetHandle) {
          connectionToRemove = connectionsToRemove.find(conn => 
            conn.sourceHandle === sourceHandle && conn.targetHandle === targetHandle
          ) || connectionsToRemove[0];
        }

        if (connectionToRemove) {
          state.connectionManager.removeConnection(connectionToRemove.id);
          
          const remainingConnections = state.connectionManager.getConnectionsBetweenNodes(source, target);
          if (remainingConnections.length === 0) {
            state.graph.disconnect(source, target);
          }
        }

        const targetNodeRuntime = context.type === "root"
          ? state.rootNodeRuntime[target]
          : state.subFlows[context.geoNodeId!]?.nodeRuntime[target];
        
        if (targetNodeRuntime) {
          if (sourceHandle && targetHandle && targetNodeRuntime.inputs[targetHandle]) {
            delete targetNodeRuntime.inputs[targetHandle];
          }
          
          targetNodeRuntime.isDirty = true;
        }
      });

      if (get().evaluationMode === "eager") {
        get().cooker.enqueue(target);
      }

      return { ok: true };
    },

    resetEdges: (edges: EdgeData[], context: GraphContext): Result => {
      
      set((state) => {
        const nodeRuntime = context.type === "root" 
          ? state.rootNodeRuntime 
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;
        
        if (nodeRuntime) {
          const nodeIds = Object.keys(nodeRuntime);
          
          for (const nodeId of nodeIds) {
            state.connectionManager.removeAllConnectionsForNode(nodeId);
            state.graph.removeNode(nodeId);
            state.graph.addNode({ id: nodeId });
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
      
      const targetNodeRuntime = context.type === "root"
        ? state.rootNodeRuntime
        : state.subFlows[context.geoNodeId!]?.nodeRuntime;
        
      if (!targetNodeRuntime?.[nodeId]) {
        return;
      }
      
      const runtime = targetNodeRuntime[nodeId];
      if (runtime.dirtyController) {
        runtime.dirtyController.setDirty();
      } else {
        const successors = state.graph.getAllSuccessors(nodeId);
        const nodesToMark = [nodeId, ...successors.map(n => n.id)];
        set((_state) => {
          for (const id of nodesToMark) {
            if (targetNodeRuntime[id]) {
              targetNodeRuntime[id].isDirty = true;
            }
          }
        });
      }
    },

    recomputeFrom: (nodeId: string, _context: GraphContext) => {
      const state = get();
      
      if (state.isImporting) {
        return;
      }
      
      state.cooker.enqueue(nodeId, {
        type: 'compute',
        trigger: state.graph.getNode(nodeId)
      });
      
    },

    clear: () => {
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
      
      set((state) => {
        state.isImporting = true;
      });
      
      get().clear();
      
      const rootContext: GraphContext = { type: "root" };
      nodes.forEach(node => {
        get().addNode(node, rootContext);
      });
      
      edges.forEach(edge => {
        get().addEdge(edge.source, edge.target, rootContext, edge.sourceHandle, edge.targetHandle);
      });
      
      if (subFlows) {
        Object.entries(subFlows).forEach(([geoNodeId, subFlow]) => {
          const subFlowContext: GraphContext = { type: "subflow", geoNodeId };
          
          
          subFlow.nodes.forEach(node => {
            get().addNode(node, subFlowContext);
          });
          
          subFlow.edges.forEach(edge => {
            
            const result = get().addEdge(edge.source, edge.target, subFlowContext, edge.sourceHandle, edge.targetHandle);
            if (!result.ok) {
            } else {
            }
          });
          
          set((state) => {
            const targetSubFlow = state.subFlows[geoNodeId];
            if (targetSubFlow) {
              Object.entries(subFlow.nodeRuntime).forEach(([nodeId, runtime]) => {
                if (targetSubFlow.nodeRuntime[nodeId]) {
                  targetSubFlow.nodeRuntime[nodeId].inputs = runtime.inputs;
                }
              });
              
              targetSubFlow.activeOutputNodeId = subFlow.activeOutputNodeId;
              
            }
          });
        });
      }
      
      set((state) => {
        Object.entries(nodeRuntime).forEach(([nodeId, runtime]) => {
          if (state.rootNodeRuntime[nodeId]) {
            state.rootNodeRuntime[nodeId].inputs = runtime.inputs;
          }
        });
      });
      
      (async () => {
        try {
          const { useUIStore } = await import("../store/uiStore");
          const { saveNodePositions } = useUIStore.getState();
          
          if (positions && Object.keys(positions).length > 0) {
            saveNodePositions("root", positions);
          }
          
          if (subFlows) {
            Object.entries(subFlows).forEach(([geoNodeId, subFlow]) => {
              if (subFlow.positions && Object.keys(subFlow.positions).length > 0) {
                const contextKey = `subflow-${geoNodeId}`;
                saveNodePositions(contextKey, subFlow.positions);
              }
            });
          }
        } catch (error) {
        }
      })();
      

      set((state) => {
        state.isImporting = false;
      });
      
      if (get().evaluationMode === "eager") {
        
        await get().preloadImportObjAssets();
        
        get().markAllNodesAsDirty();
        
        get().clearRecomputationTracking();
        
        if (subFlows) {
          
          for (const [geoNodeId, subFlow] of Object.entries(subFlows)) {
            const subFlowContext: GraphContext = { type: "subflow", geoNodeId };
            
            for (const node of subFlow.nodes) {
              await get().recomputeFromSync(node.id, subFlowContext);
            }
          }
        }
        
        for (const node of nodes) {
          await get().recomputeFromSync(node.id, rootContext);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await get().validatePostImportComputation();
        
      }
      
      const allNodeIds = [
        ...nodes.map(n => n.id),
        ...Object.values(subFlows || {}).flatMap(sf => sf.nodes.map(n => n.id))
      ];
      const allContexts = [
        { type: "root" as const },
        ...Object.keys(subFlows || {}).map(geoNodeId => ({ type: "subflow" as const, geoNodeId }))
      ];
      get().forceResetImportedNodeTracking(allNodeIds, allContexts);
      
    },

    preloadImportObjAssets: async () => {
      const state = get();
      
      
      for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {
        if (runtime.type === 'importObjNode') {
          await get().preloadAssetForNode(nodeId, runtime, { type: 'root' });
        }
      }
      
      for (const [geoNodeId, subFlow] of Object.entries(state.subFlows)) {
        for (const [nodeId, runtime] of Object.entries(subFlow.nodeRuntime)) {
          if (runtime.type === 'importObjNode') {
            await get().preloadAssetForNode(nodeId, runtime, { type: 'subflow', geoNodeId });
          }
        }
      }
      
    },

    preloadAssetForNode: async (nodeId: string, runtime: NodeRuntime, context: GraphContext) => {
      if (runtime.type !== 'importObjNode' || !runtime.params?.object) return;
      
      const objectParams = runtime.params.object as any;
      if (!objectParams?.assetHash || objectParams?.file) return;
      
      try {
        
        const { getAssetCache } = await import('../io/mxscene/opfs-cache');
        const assetCache = getAssetCache();
        const assetData = await assetCache.get(objectParams.assetHash);
        
        if (!assetData) {
          return;
        }
        
        const decoder = new TextDecoder();
        const content = decoder.decode(assetData);
        const encodedContent = btoa(content);
        
        const serializableFile = {
          name: `restored-${objectParams.assetHash.slice(0, 8)}.obj`,
          size: assetData.byteLength,
          lastModified: Date.now(),
          content: encodedContent,
        };
        
        set((state) => {
          const targetRuntime = context.type === 'root' 
            ? state.rootNodeRuntime[nodeId]
            : state.subFlows[context.geoNodeId!]?.nodeRuntime[nodeId];
            
          if (targetRuntime && targetRuntime.params?.object) {
            const objParams = targetRuntime.params.object as any;
            objParams.file = serializableFile;
            targetRuntime.isDirty = true;
            
          }
        });
      } catch (error) {
      }
    },

    markAllNodesAsDirty: () => {
      
      set((state) => {
        for (const runtime of Object.values(state.rootNodeRuntime)) {
          runtime.isDirty = true;
          runtime.output = null; // Clear cached output
        }
        
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
      
      let hasIssues = false;
      
      for (const [, runtime] of Object.entries(state.rootNodeRuntime)) {
        if (runtime.isDirty) {
          hasIssues = true;
        } else if (!runtime.output && runtime.type !== 'noteNode') {
          hasIssues = true;
        } else if (runtime.error) {
          hasIssues = true;
        } else {
        }
      }
      
      for (const [, subFlow] of Object.entries(state.subFlows)) {
        for (const [, runtime] of Object.entries(subFlow.nodeRuntime)) {
          if (runtime.isDirty) {
            hasIssues = true;
          } else if (!runtime.output && runtime.type !== 'noteNode') {
            hasIssues = true;
          } else if (runtime.error) {
            hasIssues = true;
          } else {
          }
        }
        
        if (subFlow.activeOutputNodeId) {
          const outputRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
          if (!outputRuntime?.output) {
            hasIssues = true;
          }
        }
      }
      
      if (hasIssues) {
      } else {
      }
    },

    clearRecomputationTracking: () => {
      const state = get();
      state.cooker.clear();
    },

    forceResetImportedNodeTracking: (_nodeIds: string[], _contexts: GraphContext[]) => {
      const state = get();
      state.cooker.clear();
    },

    recomputeFromSync: async (nodeId: string, context: GraphContext) => {
      const state = get();
      
      
      const nodeRuntime = context.type === "root" 
        ? state.rootNodeRuntime 
        : state.subFlows[context.geoNodeId!]?.nodeRuntime;
        
      if (!nodeRuntime || !nodeRuntime[nodeId]) {
        return;
      }
      
      const node = nodeRuntime[nodeId];
      if (!node.isDirty) {
        return;
      }
      
      const nodeDef = nodeRegistry[node.type];
      if (!nodeDef) {
        return;
      }
      
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
        
      }
    },

    exportGraph: async (nodePositions?: Record<string, { x: number; y: number }>) => {
      const state = get();
      
      const nodes: NodeInitData[] = Object.entries(state.rootNodeRuntime).map(([id, runtime]) => ({
        id,
        type: runtime.type,
        params: runtime.params,
      }));
      
      const edges: EdgeData[] = [];
      const rootNodeIds = Object.keys(state.rootNodeRuntime);
      
      for (const nodeId of rootNodeIds) {
        const connections = state.connectionManager.getOutputConnections(nodeId);
        
        for (const connection of connections) {
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
      
      const nodeRuntime: Record<string, Omit<NodeRuntime, "output" | "isDirty" | "error">> = {};
      Object.entries(state.rootNodeRuntime).forEach(([id, runtime]) => {
        nodeRuntime[id] = {
          type: runtime.type,
          params: runtime.params,
          inputs: runtime.inputs,
        };
      });
      
      const subFlows: Record<string, SerializedSubFlow> = {};
      Object.entries(state.subFlows).forEach(([geoNodeId, subFlow]) => {
        const subFlowNodes: NodeInitData[] = Object.entries(subFlow.nodeRuntime).map(([id, runtime]) => ({
          id,
          type: runtime.type,
          params: runtime.params,
        }));
        
        const subFlowEdges: EdgeData[] = [];
        const subFlowNodeIds = Object.keys(subFlow.nodeRuntime);
        
        for (const nodeId of subFlowNodeIds) {
          const connections = state.connectionManager.getOutputConnections(nodeId);
          
          for (const connection of connections) {
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
        
        const subFlowNodeRuntime: Record<string, Omit<NodeRuntime, "output" | "isDirty" | "error">> = {};
        Object.entries(subFlow.nodeRuntime).forEach(([id, runtime]) => {
          subFlowNodeRuntime[id] = {
            type: runtime.type,
            params: runtime.params,
            inputs: runtime.inputs,
          };
        });
        
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
        }
      });
    },
  }))
);

export const useNodeOutputs = () =>
  useGraphStore((state) => {
    const outputs: Record<string, any> = {};

    for (const [nodeId, runtime] of Object.entries(state.rootNodeRuntime)) {
      outputs[nodeId] = runtime.output;
    }

    return outputs;
  });

export const useNodes = () => {
  const rootNodeRuntime = useGraphStore((state) => state.rootNodeRuntime);

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

    const rootNodeIds = Object.keys(rootNodeRuntime);
    
    for (const nodeId of rootNodeIds) {
      const connections = connectionManager.getOutputConnections(nodeId);
      
      for (const connection of connections) {
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

    for (const [nodeId, runtime] of Object.entries(rootNodeRuntime)) {
      if (runtime.isDirty || runtime.error) continue;

      if (runtime.type === "geoNode") {
        const geoNodeVisible = runtime.params?.rendering?.visible !== false;
        if (!geoNodeVisible) continue;

        const subFlow = subFlows[nodeId];
        if (!subFlow || !subFlow.activeOutputNodeId) continue;

        const outputNodeRuntime = subFlow.nodeRuntime[subFlow.activeOutputNodeId];
        if (
          !outputNodeRuntime ||
          outputNodeRuntime.isDirty ||
          outputNodeRuntime.error ||
          !outputNodeRuntime.output
        )
          continue;

        const outputNodeVisible = outputNodeRuntime.params?.rendering?.visible === true;
        if (!outputNodeVisible) continue;

        const subFlowOutput = outputNodeRuntime.output;
        if (subFlowOutput && typeof subFlowOutput === "object" && "isObject3D" in subFlowOutput) {
          const clonedOutput = subFlowOutput.clone();

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
              const scaleFactor = transform.scaleFactor || 1;
              clonedOutput.scale.set(
                (transform.scale.x || 1) * scaleFactor,
                (transform.scale.y || 1) * scaleFactor,
                (transform.scale.z || 1) * scaleFactor
              );
            }
          }

          const rendering = runtime.params?.rendering;
          if (rendering) {
            clonedOutput.traverse((child: any) => {
              if (child.isMesh && child.material) {
                if (rendering.color && child.material.color) {
                  child.material.color.setStyle(rendering.color);
                }
                child.castShadow = rendering.castShadow ?? false;
                child.receiveShadow = rendering.receiveShadow ?? false;
              }
            });
          }

          result.push(clonedOutput);
        }
      } else {
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
    Object.entries(state.rootNodeRuntime)
      .filter(([_, runtime]) => runtime.isDirty)
      .map(([id, runtime]) => ({ id, ...runtime }))
  );

export const useErroredNodes = () =>
  useGraphStore((state) =>
    Object.entries(state.rootNodeRuntime)
      .filter(([_, runtime]) => runtime.error)
      .map(([id, runtime]) => ({ id, ...runtime }))
  );

export const useCleanNodes = () =>
  useGraphStore((state) =>
    Object.entries(state.rootNodeRuntime)
      .filter(([_, runtime]) => !runtime.isDirty && !runtime.error)
      .map(([id, runtime]) => ({ id, ...runtime }))
  );

export async function exportGraphWithMeta() {
  let viewport = { x: 0, y: 0, zoom: 1 };
  try {
    const event = new CustomEvent("minimystx:getViewport");
    window.dispatchEvent(event);
    const eventData = event as unknown as { viewportData?: typeof viewport };
    if (eventData.viewportData) {
      viewport = eventData.viewportData;
    }
  } catch (e) {
  }

  let nodePositions: Record<string, { x: number; y: number }> = {};
  try {
    const event = new CustomEvent("minimystx:getNodePositions");
    window.dispatchEvent(event);
    const eventData = event as unknown as { nodePositions?: typeof nodePositions };
    if (eventData.nodePositions) {
      nodePositions = eventData.nodePositions;
    }
  } catch (e) {
  }

  let camera = { position: [5, 2, 5], target: [0, 0, 0] };
  try {
    const event = new CustomEvent("minimystx:getCameraData");
    window.dispatchEvent(event);
    const eventData = event as unknown as { cameraData?: typeof camera };
    if (eventData.cameraData) {
      camera = eventData.cameraData;
    }
  } catch (e) {
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

  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("minimystx:rebuildFlowGraph", {
        detail: { positions: graph.positions },
      })
    );
  }, 50);

  if (data.viewport) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("minimystx:setViewport", { detail: data.viewport }));
    }, 300);
  }

  if (data.camera) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("minimystx:setCameraData", { detail: data.camera }));
    }, 200);
  }
}
