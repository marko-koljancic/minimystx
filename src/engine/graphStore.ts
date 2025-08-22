import React from "react";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import * as computeEngine from "./computeEngine";
import { nodeRegistry } from "./nodeRegistry";
import { GRAPH_SCHEMA } from "../constants";
import { extractDefaultValues, validateAndNormalizeParams } from "./parameterUtils";

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
};

export type SubFlowGraph = {
  nodeRuntime: Record<string, NodeRuntime>;
  dependencyMap: Record<string, string[]>;
  reverseDeps: Record<string, string[]>;
  activeOutputNodeId: string | null;
};

export type GraphState = {
  rootNodeRuntime: Record<string, NodeRuntime>;
  rootDependencyMap: Record<string, string[]>;
  rootReverseDeps: Record<string, string[]>;
  subFlows: Record<string, SubFlowGraph>;
  evaluationMode: "eager" | "lazy";

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
  importGraph: (serialized: SerializedGraph) => void;
  exportGraph: (
    nodePositions?: Record<string, { x: number; y: number }>
  ) => Promise<SerializedGraph>;
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

export const useGraphStore = create<GraphState>()(
  immer((set, get) => ({
    rootNodeRuntime: {},
    rootDependencyMap: {},
    rootReverseDeps: {},
    subFlows: {},
    evaluationMode: "eager",

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

        if (context.type === "root") {
          state.rootNodeRuntime[id] = newNodeRuntime;
          state.rootDependencyMap[id] = [];
          state.rootReverseDeps[id] = [];

          // Initialize sub-flow for GeoNode
          if (type === "geoNode") {
            state.subFlows[id] = {
              nodeRuntime: {},
              dependencyMap: {},
              reverseDeps: {},
              activeOutputNodeId: null,
            };
          }
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          subFlow.nodeRuntime[id] = newNodeRuntime;
          subFlow.dependencyMap[id] = [];
          subFlow.reverseDeps[id] = [];
        }
      });

      if (get().evaluationMode === "eager") {
        get().recomputeFrom(id, context);
      }
    },

    removeNode: (nodeId: string, context: GraphContext) => {
      set((state) => {
        if (context.type === "root") {
          const outgoingDeps = state.rootDependencyMap[nodeId] || [];
          const incomingDeps = state.rootReverseDeps[nodeId] || [];

          for (const targetId of outgoingDeps) {
            state.rootReverseDeps[targetId] = state.rootReverseDeps[targetId].filter(
              (id) => id !== nodeId
            );
          }

          for (const sourceId of incomingDeps) {
            state.rootDependencyMap[sourceId] = state.rootDependencyMap[sourceId].filter(
              (id) => id !== nodeId
            );
          }

          // If removing GeoNode, delete its entire sub-flow
          if (state.rootNodeRuntime[nodeId]?.type === "geoNode") {
            delete state.subFlows[nodeId];
          }

          delete state.rootNodeRuntime[nodeId];
          delete state.rootDependencyMap[nodeId];
          delete state.rootReverseDeps[nodeId];
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          if (!subFlow) return;

          const outgoingDeps = subFlow.dependencyMap[nodeId] || [];
          const incomingDeps = subFlow.reverseDeps[nodeId] || [];

          for (const targetId of outgoingDeps) {
            subFlow.reverseDeps[targetId] = subFlow.reverseDeps[targetId].filter(
              (id) => id !== nodeId
            );
          }

          for (const sourceId of incomingDeps) {
            subFlow.dependencyMap[sourceId] = subFlow.dependencyMap[sourceId].filter(
              (id) => id !== nodeId
            );
          }

          // Clear active output if this was the active node
          if (subFlow.activeOutputNodeId === nodeId) {
            subFlow.activeOutputNodeId = null;
          }

          delete subFlow.nodeRuntime[nodeId];
          delete subFlow.dependencyMap[nodeId];
          delete subFlow.reverseDeps[nodeId];
        }
      });

      const state = get();
      const dependencyMap =
        context.type === "root"
          ? state.rootDependencyMap
          : state.subFlows[context.geoNodeId!]?.dependencyMap;
      const nodeRuntime =
        context.type === "root"
          ? state.rootNodeRuntime
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;

      if (dependencyMap && nodeRuntime) {
        for (const sourceId in dependencyMap) {
          if (dependencyMap[sourceId].some((id) => !nodeRuntime[id])) {
            get().markDirty(sourceId, context);
            if (state.evaluationMode === "eager") {
              get().recomputeFrom(sourceId, context);
            }
          }
        }
      }
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
        
        if (context.type === "subflow" && willBeVisible === true && wasVisible !== true) {
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
        // Recompute subflow node first
        get().recomputeFrom(nodeId, context);
        
        // Then recompute parent GeoNode if needed
        if (context.type === "subflow" && context.geoNodeId) {
          const rootContext: GraphContext = { type: "root" };
          get().recomputeFrom(context.geoNodeId, rootContext);
        }
      }
    },

    addEdge: (
      source: string,
      target: string,
      context: GraphContext,
      _sourceHandle?: string,
      _targetHandle?: string
    ): Result => {
      if (source === target) return { ok: false, error: "Self-connections are not allowed" };

      const state = get();
      const nodeRuntime =
        context.type === "root"
          ? state.rootNodeRuntime
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;
      const dependencyMap =
        context.type === "root"
          ? state.rootDependencyMap
          : state.subFlows[context.geoNodeId!]?.dependencyMap;

      if (!nodeRuntime || !dependencyMap) {
        return { ok: false, error: `Context not found` };
      }

      if (!nodeRuntime[source] || !nodeRuntime[target])
        return { ok: false, error: `Node "${source}" or "${target}" not found` };

      if (computeEngine.wouldCreateCycle(source, target, dependencyMap))
        return { ok: false, error: "Connection creates a cycle—edge not added" };

      // ATOMIC OPERATION: All state updates and recomputation in single transaction
      let recomputationQueue: string[] = [];

      set((state) => {
        // Get current edge list for this context
        const currentDependencyMap = context.type === "root"
          ? state.rootDependencyMap
          : state.subFlows[context.geoNodeId!].dependencyMap;

        // Build current edges from dependency map
        const currentEdges: { source: string; target: string }[] = [];
        for (const [sourceId, targets] of Object.entries(currentDependencyMap)) {
          for (const targetId of targets) {
            currentEdges.push({ source: sourceId, target: targetId });
          }
        }

        // Add new edge
        const newEdges = [...currentEdges, { source, target }];

        // Rebuild dependency maps from scratch to ensure consistency
        const { dependencyMap: newDependencyMap, reverseDeps: newReverseDeps } = 
          computeEngine.rebuildDependencyMaps(newEdges);

        // Update state with rebuilt dependency maps
        if (context.type === "root") {
          state.rootDependencyMap = newDependencyMap;
          state.rootReverseDeps = newReverseDeps;
          
          // Mark target node as dirty
          if (state.rootNodeRuntime[target]) {
            state.rootNodeRuntime[target].isDirty = true;
          }
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          subFlow.dependencyMap = newDependencyMap;
          subFlow.reverseDeps = newReverseDeps;
          
          // Mark target node as dirty
          if (subFlow.nodeRuntime[target]) {
            subFlow.nodeRuntime[target].isDirty = true;
          }
        }

        // Queue recomputation if in eager mode
        if (state.evaluationMode === "eager") {
          recomputationQueue = [target];
        }
      });

      // Process recomputation queue outside of state mutation
      for (const nodeId of recomputationQueue) {
        get().recomputeFrom(nodeId, context);
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
      const dependencyMap =
        context.type === "root"
          ? state.rootDependencyMap
          : state.subFlows[context.geoNodeId!]?.dependencyMap;

      if (!nodeRuntime || !dependencyMap) {
        return { ok: false, error: `Context not found` };
      }

      if (!nodeRuntime[source] || !nodeRuntime[target])
        return { ok: false, error: `Node "${source}" or "${target}" not found` };

      if (!dependencyMap[source]?.includes(target))
        return { ok: false, error: `Edge from "${source}" to "${target}" does not exist` };

      // ATOMIC OPERATION: All state updates and recomputation in single transaction
      let recomputationQueue: string[] = [];

      set((state) => {
        // Get current edge list for this context
        const currentDependencyMap = context.type === "root"
          ? state.rootDependencyMap
          : state.subFlows[context.geoNodeId!].dependencyMap;

        // Build current edges from dependency map
        const currentEdges: { source: string; target: string }[] = [];
        for (const [sourceId, targets] of Object.entries(currentDependencyMap)) {
          for (const targetId of targets) {
            currentEdges.push({ source: sourceId, target: targetId });
          }
        }

        // Remove the edge
        const newEdges = currentEdges.filter(edge => !(edge.source === source && edge.target === target));

        // Rebuild dependency maps from scratch to ensure consistency
        const { dependencyMap: newDependencyMap, reverseDeps: newReverseDeps } = 
          computeEngine.rebuildDependencyMaps(newEdges);

        // Update state with rebuilt dependency maps
        if (context.type === "root") {
          state.rootDependencyMap = newDependencyMap;
          state.rootReverseDeps = newReverseDeps;
          
          // Handle input clearing for specific handles
          if (sourceHandle && targetHandle && state.rootNodeRuntime[target]?.inputs[targetHandle]) {
            delete state.rootNodeRuntime[target].inputs[targetHandle];
          } else if (state.rootNodeRuntime[target]) {
            state.rootNodeRuntime[target].isDirty = true;
          }
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          subFlow.dependencyMap = newDependencyMap;
          subFlow.reverseDeps = newReverseDeps;
          
          // Handle input clearing for specific handles
          if (sourceHandle && targetHandle && subFlow.nodeRuntime[target]?.inputs[targetHandle]) {
            delete subFlow.nodeRuntime[target].inputs[targetHandle];
          } else if (subFlow.nodeRuntime[target]) {
            subFlow.nodeRuntime[target].isDirty = true;
          }
        }

        // Queue recomputation if in eager mode
        if (state.evaluationMode === "eager") {
          const targetNodeRuntime = context.type === "root" 
            ? state.rootNodeRuntime 
            : state.subFlows[context.geoNodeId!]?.nodeRuntime;
          
          if (targetNodeRuntime?.[target]) {
            recomputationQueue = [target];
          }
        }
      });

      // Process recomputation queue outside of state mutation
      for (const nodeId of recomputationQueue) {
        get().recomputeFrom(nodeId, context);
      }

      return { ok: true };
    },

    resetEdges: (edges: EdgeData[], context: GraphContext): Result => {
      
      set((state) => {
        if (context.type === "root") {
          for (const nodeId in state.rootDependencyMap) {
            state.rootDependencyMap[nodeId] = [];
          }
          for (const nodeId in state.rootReverseDeps) {
            state.rootReverseDeps[nodeId] = [];
          }
          for (const nodeId in state.rootNodeRuntime) {
            state.rootNodeRuntime[nodeId].isDirty = true;
          }
        } else {
          const subFlow = state.subFlows[context.geoNodeId!];
          if (subFlow) {
            for (const nodeId in subFlow.dependencyMap) {
              subFlow.dependencyMap[nodeId] = [];
            }
            for (const nodeId in subFlow.reverseDeps) {
              subFlow.reverseDeps[nodeId] = [];
            }
            for (const nodeId in subFlow.nodeRuntime) {
              subFlow.nodeRuntime[nodeId].isDirty = true;
            }
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
      const dependencyMap =
        context.type === "root"
          ? state.rootDependencyMap
          : state.subFlows[context.geoNodeId!]?.dependencyMap;
      const nodeRuntime =
        context.type === "root"
          ? state.rootNodeRuntime
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;

      if (!dependencyMap || !nodeRuntime) return;

      const nodesToMark = computeEngine.getDependentsRecursive(nodeId, dependencyMap);

      set((state) => {
        const targetNodeRuntime =
          context.type === "root"
            ? state.rootNodeRuntime
            : state.subFlows[context.geoNodeId!]?.nodeRuntime;
        if (!targetNodeRuntime) return;

        if (targetNodeRuntime[nodeId]) targetNodeRuntime[nodeId].isDirty = true;

        for (const id of nodesToMark) {
          if (targetNodeRuntime[id]) {
            targetNodeRuntime[id].isDirty = true;
          }
        }
      });
    },

    recomputeFrom: (nodeId: string, context: GraphContext) => {
      // BATCHED RECOMPUTATION: Process all dirty nodes in correct topological order
      const batchRecompute = (startNodeId: string) => {
        const state = get();
        const dependencyMap = context.type === "root"
          ? state.rootDependencyMap
          : state.subFlows[context.geoNodeId!]?.dependencyMap;
        const reverseDeps = context.type === "root"
          ? state.rootReverseDeps
          : state.subFlows[context.geoNodeId!]?.reverseDeps;
        const nodeRuntime = context.type === "root"
          ? state.rootNodeRuntime
          : state.subFlows[context.geoNodeId!]?.nodeRuntime;

        if (!dependencyMap || !reverseDeps || !nodeRuntime) {
          console.error(`[recomputeFrom] Missing context data for ${context.type} context`);
          return;
        }

        // Get all nodes that need recomputation: the start node and all its dependents
        const dependents = computeEngine.getDependentsRecursive(startNodeId, dependencyMap);
        const nodesToRecompute = [startNodeId, ...dependents];

        // Get evaluation order for all nodes that need recomputation
        const allEvalOrders: string[] = [];
        for (const id of nodesToRecompute) {
          if (nodeRuntime[id]?.isDirty) {
            const evalOrder = computeEngine.getEvaluationOrder(id, dependencyMap);
            for (const evalId of evalOrder) {
              if (!allEvalOrders.includes(evalId)) {
                allEvalOrders.push(evalId);
              }
            }
          }
        }

        // Process all nodes in a single batch with atomic state updates
        const computationResults: Array<{
          nodeId: string;
          success: boolean;
          output?: any;
          error?: string;
        }> = [];

        // Compute all nodes (outside of state mutations)
        for (const id of allEvalOrders) {
          const node = nodeRuntime[id];
          
          if (!node || !node.isDirty) {
            continue;
          }

          const nodeDef = nodeRegistry[node.type];
          if (!nodeDef) {
            console.error(`[recomputeFrom] Node definition not found for node ${id} type ${node.type}`);
            computationResults.push({ 
              nodeId: id, 
              success: false, 
              error: `Node definition not found for type ${node.type}` 
            });
            continue;
          }

          const inputSources = reverseDeps[id] || [];
          const inputs: Record<string, any> = {};

          // Get fresh node runtime for input gathering
          const currentState = get();
          const currentNodeRuntime = context.type === "root"
            ? currentState.rootNodeRuntime
            : currentState.subFlows[context.geoNodeId!]?.nodeRuntime;

          for (const sourceId of inputSources) {
            const sourceNode = currentNodeRuntime?.[sourceId];
            if (sourceNode && sourceNode.output !== undefined) {
              inputs[sourceId] = sourceNode.output;
            }
          }

          try {
            const result = computeEngine.evaluateNode(id, node.params, inputs, nodeDef.compute);
            computationResults.push({ 
              nodeId: id, 
              success: true, 
              output: result 
            });
          } catch (err) {
            console.error(`[recomputeFrom] Error computing node ${id}:`, err);
            computationResults.push({ 
              nodeId: id, 
              success: false, 
              error: err instanceof Error ? err.message : String(err) 
            });
          }
        }

        // Apply all computation results atomically
        set((state) => {
          const targetNodeRuntime = context.type === "root"
            ? state.rootNodeRuntime
            : state.subFlows[context.geoNodeId!]?.nodeRuntime;

          if (!targetNodeRuntime) return;

          for (const result of computationResults) {
            if (targetNodeRuntime[result.nodeId]) {
              if (result.success) {
                targetNodeRuntime[result.nodeId].output = result.output;
                targetNodeRuntime[result.nodeId].isDirty = false;
                targetNodeRuntime[result.nodeId].error = undefined;
              } else {
                targetNodeRuntime[result.nodeId].error = result.error;
                targetNodeRuntime[result.nodeId].isDirty = false;
              }
            }
          }
        });
      };

      // Execute batched recomputation
      batchRecompute(nodeId);
    },

    clear: () => {
      set({
        rootNodeRuntime: {},
        rootDependencyMap: {},
        rootReverseDeps: {},
        subFlows: {},
      });
    },

    importGraph: (serialized: SerializedGraph) => {
      const { nodes, edges, nodeRuntime, positions, subFlows } = serialized;
      
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
          
          // Add subflow nodes
          subFlow.nodes.forEach(node => {
            get().addNode(node, subFlowContext);
          });
          
          // Add subflow edges
          subFlow.edges.forEach(edge => {
            get().addEdge(edge.source, edge.target, subFlowContext, edge.sourceHandle, edge.targetHandle);
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
              
              // Restore active output node
              targetSubFlow.activeOutputNodeId = subFlow.activeOutputNodeId;
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
      
      // Store positions for React Flow (will be used when UI components query positions)
      // The positions are handled by the UI layer through custom events
      const allPositions = { ...positions };
      
      // Include subflow positions
      if (subFlows) {
        Object.entries(subFlows).forEach(([_, subFlow]) => {
          Object.assign(allPositions, subFlow.positions);
        });
      }
      
      if (allPositions && Object.keys(allPositions).length > 0) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('minimystx:setNodePositions', { 
            detail: allPositions 
          }));
        }, 100);
      }
      
      // Trigger recomputation of the entire graph
      if (get().evaluationMode === "eager") {
        // Recompute root nodes
        nodes.forEach(node => {
          get().recomputeFrom(node.id, rootContext);
        });
        
        // Recompute subflow nodes
        if (subFlows) {
          Object.entries(subFlows).forEach(([geoNodeId, subFlow]) => {
            const subFlowContext: GraphContext = { type: "subflow", geoNodeId };
            subFlow.nodes.forEach(node => {
              get().recomputeFrom(node.id, subFlowContext);
            });
          });
        }
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
      
      // Convert rootDependencyMap to EdgeData format
      const edges: EdgeData[] = [];
      Object.entries(state.rootDependencyMap).forEach(([targetId, sourceIds]) => {
        sourceIds.forEach(sourceId => {
          edges.push({
            id: `${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
          });
        });
      });
      
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
        
        // Convert subflow dependencyMap to EdgeData format
        const subFlowEdges: EdgeData[] = [];
        Object.entries(subFlow.dependencyMap).forEach(([targetId, sourceIds]) => {
          sourceIds.forEach(sourceId => {
            subFlowEdges.push({
              id: `${sourceId}-${targetId}`,
              source: sourceId,
              target: targetId,
            });
          });
        });
        
        // Extract subflow node runtime data
        const subFlowNodeRuntime: Record<string, Omit<NodeRuntime, "output" | "isDirty" | "error">> = {};
        Object.entries(subFlow.nodeRuntime).forEach(([id, runtime]) => {
          subFlowNodeRuntime[id] = {
            type: runtime.type,
            params: runtime.params,
            inputs: runtime.inputs,
          };
        });
        
        // Get subflow node positions (if available)
        const subFlowPositions: Record<string, { x: number; y: number }> = {};
        if (nodePositions) {
          Object.entries(nodePositions).forEach(([nodeId, position]) => {
            if (subFlow.nodeRuntime[nodeId]) {
              subFlowPositions[nodeId] = position;
            }
          });
        }
        
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
  const rootDependencyMap = useGraphStore((state) => state.rootDependencyMap);

  // TODO: Update for context-aware edge retrieval in Phase 2
  return React.useMemo(() => {
    const edges: EdgeData[] = [];

    for (const [sourceId, targets] of Object.entries(rootDependencyMap)) {
      for (const targetId of targets) {
        edges.push({
          id: `${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
        });
      }
    }

    return edges.sort((a, b) => a.id.localeCompare(b.id));
  }, [rootDependencyMap]);
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
