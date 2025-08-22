import { Group, Object3D, BufferGeometry, Mesh, Box3, Vector3 } from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import type { GeneralProps, TransformProps, RenderingProps, NodeProcessor } from "../props";
import { createParameterMetadata, extractDefaultValues } from "../../../engine/parameterUtils";
import type { NodeParams } from "../../../engine/graphStore";
import {
  createGeneralParams,
  createSubflowRenderingParams,
} from "../../../engine/nodeParameterFactories";
import { getAssetCache } from "../../../io/mxscene/opfs-cache";
import { hashBytesSHA256 } from "../../../io/mxscene/crypto";

// Simplified serializable file representation for OBJ files
export interface SerializableObjFile {
  name: string;
  size: number;
  lastModified: number;
  content: string; // Base64 encoded OBJ content
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

  // Check if file has a name property
  if (!file.name) return { valid: false, error: "File name is missing" };

  const extension = file.name.toLowerCase().split(".").pop();
  if (extension !== "obj")
    return { valid: false, error: "Unsupported file type. Only .obj files are supported." };

  return { valid: true };
}

// Helper function to convert File to SerializableObjFile
async function fileToSerializableObjFile(file: File): Promise<SerializableObjFile> {
  const content = await file.text();
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    content: btoa(content), // Base64 encode the content
  };
}

// Helper function to get text content from either File or SerializableObjFile
async function getFileContent(file: File | SerializableObjFile): Promise<string> {
  if (file instanceof File) {
    return await file.text();
  } else {
    // Check if content exists and is a valid base64 string
    if (!file.content || typeof file.content !== "string") {
      throw new Error("SerializableObjFile content is missing or invalid");
    }

    try {
      return atob(file.content); // Decode base64 content
    } catch (error) {
      console.error("[getFileContent] Base64 decode error:", error);
      console.error("[getFileContent] Content preview:", file.content.substring(0, 100));
      throw new Error("Failed to decode SerializableObjFile content: Invalid base64 encoding");
    }
  }
}

function centerObject(object: Object3D): void {
  const box = new Box3().setFromObject(object);
  const center = box.getCenter(new Vector3());
  object.position.sub(center);
}

// Global in-memory cache for immediate access (runtime performance)
const objCache = new Map<string, Object3D>();

// Cache key for OPFS storage (based on content hash)
async function getAssetHash(file: File | SerializableObjFile): Promise<string> {
  const content = await getFileContent(file);
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  return hashBytesSHA256(data.buffer);
}

// Legacy cache key for memory cache (for backward compatibility)
function getCacheKey(file: File | SerializableObjFile): string {
  return `${file.name}_${file.lastModified}_${file.size}`;
}

async function loadObjFile(file: File | SerializableObjFile): Promise<Object3D> {
  const memoryCacheKey = getCacheKey(file);
  
  // Check in-memory cache first for immediate access
  if (objCache.has(memoryCacheKey)) {
    const cached = objCache.get(memoryCacheKey)!;
    return cached.clone();
  }

  const loader = new OBJLoader();
  const text = await getFileContent(file);

  try {
    const object = loader.parse(text);
    
    // Cache in memory for immediate access
    objCache.set(memoryCacheKey, object);
    
    // Also store raw file data in OPFS for persistence across sessions
    try {
      const assetHash = await getAssetHash(file);
      const assetCache = getAssetCache();
      
      // Only store if not already cached
      if (!(await assetCache.has(assetHash))) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        await assetCache.put(assetHash, data.buffer);
        console.debug(`[ImportObjProcessor] Cached asset ${file.name} with hash ${assetHash}`);
      }
    } catch (cacheError) {
      console.warn('[ImportObjProcessor] Failed to cache asset in OPFS:', cacheError);
      // Non-fatal - object loading can still succeed
    }
    
    return object.clone();
  } catch (error) {
    console.error("[ImportObjProcessor] Failed to parse OBJ file:", error);
    throw error;
  }
}

// New function to load from OPFS cache using hash
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
    console.warn('[loadObjFromCache] Failed to load from OPFS cache:', error);
    return null;
  }
}

export const processor: NodeProcessor<
  ImportObjNodeData,
  { object: Object3D; geometry?: BufferGeometry; shouldSetAsActiveOutput?: boolean }
> = (data: ImportObjNodeData, input?: { object: Object3D; geometry?: BufferGeometry }) => {
  console.log("[ImportObjProcessor] Processing data:", data);
  console.log("[ImportObjProcessor] File object:", data.object.file);
  
  if (!data.object.file) {
    console.warn("[ImportObjProcessor] No file provided - returning empty geometry (will not recompute)");
    // Create a stable empty group that won't cause recomputation loops
    const emptyGroup = new Group();
    emptyGroup.name = "EmptyImportObjGroup"; // Give it a name for debugging
    return { object: emptyGroup, geometry: undefined };
  }

  const validation = validateFile(data.object.file);
  if (!validation.valid) {
    console.warn("[ImportObjProcessor] File validation failed:", validation.error);
    return { object: new Group(), geometry: undefined };
  }
  
  console.log("[ImportObjProcessor] File validation passed:", validation);

  // For synchronous processing, check if the object is already cached
  const cacheKey = getCacheKey(data.object.file);

  if (!objCache.has(cacheKey)) {
    return { object: new Group(), geometry: undefined };
  }

  let loadedObject: Object3D;
  try {
    loadedObject = objCache.get(cacheKey)!.clone();
  } catch (error) {
    console.error("[ImportObjProcessor] Failed to clone cached object:", error);
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

  // Apply shadow settings to all meshes in the loaded object
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
    // Comprehensive validation for Three.js Object3D
    const isValidObject3D = (obj: any): obj is Object3D => {
      return obj && 
        typeof obj === "object" && 
        obj.isObject3D === true &&
        "updateMatrixWorld" in obj && 
        typeof obj.updateMatrixWorld === "function" &&
        "matrixWorld" in obj &&
        obj.matrixWorld !== null &&
        obj.matrixWorld !== undefined;
    };

    if (isValidObject3D(input.object)) {
      try {
        // Ensure the matrix world is up to date before using it
        input.object.updateMatrixWorld(true);
        if (input.object.matrixWorld) {
          loadedObject.applyMatrix4(input.object.matrixWorld);
          console.log("[ImportObjProcessor] Successfully applied input matrix transformation");
        } else {
          console.warn("[ImportObjProcessor] Input matrixWorld is null after updateMatrixWorld");
        }
      } catch (error) {
        console.error("[ImportObjProcessor] Failed to apply input matrix transformation:", error);
        // Continue without applying transformation rather than failing completely
      }
    } else {
      const inputObj = input?.object;
      console.warn("[ImportObjProcessor] Input is not a valid Three.js Object3D:", typeof inputObj, (inputObj as any)?.constructor?.name, inputObj);
      console.warn("[ImportObjProcessor] Input validation details:", {
        hasIsObject3D: (inputObj as any)?.isObject3D,
        hasUpdateMatrixWorld: inputObj ? "updateMatrixWorld" in inputObj : false,
        updateMatrixWorldType: inputObj ? typeof (inputObj as any).updateMatrixWorld : 'undefined',
        hasMatrixWorld: inputObj ? "matrixWorld" in inputObj : false,
        matrixWorldValue: (inputObj as any)?.matrixWorld
      });
    }
  }

  return { object: loadedObject, geometry };
};

// Export functions for use in components and serialization
export { loadObjFile, fileToSerializableObjFile, loadObjFromCache, getAssetHash };

export const importObjNodeParams: NodeParams = {
  general: createGeneralParams("Import OBJ 1", "Load geometry from .obj file"),
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
  rendering: createSubflowRenderingParams(),
};

export const importObjNodeCompute = (params: Record<string, unknown>, inputs?: unknown, context?: { nodeId?: string }) => {
  console.log(`[importObjNodeCompute] Starting computation for node ${context?.nodeId}`);
  console.log(`[importObjNodeCompute] Params:`, params);
  
  // Get defaults for missing parameters
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
  // Use first input if available, otherwise undefined
  const inputObject =
    inputs && Object.keys(inputs).length > 0 ? (Object.values(inputs)[0] as { object: Object3D; geometry?: BufferGeometry }) : undefined;
  
  const result = processor(data, inputObject);
  
  // If we successfully produced geometry and we're in a subflow context, 
  // mark this node to be set as the active output after computation completes
  if (result?.object && context?.nodeId) {
    console.log(`[importObjNodeCompute] Produced geometry for node ${context.nodeId}`, result.object);
    
    // Create a new result object to avoid modifying frozen objects
    // Note: We'll set shouldSetAsActiveOutput to true for now, the graphStore will handle import logic
    const finalResult = { ...result, shouldSetAsActiveOutput: true };
    return finalResult;
  } else {
    if (!result?.object) {
      console.log(`[importObjNodeCompute] No object produced for node ${context?.nodeId}`);
    }
    if (!context?.nodeId) {
      console.log(`[importObjNodeCompute] No context nodeId provided`);
    }
  }
  
  return result;
};
