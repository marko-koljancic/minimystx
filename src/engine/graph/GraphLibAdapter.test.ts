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

  it("allows a non-cyclic connection", () => {
    const g = buildChain();
    g.addNode({ id: "d" });
    expect(g.wouldCreateCycle("c", "d")).toBe(false);
  });
});
