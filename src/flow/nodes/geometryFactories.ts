import { BufferGeometry, Mesh, MeshStandardMaterial, Object3D } from "three";
import type { GeneralProps, TransformProps, RenderingProps } from "./props";
import { Object3DContainer } from "../../engine/containers/BaseContainer";
export interface BaseGeometryData {
  general: GeneralProps;
  transform: TransformProps;
  rendering: RenderingProps;
}
export function createGeometryMesh<T extends BaseGeometryData>(
  data: T,
  geometry: BufferGeometry,
  _input?: Object3D
): Object3DContainer {
  const material = data.rendering.material || new MeshStandardMaterial();
  if (material instanceof MeshStandardMaterial) {
    material.color.setStyle("#ffffff");
  }
  const mesh = new Mesh(geometry, material);
  // Do NOT bake rendering.visible into the mesh. `rendering.visible` gates whether the
  // node renders AS the active subflow output (enforced in SceneObjectManager); baking
  // it here would leave a non-active node's mesh invisible even when it is consumed as
  // an input by a downstream node (e.g. Combine), hiding it in the combined result.
  mesh.visible = true;
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  mesh.castShadow = data.rendering.castShadow ?? false;
  mesh.receiveShadow = data.rendering.receiveShadow ?? false;
  return new Object3DContainer(mesh);
}
