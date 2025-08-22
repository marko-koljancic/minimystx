/**
 * TypeScript interfaces for .mxscene portable project bundle format
 */

export interface ManifestJson {
  schemaVersion: string;
  engineVersion: string;
  createdAt: string; // ISO8601 timestamp
  assets: AssetManifestEntry[];
}

export interface AssetManifestEntry {
  id: string; // SHA-256 hex hash
  name: string; // Original filename
  mime: string; // MIME type
  size: number; // File size in bytes
  hash: string; // "sha256:<hex>"
  source: "embedded"; // Always "embedded" for .mxscene
  originalPath?: string; // Optional hint for original path
}

export interface SceneJson {
  schemaVersion: string;
  engineVersion: string;
  units: string; // e.g., "meters"
  graph: GraphData;
  camera: CameraData;
  renderer: RendererData;
  ui: UIData;
  assets: SceneAssetEntry[];
  meta: ProjectMetadata;
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
  nodeRuntime: Record<string, NodeRuntimeData>;
  positions: Record<string, { x: number; y: number }>;
  // Hierarchical graph data
  subFlows: Record<string, SubFlowData>;
}

export interface SubFlowData {
  nodes: NodeData[];
  edges: EdgeData[];
  nodeRuntime: Record<string, NodeRuntimeData>;
  positions: Record<string, { x: number; y: number }>;
  activeOutputNodeId: string | null;
}

export interface NodeData {
  id: string;
  type: string;
  params?: Record<string, unknown>;
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface NodeRuntimeData {
  type: string;
  params: Record<string, unknown>;
  inputs: Record<string, unknown>;
}

export interface CameraData {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  isOrthographic?: boolean;
}

export interface RendererData {
  background: string; // Color hex
  exposure: number;
  wireframe?: boolean;
  xRay?: boolean;
}

export interface UIData {
  gridVisible: boolean;
  minimapVisible: boolean;
  showFlowControls: boolean;
  connectionLineStyle: string;
  viewportStates: Record<string, { x: number; y: number; zoom: number }>;
}

export interface SceneAssetEntry {
  id: string; // SHA-256 hex hash (matches ManifestJson.assets[].id)
  role: string; // e.g., "model", "texture", "material"
  importSettings?: Record<string, unknown>; // Per-asset import settings
}

export interface ProjectMetadata {
  name: string;
  description: string;
  projectId: string; // UUID
  created?: string; // ISO8601
  modified?: string; // ISO8601
}

// Asset discovery system types
export interface AssetReference {
  hash: string; // SHA-256 hex
  originalName: string;
  originalPath?: string;
  mime: string;
  size: number;
  data: ArrayBuffer;
  role: string; // "model", "texture", etc.
  importSettings?: Record<string, unknown>;
}

// Progress tracking types
export interface ProgressUpdate {
  phase: "collecting" | "hashing" | "packaging" | "writing" | "reading" | "extracting" | "validating";
  currentAsset?: string;
  assetIndex?: number;
  totalAssets?: number;
  bytesProcessed?: number;
  totalBytes?: number;
  percentage: number;
  message: string;
}

// Error types
export class MxSceneError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MxSceneError';
  }
}

export class IntegrityError extends MxSceneError {
  constructor(message: string, public expectedHash: string, public actualHash: string) {
    super(message, 'INTEGRITY_ERROR');
    this.name = 'IntegrityError';
  }
}

export class SchemaError extends MxSceneError {
  constructor(message: string, public foundVersion: string, public supportedVersion: string) {
    super(message, 'SCHEMA_ERROR');
    this.name = 'SchemaError';
  }
}

export class ZipError extends MxSceneError {
  constructor(message: string) {
    super(message, 'ZIP_ERROR');
    this.name = 'ZipError';
  }
}

export class OpfsError extends MxSceneError {
  constructor(message: string) {
    super(message, 'OPFS_ERROR');
    this.name = 'OpfsError';
  }
}

// Worker message types
export interface WorkerMessage {
  id: string;
  type: 'export' | 'import' | 'progress' | 'success' | 'error';
  data?: unknown;
  error?: {
    message: string;
    code: string;
    stack?: string;
  };
}

export interface ExportRequest {
  sceneData: SceneJson;
  assets: AssetReference[];
  projectName: string;
}

export interface ImportRequest {
  fileBuffer: ArrayBuffer;
  fileName: string;
}

// ZIP abstraction types
export interface ZipWriter {
  addFile(pathInZip: string, data: Uint8Array): Promise<void>;
  addText(pathInZip: string, text: string): Promise<void>;
  finalize(): Promise<Uint8Array>;
}

export interface ZipReader {
  list(): Promise<string[]>;
  readFile(pathInZip: string): Promise<Uint8Array>;
  readText(pathInZip: string): Promise<string>;
  has(pathInZip: string): Promise<boolean>;
}

// Asset cache interface
export interface AssetCache {
  has(hash: string): Promise<boolean>;
  get(hash: string): Promise<ArrayBuffer | null>;
  put(hash: string, data: ArrayBuffer): Promise<void>;
  clear?(): Promise<void>;
  size?(): Promise<number>;
}

// Export/Import result types
export interface ExportResult {
  blob: Blob;
  fileName: string;
  size: number;
  assetCount: number;
}

export interface ImportResult {
  scene: SceneJson;
  manifest: ManifestJson;
  loadedAssets: string[]; // List of asset IDs (hashes)
  warnings?: string[]; // Non-fatal issues during import
}