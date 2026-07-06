import { BaseContainer } from "../containers/BaseContainer";
import type { NodeDefinition, NodeOutputs } from "../graphStore";

// Pure cooking primitives, shared by the subflow and root compute paths in
// graphStore. No store imports, no side effects: callers decide how to commit
// results (immer draft writes, generation guards, downstream propagation).

export type CookResult =
  | { status: "ok"; outputs: NodeOutputs }
  | { status: "pending"; promise: Promise<NodeOutputs> }
  | { status: "error"; error: string }
  | { status: "skipped" };

// Run a node's computeTyped once. Synchronous results come back as "ok", promises
// as "pending" (the caller owns stale-result handling), throws as "error", and
// nodes without computeTyped (geoNode, note) as "skipped".
export function cookNode(
  definition: NodeDefinition | undefined,
  params: Record<string, unknown>,
  inputs: Record<string, BaseContainer>,
  nodeId: string
): CookResult {
  if (!definition?.computeTyped) return { status: "skipped" };
  try {
    const result = definition.computeTyped(params, inputs, {
      nodeId,
      renderTarget: null,
      isInRenderCone: true,
    });
    if (result && typeof (result as { then?: unknown }).then === "function") {
      return { status: "pending", promise: result as Promise<NodeOutputs> };
    }
    return { status: "ok", outputs: result as NodeOutputs };
  } catch (err) {
    return { status: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

// True when a compute output carries no renderable geometry: an Object3D with no
// descendant geometry (e.g. an empty Combine Group), or a geometry with no
// vertices. Used to keep the last good output instead of blanking the viewport.
export function isRenderableEmpty(output: unknown): boolean {
  if (!output || typeof output !== "object") return true;
  const record = output as Record<string, unknown>;
  const container = (record.default ?? output) as { value?: unknown };
  const value = (container?.value ?? container) as
    | {
        isObject3D?: boolean;
        geometry?: unknown;
        traverse?: (cb: (c: unknown) => void) => void;
        attributes?: { position?: { count?: number } };
      }
    | undefined;
  if (!value || typeof value !== "object") return true;
  if (value.isObject3D) {
    let hasGeometry = Boolean(value.geometry);
    if (!hasGeometry && typeof value.traverse === "function") {
      value.traverse((child) => {
        if ((child as { geometry?: unknown })?.geometry) hasGeometry = true;
      });
    }
    return !hasGeometry;
  }
  if (value.attributes) {
    const pos = value.attributes.position;
    return !pos || (pos.count ?? 0) === 0;
  }
  return false;
}

export type OutputDecision = {
  output: NodeOutputs | null;
  warning: string | undefined;
};

// Decide what a node's stored output should become given a fresh result: if the
// result is empty and the previous output was not, keep the previous output and
// raise a warning (so the viewport does not blank on a transient empty compute).
export function decideOutput(prevOutput: NodeOutputs | null, result: NodeOutputs): OutputDecision {
  if (isRenderableEmpty(result) && prevOutput && !isRenderableEmpty(prevOutput)) {
    return { output: prevOutput, warning: "No geometry produced; showing last valid result" };
  }
  return { output: result, warning: undefined };
}
