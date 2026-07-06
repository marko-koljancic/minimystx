import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from "three";
import { useGraphStore, type NodeOutputs, type NodeDefinition } from "./graphStore";
import { nodeRegistry } from "../flow/nodes/nodeRegistry";
import { Object3DContainer } from "./containers/BaseContainer";

// Integration tests over the real store and node registry: the single cook path,
// frame-coalesced flushes (driven manually via flushCooks), downstream
// propagation, the async generation guard, and the serialization round-trip.

const store = () => useGraphStore.getState();
const GEO = "geo-1";
const SUBFLOW = { type: "subflow" as const, geoNodeId: GEO };
const ROOT = { type: "root" as const };

const addGeoWithBox = () => {
  store().addNode({ id: GEO, type: "geoNode" }, ROOT);
  store().addNode({ id: "box-1", type: "boxNode" }, SUBFLOW);
  store().flushCooks();
};

beforeEach(() => {
  store().clear();
});

describe("graphStore cook path", () => {
  it("cooks a freshly added subflow node on flush and makes it the active output", () => {
    addGeoWithBox();
    const subflow = store().subFlows[GEO];
    expect(subflow.activeOutputNodeId).toBe("box-1");
    expect(subflow.nodeState["box-1"].output?.default).toBeInstanceOf(Object3DContainer);
  });

  it("recomputes on setParams with a fresh output object (reference identity changes)", () => {
    addGeoWithBox();
    const before = store().subFlows[GEO].nodeState["box-1"].output;
    store().setParams("box-1", { geometry: { ...store().subFlows[GEO].nodeState["box-1"].params.geometry, width: 5 } }, SUBFLOW);
    store().flushCooks();
    const after = store().subFlows[GEO].nodeState["box-1"].output;
    expect(after).not.toBe(before);
    expect(after?.default).toBeInstanceOf(Object3DContainer);
  });

  it("coalesces multiple edits into one flush and keeps the latest params", () => {
    addGeoWithBox();
    const geometry = store().subFlows[GEO].nodeState["box-1"].params.geometry;
    store().setParams("box-1", { geometry: { ...geometry, width: 2 } }, SUBFLOW);
    store().setParams("box-1", { geometry: { ...geometry, width: 9 } }, SUBFLOW);
    store().flushCooks();
    expect(store().subFlows[GEO].nodeState["box-1"].params.geometry.width).toBe(9);
    const mesh = (store().subFlows[GEO].nodeState["box-1"].output?.default as Object3DContainer).value as Mesh;
    const box = (mesh.geometry as BoxGeometry).parameters;
    expect(box.width).toBe(9);
  });

  it("propagates upstream edits to downstream nodes through a typed edge", () => {
    addGeoWithBox();
    store().addNode({ id: "tr-1", type: "transformNode" }, SUBFLOW);
    const edge = store().addEdge("box-1", "tr-1", SUBFLOW, "geometry_output", "default");
    expect(edge.ok).toBe(true);
    store().flushCooks();
    const before = store().subFlows[GEO].nodeState["tr-1"].output;
    expect(before?.default).toBeInstanceOf(Object3DContainer);
    const geometry = store().subFlows[GEO].nodeState["box-1"].params.geometry;
    store().setParams("box-1", { geometry: { ...geometry, width: 7 } }, SUBFLOW);
    store().flushCooks();
    const after = store().subFlows[GEO].nodeState["tr-1"].output;
    expect(after).not.toBe(before);
  });

  it("recomputes successors when an upstream node is removed", () => {
    addGeoWithBox();
    store().addNode({ id: "tr-1", type: "transformNode" }, SUBFLOW);
    store().addEdge("box-1", "tr-1", SUBFLOW, "geometry_output", "default");
    store().flushCooks();
    store().removeNode("box-1", SUBFLOW);
    store().flushCooks();
    const output = store().subFlows[GEO].nodeState["tr-1"].output;
    // Without input the transform yields an empty Object3D; keep-last-good retains
    // the previous renderable output and flags a warning instead of blanking.
    const state = store().subFlows[GEO].nodeState["tr-1"];
    expect(output).not.toBeNull();
    expect(state.warning).toMatch(/last valid result/);
  });

  it("cooks root lights eagerly through the same flush", () => {
    store().addNode({ id: "light-1", type: "pointLightNode" }, ROOT);
    store().flushCooks();
    const output = store().rootNodeState["light-1"].output;
    expect(output?.default).toBeInstanceOf(Object3DContainer);
    expect((output?.default as Object3DContainer).value).toBeInstanceOf(Group);
  });

  it("captures a compute error on the node state", () => {
    addGeoWithBox();
    // Force an error: width of NaN slips past normalization only via setParams
    // (Object.assign), and BoxGeometry tolerates NaN, so use a broken registry stub.
    nodeRegistry["explodingNode"] = {
      type: "explodingNode",
      category: "Test",
      displayName: "Exploding",
      allowedContexts: ["subflow"],
      params: {},
      computeTyped: () => {
        throw new Error("kaboom");
      },
    } satisfies NodeDefinition;
    try {
      store().addNode({ id: "boom-1", type: "explodingNode" }, SUBFLOW);
      store().flushCooks();
      const state = store().subFlows[GEO].nodeState["boom-1"];
      expect(state.error).toBe("kaboom");
      expect(state.output).toBeNull();
    } finally {
      delete nodeRegistry["explodingNode"];
    }
  });
});

describe("graphStore async generation guard", () => {
  type Resolver = (outputs: NodeOutputs) => void;
  const resolvers: Resolver[] = [];

  beforeEach(() => {
    resolvers.length = 0;
    nodeRegistry["asyncTestNode"] = {
      type: "asyncTestNode",
      category: "Test",
      displayName: "Async Test",
      allowedContexts: ["subflow"],
      params: {},
      computeTyped: () =>
        new Promise<NodeOutputs>((resolve) => {
          resolvers.push(resolve);
        }),
    } satisfies NodeDefinition;
  });

  afterEach(() => {
    delete nodeRegistry["asyncTestNode"];
  });

  const asyncOutput = (): NodeOutputs => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    return { default: new Object3DContainer(mesh) };
  };

  it("drops a stale async result and commits only the freshest generation", async () => {
    store().addNode({ id: GEO, type: "geoNode" }, ROOT);
    store().addNode({ id: "async-1", type: "asyncTestNode" }, SUBFLOW);
    store().flushCooks();
    // Second cook supersedes the first before either resolves.
    store().setParams("async-1", { general: { name: "poke" } }, SUBFLOW);
    store().flushCooks();
    expect(resolvers).toHaveLength(2);

    const staleOutput = asyncOutput();
    const freshOutput = asyncOutput();
    resolvers[0](staleOutput);
    await Promise.resolve();
    await Promise.resolve();
    expect(store().subFlows[GEO].nodeState["async-1"].output).toBeNull();

    resolvers[1](freshOutput);
    await Promise.resolve();
    await Promise.resolve();
    expect(store().subFlows[GEO].nodeState["async-1"].output).toBe(freshOutput);
  });
});

describe("graphStore serialization round-trip", () => {
  it("reproduces nodes, edges, and active outputs through exportGraph -> importGraph", async () => {
    store().addNode({ id: "light-1", type: "pointLightNode" }, ROOT);
    addGeoWithBox();
    store().addNode({ id: "tr-1", type: "transformNode" }, SUBFLOW);
    store().addEdge("box-1", "tr-1", SUBFLOW, "geometry_output", "default");
    store().setParams("tr-1", { rendering: { visible: true } }, SUBFLOW);
    store().flushCooks();
    expect(store().subFlows[GEO].activeOutputNodeId).toBe("tr-1");

    const serialized = await store().exportGraph();
    expect(serialized.nodes.map((n) => n.id).sort()).toEqual(["geo-1", "light-1"]);
    expect(serialized.subFlows[GEO].nodes.map((n) => n.id).sort()).toEqual(["box-1", "tr-1"]);
    expect(serialized.subFlows[GEO].edges).toHaveLength(1);
    expect(serialized.subFlows[GEO].activeOutputNodeId).toBe("tr-1");

    await store().importGraph(serialized);
    store().flushCooks();

    expect(Object.keys(store().rootNodeState).sort()).toEqual(["geo-1", "light-1"]);
    expect(Object.keys(store().subFlows[GEO].nodeState).sort()).toEqual(["box-1", "tr-1"]);
    expect(store().subFlows[GEO].activeOutputNodeId).toBe("tr-1");
    expect(store().getEdges(SUBFLOW)).toHaveLength(1);
    expect(store().getEdges(SUBFLOW)[0]).toMatchObject({
      source: "box-1",
      target: "tr-1",
      sourceHandle: "geometry_output",
      targetHandle: "default",
    });
  });
});
