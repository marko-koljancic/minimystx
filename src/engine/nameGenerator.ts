import { nodeRegistry } from "./nodeRegistry";
import { NodeState, GraphContext } from "./graphStore";
export function getBaseName(nodeType: string): string {
  const nodeDefinition = nodeRegistry[nodeType];
  if (!nodeDefinition) {
    return nodeType;
  }
  return nodeDefinition.displayName;
}
function extractNumber(name: string, baseName: string): number | null {
  const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`);
  const match = name.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}
function getExistingNumbers(baseName: string, nodeStates: Record<string, NodeState>): Set<number> {
  const existingNumbers = new Set<number>();
  Object.values(nodeStates).forEach((nodeState) => {
    const nameParam = nodeState.params?.general?.name;
    if (typeof nameParam === "string") {
      const number = extractNumber(nameParam, baseName);
      if (number !== null) {
        existingNumbers.add(number);
      }
    }
  });
  return existingNumbers;
}
function getNextAvailableNumber(baseName: string, nodeStates: Record<string, NodeState>): number {
  const existingNumbers = getExistingNumbers(baseName, nodeStates);
  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }
  return nextNumber;
}
function getContextNodeStates(
  context: GraphContext,
  rootNodeState: Record<string, NodeState>,
  subFlows: Record<string, { nodeState: Record<string, NodeState> }>
): Record<string, NodeState> {
  if (context.type === "root") {
    return rootNodeState;
  } else if (context.type === "subflow" && context.geoNodeId) {
    return subFlows[context.geoNodeId]?.nodeState || {};
  }
  return {};
}
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
