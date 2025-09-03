import {
  Group,
  Object3D,
  BufferGeometry,
  Mesh,
  Box3,
  Vector3,
  Material,
  MeshStandardMaterial,
} from "three";
import { GLTFLoader, GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { GeneralProps, TransformProps, RenderingProps } from "../props";
import { createParameterMetadata, extractDefaultValues } from "../../../engine/parameterUtils";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { createGeneralParams, createRenderingParams } from "../../../engine/nodeParameterFactories";
import { getAssetCache } from "../../../io/mxscene/opfs-cache";
import { hashBytesSHA256 } from "../../../io/mxscene/crypto";
import { BaseContainer, Object3DContainer } from "../../../engine/containers/BaseContainer";
export interface SerializableGltfFile {
  name: string;
  size: number;
  lastModified: number;
  content: string;
}
export interface ImportGltfNodeData extends Record<string, unknown> {
  general: GeneralProps;
  object: {
    file: File | SerializableGltfFile | null;
    scale: number;
    centerToOrigin: boolean;
    preserveMaterials: boolean;
  };
  transform: TransformProps;
  rendering: RenderingProps;
}
function validateFile(file: File | SerializableGltfFile | null): {
  valid: boolean;
  error?: string;
} {
  if (!file) return { valid: false, error: "No file selected" };
  if (!file.name) return { valid: false, error: "File name is missing" };
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "gltf" && extension !== "glb")
    return {
      valid: false,
      error: "Unsupported file type. Only .gltf and .glb files are supported.",
    };
  return { valid: true };
}
async function fileToSerializableGltfFile(file: File): Promise<SerializableGltfFile> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  const binaryString = Array.from(uint8Array, (byte) => String.fromCharCode(byte)).join("");
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    content: btoa(binaryString),
  };
}
async function getFileArrayBuffer(file: File | SerializableGltfFile): Promise<ArrayBuffer> {
  if (file instanceof File) {
    return await file.arrayBuffer();
  } else {
    if (!file.content || typeof file.content !== "string") {
      throw new Error("SerializableGltfFile content is missing or invalid");
    }
    try {
      const binaryString = atob(file.content);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      return uint8Array.buffer;
    } catch (error) {
      throw new Error("Failed to decode SerializableGltfFile content: Invalid base64 encoding");
    }
  }
}
function centerObject(object: Object3D): void {
  const box = new Box3().setFromObject(object);
  const center = box.getCenter(new Vector3());
  object.position.sub(center);
}
function extractAllMeshes(scene: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  scene.traverse((child) => {
    if (child instanceof Mesh) {
      meshes.push(child);
    }
  });
  return meshes;
}
function applyDefaultMaterials(meshes: Mesh[]): void {
  const defaultMaterial = new MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.0,
    roughness: 0.5,
  });
  meshes.forEach((mesh) => {
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat: Material) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    mesh.material = defaultMaterial.clone();
  });
}
function processGltfScene(gltf: GLTF, preserveMaterials: boolean): Object3D {
  const scene = gltf.scene.clone();
  if (!preserveMaterials) {
    const meshes = extractAllMeshes(scene);
    applyDefaultMaterials(meshes);
  }
  return scene;
}
const gltfCache = new Map<string, Object3D>();
let gltfLoader: GLTFLoader | null = null;
function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    gltfLoader.setDRACOLoader(dracoLoader);
  }
  return gltfLoader;
}
async function getAssetHash(file: File | SerializableGltfFile): Promise<string> {
  const arrayBuffer = await getFileArrayBuffer(file);
  return hashBytesSHA256(arrayBuffer);
}
function getCacheKey(file: File | SerializableGltfFile): string {
  return `${file.name}_${file.lastModified}_${file.size}`;
}
async function loadGltfFile(file: File | SerializableGltfFile): Promise<Object3D> {
  const memoryCacheKey = getCacheKey(file);
  if (gltfCache.has(memoryCacheKey)) {
    const cached = gltfCache.get(memoryCacheKey)!;
    return cached.clone();
  }
  const loader = getGLTFLoader();
  const arrayBuffer = await getFileArrayBuffer(file);
  const gltf: GLTF = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });
  const object = gltf.scene;
  gltfCache.set(memoryCacheKey, object);
  try {
    const assetHash = await getAssetHash(file);
    const assetCache = getAssetCache();
    if (!(await assetCache.has(assetHash))) {
      await assetCache.put(assetHash, arrayBuffer);
    }
  } catch (cacheError) {}
  return object.clone();
}
async function loadGltfFromCache(hash: string): Promise<Object3D | null> {
  try {
    const assetCache = getAssetCache();
    const data = await assetCache.get(hash);
    if (!data) {
      return null;
    }
    const loader = getGLTFLoader();
    const gltf: GLTF = await new Promise((resolve, reject) => {
      loader.parse(data, "", resolve, reject);
    });
    return gltf.scene;
  } catch (error) {
    return null;
  }
}
export const processor = async (
  data: ImportGltfNodeData,
  input?: { object: Object3D; geometry?: BufferGeometry }
): Promise<{ object: Object3D; geometry?: BufferGeometry; shouldSetAsActiveOutput?: boolean }> => {
  const clonedData = {
    object: {
      file: data.object?.file || null,
      scale: data.object?.scale || 1,
      centerToOrigin: data.object?.centerToOrigin || false,
      preserveMaterials:
        data.object?.preserveMaterials !== undefined ? data.object.preserveMaterials : true,
    },
    transform: {
      position: {
        x: data.transform?.position?.x || 0,
        y: data.transform?.position?.y || 0,
        z: data.transform?.position?.z || 0,
      },
      rotation: {
        x: data.transform?.rotation?.x || 0,
        y: data.transform?.rotation?.y || 0,
        z: data.transform?.rotation?.z || 0,
      },
      scale: {
        x: data.transform?.scale?.x || 1,
        y: data.transform?.scale?.y || 1,
        z: data.transform?.scale?.z || 1,
        factor: data.transform?.scale?.factor || 1,
      },
    },
    rendering: {
      visible: data.rendering?.visible !== undefined ? data.rendering.visible : true,
      castShadow: data.rendering?.castShadow !== undefined ? data.rendering.castShadow : false,
      receiveShadow:
        data.rendering?.receiveShadow !== undefined ? data.rendering.receiveShadow : false,
    },
  };
  if (!clonedData.object.file) {
    const emptyGroup = new Group();
    emptyGroup.name = "EmptyImportGltfGroup";
    return { object: emptyGroup, geometry: undefined };
  }
  const validation = validateFile(clonedData.object.file);
  if (!validation.valid) {
    return { object: new Group(), geometry: undefined };
  }
  const cacheKey = getCacheKey(clonedData.object.file);
  if (!gltfCache.has(cacheKey)) {
    try {
      await loadGltfFile(clonedData.object.file);
    } catch (error) {
      return { object: new Group(), geometry: undefined };
    }
  }
  if (!gltfCache.has(cacheKey)) {
    return { object: new Group(), geometry: undefined };
  }
  let loadedObject: Object3D;
  try {
    loadedObject = gltfCache.get(cacheKey)!.clone();
    loadedObject = processGltfScene(
      { scene: loadedObject } as GLTF,
      clonedData.object.preserveMaterials
    );
  } catch (error) {
    return { object: new Group(), geometry: undefined };
  }
  const validScale = clonedData.object.scale <= 0 ? 0.001 : clonedData.object.scale;
  if (validScale !== 1) loadedObject.scale.multiplyScalar(validScale);
  if (clonedData.object.centerToOrigin) centerObject(loadedObject);
  loadedObject.position.add(
    new Vector3(
      clonedData.transform.position.x,
      clonedData.transform.position.y,
      clonedData.transform.position.z
    )
  );
  loadedObject.rotation.set(
    loadedObject.rotation.x + clonedData.transform.rotation.x,
    loadedObject.rotation.y + clonedData.transform.rotation.y,
    loadedObject.rotation.z + clonedData.transform.rotation.z
  );
  const scaleFactor = clonedData.transform.scale.factor || 1;
  loadedObject.scale.multiply(
    new Vector3(
      clonedData.transform.scale.x * scaleFactor,
      clonedData.transform.scale.y * scaleFactor,
      clonedData.transform.scale.z * scaleFactor
    )
  );
  loadedObject.visible = clonedData.rendering.visible;
  loadedObject.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = clonedData.rendering.castShadow;
      child.receiveShadow = clonedData.rendering.receiveShadow;
    }
  });
  let geometry: BufferGeometry | undefined;
  const meshes = extractAllMeshes(loadedObject);
  if (meshes.length > 0) {
    geometry = meshes[0].geometry;
  }
  if (input && input.object) {
    const isValidObject3D = (obj: any): obj is Object3D => {
      return (
        obj &&
        typeof obj === "object" &&
        obj.isObject3D === true &&
        "updateMatrixWorld" in obj &&
        typeof obj.updateMatrixWorld === "function" &&
        "matrixWorld" in obj &&
        obj.matrixWorld !== null &&
        obj.matrixWorld !== undefined
      );
    };
    if (isValidObject3D(input.object)) {
      try {
        input.object.updateMatrixWorld(true);
        if (input.object.matrixWorld) {
          loadedObject.applyMatrix4(input.object.matrixWorld);
        }
      } catch (error) {}
    }
  }
  return { object: loadedObject, geometry };
};
export { loadGltfFile, fileToSerializableGltfFile, loadGltfFromCache, getAssetHash };
export const importGltfNodeParams: NodeParams = {
  general: createGeneralParams("Import glTF", "Load geometry from .gltf/.glb file"),
  object: {
    file: createParameterMetadata("file", null, {
      displayName: "File",
      accept: ".gltf,.glb,model/gltf+json,model/gltf-binary",
    }),
    scale: createParameterMetadata("number", 1, {
      displayName: "Scale",
      min: 0.001,
      max: 100,
      step: 0.1,
    }),
    centerToOrigin: createParameterMetadata("boolean", false, { displayName: "Center to Origin" }),
    preserveMaterials: createParameterMetadata("boolean", true, {
      displayName: "Preserve Materials",
    }),
  },
  rendering: createRenderingParams(),
};
export const importGltfNodeCompute = async (
  params: Record<string, any>,
  inputs?: unknown,
  context?: { nodeId?: string }
) => {
  const defaultParams = extractDefaultValues(importGltfNodeParams);
  const data: ImportGltfNodeData = {
    general: (params.general as ImportGltfNodeData["general"]) || defaultParams.general,
    object: (params.object as ImportGltfNodeData["object"]) || defaultParams.object,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    rendering: (params.rendering as ImportGltfNodeData["rendering"]) || defaultParams.rendering,
  };
  const inputObject =
    inputs && Object.keys(inputs).length > 0
      ? (Object.values(inputs)[0] as { object: Object3D; geometry?: BufferGeometry })
      : undefined;
  const result = await processor(data, inputObject);
  if (result?.object && context?.nodeId) {
    const finalResult = { ...result, shouldSetAsActiveOutput: true };
    return finalResult;
  } else {
    if (!result?.object) {
    }
    if (!context?.nodeId) {
    }
  }
  return result;
};
export const importGltfNodeComputeTyped = async (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Promise<Record<string, BaseContainer>> => {
  const defaultParams = extractDefaultValues(importGltfNodeParams);
  const data: ImportGltfNodeData = {
    general: (params.general as ImportGltfNodeData["general"]) || defaultParams.general,
    object: (params.object as ImportGltfNodeData["object"]) || defaultParams.object,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    rendering: (params.rendering as ImportGltfNodeData["rendering"]) || defaultParams.rendering,
  };
  const inputContainer = inputs.default as Object3DContainer | undefined;
  const inputObject = inputContainer ? { object: inputContainer.value } : undefined;
  const result = await processor(data, inputObject);
  if (!result?.object) {
    return { default: new Object3DContainer(new Group()) };
  }
  return { default: new Object3DContainer(result.object) };
};
