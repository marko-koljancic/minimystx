// Central export for all node types
// This provides a single import source for all nodes organized by category

// Container Nodes
export { geoNodeParams, geoNodeCompute } from "./Geometry/GeoNode";

// 3D Primitive Nodes
export { boxNodeParams, boxNodeComputeTyped } from "./3D_Primitives/Box";
export { sphereNodeParams, sphereNodeComputeTyped } from "./3D_Primitives/Sphere";
export { cylinderNodeParams, cylinderNodeComputeTyped } from "./3D_Primitives/Cylinder";
export { coneNodeParams, coneNodeComputeTyped } from "./3D_Primitives/Cone";
export { planeNodeParams, planeNodeComputeTyped } from "./3D_Primitives/Plane";
export { torusNodeParams, torusNodeComputeTyped } from "./3D_Primitives/Torus";
export { torusKnotNodeParams, torusKnotNodeComputeTyped } from "./3D_Primitives/TorusKnot";

// Import Nodes
export { importObjNodeParams, importObjNodeComputeTyped } from "./3D_Primitives/ImportObj";
export { importGltfNodeParams, importGltfNodeComputeTyped } from "./3D_Primitives/ImportGltf";

// Light Nodes
export { pointLightNodeParams, pointLightNodeCompute } from "./Lights/PointLight";
export { ambientLightNodeParams, ambientLightNodeCompute } from "./Lights/AmbientLight";
export { directionalLightNodeParams, directionalLightNodeCompute } from "./Lights/DirectionalLight";
export { spotLightNodeParams, spotLightNodeCompute } from "./Lights/SpotLight";
export { hemisphereLightNodeParams, hemisphereLightNodeCompute } from "./Lights/HemisphereLight";
export { rectAreaLightNodeParams, rectAreaLightNodeCompute } from "./Lights/RectAreaLight";

// Modifier Nodes
export { transformNodeParams, transformNodeComputeTyped } from "./Modifiers/Transform";

// Utility Nodes
export { noteNodeParams, noteNodeCompute } from "./Utility/Note";

// Export all NodeData types for type definitions
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
export type { NoteNodeData } from "./Utility/Note";

// Re-export everything imported above for grouped access
import * as _geoNode from "./Geometry/GeoNode";
import * as _box from "./3D_Primitives/Box";
import * as _sphere from "./3D_Primitives/Sphere";
import * as _cylinder from "./3D_Primitives/Cylinder";
import * as _cone from "./3D_Primitives/Cone";
import * as _plane from "./3D_Primitives/Plane";
import * as _torus from "./3D_Primitives/Torus";
import * as _torusKnot from "./3D_Primitives/TorusKnot";
import * as _importObj from "./3D_Primitives/ImportObj";
import * as _importGltf from "./3D_Primitives/ImportGltf";
import * as _pointLight from "./Lights/PointLight";
import * as _ambientLight from "./Lights/AmbientLight";
import * as _directionalLight from "./Lights/DirectionalLight";
import * as _spotLight from "./Lights/SpotLight";
import * as _hemisphereLight from "./Lights/HemisphereLight";
import * as _rectAreaLight from "./Lights/RectAreaLight";
import * as _transform from "./Modifiers/Transform";
import * as _note from "./Utility/Note";

// Grouped exports for easy category-based imports
export const geometryNodes = {
  geoNodeParams: _geoNode.geoNodeParams,
  geoNodeCompute: _geoNode.geoNodeCompute,
};

export const primitiveNodes = {
  boxNodeParams: _box.boxNodeParams,
  boxNodeComputeTyped: _box.boxNodeComputeTyped,
  sphereNodeParams: _sphere.sphereNodeParams,
  sphereNodeComputeTyped: _sphere.sphereNodeComputeTyped,
  cylinderNodeParams: _cylinder.cylinderNodeParams,
  cylinderNodeComputeTyped: _cylinder.cylinderNodeComputeTyped,
  coneNodeParams: _cone.coneNodeParams,
  coneNodeComputeTyped: _cone.coneNodeComputeTyped,
  planeNodeParams: _plane.planeNodeParams,
  planeNodeComputeTyped: _plane.planeNodeComputeTyped,
  torusNodeParams: _torus.torusNodeParams,
  torusNodeComputeTyped: _torus.torusNodeComputeTyped,
  torusKnotNodeParams: _torusKnot.torusKnotNodeParams,
  torusKnotNodeComputeTyped: _torusKnot.torusKnotNodeComputeTyped,
};

export const importNodes = {
  importObjNodeParams: _importObj.importObjNodeParams,
  importObjNodeComputeTyped: _importObj.importObjNodeComputeTyped,
  importGltfNodeParams: _importGltf.importGltfNodeParams,
  importGltfNodeComputeTyped: _importGltf.importGltfNodeComputeTyped,
};

export const lightNodes = {
  pointLightNodeParams: _pointLight.pointLightNodeParams,
  pointLightNodeCompute: _pointLight.pointLightNodeCompute,
  ambientLightNodeParams: _ambientLight.ambientLightNodeParams,
  ambientLightNodeCompute: _ambientLight.ambientLightNodeCompute,
  directionalLightNodeParams: _directionalLight.directionalLightNodeParams,
  directionalLightNodeCompute: _directionalLight.directionalLightNodeCompute,
  spotLightNodeParams: _spotLight.spotLightNodeParams,
  spotLightNodeCompute: _spotLight.spotLightNodeCompute,
  hemisphereLightNodeParams: _hemisphereLight.hemisphereLightNodeParams,
  hemisphereLightNodeCompute: _hemisphereLight.hemisphereLightNodeCompute,
  rectAreaLightNodeParams: _rectAreaLight.rectAreaLightNodeParams,
  rectAreaLightNodeCompute: _rectAreaLight.rectAreaLightNodeCompute,
};

export const modifierNodes = {
  transformNodeParams: _transform.transformNodeParams,
  transformNodeComputeTyped: _transform.transformNodeComputeTyped,
};

export const utilityNodes = {
  noteNodeParams: _note.noteNodeParams,
  noteNodeCompute: _note.noteNodeCompute,
};

// Export nodeRegistry and related functions for convenience
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
  getFilteredNodesByCategoryForContext
} from "./nodeRegistry";