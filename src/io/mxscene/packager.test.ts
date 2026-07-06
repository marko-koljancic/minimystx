import { describe, it, expect } from "vitest";
import { buildMxSceneZip, parseMxSceneZip, SUPPORTED_SCHEMA_VERSION } from "./packager";
import { createZipWriter } from "./zip";
import { hashBytesSHA256 } from "./crypto";
import { SchemaError, IntegrityError, type AssetReference, type SceneJson } from "./types";

// Round-trip tests over the exact pipeline the worker ships: scene + assets in,
// ZIP bytes out, parsed back with integrity checks. Runs fully in node (fflate
// and crypto.subtle need no DOM).

const textBytes = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

const makeAsset = async (name: string, data: ArrayBuffer, mime: string, role: string): Promise<AssetReference> => ({
  hash: await hashBytesSHA256(data),
  originalName: name,
  mime,
  size: data.byteLength,
  data,
  role,
});

const makeScene = (): SceneJson => ({
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  engineVersion: "0.1.0",
  units: "meters",
  graph: {
    nodes: [
      { id: "geo-1", type: "geoNode", params: { general: { name: "Geo 1" } } },
      { id: "light-1", type: "pointLightNode", params: {} },
    ],
    edges: [],
    positions: { "geo-1": { x: 100, y: 50 }, "light-1": { x: -100, y: 50 } },
    subFlows: {
      "geo-1": {
        nodes: [
          { id: "obj-1", type: "importObjNode", params: { object: { file: null, assetHash: "later" } } },
          { id: "gltf-1", type: "importGltfNode", params: { object: { file: null, assetHash: "later" } } },
        ],
        edges: [
          {
            id: "obj-1__geometry_output__gltf-1__default",
            source: "obj-1",
            target: "gltf-1",
            sourceHandle: "geometry_output",
            targetHandle: "default",
          },
        ],
        positions: { "obj-1": { x: 0, y: 0 }, "gltf-1": { x: 0, y: 120 } },
        activeOutputNodeId: "obj-1",
      },
    },
  },
  camera: { position: [1, 2, 3], target: [0, 0.5, 0], fov: 42, isOrthographic: false },
  renderer: { background: "#123456", exposure: 1.4 },
  ui: {
    gridVisible: false,
    minimapVisible: true,
    showFlowControls: false,
    connectionLineStyle: "step",
    viewportStates: { root: { x: 10, y: 20, zoom: 1.5 } },
  },
  assets: [],
  meta: { name: "Round Trip", description: "", projectId: "test-project" },
});

describe("mxscene packager round-trip", () => {
  it("rebuilds the identical scene with assets intact", async () => {
    const objAsset = await makeAsset("model.obj", textBytes("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n"), "model/obj", "geometry");
    // Binary payload with non-ASCII bytes (would corrupt under text round-tripping).
    const glbBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0xff, 0xfe, 0x80, 0x01]);
    const glbAsset = await makeAsset("model.glb", glbBytes.buffer as ArrayBuffer, "model/gltf-binary", "geometry");

    const scene = makeScene();
    const { zipData, assetCount } = await buildMxSceneZip(scene, [objAsset, glbAsset]);
    expect(assetCount).toBe(2);

    const result = await parseMxSceneZip(zipData.buffer as ArrayBuffer);
    expect(result.warnings).toBeUndefined();
    expect(result.loadedAssets.sort()).toEqual([objAsset.hash, glbAsset.hash].sort());
    expect(result.manifest.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(result.manifest.assets).toHaveLength(2);

    // The parsed scene matches what went in, except the packager stamps
    // schema/engine versions and fills the assets list.
    expect(result.scene.graph).toEqual(scene.graph);
    expect(result.scene.camera).toEqual(scene.camera);
    expect(result.scene.renderer).toEqual(scene.renderer);
    expect(result.scene.ui).toEqual(scene.ui);
    expect(result.scene.meta).toEqual(scene.meta);
    expect(result.scene.assets.map((a) => a.id).sort()).toEqual([objAsset.hash, glbAsset.hash].sort());
  });

  it("rejects an asset whose declared hash does not match its bytes", async () => {
    const asset = await makeAsset("model.obj", textBytes("v 0 0 0\n"), "model/obj", "geometry");
    asset.hash = asset.hash.replace(/^./, asset.hash[0] === "0" ? "1" : "0");
    await expect(buildMxSceneZip(makeScene(), [asset])).rejects.toBeInstanceOf(IntegrityError);
  });

  it("rejects files with an unsupported schema version (no migration path)", async () => {
    const writer = createZipWriter();
    await writer.addText(
      "manifest.json",
      JSON.stringify({ schemaVersion: "1.0", engineVersion: "0.1.0", createdAt: "2026-01-01", assets: [] })
    );
    await writer.addText("scene.json", JSON.stringify(makeScene()));
    const zipData = await writer.finalize();

    await expect(parseMxSceneZip(zipData.buffer as ArrayBuffer)).rejects.toBeInstanceOf(SchemaError);
  });
});
