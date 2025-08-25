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

export const applyDagreLayout = (
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): LayoutNode[] => {
  const g = new dagre.graphlib.Graph();
  
  g.setGraph({ 
    rankdir: 'TB',
    align: 'UL',
    nodesep: 50,
    edgesep: 10,
    ranksep: 100
  });
  
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
    const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
    
    g.setNode(node.id, {
      width,
      height
    });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2
      }
    };
  });
};

export const applyELKLayout = async (
  nodes: LayoutNode[],
  edges: LayoutEdge[]
): Promise<LayoutNode[]> => {
  const elk = new ELK();

  const elkNodes = nodes.map((node) => ({
    id: node.id,
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
      'elk.direction': 'DOWN',
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
    return nodes.map((node, index) => ({
      ...node,
      position: {
        x: (index % 3) * 220,
        y: Math.floor(index / 3) * 170
      }
    }));
  }
};

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