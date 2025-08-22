export function wouldCreateCycle(
  source: string,
  target: string,
  dependencyMap: Record<string, string[]>
): boolean {
  const visited = new Set<string>();

  function hasPath(from: string, to: string): boolean {
    if (from === to) return true;
    if (visited.has(from)) return false;

    visited.add(from);
    const dependencies = dependencyMap[from] || [];

    for (const dep of dependencies) {
      if (hasPath(dep, to)) return true;
    }

    return false;
  }

  return hasPath(target, source);
}

export function getDependentsRecursive(
  nodeId: string,
  dependencyMap: Record<string, string[]>
): string[] {
  const dependents = new Set<string>();
  const visited = new Set<string>();

  function findDependents(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    for (const [node, deps] of Object.entries(dependencyMap)) {
      if (deps.includes(id) && !dependents.has(node)) {
        dependents.add(node);
        findDependents(node);
      }
    }
  }

  findDependents(nodeId);
  return Array.from(dependents);
}

export function getEvaluationOrder(
  nodeId: string,
  dependencyMap: Record<string, string[]>
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);

    const dependencies = dependencyMap[id] || [];
    for (const dep of dependencies) {
      visit(dep);
    }

    result.push(id);
  }

  visit(nodeId);
  return result;
}

export function evaluateNode(id: string, params: any, inputs: any, compute: any): any {
  try {
    if (typeof compute === "function") {
      // Pass nodeId as context to compute functions that need it (like geoNode)
      const context = { nodeId: id };
      const result = compute(params, inputs, context);
      return result;
    }
    console.warn(`[evaluateNode] Node ${id} has no compute function`);
    return null;
  } catch (error) {
    console.error(`[evaluateNode] Error evaluating node ${id}:`, error);
    return null;
  }
}

export function findRootNodes(reverseDeps: Record<string, string[]>): string[] {
  const allNodes = new Set(Object.keys(reverseDeps));
  const hasIncomingEdges = new Set<string>();

  for (const deps of Object.values(reverseDeps)) {
    for (const dep of deps) {
      hasIncomingEdges.add(dep);
    }
  }

  return Array.from(allNodes).filter((node) => !hasIncomingEdges.has(node));
}

/**
 * Rebuilds dependency maps from edge list to ensure consistency
 * This eliminates corruption from incremental updates
 */
export function rebuildDependencyMaps(edges: { source: string; target: string }[]): {
  dependencyMap: Record<string, string[]>;
  reverseDeps: Record<string, string[]>;
} {
  const dependencyMap: Record<string, string[]> = {};
  const reverseDeps: Record<string, string[]> = {};

  // Collect all unique node IDs
  const allNodes = new Set<string>();
  for (const edge of edges) {
    allNodes.add(edge.source);
    allNodes.add(edge.target);
  }

  // Initialize empty arrays for all nodes
  for (const nodeId of allNodes) {
    dependencyMap[nodeId] = [];
    reverseDeps[nodeId] = [];
  }

  // Populate dependency maps from edges
  for (const edge of edges) {
    const { source, target } = edge;
    
    // dependencyMap[target] contains nodes that target depends on (sources)
    // For edge A→B: B depends on A, so dependencyMap[B] contains A
    if (!dependencyMap[target].includes(source)) {
      dependencyMap[target].push(source);
    }
    
    // reverseDeps[source] contains nodes that depend on source (targets)
    // For edge A→B: B depends on A, so reverseDeps[A] contains B
    if (!reverseDeps[source].includes(target)) {
      reverseDeps[source].push(target);
    }
  }

  return { dependencyMap, reverseDeps };
}
