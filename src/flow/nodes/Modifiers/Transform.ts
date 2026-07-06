import { Object3D, BufferGeometry, Vector3, Mesh, Group, EulerOrder } from "three";
import type { GeneralProps, TransformProps, RenderingProps } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createGeneralParams, createTransformParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams } from "../../../engine/graphStore";
import { BaseContainer, Object3DContainer } from "../../../engine/containers/BaseContainer";
export interface TransformNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: TransformProps & {
    rotationOrder?: string;
  };
  rendering: RenderingProps;
}
const transformObject = (
  data: TransformNodeData,
  input?: { object: Object3D; geometry?: BufferGeometry }
): { object: Object3D; geometry?: BufferGeometry } => {
  if (!input || !input.object) {
    const emptyObj = new Object3D();
    return { object: emptyObj };
  }
  let obj: Object3D;
  if (input.object instanceof Mesh) {
    const mesh = input.object as Mesh;
    obj = new Mesh(
      mesh.geometry.clone(),
      mesh.material
        ? Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone()
        : undefined
    );
    obj.copy(input.object, false);
  } else if (input.object instanceof Group) {
    obj = input.object.clone(true);
  } else {
    obj = input.object.clone(true);
  }
  let geometry: BufferGeometry | undefined = input.geometry;
  const position = data.transform.position || { x: 0, y: 0, z: 0 };
  obj.position.add(new Vector3(position.x, position.y, position.z));
  const rotation = data.transform.rotation || { x: 0, y: 0, z: 0 };
  const rotationOrder = (data.transform.rotationOrder || "XYZ") as EulerOrder;
  obj.rotation.set(obj.rotation.x + rotation.x, obj.rotation.y + rotation.y, obj.rotation.z + rotation.z, rotationOrder);
  const scale = data.transform.scale || { x: 1, y: 1, z: 1, factor: 1 };
  const scaleFactor = scale.factor || 1;
  obj.scale.multiply(new Vector3(scale.x * scaleFactor, scale.y * scaleFactor, scale.z * scaleFactor));
  obj.visible = data.rendering?.visible !== false;
  if (!geometry && obj instanceof Mesh) {
    geometry = obj.geometry;
  }
  return { object: obj, geometry };
};
export const transformNodeParams: NodeParams = {
  general: createGeneralParams("Transform Node", "Applies transformations to input geometry"),
  transform: {
    ...createTransformParams(),
    rotationOrder: createParameterMetadata("enum", "XYZ", {
      displayName: "Rotation Order",
      enumValues: ["XYZ", "XZY", "YXZ", "YZX", "ZXY", "ZYX"],
    }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, { displayName: "Visible" }),
  },
};
export const transformNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>
): Record<string, BaseContainer> => {
  const inputContainer = inputs.default as Object3DContainer | undefined;
  if (!inputContainer) {
    return { default: new Object3DContainer(new Object3D()) };
  }
  const data: TransformNodeData = {
    general: params.general || {},
    transform: {
      position: params.transform?.position || { x: 0, y: 0, z: 0 },
      rotation: params.transform?.rotation || { x: 0, y: 0, z: 0 },
      scale: {
        ...params.transform?.scale,
        factor: params.transform?.scaleFactor || 1,
      },
      rotationOrder: params.transform?.rotationOrder || "XYZ",
    },
    rendering: {
      visible: params.rendering?.visible !== false,
      ...params.rendering,
    },
  };
  const inputObject = { object: inputContainer.value };
  const result = transformObject(data, inputObject);
  return { default: new Object3DContainer(result.object) };
};
