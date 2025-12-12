import { Group, Object3D, BufferGeometry, Mesh, Box3, Vector3 } from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { GeneralProps, TransformProps, RenderingProps, NodeProcessor } from "../props";
import { createParameterMetadata, extractDefaultValues } from "../../../engine/parameterUtils";
import type { NodeParams, ComputeContext } from "../../../engine/graphStore";
import { createGeneralParams, createRenderingParams } from "../../../engine/nodeParameterFactories";
import { getAssetCache } from "../../../io/mxscene/opfs-cache";
import { hashBytesSHA256 } from "../../../io/mxscene/crypto";
import { BaseContainer, Object3DContainer } from "../../../engine/containers/BaseContainer";
export interface SerializableObjFile {
  name: string;
  size: number;
  lastModified: number;
  content: string;
}
export interface ImportObjNodeData extends Record<string, unknown> {
  general: GeneralProps;
  object: {
    file: File | SerializableObjFile | null;
    scale: number;
    centerToOrigin: boolean;
  };
  transform: TransformProps;
  rendering: RenderingProps;
}
function validateFile(file: File | SerializableObjFile | null): { valid: boolean; error?: string } {
  if (!file) return { valid: false, error: "No file selected" };
  if (!file.name) return { valid: false, error: "File name is missing" };
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "obj") return { valid: false, error: "Unsupported file type. Only .obj files are supported." };
  return { valid: true };
}
async function fileToSerializableObjFile(file: File): Promise<SerializableObjFile> {
  const content = await file.text();
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    content: btoa(content),
  };
}
async function getFileContent(file: File | SerializableObjFile): Promise<string> {
  if (file instanceof File) {
    return await file.text();
  }
  if ("text" in file && typeof (file as any).text === "function") {
    try {
      return await (file as any).text();
    } catch (error) {}
  }
  if ("content" in file && file.content && typeof file.content === "string") {
    try {
      return atob(file.content);
    } catch (error) {
      throw new Error("Failed to decode SerializableObjFile content: Invalid base64 encoding");
    }
  }
  if (typeof file === "object" && "content" in file && typeof (file as any).content === "string") {
    return (file as any).content;
  }
  throw new Error(
    `Unsupported file format: ${typeof file}, constructor: ${file?.constructor?.name}, keys: ${Object.keys(file || {})}`
  );
}
function centerObject(object: Object3D): void {
  const box = new Box3().setFromObject(object);
  const center = box.getCenter(new Vector3());
  object.position.sub(center);
}
const objCache = new Map<string, Object3D>();
async function getAssetHash(file: File | SerializableObjFile): Promise<string> {
  const content = await getFileContent(file);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  return hashBytesSHA256(data.buffer);
}
function getCacheKey(file: File | SerializableObjFile): string {
  return `${file.name}_${file.lastModified}_${file.size}`;
}
async function loadObjFile(file: File | SerializableObjFile): Promise<Object3D> {
  const memoryCacheKey = getCacheKey(file);
  if (objCache.has(memoryCacheKey)) {
    const cached = objCache.get(memoryCacheKey)!;
    return cached.clone();
  }
  const loader = new OBJLoader();
  const text = await getFileContent(file);

  const object = loader.parse(text);
  objCache.set(memoryCacheKey, object);

  const assetHash = await getAssetHash(file);
  const assetCache = getAssetCache();
  if (!(await assetCache.has(assetHash))) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    await assetCache.put(assetHash, data.buffer);
  }

  return object.clone();
}
async function loadObjFromCache(hash: string): Promise<Object3D | null> {
  try {
    const assetCache = getAssetCache();
    const data = await assetCache.get(hash);
    if (!data) {
      return null;
    }
    const decoder = new TextDecoder();
    const text = decoder.decode(data);
    const loader = new OBJLoader();
    const object = loader.parse(text);
    return object;
  } catch (error) {
    return null;
  }
}
export const processor: NodeProcessor<
  ImportObjNodeData,
  { object: Object3D; geometry?: BufferGeometry; shouldSetAsActiveOutput?: boolean }
> = (data: ImportObjNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  if (!data.object.file) {
    const emptyGroup = new Group();
    emptyGroup.name = "EmptyImportObjGroup";
    return { object: emptyGroup, geometry: undefined };
  }
  const validation = validateFile(data.object.file);
  if (!validation.valid) {
    return { object: new Group(), geometry: undefined };
  }
  const cacheKey = getCacheKey(data.object.file);
  if (!objCache.has(cacheKey)) {
    return { object: new Group(), geometry: undefined };
  }
  let loadedObject: Object3D;
  try {
    loadedObject = objCache.get(cacheKey)!.clone();
  } catch (error) {
    return { object: new Group(), geometry: undefined };
  }
  const validScale = data.object.scale <= 0 ? 0.001 : data.object.scale;
  if (validScale !== 1) loadedObject.scale.multiplyScalar(validScale);
  if (data.object.centerToOrigin) centerObject(loadedObject);
  loadedObject.position.add(
    new Vector3(data.transform.position.x, data.transform.position.y, data.transform.position.z)
  );
  loadedObject.rotation.set(
    loadedObject.rotation.x + data.transform.rotation.x,
    loadedObject.rotation.y + data.transform.rotation.y,
    loadedObject.rotation.z + data.transform.rotation.z
  );
  const scaleFactor = data.transform.scale.factor || 1;
  loadedObject.scale.multiply(
    new Vector3(
      data.transform.scale.x * scaleFactor,
      data.transform.scale.y * scaleFactor,
      data.transform.scale.z * scaleFactor
    )
  );
  loadedObject.visible = data.rendering.visible;
  loadedObject.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = data.rendering.castShadow ?? false;
      child.receiveShadow = data.rendering.receiveShadow ?? false;
    }
  });
  let geometry: BufferGeometry | undefined;
  if (loadedObject instanceof Mesh && loadedObject.geometry) {
    geometry = loadedObject.geometry;
  } else if (loadedObject.children.length === 1 && loadedObject.children[0] instanceof Mesh) {
    geometry = (loadedObject.children[0] as Mesh).geometry;
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
        } else {
        }
      } catch (error) {}
    } else {
    }
  }
  return { object: loadedObject, geometry };
};
export { loadObjFile, fileToSerializableObjFile, loadObjFromCache, getAssetHash };
export const importObjNodeParams: NodeParams = {
  general: createGeneralParams("Import OBJ", "Load geometry from .obj file"),
  object: {
    file: createParameterMetadata("file", null, { displayName: "File", accept: ".obj" }),
    scale: createParameterMetadata("number", 1, {
      displayName: "Scale",
      min: 0.001,
      max: 100,
      step: 0.1,
    }),
    centerToOrigin: createParameterMetadata("boolean", false, { displayName: "Center to Origin" }),
  },
  rendering: createRenderingParams(),
};
export const importObjNodeCompute = (
  params: Record<string, unknown>,
  inputs?: unknown,
  context?: { nodeId?: string }
) => {
  const defaultParams = extractDefaultValues(importObjNodeParams);
  const data: ImportObjNodeData = {
    general: (params.general as ImportObjNodeData["general"]) || defaultParams.general,
    object: (params.object as ImportObjNodeData["object"]) || defaultParams.object,
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    rendering: (params.rendering as ImportObjNodeData["rendering"]) || defaultParams.rendering,
  };
  const inputObject =
    inputs && Object.keys(inputs).length > 0
      ? (Object.values(inputs)[0] as { object: Object3D; geometry?: BufferGeometry })
      : undefined;
  const result = processor(data, inputObject);
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
export const importObjNodeComputeTyped = async (
  params: Record<string, any>,
  inputs: Record<string, BaseContainer>,
  context: ComputeContext
): Promise<Record<string, BaseContainer>> => {
  const defaultParams = extractDefaultValues(importObjNodeParams);
  const originalObjectParams = (params.object as ImportObjNodeData["object"]) || defaultParams.object;
  const data: ImportObjNodeData = {
    general: JSON.parse(JSON.stringify((params.general as ImportObjNodeData["general"]) || defaultParams.general)),
    object: {
      file: originalObjectParams.file,
      ...JSON.parse(
        JSON.stringify({
          scale: originalObjectParams.scale,
          centerToOrigin: originalObjectParams.centerToOrigin,
        })
      ),
    },
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1, factor: 1 },
    },
    rendering: JSON.parse(
      JSON.stringify((params.rendering as ImportObjNodeData["rendering"]) || defaultParams.rendering)
    ),
  };
  if (data.object.file) {
    const cacheKey = getCacheKey(data.object.file);
    const inCache = objCache.has(cacheKey);
    if (!inCache) {
      try {
        await loadObjFile(data.object.file);
      } catch (error) {
        return { default: new Object3DContainer(new Group()) };
      }
    } else {
    }
  } else {
  }
  const inputContainer = inputs.default as Object3DContainer | undefined;
  const inputObject = inputContainer ? { object: inputContainer.value } : undefined;
  const result = processor(data, inputObject);
  if (!result?.object) {
    return { default: new Object3DContainer(new Group()) };
  }
  return { default: new Object3DContainer(result.object) };
};
