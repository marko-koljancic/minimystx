import {
  ConnectionMode,
  ReactFlow,
  useNodesState,
  useEdgesState,
  ReactFlowInstance,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import styles from "./FlowCanvas.module.css";
import { useEdgeManagement, useKeyboardShortcuts } from "../hooks";
import { useFlowGraphSync } from "../hooks/useFlowGraphSync";
import { useAutoLayout } from "../hooks/useAutoLayout";
import { useGraphStore } from "../engine/graphStore";
import { useContextNodes, useContextEdges } from "../hooks/useContextNodes";
import {
  useUIStore,
  useTogglePalette,
  useSetPalettePosition,
  useSetKeyboardNavigationMode,
  useResetPaletteNavigation,
  useCurrentContext,
  useNavigateToSubFlow,
  useSaveViewportState,
  useGetViewportState,
  useSaveNodePositions,
  useGetNodePositions,
  getContextKey,
  useGetFlowViewMode,
} from "../store";
import { Breadcrumb } from "./Breadcrumb";
import ConnectionLine from "./edges/ConnectionLine";
import { FlowBackground } from "./FlowBackground";
import { FlowControls } from "./FlowControls";
import FlowViewToggle from "./FlowViewToggle";
import FlowListView from "./FlowListView";
import { useCallback, useEffect, useRef, useState } from "react";
import { edgeTypes, initialEdges, initialNodes, nodeTypes } from "../constants";
import { v4 as uuid } from "uuid";
export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);
  const [currentLayoutAlgorithm, setCurrentLayoutAlgorithm] = useState<"dagre" | "elk">("dagre");
  const { syncNodeChanges, syncEdgeChanges } = useFlowGraphSync();
  const { setSelectedNode, setSelectedNodes: setUISelectedNodes, clearSelection } = useUIStore();
  const currentContext = useCurrentContext();
  const getFlowViewMode = useGetFlowViewMode();
  const contextKey = getContextKey(currentContext);
  const currentViewMode = getFlowViewMode(contextKey);
  const { applyDagre, applyELK, applyDagreToSelection, applyELKToSelection } = useAutoLayout();
  const { onConnect, onReconnect, handleIsValidConnection } = useEdgeManagement(
    setEdges,
    nodes,
    edges
  );
  const handleAutoLayoutCycle = useCallback(
    (forceAllNodes = false) => {
      const selectedNodeIds = selectedNodes.map((node) => node.id);
      const hasSelection = selectedNodeIds.length > 0;
      const shouldUseSelection = hasSelection && !forceAllNodes;
      const algorithmToUse = currentLayoutAlgorithm;
      const nextAlgorithm = currentLayoutAlgorithm === "dagre" ? "elk" : "dagre";
      setCurrentLayoutAlgorithm(nextAlgorithm);
      if (shouldUseSelection) {
        if (algorithmToUse === "dagre") {
          applyDagreToSelection(selectedNodeIds);
        } else {
          applyELKToSelection(selectedNodeIds);
        }
      } else {
        if (algorithmToUse === "dagre") {
          applyDagre();
        } else {
          applyELK();
        }
      }
    },
    [
      selectedNodes,
      currentLayoutAlgorithm,
      applyDagre,
      applyELK,
      applyDagreToSelection,
      applyELKToSelection,
    ]
  );
  const handleDeleteSelectedEdges = useCallback(() => {
    if (selectedEdges.length === 0) return;
    const { removeEdge } = useGraphStore.getState();
    selectedEdges.forEach((edge) => {
      const result = removeEdge(
        edge.source,
        edge.target,
        currentContext,
        edge.sourceHandle || undefined,
        edge.targetHandle || undefined
      );
      if (!result.ok) {
        return;
      }
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    });
    setSelectedEdges([]);
  }, [selectedEdges, setEdges, currentContext]);
  const { containerRef } = useKeyboardShortcuts({
    context: "flow",
    onDeleteSelectedEdges: handleDeleteSelectedEdges,
    onAutoLayoutCycle: handleAutoLayoutCycle,
  });
  const navigateToSubFlow = useNavigateToSubFlow();
  const saveViewportState = useSaveViewportState();
  const getViewportState = useGetViewportState();
  const saveNodePositions = useSaveNodePositions();
  const getNodePositions = useGetNodePositions();
  const contextNodes = useContextNodes();
  const contextEdges = useContextEdges();
  const prevContextRef = useRef(currentContext);
  const reactFlowRef = useRef<HTMLDivElement>(null);
  const togglePalette = useTogglePalette();
  const setPalettePosition = useSetPalettePosition();
  const setKeyboardNavigationMode = useSetKeyboardNavigationMode();
  const resetPaletteNavigation = useResetPaletteNavigation();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<any, any> | null>(
    null
  );
  const getVisibleCenter = useCallback(() => {
    if (!reactFlowInstance) return { x: 0, y: 0 };
    const viewport = reactFlowInstance.getViewport();
    const reactFlowElement = reactFlowRef.current;
    if (!reactFlowElement) return { x: 0, y: 0 };
    const rect = reactFlowElement.getBoundingClientRect();
    const visibleCenterX = -viewport.x + rect.width / 2 / viewport.zoom;
    const visibleCenterY = -viewport.y + rect.height / 2 / viewport.zoom;
    return { x: visibleCenterX, y: visibleCenterY };
  }, [reactFlowInstance]);
  useEffect(() => {
    initialNodes.forEach((node) => {
      syncNodeChanges([{ type: "add", item: node }]);
    });
    setNodes(initialNodes);
  }, []);
  useEffect(() => {
    const currentNodeIds = new Set(nodes.map((n) => n.id));
    const contextNodeIds = new Set(contextNodes.map((n) => n.id));
    const needsSync =
      contextNodeIds.size !== currentNodeIds.size ||
      [...contextNodeIds].some((id) => !currentNodeIds.has(id)) ||
      [...currentNodeIds].some((id) => !contextNodeIds.has(id));
    if (needsSync) {
      const contextKey = getContextKey(currentContext);
      const savedPositions = getNodePositions(contextKey);
      const newNodes = contextNodes.map((contextNode, index) => {
        const existingNode = nodes.find((n) => n.id === contextNode.id);
        const initialNode = initialNodes.find((n) => n.id === contextNode.id);
        const savedPosition = savedPositions?.[contextNode.id];
        const fallbackPosition = initialNode?.position || {
          x: (index % 3) * 200,
          y: Math.floor(index / 3) * 150,
        };
        return {
          ...contextNode,
          position: savedPosition || existingNode?.position || fallbackPosition,
          data: contextNode.data,
        };
      });
      setNodes(newNodes as any);
      setEdges(contextEdges);
    }
  }, [contextNodes, setNodes, contextEdges, setEdges]);
  useEffect(() => {
    setEdges(contextEdges);
  }, [contextEdges, setEdges]);
  const lastContextNodesRef = useRef(contextNodes);
  useEffect(() => {
    if (lastContextNodesRef.current !== contextNodes) {
      lastContextNodesRef.current = contextNodes;
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const contextNode = contextNodes.find((n) => n.id === node.id);
          if (contextNode) {
            const newData = contextNode.data as any;
            if (JSON.stringify(node.data) !== JSON.stringify(newData)) {
              return {
                ...node,
                data: newData,
              };
            }
          }
          return node;
        })
      );
    }
  }, [contextNodes, setNodes]);
  useEffect(() => {
    const handleFitNodes = () => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2 });
      }
    };
    window.addEventListener("minimystx:fitNodes", handleFitNodes);
    return () => {
      window.removeEventListener("minimystx:fitNodes", handleFitNodes);
    };
  }, [reactFlowInstance]);
  useEffect(() => {
    const handleGetViewport = (event: CustomEvent) => {
      if (reactFlowInstance) {
        const viewport = reactFlowInstance.getViewport();
        (event as unknown as { viewportData?: typeof viewport }).viewportData = viewport;
      }
    };
    const handleSetViewport = (event: CustomEvent) => {
      const viewport = event.detail;
      if (viewport && reactFlowInstance) {
        reactFlowInstance.setViewport(viewport, { duration: 0 });
      }
    };
    const handleGetNodePositions = (event: CustomEvent) => {
      const nodePositions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((node) => {
        nodePositions[node.id] = { x: node.position.x, y: node.position.y };
      });
      (event as unknown as { nodePositions?: typeof nodePositions }).nodePositions = nodePositions;
    };
    window.addEventListener("minimystx:getViewport", handleGetViewport as EventListener);
    window.addEventListener("minimystx:setViewport", handleSetViewport as EventListener);
    window.addEventListener("minimystx:getNodePositions", handleGetNodePositions as EventListener);
    return () => {
      window.removeEventListener("minimystx:getViewport", handleGetViewport as EventListener);
      window.removeEventListener("minimystx:setViewport", handleSetViewport as EventListener);
      window.removeEventListener(
        "minimystx:getNodePositions",
        handleGetNodePositions as EventListener
      );
    };
  }, [reactFlowInstance, nodes]);
  useEffect(() => {
    const handleCreateNode = (event: CustomEvent) => {
      const { nodeType, position } = event.detail;
      if (!reactFlowInstance || !nodeType) return;
      const flowPosition = position
        ? reactFlowInstance.screenToFlowPosition(position)
        : getVisibleCenter();
      const newNode = {
        id: uuid(),
        type: nodeType,
        position: flowPosition,
      };
      syncNodeChanges([{ type: "add", item: newNode }]);
    };
    window.addEventListener("minimystx:createNode", handleCreateNode as EventListener);
    return () => {
      window.removeEventListener("minimystx:createNode", handleCreateNode as EventListener);
    };
  }, [reactFlowInstance, syncNodeChanges, getVisibleCenter]);
  useEffect(() => {
    const handleRebuildGraph = (event: CustomEvent) => {
      const savedPositions = event.detail?.positions as
        | Record<string, { x: number; y: number }>
        | undefined;
      const visibleCenter = getVisibleCenter();
      const graphNodes = contextNodes.map((contextNode, index) => ({
        id: contextNode.id,
        type: contextNode.type,
        position: savedPositions?.[contextNode.id] || {
          x: visibleCenter.x + ((index % 3) - 1) * 200,
          y:
            visibleCenter.y +
            (Math.floor(index / 3) - Math.floor(contextNodes.length / 3 / 2)) * 150,
        },
        data: contextNode.data,
      }));
      const graphEdges = contextEdges;
      if (graphNodes.length > 0) {
        setNodes(graphNodes as any);
        setEdges(graphEdges);
        if (!savedPositions) {
          setTimeout(() => {
            if (reactFlowInstance) {
              reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
            }
          }, 100);
        }
      }
    };
    window.addEventListener("minimystx:rebuildFlowGraph", handleRebuildGraph as EventListener);
    return () => {
      window.removeEventListener("minimystx:rebuildFlowGraph", handleRebuildGraph as EventListener);
    };
  }, [contextNodes, contextEdges, setNodes, setEdges, reactFlowInstance, getVisibleCenter]);
  useEffect(() => {
    const handleApplyLayout = (event: CustomEvent) => {
      const {
        nodes: layoutedNodes,
        algorithm: _algorithm,
        selectedOnly,
        selectedCount: _selectedCount,
      } = event.detail;
      if (!layoutedNodes || layoutedNodes.length === 0) {
        return;
      }
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const layoutedNode = layoutedNodes.find((n: any) => n.id === node.id);
          if (layoutedNode && layoutedNode.position) {
            return {
              ...node,
              position: layoutedNode.position,
            };
          }
          return node;
        })
      );
      if (reactFlowInstance && !selectedOnly) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
        }, 100);
      }
    };
    window.addEventListener("minimystx:applyLayout", handleApplyLayout as EventListener);
    return () => {
      window.removeEventListener("minimystx:applyLayout", handleApplyLayout as EventListener);
    };
  }, [setNodes, reactFlowInstance]);
  useEffect(() => {
    const handleAutoLayoutTrigger = (event: CustomEvent) => {
      const { algorithm } = event.detail;
      if (algorithm === "dagre") {
        applyDagre();
      } else if (algorithm === "elk") {
        applyELK();
      }
    };
    window.addEventListener("minimystx:applyAutoLayout", handleAutoLayoutTrigger as EventListener);
    return () => {
      window.removeEventListener(
        "minimystx:applyAutoLayout",
        handleAutoLayoutTrigger as EventListener
      );
    };
  }, [applyDagre, applyELK]);
  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      syncNodeChanges(changes);
    },
    [onNodesChange, syncNodeChanges]
  );
  const handleEdgesChange = useCallback(
    (changes: any) => {
      const results = syncEdgeChanges(changes, undefined, edges);
      onEdgesChange(changes);
      results.forEach((result) => {
        if (!result.success && result.error) {
          // TO DO fix this
        }
      });
    },
    [onEdgesChange, syncEdgeChanges, edges]
  );
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodesList, edges: selectedEdgesList }: { nodes: any[]; edges: any[] }) => {
      setSelectedEdges(selectedEdgesList || []);
      setSelectedNodes(selectedNodesList || []);
      const selectedNodeIds = (selectedNodesList || []).map((node: any) => node.id);
      setUISelectedNodes(selectedNodeIds);
      if (selectedNodesList.length === 1) {
        setSelectedNode(selectedNodesList[0].id);
      } else if (selectedNodesList.length === 0) {
        clearSelection();
      } else {
        setSelectedNode(selectedNodesList[0].id);
      }
    },
    [setSelectedNode, setUISelectedNodes, clearSelection]
  );
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/reactflow");
      if (!data) return;
      try {
        const nodeData = JSON.parse(data);
        if (!reactFlowInstance) return;
        const position = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        const newNode = {
          id: uuid(),
          type: nodeData.type,
          position,
        };
        syncNodeChanges([{ type: "add", item: newNode }]);
      } catch (error) {}
    },
    [syncNodeChanges, reactFlowInstance]
  );
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setPalettePosition(mousePosition);
        setKeyboardNavigationMode(true);
        resetPaletteNavigation();
        togglePalette();
      }
    },
    [
      togglePalette,
      setPalettePosition,
      mousePosition,
      setKeyboardNavigationMode,
      resetPaletteNavigation,
    ]
  );
  const onInit = useCallback(
    (instance: ReactFlowInstance<any, any>) => {
      setReactFlowInstance(instance);
      const contextKey = getContextKey(currentContext);
      const savedViewport = getViewportState(contextKey);
      if (savedViewport) {
        setTimeout(() => {
          instance.setViewport(savedViewport, { duration: 0 });
        }, 100);
      }
    },
    [currentContext, getViewportState]
  );
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      if (node.type === "geoNode" && currentContext.type === "root" && reactFlowInstance) {
        const currentViewport = reactFlowInstance.getViewport();
        const contextKey = getContextKey(currentContext);
        saveViewportState(contextKey, currentViewport);
        const nodePositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          nodePositions[n.id] = { x: n.position.x, y: n.position.y };
        });
        saveNodePositions(contextKey, nodePositions);
        navigateToSubFlow(node.id);
      }
    },
    [
      currentContext,
      navigateToSubFlow,
      reactFlowInstance,
      saveViewportState,
      saveNodePositions,
      nodes,
    ]
  );
  useEffect(() => {
    if (reactFlowInstance && prevContextRef.current !== currentContext) {
      if (prevContextRef.current) {
        const currentViewport = reactFlowInstance.getViewport();
        const prevContextKey = getContextKey(prevContextRef.current);
        saveViewportState(prevContextKey, currentViewport);
        const nodePositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          nodePositions[n.id] = { x: n.position.x, y: n.position.y };
        });
        saveNodePositions(prevContextKey, nodePositions);
      }
      const newContextKey = getContextKey(currentContext);
      const savedViewport = getViewportState(newContextKey);
      if (savedViewport) {
        reactFlowInstance.setViewport(savedViewport, { duration: 0 });
      } else {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
        }, 100);
      }
      prevContextRef.current = currentContext;
    }
  }, [
    currentContext,
    reactFlowInstance,
    saveViewportState,
    getViewportState,
    saveNodePositions,
    nodes,
  ]);
  useEffect(() => {
    const handleSaveCurrentViewport = () => {
      if (reactFlowInstance) {
        const currentViewport = reactFlowInstance.getViewport();
        const contextKey = getContextKey(currentContext);
        saveViewportState(contextKey, currentViewport);
        const nodePositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          nodePositions[n.id] = { x: n.position.x, y: n.position.y };
        });
        saveNodePositions(contextKey, nodePositions);
      }
    };
    const handleRestoreViewportAfterMaximize = () => {
      if (reactFlowInstance) {
        const contextKey = getContextKey(currentContext);
        const savedViewport = getViewportState(contextKey);
        const savedPositions = getNodePositions(contextKey);
        if (savedViewport) {
          reactFlowInstance.setViewport(savedViewport, { duration: 0 });
        }
        if (savedPositions) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              const savedPosition = savedPositions[node.id];
              if (savedPosition) {
                return {
                  ...node,
                  position: savedPosition,
                };
              }
              return node;
            })
          );
        }
      }
    };
    window.addEventListener("minimystx:saveCurrentViewport", handleSaveCurrentViewport);
    window.addEventListener(
      "minimystx:restoreViewportAfterMaximize",
      handleRestoreViewportAfterMaximize
    );
    return () => {
      window.removeEventListener("minimystx:saveCurrentViewport", handleSaveCurrentViewport);
      window.removeEventListener(
        "minimystx:restoreViewportAfterMaximize",
        handleRestoreViewportAfterMaximize
      );
    };
  }, [
    reactFlowInstance,
    currentContext,
    saveViewportState,
    nodes,
    saveNodePositions,
    getViewportState,
    getNodePositions,
    setNodes,
  ]);
  return (
    <div
      ref={containerRef}
      className={styles.canvasContainer}
      tabIndex={0}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
    >
      <FlowViewToggle />
      {currentViewMode === "graph" && (
        <div className={styles.breadcrumbContainer}>
          <Breadcrumb />
        </div>
      )}
      {currentViewMode === "list" ? (
        <FlowListView />
      ) : (
        <ReactFlow
          ref={reactFlowRef}
          nodes={nodes}
          edges={edges}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onSelectionChange={handleSelectionChange}
          isValidConnection={handleIsValidConnection}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Strict}
          connectionLineComponent={ConnectionLine}
          onInit={onInit}
          onNodeDoubleClick={handleNodeDoubleClick}
          fitView
          multiSelectionKeyCode={["Meta", "Control"]}
          selectionKeyCode="Shift"
          panOnDrag={[1, 2]}
          selectNodesOnDrag={false}
          proOptions={{ hideAttribution: true }}
        >
          <FlowBackground />
          <FlowControls />
        </ReactFlow>
      )}
    </div>
  );
}
