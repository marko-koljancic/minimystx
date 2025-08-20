import dagre from '@dagrejs/dagre';
import ELK from 'elkjs/lib/elk.bundled.js';

export interface LayoutNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
  position?: { x: number; y: number };
  measured?: {
    width: number;
    height: number;
  };
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 150;

/**
 * Apply Dagre layout algorithm with top-to-bottom direction
 * Maintains vertical-only connections for Minimystx
 */
export const applyDagreLayout = (
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): LayoutNode[] => {
  // Create a new directed graph
  const g = new dagre.graphlib.Graph();
  
  // Set graph attributes for vertical layout
  g.setGraph({ 
    rankdir: 'TB',  // Top-to-bottom direction as required
    align: 'UL',    // Upper-left alignment
    nodesep: 50,    // Horizontal separation between nodes
    edgesep: 10,    // Edge separation
    ranksep: 100    // Vertical separation between ranks
  });
  
  // Set default edge label
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph
  nodes.forEach((node) => {
    // Use measured dimensions if available, otherwise fall back to defaults
    const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
    
    g.setNode(node.id, {
      width,
      height
    });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Run the layout algorithm
  dagre.layout(g);

  // Apply the calculated positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        // Dagre places nodes at center, we need top-left coordinates
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2
      }
    };
  });
};

/**
 * Apply ELK layout algorithm with downward direction
 * Maintains vertical-only connections for Minimystx
 */
export const applyELKLayout = async (
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): Promise<LayoutNode[]> => {
  const elk = new ELK();

  // Prepare ELK graph structure
  const elkNodes = nodes.map((node) => ({
    id: node.id,
    // Use measured dimensions if available, otherwise fall back to defaults
    width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? DEFAULT_NODE_HEIGHT
  }));

  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target]
  }));

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',  // Downward direction as required
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.layered.spacing.edgeNodeBetweenLayers': '50',
      'elk.layered.nodePlacement.strategy': 'SIMPLE'
    },
    children: elkNodes,
    edges: elkEdges
  };

  try {
    const layoutedGraph = await elk.layout(graph);
    
    // Apply the calculated positions to nodes
    return nodes.map((node) => {
      const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
      return {
        ...node,
        position: {
          x: elkNode?.x ?? 0,
          y: elkNode?.y ?? 0
        }
      };
    });
  } catch (error) {
    console.error('ELK layout failed:', error);
    // Return original nodes with fallback grid positions
    return nodes.map((node, index) => ({
      ...node,
      position: {
        x: (index % 3) * 220, // 200 + 20 spacing
        y: Math.floor(index / 3) * 170 // 150 + 20 spacing
      }
    }));
  }
};

/**
 * Get measured node dimensions from DOM element if available
 * Falls back to default dimensions
 */
export const getNodeDimensions = (nodeId: string): { width: number; height: number } => {
  const nodeElement = document.querySelector(`[data-id="${nodeId}"]`);
  
  if (nodeElement) {
    const rect = nodeElement.getBoundingClientRect();
    return {
      width: Math.max(rect.width, DEFAULT_NODE_WIDTH),
      height: Math.max(rect.height, DEFAULT_NODE_HEIGHT)
    };
  }
  
  return {
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT
  };
};