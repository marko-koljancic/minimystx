import { Object3D, BufferGeometry, Vector3, Mesh, Group } from "three";
import type { GeneralProps, TransformProps, RenderingProps, NodeProcessor } from "../props";
import { createParameterMetadata } from "../../../engine/parameterUtils";
import { createGeneralParams, createTransformParams } from "../../../engine/nodeParameterFactories";
import type { NodeParams } from "../../../engine/graphStore";

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
  console.log("[Transform processor] Input received:", input, "Data:", data);
  
  if (!input || !input.object) {
    console.log("[Transform processor] No input or no input.object, returning empty Object3D");
    const emptyObj = new Object3D();
    return { object: emptyObj };
  }

  // Clone with proper type preservation
  let obj: Object3D;
  if (input.object instanceof Mesh) {
    // For Mesh objects, create a new Mesh with cloned geometry and material
    const mesh = input.object as Mesh;
    obj = new Mesh(
      mesh.geometry.clone(),
      mesh.material ? (Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone()) : undefined
    );
    // Copy all other properties
    obj.copy(input.object, false); // false = don't copy children
  } else if (input.object instanceof Group) {
    // For Groups, clone recursively
    obj = input.object.clone(true);
  } else {
    // For other Object3D types, use standard cloning
    obj = input.object.clone(true);
  }
  
  let geometry: BufferGeometry | undefined = input.geometry;

  // Apply additive position (relative to current position)
  const position = data.transform.position || { x: 0, y: 0, z: 0 };
  obj.position.add(new Vector3(position.x, position.y, position.z));

  // Apply additive rotation with specified order (relative to current rotation)
  const rotation = data.transform.rotation || { x: 0, y: 0, z: 0 };
  const rotationOrder = data.transform.rotationOrder || "XYZ";
  
  // Apply additive rotation - input is already in radians
  obj.rotation.set(
    obj.rotation.x + rotation.x,
    obj.rotation.y + rotation.y,
    obj.rotation.z + rotation.z,
    rotationOrder as any
  );

  // Apply multiplicative scale with scale factor
  const scale = data.transform.scale || { x: 1, y: 1, z: 1, factor: 1 };
  const scaleFactor = scale.factor || 1;
  obj.scale.multiply(new Vector3(
    scale.x * scaleFactor,
    scale.y * scaleFactor,
    scale.z * scaleFactor
  ));

  // Set visibility
  obj.visible = data.rendering?.visible !== false;

  // Extract geometry if object is a mesh (preserve input geometry if available)
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
  console.log("[transformNodeCompute] Called with params:", params, "inputs:", inputs);
  
  const inputKeys = Object.keys(inputs);
  let inputObject: { object: Object3D; geometry?: BufferGeometry } | undefined = undefined;

  if (inputKeys.length > 0) {
    const input = inputs[inputKeys[0]];
    console.log("[transformNodeCompute] Processing input:", input);
    
    // Expect standard format: { object: Object3D, geometry?: BufferGeometry }
    if (input && typeof input === "object" && (input as any).object && (input as any).object.isObject3D) {
      inputObject = input as { object: Object3D; geometry?: BufferGeometry };
      console.log("[transformNodeCompute] Valid input object found:", inputObject);
    } else {
      console.log("[transformNodeCompute] Input is not a valid Object3D:", input);
    }
  } else {
    console.log("[transformNodeCompute] No inputs received");
  }

  // Convert params to structured data with proper fallbacks
  const data: TransformNodeData = {
    general: params.general || {},
    transform: {
      position: params.transform?.position || { x: 0, y: 0, z: 0 },
      rotation: params.transform?.rotation || { x: 0, y: 0, z: 0 },
      scale: { 
        ...params.transform?.scale,
        factor: params.transform?.scaleFactor || 1
      },
      rotationOrder: params.transform?.rotationOrder || "XYZ",
    },
    rendering: {
      visible: params.rendering?.visible !== false, // Default to true unless explicitly false
      ...params.rendering
    },
  };
  
  
  return processor(data, inputObject);
};
