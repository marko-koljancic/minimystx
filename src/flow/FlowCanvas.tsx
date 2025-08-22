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
} from "../store";
import { Breadcrumb } from "./Breadcrumb";
import ConnectionLine from "./edges/ConnectionLine";
import { FlowBackground } from "./FlowBackground";
import { FlowControls } from "./FlowControls";
import { useCallback, useEffect, useRef, useState } from "react";
import { edgeTypes, initialEdges, initialNodes, nodeTypes } from "../constants";
import { v4 as uuid } from "uuid";

export default function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);
  const [currentLayoutAlgorithm, setCurrentLayoutAlgorithm] = useState<'dagre' | 'elk'>('dagre');
  const { syncNodeChanges, syncEdgeChanges } = useFlowGraphSync();
  const { setSelectedNode, setSelectedNodes: setUISelectedNodes, clearSelection } = useUIStore();
  const currentContext = useCurrentContext();
  const { applyDagre, applyELK, applyDagreToSelection, applyELKToSelection } = useAutoLayout();
  const { onConnect, onReconnect, handleIsValidConnection } = useEdgeManagement(setEdges, nodes, edges);

  // Handle L key for cycling auto-layout algorithms
  const handleAutoLayoutCycle = useCallback((forceAllNodes = false) => {
    const selectedNodeIds = selectedNodes.map(node => node.id);
    const hasSelection = selectedNodeIds.length > 0;
    const shouldUseSelection = hasSelection && !forceAllNodes;

    // Determine which algorithm to use and update for next time
    const algorithmToUse = currentLayoutAlgorithm;
    const nextAlgorithm = currentLayoutAlgorithm === 'dagre' ? 'elk' : 'dagre';
    setCurrentLayoutAlgorithm(nextAlgorithm);


    if (shouldUseSelection) {
      // Apply layout to selected nodes only
      if (algorithmToUse === 'dagre') {
        applyDagreToSelection(selectedNodeIds);
      } else {
        applyELKToSelection(selectedNodeIds);
      }
    } else {
      // Apply layout to all nodes
      if (algorithmToUse === 'dagre') {
        applyDagre();
      } else {
        applyELK();
      }
    }
  }, [selectedNodes, currentLayoutAlgorithm, applyDagre, applyELK, applyDagreToSelection, applyELKToSelection]);
  
  // Edge deletion handler
  const handleDeleteSelectedEdges = useCallback(() => {
    if (selectedEdges.length === 0) return;
    
    const { removeEdge } = useGraphStore.getState();
    
    selectedEdges.forEach(edge => {
      // Remove from graph store first
      const result = removeEdge(
        edge.source,
        edge.target,
        currentContext,
        edge.sourceHandle || undefined,
        edge.targetHandle || undefined
      );
      
      if (!result.ok) {
        console.error("[EDGE DELETE] Failed to remove edge from graph store:", result.error);
        return;
      }
      
      // Remove from React Flow edges
      setEdges(eds => eds.filter(e => e.id !== edge.id));
    });
    
    // Clear the selection
    setSelectedEdges([]);
  }, [selectedEdges, setEdges, currentContext]);

  const { containerRef } = useKeyboardShortcuts({ 
    context: "flow", 
    onDeleteSelectedEdges: handleDeleteSelectedEdges,
    onAutoLayoutCycle: handleAutoLayoutCycle
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

  // Helper function to get the center of the visible viewport
  const getVisibleCenter = useCallback(() => {
    if (!reactFlowInstance) return { x: 0, y: 0 };
    
    // Get current viewport (x, y are the top-left corner, zoom is the scale)
    const viewport = reactFlowInstance.getViewport();
    
    // Get the DOM element to calculate visible area dimensions
    const reactFlowElement = reactFlowRef.current;
    if (!reactFlowElement) return { x: 0, y: 0 };
    
    const rect = reactFlowElement.getBoundingClientRect();
    
    // Calculate the center of the visible area in flow coordinates
    // The visible center in flow space = viewport offset + (visible dimensions / 2) / zoom
    const visibleCenterX = -viewport.x + (rect.width / 2) / viewport.zoom;
    const visibleCenterY = -viewport.y + (rect.height / 2) / viewport.zoom;
    
    return { x: visibleCenterX, y: visibleCenterY };
  }, [reactFlowInstance]);

  // Initialize nodes only once on mount
  useEffect(() => {
    // First sync the nodes to the graph store
    initialNodes.forEach((node) => {
      syncNodeChanges([{ type: "add", item: node }]);
    });

    // Then set the initial nodes with their positions in ReactFlow
    setNodes(initialNodes);
  }, []); // Empty dependency array - run only once on mount

  // Sync context nodes to React Flow nodes
  useEffect(() => {
    const currentNodeIds = new Set(nodes.map((n) => n.id));
    const contextNodeIds = new Set(contextNodes.map((n) => n.id));

    // Check if we need to add/remove nodes
    const needsSync =
      contextNodeIds.size !== currentNodeIds.size ||
      [...contextNodeIds].some((id) => !currentNodeIds.has(id)) ||
      [...currentNodeIds].some((id) => !contextNodeIds.has(id));

    if (needsSync) {
      // Get saved positions for current context
      const contextKey = getContextKey(currentContext);
      const savedPositions = getNodePositions(contextKey);

      const newNodes = contextNodes.map((contextNode, index) => {
        const existingNode = nodes.find((n) => n.id === contextNode.id);
        // For initial nodes, preserve their original positions
        const initialNode = initialNodes.find((n) => n.id === contextNode.id);
        // Priority: saved position > existing position > initial position > smart default
        const savedPosition = savedPositions?.[contextNode.id];
        const fallbackPosition = initialNode?.position || {
          // Use visible center with offset for multiple nodes
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
      
      // Also sync edges when nodes change
      setEdges(contextEdges);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextNodes, setNodes, contextEdges, setEdges]); // nodes dependency intentionally excluded to prevent infinite loop

  // Sync context edges to React Flow edges
  useEffect(() => {
    setEdges(contextEdges);
  }, [contextEdges, setEdges]);

  // Update existing nodes with latest data from graph store
  const lastContextNodesRef = useRef(contextNodes);
  useEffect(() => {
    // Only update if the context nodes actually changed
    if (lastContextNodesRef.current !== contextNodes) {
      lastContextNodesRef.current = contextNodes;

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const contextNode = contextNodes.find((n) => n.id === node.id);
          if (contextNode) {
            // Only update if data actually changed to prevent unnecessary re-renders
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
        // Store the data in the event for retrieval
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
      // Store the data in the event for retrieval
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

  // Handle node creation from keyboard palette
  useEffect(() => {
    const handleCreateNode = (event: CustomEvent) => {
      const { nodeType, position } = event.detail;
      if (!reactFlowInstance || !nodeType) return;

      // Use provided position (from mouse/palette) or fall back to visible center
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

  // Handle graph rebuild after import
  useEffect(() => {
    const handleRebuildGraph = (event: CustomEvent) => {
      const savedPositions = event.detail?.positions as
        | Record<string, { x: number; y: number }>
        | undefined;

      // Use context-aware nodes for rebuild
      const visibleCenter = getVisibleCenter();
      const graphNodes = contextNodes.map((contextNode, index) => ({
        id: contextNode.id,
        type: contextNode.type,
        position: savedPositions?.[contextNode.id] || {
          // Fallback to grid pattern centered around visible viewport
          x: visibleCenter.x + ((index % 3) - 1) * 200,
          y: visibleCenter.y + (Math.floor(index / 3) - Math.floor(contextNodes.length / 3 / 2)) * 150,
        },
        data: contextNode.data,
      }));

      const graphEdges = contextEdges;

      if (graphNodes.length > 0) {
        setNodes(graphNodes as any);
        setEdges(graphEdges);

        // Only auto-fit view if we don't have saved positions (i.e., for new scenes)
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

  // Handle auto-layout events
  useEffect(() => {
    const handleApplyLayout = (event: CustomEvent) => {
      const { nodes: layoutedNodes, algorithm, selectedOnly, selectedCount } = event.detail;
      
      if (!layoutedNodes || layoutedNodes.length === 0) {
        return;
      }

      // Update node positions in React Flow
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const layoutedNode = layoutedNodes.find((n: any) => n.id === node.id);
          if (layoutedNode && layoutedNode.position) {
            return {
              ...node,
              position: layoutedNode.position
            };
          }
          return node;
        })
      );

      // Fit view after layout with padding (only if all nodes were laid out)
      if (reactFlowInstance && !selectedOnly) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
        }, 100);
      }

      const message = selectedOnly 
        ? `Applied ${algorithm} layout to ${selectedCount} selected nodes`
        : `Applied ${algorithm} layout to ${layoutedNodes.length} nodes`;
      
      console.info(`[FlowCanvas] ${message}`);
    };

    window.addEventListener("minimystx:applyLayout", handleApplyLayout as EventListener);

    return () => {
      window.removeEventListener("minimystx:applyLayout", handleApplyLayout as EventListener);
    };
  }, [setNodes, reactFlowInstance]);

  // Handle auto-layout trigger events from Header
  useEffect(() => {
    const handleAutoLayoutTrigger = (event: CustomEvent) => {
      const { algorithm } = event.detail;
      
      if (algorithm === 'dagre') {
        applyDagre();
      } else if (algorithm === 'elk') {
        applyELK();
      }
    };

    window.addEventListener("minimystx:applyAutoLayout", handleAutoLayoutTrigger as EventListener);

    return () => {
      window.removeEventListener("minimystx:applyAutoLayout", handleAutoLayoutTrigger as EventListener);
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
      onEdgesChange(changes);
      const results = syncEdgeChanges(changes);
      results.forEach((result) => {
        if (!result.success && result.error) {
          console.warn("Edge sync failed:", result.error);
        }
      });
    },
    [onEdgesChange, syncEdgeChanges]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodesList, edges: selectedEdgesList }: { nodes: any[]; edges: any[] }) => {
      // Update local state
      setSelectedEdges(selectedEdgesList || []);
      setSelectedNodes(selectedNodesList || []);
      
      // Update UI store with multiple selection support
      const selectedNodeIds = (selectedNodesList || []).map((node: any) => node.id);
      setUISelectedNodes(selectedNodeIds);
      
      // Handle single node selection for legacy compatibility
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
      } catch (error) {
        console.error("[DROP] Failed to parse node data:", error);
      }
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

      // Restore viewport state for the current context
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

  // Handle double-click navigation for GeoNodes
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: any) => {
      if (node.type === "geoNode" && currentContext.type === "root" && reactFlowInstance) {
        // Save current viewport state before switching
        const currentViewport = reactFlowInstance.getViewport();
        const contextKey = getContextKey(currentContext);
        saveViewportState(contextKey, currentViewport);

        // Save current node positions before switching
        const nodePositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          nodePositions[n.id] = { x: n.position.x, y: n.position.y };
        });
        saveNodePositions(contextKey, nodePositions);

        navigateToSubFlow(node.id);
      }
    },
    [currentContext, navigateToSubFlow, reactFlowInstance, saveViewportState, saveNodePositions, nodes]
  );

  // Handle context switching and viewport restoration
  useEffect(() => {
    if (reactFlowInstance && prevContextRef.current !== currentContext) {
      // Save viewport state and node positions for previous context
      if (prevContextRef.current) {
        const currentViewport = reactFlowInstance.getViewport();
        const prevContextKey = getContextKey(prevContextRef.current);
        saveViewportState(prevContextKey, currentViewport);

        // Save node positions for previous context
        const nodePositions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          nodePositions[n.id] = { x: n.position.x, y: n.position.y };
        });
        saveNodePositions(prevContextKey, nodePositions);
      }

      // Restore viewport state for new context
      const newContextKey = getContextKey(currentContext);
      const savedViewport = getViewportState(newContextKey);

      if (savedViewport) {
        reactFlowInstance.setViewport(savedViewport, { duration: 0 });
      } else {
        // Default viewport for new contexts - fit view
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
        }, 100);
      }

      prevContextRef.current = currentContext;
    }
  }, [currentContext, reactFlowInstance, saveViewportState, getViewportState, saveNodePositions, nodes]);

  // Handle viewport save requests from breadcrumb
  useEffect(() => {
    const handleSaveCurrentViewport = () => {
      if (reactFlowInstance) {
        const currentViewport = reactFlowInstance.getViewport();
        const contextKey = getContextKey(currentContext);
        saveViewportState(contextKey, currentViewport);
      }
    };

    window.addEventListener("minimystx:saveCurrentViewport", handleSaveCurrentViewport);

    return () => {
      window.removeEventListener("minimystx:saveCurrentViewport", handleSaveCurrentViewport);
    };
  }, [reactFlowInstance, currentContext, saveViewportState]);

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
      <div className={styles.breadcrumbContainer}>
        <Breadcrumb />
      </div>
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
        // Multi-selection configuration
        multiSelectionKeyCode={["Meta", "Control"]}
        selectionKeyCode="Shift"
        panOnDrag={[1, 2]} // Left and middle mouse button for panning
        selectNodesOnDrag={false} // Don't start selection on drag
      >
        <FlowBackground />
        <FlowControls />
      </ReactFlow>
    </div>
  );
}
