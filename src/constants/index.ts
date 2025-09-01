import { Edge, Node } from "@xyflow/react";
import BoxNode from "../flow/nodes/Geometry/BoxNode.tsx";
import SphereNode from "../flow/nodes/Geometry/SphereNode.tsx";
import CylinderNode from "../flow/nodes/Geometry/CylinderNode.tsx";
import PlaneNode from "../flow/nodes/Geometry/PlaneNode.tsx";
import ConeNode from "../flow/nodes/Geometry/ConeNode.tsx";
import TorusNode from "../flow/nodes/Geometry/TorusNode.tsx";
import TorusKnotNode from "../flow/nodes/Geometry/TorusKnotNode.tsx";
import TransformNode from "../flow/nodes/Utility/TransformNode.tsx";
import ImportObjNode from "../flow/nodes/Geometry/ImportObjNode.tsx";
import ImportGltfNode from "../flow/nodes/Geometry/ImportGltfNode.tsx";
import PointLightNode from "../flow/nodes/Lights/PointLightNode.tsx";
import AmbientLightNode from "../flow/nodes/Lights/AmbientLightNode.tsx";
import DirectionalLightNode from "../flow/nodes/Lights/DirectionalLightNode.tsx";
import SpotLightNode from "../flow/nodes/Lights/SpotLightNode.tsx";
import HemisphereLightNode from "../flow/nodes/Lights/HemisphereLightNode.tsx";
import RectAreaLightNode from "../flow/nodes/Lights/RectAreaLightNode.tsx";
import GeoNodeNode from "../flow/nodes/Root/GeoNodeNode.tsx";
import EdgeLine from "../flow/edges/EdgeLine.tsx";
import { BoxNodeData } from "../flow/nodes/Geometry/Box";
import { SphereNodeData } from "../flow/nodes/Geometry/Sphere";
import { CylinderNodeData } from "../flow/nodes/Geometry/Cylinder";
import { PlaneNodeData } from "../flow/nodes/Geometry/Plane";
import { ConeNodeData } from "../flow/nodes/Geometry/Cone";
import { TorusNodeData } from "../flow/nodes/Geometry/Torus";
import { TorusKnotNodeData } from "../flow/nodes/Geometry/TorusKnot";
import { TransformNodeData } from "../flow/nodes/Utility/Transform";
import { ImportObjNodeData } from "../flow/nodes/Geometry/ImportObj";
import { ImportGltfNodeData } from "../flow/nodes/Geometry/ImportGltf";
import { PointLightNodeData } from "../flow/nodes/Lights/PointLight";
import { AmbientLightNodeData } from "../flow/nodes/Lights/AmbientLight";
import { DirectionalLightNodeData } from "../flow/nodes/Lights/DirectionalLight";
import { SpotLightNodeData } from "../flow/nodes/Lights/SpotLight";
import { HemisphereLightNodeData } from "../flow/nodes/Lights/HemisphereLight";
import { RectAreaLightNodeData } from "../flow/nodes/Lights/RectAreaLight";
import { GeoNodeData } from "../flow/nodes/Root/GeoNode";
import NoteNode from "../flow/nodes/Utility/NoteNode.tsx";
import { NoteNodeData } from "../flow/nodes/Utility/Note";
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
