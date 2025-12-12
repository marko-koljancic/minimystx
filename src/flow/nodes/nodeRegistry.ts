import { NodeDefinition, InputCloneMode } from "../../engine/graphStore";
import {
  geoNodeParams,
  geoNodeCompute,
  boxNodeParams,
  boxNodeComputeTyped,
  sphereNodeParams,
  sphereNodeComputeTyped,
  cylinderNodeParams,
  cylinderNodeComputeTyped,
  coneNodeParams,
  coneNodeComputeTyped,
  planeNodeParams,
  planeNodeComputeTyped,
  torusNodeParams,
  torusNodeComputeTyped,
  torusKnotNodeParams,
  torusKnotNodeComputeTyped,
  importObjNodeParams,
  importObjNodeComputeTyped,
  importGltfNodeParams,
  importGltfNodeComputeTyped,
  pointLightNodeParams,
  pointLightNodeCompute,
  ambientLightNodeParams,
  ambientLightNodeCompute,
  directionalLightNodeParams,
  directionalLightNodeCompute,
  spotLightNodeParams,
  spotLightNodeCompute,
  hemisphereLightNodeParams,
  hemisphereLightNodeCompute,
  rectAreaLightNodeParams,
  rectAreaLightNodeCompute,
  transformNodeParams,
  transformNodeComputeTyped,
  combineNodeParams,
  combineNodeComputeTyped,
  noteNodeParams,
  noteNodeCompute,
} from ".";
export const nodeRegistry: Record<string, NodeDefinition> = {
  geoNode: {
    type: "geoNode",
    category: "Container",
    displayName: "Geo",
    allowedContexts: ["root"],
    params: geoNodeParams,
    compute: geoNodeCompute,
  },
  boxNode: {
    type: "boxNode",
    category: "3D Primitives",
    displayName: "Box",
    allowedContexts: ["subflow"],
    params: boxNodeParams,
    computeTyped: boxNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  sphereNode: {
    type: "sphereNode",
    category: "3D Primitives",
    displayName: "Sphere",
    allowedContexts: ["subflow"],
    params: sphereNodeParams,
    computeTyped: sphereNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  cylinderNode: {
    type: "cylinderNode",
    category: "3D Primitives",
    displayName: "Cylinder",
    allowedContexts: ["subflow"],
    params: cylinderNodeParams,
    computeTyped: cylinderNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  planeNode: {
    type: "planeNode",
    category: "3D Primitives",
    displayName: "Plane",
    allowedContexts: ["subflow"],
    params: planeNodeParams,
    computeTyped: planeNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  coneNode: {
    type: "coneNode",
    category: "3D Primitives",
    displayName: "Cone",
    allowedContexts: ["subflow"],
    params: coneNodeParams,
    computeTyped: coneNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  torusNode: {
    type: "torusNode",
    category: "3D Primitives",
    displayName: "Torus",
    allowedContexts: ["subflow"],
    params: torusNodeParams,
    computeTyped: torusNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  torusKnotNode: {
    type: "torusKnotNode",
    category: "3D Primitives",
    displayName: "TorusKnot",
    allowedContexts: ["subflow"],
    params: torusKnotNodeParams,
    computeTyped: torusKnotNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  transformNode: {
    type: "transformNode",
    category: "Modifiers",
    displayName: "Transform",
    allowedContexts: ["subflow"],
    params: transformNodeParams,
    computeTyped: transformNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  combineNode: {
    type: "combineNode",
    category: "Modifiers",
    displayName: "Combine",
    allowedContexts: ["subflow"],
    params: combineNodeParams,
    computeTyped: combineNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  noteNode: {
    type: "noteNode",
    category: "Utility",
    displayName: "Note",
    allowedContexts: ["root", "subflow"],
    params: noteNodeParams,
    compute: noteNodeCompute,
  },
  importObjNode: {
    type: "importObjNode",
    category: "Import",
    displayName: "Import OBJ",
    allowedContexts: ["subflow"],
    params: importObjNodeParams,
    computeTyped: importObjNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  importGltfNode: {
    type: "importGltfNode",
    category: "Import",
    displayName: "Import glTF",
    allowedContexts: ["subflow"],
    params: importGltfNodeParams,
    computeTyped: importGltfNodeComputeTyped,
    inputCloneMode: InputCloneMode.NEVER,
  },
  pointLightNode: {
    type: "pointLightNode",
    category: "Lights",
    displayName: "Point Light",
    allowedContexts: ["root"],
    params: pointLightNodeParams,
    compute: pointLightNodeCompute,
  },
  ambientLightNode: {
    type: "ambientLightNode",
    category: "Lights",
    displayName: "Ambient Light",
    allowedContexts: ["root"],
    params: ambientLightNodeParams,
    compute: ambientLightNodeCompute,
  },
  directionalLightNode: {
    type: "directionalLightNode",
    category: "Lights",
    displayName: "Directional Light",
    allowedContexts: ["root"],
    params: directionalLightNodeParams,
    compute: directionalLightNodeCompute,
  },
  spotLightNode: {
    type: "spotLightNode",
    category: "Lights",
    displayName: "Spot Light",
    allowedContexts: ["root"],
    params: spotLightNodeParams,
    compute: spotLightNodeCompute,
  },
  hemisphereLightNode: {
    type: "hemisphereLightNode",
    category: "Lights",
    displayName: "Hemisphere Light",
    allowedContexts: ["root"],
    params: hemisphereLightNodeParams,
    compute: hemisphereLightNodeCompute,
  },
  rectAreaLightNode: {
    type: "rectAreaLightNode",
    category: "Lights",
    displayName: "Rect Area Light",
    allowedContexts: ["root"],
    params: rectAreaLightNodeParams,
    compute: rectAreaLightNodeCompute,
  },
};
export const getAvailableNodeTypes = (): string[] => {
  return Object.keys(nodeRegistry);
};
export const isValidNodeType = (type: string): boolean => {
  return type in nodeRegistry;
};
export const getAllNodeDefinitions = (): NodeDefinition[] => {
  return Object.values(nodeRegistry);
};
export const getNodesByCategory = (): Record<string, NodeDefinition[]> => {
  const categories: Record<string, NodeDefinition[]> = {};
  Object.values(nodeRegistry).forEach((node) => {
    if (!categories[node.category]) {
      categories[node.category] = [];
    }
    categories[node.category].push(node);
  });
  return categories;
};
export const getAvailableCategories = (): string[] => {
  const categories = new Set<string>();
  Object.values(nodeRegistry).forEach((node) => {
    categories.add(node.category);
  });
  return Array.from(categories).sort();
};
const calculateFuzzyScore = (query: string, target: string): number => {
  if (query === target) return 1000;
  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();
  if (targetLower.includes(queryLower)) {
    const index = targetLower.indexOf(queryLower);
    return 500 - index;
  }
  let score = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;
  for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIndex]) {
      score += 10;
      if (consecutiveMatches > 0) {
        score += consecutiveMatches * 5;
      }
      consecutiveMatches++;
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
  }
  const unmatchedChars = queryLower.length - queryIndex;
  score -= unmatchedChars * 20;
  return Math.max(0, score);
};
export const searchNodes = (query: string, maxResults: number = 100): NodeDefinition[] => {
  if (!query.trim()) return getAllNodeDefinitions();
  const scoredNodes = Object.values(nodeRegistry).map((node) => {
    const displayNameScore = calculateFuzzyScore(query, node.displayName);
    const typeScore = calculateFuzzyScore(query, node.type);
    const categoryScore = calculateFuzzyScore(query, node.category) * 0.3;
    const maxScore = Math.max(displayNameScore, typeScore, categoryScore);
    return {
      node,
      score: maxScore,
    };
  });
  return scoredNodes
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ node }) => node);
};
export const getFilteredNodesByCategory = (searchQuery: string): Record<string, NodeDefinition[]> => {
  if (!searchQuery.trim()) {
    return getNodesByCategory();
  }
  const searchResults = searchNodes(searchQuery);
  const filteredCategories: Record<string, NodeDefinition[]> = {};
  searchResults.forEach((node) => {
    if (!filteredCategories[node.category]) {
      filteredCategories[node.category] = [];
    }
    filteredCategories[node.category].push(node);
  });
  return filteredCategories;
};
export const getNodesByCategoryForContext = (contextType: "root" | "subflow"): Record<string, NodeDefinition[]> => {
  const categories: Record<string, NodeDefinition[]> = {};
  Object.values(nodeRegistry)
    .filter((node) => node.allowedContexts.includes(contextType))
    .forEach((node) => {
      if (!categories[node.category]) {
        categories[node.category] = [];
      }
      categories[node.category].push(node);
    });
  return categories;
};
export const getAvailableCategoriesForContext = (contextType: "root" | "subflow"): string[] => {
  const categories = new Set<string>();
  Object.values(nodeRegistry)
    .filter((node) => node.allowedContexts.includes(contextType))
    .forEach((node) => {
      categories.add(node.category);
    });
  return Array.from(categories).sort();
};
export const searchNodesForContext = (
  query: string,
  contextType: "root" | "subflow",
  maxResults: number = 100
): NodeDefinition[] => {
  if (!query.trim()) {
    return Object.values(nodeRegistry).filter((node) => node.allowedContexts.includes(contextType));
  }
  const scoredNodes = Object.values(nodeRegistry)
    .filter((node) => node.allowedContexts.includes(contextType))
    .map((node) => {
      const displayNameScore = calculateFuzzyScore(query, node.displayName);
      const typeScore = calculateFuzzyScore(query, node.type);
      const categoryScore = calculateFuzzyScore(query, node.category) * 0.3;
      const maxScore = Math.max(displayNameScore, typeScore, categoryScore);
      return {
        node,
        score: maxScore,
      };
    });
  return scoredNodes
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ node }) => node);
};
export const getFilteredNodesByCategoryForContext = (
  searchQuery: string,
  contextType: "root" | "subflow"
): Record<string, NodeDefinition[]> => {
  if (!searchQuery.trim()) {
    return getNodesByCategoryForContext(contextType);
  }
  const searchResults = searchNodesForContext(searchQuery, contextType);
  const filteredCategories: Record<string, NodeDefinition[]> = {};
  searchResults.forEach((node) => {
    if (!filteredCategories[node.category]) {
      filteredCategories[node.category] = [];
    }
    filteredCategories[node.category].push(node);
  });
  return filteredCategories;
};
