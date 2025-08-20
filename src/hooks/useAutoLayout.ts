import { useCallback } from 'react';
import { useContextNodes, useContextEdges } from './useContextNodes';
import { applyDagreLayout, applyELKLayout, getNodeDimensions, LayoutNode } from '../utils/layoutUtils';

/**
 * Hook for applying auto-layout algorithms to the current FlowCanvas context
 * Supports both root and sub-flow contexts with Dagre and ELK algorithms
 */
export const useAutoLayout = () => {
  const contextNodes = useContextNodes();
  const contextEdges = useContextEdges();

  const applyDagre = useCallback(async () => {
    if (contextNodes.length === 0) {
      return;
    }

    try {
      // Convert context nodes to layout nodes with measured dimensions
      // Exclude Note nodes from auto-layout
      const layoutNodes: LayoutNode[] = contextNodes
        .filter((node) => node.type !== 'noteNode')
        .map((node) => ({
          ...node,
          measured: getNodeDimensions(node.id)
        }));

      // Apply Dagre layout
      const layoutedNodes = applyDagreLayout(layoutNodes, contextEdges);

      // Dispatch event to update node positions in FlowCanvas
      const event = new CustomEvent('minimystx:applyLayout', {
        detail: {
          nodes: layoutedNodes,
          algorithm: 'dagre'
        }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('Failed to apply Dagre layout:', error);
    }
  }, [contextNodes, contextEdges]);

  const applyELK = useCallback(async () => {
    if (contextNodes.length === 0) {
      return;
    }

    try {
      // Convert context nodes to layout nodes with measured dimensions
      // Exclude Note nodes from auto-layout
      const layoutNodes: LayoutNode[] = contextNodes
        .filter((node) => node.type !== 'noteNode')
        .map((node) => ({
          ...node,
          measured: getNodeDimensions(node.id)
        }));

      // Apply ELK layout (async)
      const layoutedNodes = await applyELKLayout(layoutNodes, contextEdges);

      // Dispatch event to update node positions in FlowCanvas
      const event = new CustomEvent('minimystx:applyLayout', {
        detail: {
          nodes: layoutedNodes,
          algorithm: 'elk'
        }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('Failed to apply ELK layout:', error);
    }
  }, [contextNodes, contextEdges]);

  const applyDagreToSelection = useCallback(async (selectedNodeIds: string[]) => {
    if (selectedNodeIds.length === 0) {
      return;
    }

    if (contextNodes.length === 0) {
      return;
    }

    try {
      // Filter nodes to only selected ones, excluding Note nodes
      const selectedNodes = contextNodes
        .filter(node => selectedNodeIds.includes(node.id))
        .filter(node => node.type !== 'noteNode');
      const selectedNodeSet = new Set(selectedNodes.map(node => node.id));
      
      // Filter edges to only those connecting selected nodes
      const relevantEdges = contextEdges.filter(edge => 
        selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target)
      );

      // Convert to layout nodes with measured dimensions
      const layoutNodes: LayoutNode[] = selectedNodes.map((node) => ({
        ...node,
        measured: getNodeDimensions(node.id)
      }));

      // Apply Dagre layout to selected nodes only
      const layoutedNodes = applyDagreLayout(layoutNodes, relevantEdges);

      // Dispatch event with selection info
      const event = new CustomEvent('minimystx:applyLayout', {
        detail: {
          nodes: layoutedNodes,
          algorithm: 'dagre',
          selectedOnly: true,
          selectedCount: selectedNodes.length
        }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('Failed to apply Dagre layout to selection:', error);
    }
  }, [contextNodes, contextEdges]);

  const applyELKToSelection = useCallback(async (selectedNodeIds: string[]) => {
    if (selectedNodeIds.length === 0) {
      return;
    }

    if (contextNodes.length === 0) {
      return;
    }

    try {
      // Filter nodes to only selected ones, excluding Note nodes
      const selectedNodes = contextNodes
        .filter(node => selectedNodeIds.includes(node.id))
        .filter(node => node.type !== 'noteNode');
      const selectedNodeSet = new Set(selectedNodes.map(node => node.id));
      
      // Filter edges to only those connecting selected nodes
      const relevantEdges = contextEdges.filter(edge => 
        selectedNodeSet.has(edge.source) && selectedNodeSet.has(edge.target)
      );

      // Convert to layout nodes with measured dimensions
      const layoutNodes: LayoutNode[] = selectedNodes.map((node) => ({
        ...node,
        measured: getNodeDimensions(node.id)
      }));

      // Apply ELK layout to selected nodes only
      const layoutedNodes = await applyELKLayout(layoutNodes, relevantEdges);

      // Dispatch event with selection info
      const event = new CustomEvent('minimystx:applyLayout', {
        detail: {
          nodes: layoutedNodes,
          algorithm: 'elk',
          selectedOnly: true,
          selectedCount: selectedNodes.length
        }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('Failed to apply ELK layout to selection:', error);
    }
  }, [contextNodes, contextEdges]);

  return {
    applyDagre,
    applyELK,
    applyDagreToSelection,
    applyELKToSelection
  };
};