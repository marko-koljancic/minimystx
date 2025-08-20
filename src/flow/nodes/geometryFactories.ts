import { BufferGeometry, Mesh, MeshStandardMaterial, Object3D } from "three";
import type { GeneralProps, TransformProps, RenderingProps } from "./props";

export interface BaseGeometryData {
  general: GeneralProps;
  transform: TransformProps;
  rendering: RenderingProps;
}

export function createGeometryMesh<T extends BaseGeometryData>(
  data: T,
  geometry: BufferGeometry,
  _input?: Object3D
): { object: Object3D; geometry: BufferGeometry } {
  const material = data.rendering.material || new MeshStandardMaterial();

  // Color will be applied at GeoNode level in Phase 5
  // For now, use default white material for sub-flow geometry
  if (material instanceof MeshStandardMaterial) {
    material.color.setStyle("#ffffff");
  }

  const mesh = new Mesh(geometry, material);
  mesh.visible = data.rendering.visible !== false;
  
  // Geometry nodes now generate at origin - no transform application
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  
  // Shadow properties will be applied at GeoNode level in Phase 5
  // For now, use defaults to prevent issues
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return { object: mesh, geometry };
}
