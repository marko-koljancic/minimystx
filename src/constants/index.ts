import { Edge, Node } from "@xyflow/react";
import BoxNode from "../flow/nodes/3D_Primitives/BoxNode.tsx";
import SphereNode from "../flow/nodes/3D_Primitives/SphereNode.tsx";
import CylinderNode from "../flow/nodes/3D_Primitives/CylinderNode.tsx";
import PlaneNode from "../flow/nodes/3D_Primitives/PlaneNode.tsx";
import ConeNode from "../flow/nodes/3D_Primitives/ConeNode.tsx";
import TorusNode from "../flow/nodes/3D_Primitives/TorusNode.tsx";
import TorusKnotNode from "../flow/nodes/3D_Primitives/TorusKnotNode.tsx";
import TransformNode from "../flow/nodes/Modifiers/TransformNode.tsx";
import ImportObjNode from "../flow/nodes/3D_Primitives/ImportObjNode.tsx";
import ImportGltfNode from "../flow/nodes/3D_Primitives/ImportGltfNode.tsx";
import PointLightNode from "../flow/nodes/Lights/PointLightNode.tsx";
import AmbientLightNode from "../flow/nodes/Lights/AmbientLightNode.tsx";
import DirectionalLightNode from "../flow/nodes/Lights/DirectionalLightNode.tsx";
import SpotLightNode from "../flow/nodes/Lights/SpotLightNode.tsx";
import HemisphereLightNode from "../flow/nodes/Lights/HemisphereLightNode.tsx";
import RectAreaLightNode from "../flow/nodes/Lights/RectAreaLightNode.tsx";
import GeoNodeNode from "../flow/nodes/Geometry/GeoNodeNode.tsx";
import EdgeLine from "../flow/edges/EdgeLine.tsx";

import type {
  BoxNodeData,
  SphereNodeData,
  CylinderNodeData,
  PlaneNodeData,
  ConeNodeData,
  TorusNodeData,
  TorusKnotNodeData,
  TransformNodeData,
  ImportObjNodeData,
  ImportGltfNodeData,
  PointLightNodeData,
  AmbientLightNodeData,
  DirectionalLightNodeData,
  SpotLightNodeData,
  HemisphereLightNodeData,
  RectAreaLightNodeData,
  GeoNodeData,
  NoteNodeData,
} from "../flow/nodes";

import NoteNode from "../flow/nodes/Utility/NoteNode.tsx";
export const nodeTypes = {
  boxNode: BoxNode,
  sphereNode: SphereNode,
  cylinderNode: CylinderNode,
  planeNode: PlaneNode,
  coneNode: ConeNode,
  torusNode: TorusNode,
  torusKnotNode: TorusKnotNode,
  transformNode: TransformNode,
  importObjNode: ImportObjNode,
  importGltfNode: ImportGltfNode,
  pointLightNode: PointLightNode,
  ambientLightNode: AmbientLightNode,
  directionalLightNode: DirectionalLightNode,
  spotLightNode: SpotLightNode,
  hemisphereLightNode: HemisphereLightNode,
  rectAreaLightNode: RectAreaLightNode,
  geoNode: GeoNodeNode,
  noteNode: NoteNode,
};
export const edgeTypes = {
  wire: EdgeLine,
};
type FlowNodeTypes =
  | BoxNodeData
  | SphereNodeData
  | CylinderNodeData
  | PlaneNodeData
  | ConeNodeData
  | TorusNodeData
  | TorusKnotNodeData
  | TransformNodeData
  | ImportObjNodeData
  | ImportGltfNodeData
  | PointLightNodeData
  | AmbientLightNodeData
  | DirectionalLightNodeData
  | SpotLightNodeData
  | HemisphereLightNodeData
  | RectAreaLightNodeData
  | GeoNodeData
  | NoteNodeData;
export const initialEdges: Edge[] = [];
export const initialNodes: Node<FlowNodeTypes>[] = [];
export const GRAPH_SCHEMA = 1;
