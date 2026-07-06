import { describe, it, expect } from "vitest";
import { BoxGeometry, BufferGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { cookNode, decideOutput, isRenderableEmpty } from "./cook";
import { GeometryContainer, Object3DContainer } from "../containers/BaseContainer";
import type { NodeDefinition, NodeOutputs } from "../graphStore";

const makeDefinition = (computeTyped: NodeDefinition["computeTyped"]): NodeDefinition => ({
  type: "testNode",
  category: "Test",
  displayName: "Test",
  allowedContexts: ["subflow"],
  params: {},
  computeTyped,
});

const meshOutput = (): NodeOutputs => {
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
  return { default: new Object3DContainer(mesh) };
};

const emptyGroupOutput = (): NodeOutputs => ({ default: new Object3DContainer(new Group()) });

describe("cookNode", () => {
  it("returns ok with the outputs for a synchronous compute", () => {
    const outputs = meshOutput();
    const result = cookNode(makeDefinition(() => outputs), {}, {}, "n1");
    expect(result).toEqual({ status: "ok", outputs });
  });

  it("returns pending with the promise for an async compute", async () => {
    const outputs = meshOutput();
    const result = cookNode(makeDefinition(async () => outputs), {}, {}, "n1");
    expect(result.status).toBe("pending");
    if (result.status === "pending") {
      await expect(result.promise).resolves.toBe(outputs);
    }
  });

  it("captures a synchronous throw as an error result", () => {
    const result = cookNode(
      makeDefinition(() => {
        throw new Error("bad params");
      }),
      {},
      {},
      "n1"
    );
    expect(result).toEqual({ status: "error", error: "bad params" });
  });

  it("returns skipped for definitions without computeTyped (geoNode, note)", () => {
    const def = makeDefinition(undefined);
    delete def.computeTyped;
    expect(cookNode(def, {}, {}, "n1")).toEqual({ status: "skipped" });
    expect(cookNode(undefined, {}, {}, "n1")).toEqual({ status: "skipped" });
  });

  it("passes params and inputs through to computeTyped", () => {
    const seen: unknown[] = [];
    const inputs = { default: new GeometryContainer(new BoxGeometry()) };
    const params = { geometry: { width: 2 } };
    cookNode(
      makeDefinition((p, i, ctx) => {
        seen.push(p, i, ctx.nodeId);
        return meshOutput();
      }),
      params,
      inputs,
      "node-42"
    );
    expect(seen).toEqual([params, inputs, "node-42"]);
  });
});

describe("isRenderableEmpty", () => {
  it("treats null/undefined/non-objects as empty", () => {
    expect(isRenderableEmpty(null)).toBe(true);
    expect(isRenderableEmpty(undefined)).toBe(true);
    expect(isRenderableEmpty(42)).toBe(true);
  });

  it("treats an Object3D with no descendant geometry as empty", () => {
    expect(isRenderableEmpty(emptyGroupOutput())).toBe(true);
  });

  it("treats an Object3D containing a mesh as renderable", () => {
    expect(isRenderableEmpty(meshOutput())).toBe(false);
  });

  it("treats a geometry with no vertices as empty and one with vertices as renderable", () => {
    expect(isRenderableEmpty({ default: new GeometryContainer(new BufferGeometry()) })).toBe(true);
    expect(isRenderableEmpty({ default: new GeometryContainer(new BoxGeometry(1, 1, 1)) })).toBe(false);
  });
});

describe("decideOutput (keep-last-good rule)", () => {
  it("commits a renderable result and clears the warning", () => {
    const prev = meshOutput();
    const next = meshOutput();
    expect(decideOutput(prev, next)).toEqual({ output: next, warning: undefined });
  });

  it("keeps the previous output with a warning when the new result is empty", () => {
    const prev = meshOutput();
    const empty = emptyGroupOutput();
    const decision = decideOutput(prev, empty);
    expect(decision.output).toBe(prev);
    expect(decision.warning).toMatch(/last valid result/);
  });

  it("commits an empty result when there was no previous good output", () => {
    const empty = emptyGroupOutput();
    expect(decideOutput(null, empty)).toEqual({ output: empty, warning: undefined });
    const prevEmpty = emptyGroupOutput();
    expect(decideOutput(prevEmpty, empty)).toEqual({ output: empty, warning: undefined });
  });
});
