import * as THREE from "three";

interface WireframeOverlayManagerDependencies {
  scene: THREE.Scene;
}

export class WireframeOverlayManager {
  private wireframeGeometryCache: WeakMap<THREE.BufferGeometry, THREE.WireframeGeometry> = new WeakMap();
  private meshOverlayMap: WeakMap<THREE.Mesh, THREE.LineSegments> = new WeakMap();
  private activeMeshes: Set<THREE.Mesh> = new Set();
  private wireframeMaterial: THREE.LineBasicMaterial = new THREE.LineBasicMaterial();

  constructor(private dependencies: WireframeOverlayManagerDependencies) {
    this.initializeWireframeMaterial();
  }

  public addWireframeOverlay(mesh: THREE.Mesh): void {
    if (this.meshOverlayMap.has(mesh)) {
      return;
    }

    const geometry = mesh.geometry;
    let wireframeGeometry = this.wireframeGeometryCache.get(geometry);

    if (!wireframeGeometry) {
      wireframeGeometry = new THREE.WireframeGeometry(geometry);
      this.wireframeGeometryCache.set(geometry, wireframeGeometry);
    }

    const lineSegments = new THREE.LineSegments(wireframeGeometry, this.wireframeMaterial);
    
    mesh.add(lineSegments);
    this.meshOverlayMap.set(mesh, lineSegments);
    this.activeMeshes.add(mesh);
  }

  public removeWireframeOverlay(mesh: THREE.Mesh): void {
    const overlay = this.meshOverlayMap.get(mesh);
    if (overlay) {
      mesh.remove(overlay);
      this.meshOverlayMap.delete(mesh);
      this.activeMeshes.delete(mesh);
    }
  }

  public updateWireframeOverlays(meshes: THREE.Mesh[]): void {
    const currentMeshes = new Set(meshes);
    
    for (const mesh of this.activeMeshes) {
      if (!currentMeshes.has(mesh)) {
        const overlay = this.meshOverlayMap.get(mesh);
        if (overlay) {
          mesh.remove(overlay);
          this.meshOverlayMap.delete(mesh);
        }
      }
    }
    
    this.activeMeshes.clear();

    for (const mesh of meshes) {
      if (!this.meshOverlayMap.has(mesh)) {
        this.addWireframeOverlay(mesh);
      } else {
        this.activeMeshes.add(mesh);
      }
    }
  }

  public clearAllOverlays(): void {
    for (const mesh of this.activeMeshes) {
      const overlay = this.meshOverlayMap.get(mesh);
      if (overlay) {
        mesh.remove(overlay);
        this.meshOverlayMap.delete(mesh);
      }
    }
    this.activeMeshes.clear();
  }

  public dispose(): void {
    this.clearAllOverlays();
    if (this.wireframeMaterial) {
      this.wireframeMaterial.dispose();
    }
    this.wireframeGeometryCache = new WeakMap();
    this.meshOverlayMap = new WeakMap();
  }

  private initializeWireframeMaterial(): void {
    const thickness = 1.5 * Math.min(window.devicePixelRatio, 2);
    this.wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: thickness,
      transparent: true,
      opacity: 0.4,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }
}