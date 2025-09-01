import { nodeRegistry } from './nodeRegistry';
import { NodeState, GraphContext } from './graphStore';

/**
 * Extracts the base name from a node's display name
 * E.g., "Box" from "Box", "Point Light" from "Point Light"
 */
export function getBaseName(nodeType: string): string {
  const nodeDefinition = nodeRegistry[nodeType];
  if (!nodeDefinition) {
    console.warn(`Unknown node type: ${nodeType}`);
    return nodeType;
  }
  
  return nodeDefinition.displayName;
}

/**
 * Extracts number from a name if it follows the pattern "BaseName N"
 * Returns null if no number is found
 */
function extractNumber(name: string, baseName: string): number | null {
  // Match pattern: "BaseName N" where N is a number
  const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)$`);
  const match = name.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Finds all existing numbers for a given base name in the context
 */
function getExistingNumbers(baseName: string, nodeStates: Record<string, NodeState>): Set<number> {
  const existingNumbers = new Set<number>();
  
  Object.values(nodeStates).forEach((nodeState) => {
    const nameParam = nodeState.params?.general?.name;
    if (typeof nameParam === 'string') {
      const number = extractNumber(nameParam, baseName);
      if (number !== null) {
        existingNumbers.add(number);
      }
    }
  });
  
  return existingNumbers;
}

/**
 * Finds the next available number for a base name
 */
function getNextAvailableNumber(baseName: string, nodeStates: Record<string, NodeState>): number {
  const existingNumbers = getExistingNumbers(baseName, nodeStates);
  
  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }
  
  return nextNumber;
}

/**
 * Gets the appropriate node states based on context
 */
function getContextNodeStates(
  context: GraphContext,
  rootNodeState: Record<string, NodeState>,
  subFlows: Record<string, { nodeState: Record<string, NodeState> }>
): Record<string, NodeState> {
  if (context.type === 'root') {
    return rootNodeState;
  } else if (context.type === 'subflow' && context.geoNodeId) {
    return subFlows[context.geoNodeId]?.nodeState || {};
  }
  
  return {};
}

/**
 * Generates a default name for a new node
 * 
 * @param nodeType - The type of node (e.g., 'boxNode', 'sphereNode')
 * @param context - The context where the node is being created
 * @param rootNodeState - Root level node states
 * @param subFlows - Subflow node states
 * @returns Generated name like "Box 1", "Sphere 2", etc.
 */
export function generateNodeName(
  nodeType: string,
  context: GraphContext,
  rootNodeState: Record<string, NodeState>,
  subFlows: Record<string, { nodeState: Record<string, NodeState> }>
): string {
  const baseName = getBaseName(nodeType);
  const contextNodeStates = getContextNodeStates(context, rootNodeState, subFlows);
  const nextNumber = getNextAvailableNumber(baseName, contextNodeStates);
  
  return `${baseName} ${nextNumber}`;
}