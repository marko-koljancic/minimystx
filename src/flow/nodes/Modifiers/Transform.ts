import { Object3D, BufferGeometry, Vector3, Mesh, Group } from "three";
import type { GeneralProps, TransformProps, RenderingProps, NodeProcessor } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createGeneralParams, createTransformParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { BaseContainer, Object3DContainer } from "../../../engine/containers/BaseContainer";
export interface TransformNodeData extends Record<string, unknown> {
  general: GeneralProps;
  transform: TransformProps & {
    rotationOrder?: string;
  };
  rendering: RenderingProps;
}
export const processor: NodeProcessor<
  TransformNodeData,
  { object: Object3D; geometry?: BufferGeometry }
> = (
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
  const rotationOrder = data.transform.rotationOrder || "XYZ";
  obj.rotation.set(
    obj.rotation.x + rotation.x,
    obj.rotation.y + rotation.y,
    obj.rotation.z + rotation.z,
    rotationOrder as any
  );
  const scale = data.transform.scale || { x: 1, y: 1, z: 1, factor: 1 };
  const scaleFactor = scale.factor || 1;
  obj.scale.multiply(
    new Vector3(scale.x * scaleFactor, scale.y * scaleFactor, scale.z * scaleFactor)
  );
  obj.visible = data.rendering?.visible !== false;
  if (!geometry && (obj as any).geometry) {
    geometry = (obj as any).geometry;
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
export const transformNodeCompute = (params: Record<string, any>, inputs: Record<string, any>) => {
  const inputKeys = Object.keys(inputs);
  let inputObject: { object: Object3D; geometry?: BufferGeometry } | undefined = undefined;
  if (inputKeys.length > 0) {
    const input = inputs[inputKeys[0]];
    if (
      input &&
      typeof input === "object" &&
      (input as any).object &&
      (input as any).object.isObject3D
    ) {
      inputObject = input as { object: Object3D; geometry?: BufferGeometry };
    } else {
    }
  } else {
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
  return processor(data, inputObject);
};
export const transformNodeComputeTyped = (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
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
  const result = processor(data, inputObject);
  return { default: new Object3DContainer(result.object) };
};
