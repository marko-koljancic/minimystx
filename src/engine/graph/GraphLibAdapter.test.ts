import { describe, it, expect } from "vitest";
import { GraphLibAdapter } from "./GraphLibAdapter";

// Helper: build a graph a -> b -> c (data flows source -> target).
function buildChain(): GraphLibAdapter {
  const g = new GraphLibAdapter();
  g.addNode({ id: "a" });
  g.addNode({ id: "b" });
  g.addNode({ id: "c" });
  g.connect("a", "b");
  g.connect("b", "c");
  return g;
}

describe("GraphLibAdapter render cone (predecessor direction)", () => {
  it("returns the target plus its upstream predecessors, not its downstream", () => {
    const g = buildChain();
    const cone = g.getRenderCone("c");
    expect(cone).toContain("c");
    expect(cone).toContain("b");
    expect(cone).toContain("a");
    expect(cone.length).toBe(3);
  });

  it("returns only the node itself for a terminal target with no upstream", () => {
    const g = buildChain();
    const cone = g.getRenderCone("a");
    expect(cone).toEqual(["a"]);
  });

  it("excludes downstream nodes from an intermediate target's cone", () => {
    const g = buildChain();
    const cone = g.getRenderCone("b");
    // b's cone is {b, a}; c is downstream and must NOT be included.
    expect(cone).toContain("b");
    expect(cone).toContain("a");
    expect(cone).not.toContain("c");
  });

  it("returns [] for an unknown node", () => {
    const g = buildChain();
    expect(g.getRenderCone("missing")).toEqual([]);
  });
});

describe("GraphLibAdapter downstream + topological order", () => {
  it("lists downstream successors excluding the node itself", () => {
    const g = buildChain();
    expect(new Set(g.getDownstreamNodes("a"))).toEqual(new Set(["b", "c"]));
    expect(g.getDownstreamNodes("c")).toEqual([]);
  });

  it("topologically sorts a subset so sources precede targets", () => {
    const g = buildChain();
    const order = g.topologicalSort(["a", "b", "c"]);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });
});

describe("GraphLibAdapter typed edges (serialization source of truth)", () => {
  it("captures source/target and handles for typed connections", () => {
    const g = new GraphLibAdapter();
    g.addNode({ id: "box" });
    g.addNode({ id: "transform" });
    g.connectTyped("box", "geometry_output", "transform", "geometry_input");

    const edges = g.getAllTypedEdges();
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual({
      source: "box",
      target: "transform",
      sourceHandle: "geometry_output",
      targetHandle: "geometry_input",
    });
  });

  it("captures multiple inputs into the same target", () => {
    const g = new GraphLibAdapter();
    g.addNode({ id: "a" });
    g.addNode({ id: "b" });
    g.addNode({ id: "combine" });
    g.connectTyped("a", "default", "combine", "input_0");
    g.connectTyped("b", "default", "combine", "input_1");

    const edges = g.getAllTypedEdges();
    expect(edges).toHaveLength(2);
    const targets = edges.map((e) => e.targetHandle).sort();
    expect(targets).toEqual(["input_0", "input_1"]);
  });
});

describe("GraphLibAdapter cycle detection", () => {
  it("flags a connection that would close a cycle", () => {
    const g = buildChain();
    expect(g.wouldCreateCycle("c", "a")).toBe(true);
  });

  it("flags a self-connection", () => {
    const g = buildChain();
    expect(g.wouldCreateCycle("a", "a")).toBe(true);
  });

  it("allows a non-cyclic connection", () => {
    const g = buildChain();
    g.addNode({ id: "d" });
    expect(g.wouldCreateCycle("c", "d")).toBe(false);
  });

  it("connect() refuses the cycle-closing edge and leaves the graph intact", () => {
    const g = buildChain();
    expect(g.connect("c", "a")).toBe(false);
    expect(g.getAllEdges()).toHaveLength(2);
  });
});

describe("GraphLibAdapter memoization across topology changes", () => {
  it("invalidates cached predecessors when an edge is added", () => {
    const g = buildChain();
    expect(g.getAllPredecessors("c").map((n) => n.id).sort()).toEqual(["a", "b"]);
    g.addNode({ id: "d" });
    g.connect("d", "c");
    expect(g.getAllPredecessors("c").map((n) => n.id).sort()).toEqual(["a", "b", "d"]);
  });

  it("invalidates cached predecessors when an edge is removed", () => {
    const g = buildChain();
    expect(g.getAllPredecessors("c")).toHaveLength(2);
    g.disconnect("b", "c");
    expect(g.getAllPredecessors("c")).toHaveLength(0);
  });

  it("invalidates the cached topological order when topology changes", () => {
    const g = buildChain();
    expect(g.topologicalSort(["a", "b", "c"])).toHaveLength(3);
    g.addNode({ id: "d" });
    g.connect("c", "d");
    const order = g.topologicalSort(["a", "c", "d"]);
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
    expect(order).toHaveLength(3);
  });
});

describe("GraphLibAdapter typed connect/disconnect symmetry", () => {
  it("removes the base edge when the last typed connection between two nodes is removed", () => {
    const g = new GraphLibAdapter();
    g.addNode({ id: "a" });
    g.addNode({ id: "b" });
    g.connectTyped("a", "default", "b", "in1");
    g.connectTyped("a", "default", "b", "in2");
    expect(g.getAllEdges()).toHaveLength(1);
    g.disconnectTyped("b", "in1");
    // A second typed connection still exists, so the base edge must survive.
    expect(g.getAllEdges()).toHaveLength(1);
    g.disconnectTyped("b", "in2");
    expect(g.getAllEdges()).toHaveLength(0);
    expect(g.getAllTypedEdges()).toHaveLength(0);
  });
});
