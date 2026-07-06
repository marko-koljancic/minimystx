import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { SUPPORTED_SCHEMA_VERSION } from "./packager";
import type { ImportResult, SceneJson } from "./types";

// Integration test for the import orchestration over the real stores: graph
// population, document view-data loading, and ui/renderer state restore. Runs in
// the node environment with minimal window/document stubs (the bridge treats a
// missing SceneManager registry as a failed camera sync, which is expected here).

beforeAll(() => {
  const noop = () => undefined;
  Object.assign(globalThis, {
    window: {
      matchMedia: () => ({ matches: true, addEventListener: noop, removeEventListener: noop }),
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => true,
    },
    document: {
      title: "",
      body: { classList: { add: noop, remove: noop } },
    },
    CustomEvent: class {
      constructor(
        public type: string,
        public init?: { detail?: unknown }
      ) {}
    },
  });
});

const fixtureScene = (): SceneJson => ({
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  engineVersion: "0.1.0",
  units: "meters",
  graph: {
    nodes: [
      { id: "light-1", type: "pointLightNode", params: {} },
      { id: "geo-1", type: "geoNode", params: { general: { name: "Fixture Geo" } } },
    ],
    edges: [],
    positions: { "light-1": { x: -150, y: 40 }, "geo-1": { x: 150, y: 40 } },
    subFlows: {
      "geo-1": {
        nodes: [
          { id: "box-1", type: "boxNode", params: { geometry: { width: 3 }, rendering: { visible: false } } },
          { id: "tr-1", type: "transformNode", params: { rendering: { visible: true } } },
        ],
        edges: [
          {
            id: "box-1__geometry_output__tr-1__default",
            source: "box-1",
            target: "tr-1",
            sourceHandle: "geometry_output",
            targetHandle: "default",
          },
        ],
        positions: { "box-1": { x: 0, y: 0 }, "tr-1": { x: 0, y: 140 } },
        activeOutputNodeId: "tr-1",
      },
    },
  },
  camera: { position: [8, 3, 12], target: [0, 1, 0], fov: 75, isOrthographic: false },
  renderer: { background: "#224466", exposure: 1.7 },
  ui: {
    gridVisible: false,
    minimapVisible: true,
    showFlowControls: false,
    connectionLineStyle: "step",
    viewportStates: { root: { x: 5, y: 6, zoom: 1.25 } },
  },
  assets: [],
  meta: { name: "Fixture Scene", description: "", projectId: "fixture" },
});

const fixtureResult = (): ImportResult => ({
  scene: fixtureScene(),
  manifest: {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    engineVersion: "0.1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    assets: [],
  },
  loadedAssets: [],
});

describe("applyImportedScene", () => {
  beforeEach(async () => {
    const { useGraphStore } = await import("../../engine/graphStore");
    useGraphStore.getState().clear();
  });

  // Generous timeout: with no SceneManager registered (node env), the bridge's
  // two waitForSceneReady polls run their full 3s + 5s before giving up on camera.
  it("restores graph, document view data, and ui/renderer state through the real stores", { timeout: 15000 }, async () => {
    const { applyImportedScene } = await import("./import");
    const { useGraphStore } = await import("../../engine/graphStore");
    const { useDocumentStore } = await import("../../store/documentStore");
    const { useUIStore } = await import("../../store/uiStore");
    const { usePreferencesStore } = await import("../../store/preferencesStore");

    await applyImportedScene(fixtureResult());
    useGraphStore.getState().flushCooks();

    const g = useGraphStore.getState();
    expect(Object.keys(g.rootNodeState).sort()).toEqual(["geo-1", "light-1"]);
    expect(g.rootNodeState["geo-1"].params.general.name).toBe("Fixture Geo");
    expect(Object.keys(g.subFlows["geo-1"].nodeState).sort()).toEqual(["box-1", "tr-1"]);
    expect(g.subFlows["geo-1"].activeOutputNodeId).toBe("tr-1");
    expect(g.getEdges({ type: "subflow", geoNodeId: "geo-1" })).toHaveLength(1);

    const doc = useDocumentStore.getState();
    expect(doc.getNodePositions("root")).toEqual({ "light-1": { x: -150, y: 40 }, "geo-1": { x: 150, y: 40 } });
    expect(doc.getNodePositions("subflow-geo-1")).toEqual({ "box-1": { x: 0, y: 0 }, "tr-1": { x: 0, y: 140 } });
    expect(doc.getViewportState("root")).toEqual({ x: 5, y: 6, zoom: 1.25 });

    const ui = useUIStore.getState();
    expect(ui.showGridInRenderView).toBe(false);
    expect(ui.showMinimap).toBe(true);
    expect(ui.showFlowControls).toBe(false);
    expect(ui.connectionLineStyle).toBe("step");

    const prefs = usePreferencesStore.getState();
    expect(prefs.renderer.background.color).toBe("#224466");
    expect(prefs.materials.exposure).toBe(1.7);

    expect((globalThis as { document: { title: string } }).document.title).toBe("Fixture Scene - Minimystx");

    // The transform chain cooked through the imported typed edge.
    const trOutput = g.subFlows["geo-1"].nodeState["tr-1"].output;
    expect(trOutput?.default).toBeTruthy();
  });
});
