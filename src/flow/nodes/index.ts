export { geoNodeParams } from "./Geometry/GeoNode";

export { boxNodeParams, boxNodeComputeTyped } from "./3D_Primitives/Box";
export { sphereNodeParams, sphereNodeComputeTyped } from "./3D_Primitives/Sphere";
export { cylinderNodeParams, cylinderNodeComputeTyped } from "./3D_Primitives/Cylinder";
export { coneNodeParams, coneNodeComputeTyped } from "./3D_Primitives/Cone";
export { planeNodeParams, planeNodeComputeTyped } from "./3D_Primitives/Plane";
export { torusNodeParams, torusNodeComputeTyped } from "./3D_Primitives/Torus";
export { torusKnotNodeParams, torusKnotNodeComputeTyped } from "./3D_Primitives/TorusKnot";

export { importObjNodeParams, importObjNodeComputeTyped } from "./3D_Primitives/ImportObj";
export { importGltfNodeParams, importGltfNodeComputeTyped } from "./3D_Primitives/ImportGltf";

export { pointLightNodeParams, pointLightNodeComputeTyped } from "./Lights/PointLight";
export { ambientLightNodeParams, ambientLightNodeComputeTyped } from "./Lights/AmbientLight";
export { directionalLightNodeParams, directionalLightNodeComputeTyped } from "./Lights/DirectionalLight";
export { spotLightNodeParams, spotLightNodeComputeTyped } from "./Lights/SpotLight";
export { hemisphereLightNodeParams, hemisphereLightNodeComputeTyped } from "./Lights/HemisphereLight";
export { rectAreaLightNodeParams, rectAreaLightNodeComputeTyped } from "./Lights/RectAreaLight";

export { transformNodeParams, transformNodeComputeTyped } from "./Modifiers/Transform";
export { combineNodeParams, combineNodeComputeTyped } from "./Modifiers/Combine";

export { noteNodeParams } from "./Utility/Note";

export type { GeoNodeData } from "./Geometry/GeoNode";
export type { BoxNodeData } from "./3D_Primitives/Box";
export type { SphereNodeData } from "./3D_Primitives/Sphere";
export type { CylinderNodeData } from "./3D_Primitives/Cylinder";
export type { ConeNodeData } from "./3D_Primitives/Cone";
export type { PlaneNodeData } from "./3D_Primitives/Plane";
export type { TorusNodeData } from "./3D_Primitives/Torus";
export type { TorusKnotNodeData } from "./3D_Primitives/TorusKnot";
export type { ImportObjNodeData } from "./3D_Primitives/ImportObj";
export type { ImportGltfNodeData } from "./3D_Primitives/ImportGltf";
export type { PointLightNodeData } from "./Lights/PointLight";
export type { AmbientLightNodeData } from "./Lights/AmbientLight";
export type { DirectionalLightNodeData } from "./Lights/DirectionalLight";
export type { SpotLightNodeData } from "./Lights/SpotLight";
export type { HemisphereLightNodeData } from "./Lights/HemisphereLight";
export type { RectAreaLightNodeData } from "./Lights/RectAreaLight";
export type { TransformNodeData } from "./Modifiers/Transform";
export type { CombineNodeData } from "./Modifiers/Combine";
export type { NoteNodeData } from "./Utility/Note";

export {
  nodeRegistry,
  getAvailableNodeTypes,
  isValidNodeType,
  getAllNodeDefinitions,
  getNodesByCategory,
  getAvailableCategories,
  searchNodes,
  getFilteredNodesByCategory,
  getNodesByCategoryForContext,
  getAvailableCategoriesForContext,
  searchNodesForContext,
  getFilteredNodesByCategoryForContext,
} from "./nodeRegistry";
