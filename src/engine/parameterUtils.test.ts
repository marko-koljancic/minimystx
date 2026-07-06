import { describe, it, expect } from "vitest";
import { createParameterMetadata, validateAndNormalizeParams, validateParameterValue } from "./parameterUtils";
import type { NodeParams } from "./graphStore";

const paramsDef: NodeParams = {
  geometry: {
    width: createParameterMetadata("number", 1, { min: 0.01, max: 100 }),
    segments: createParameterMetadata("number", 8, { min: 1, max: 64 }),
  },
  rendering: {
    visible: createParameterMetadata("boolean", true, {}),
    mode: createParameterMetadata("enum", "shaded", { enumValues: ["shaded", "wireframe"] }),
  },
};

describe("validateAndNormalizeParams", () => {
  it("fills every declared parameter with its default when params are empty", () => {
    const result = validateAndNormalizeParams({}, paramsDef);
    expect(result.geometry.width).toBe(1);
    expect(result.geometry.segments).toBe(8);
    expect(result.rendering.visible).toBe(true);
    expect(result.rendering.mode).toBe("shaded");
  });

  it("keeps valid provided values", () => {
    const result = validateAndNormalizeParams({ geometry: { width: 5 }, rendering: { visible: false } }, paramsDef);
    expect(result.geometry.width).toBe(5);
    expect(result.rendering.visible).toBe(false);
  });

  it("resets out-of-range numbers to the default", () => {
    const result = validateAndNormalizeParams({ geometry: { width: 1000, segments: 0 } }, paramsDef);
    expect(result.geometry.width).toBe(1);
    expect(result.geometry.segments).toBe(8);
  });

  it("resets unknown enum values and wrong-typed booleans to the default", () => {
    const result = validateAndNormalizeParams({ rendering: { mode: "xray", visible: "yes" } }, paramsDef);
    expect(result.rendering.mode).toBe("shaded");
    expect(result.rendering.visible).toBe(true);
  });

  it("drops parameters that are not declared in the definition", () => {
    const result = validateAndNormalizeParams({ geometry: { bogus: 42 } }, paramsDef);
    expect(result.geometry.bogus).toBeUndefined();
  });
});

describe("validateParameterValue", () => {
  it("validates vector3 components", () => {
    const meta = createParameterMetadata("vector3", { x: 0, y: 0, z: 0 }, {});
    expect(validateParameterValue({ x: 1, y: 2, z: 3 }, meta).valid).toBe(true);
    expect(validateParameterValue({ x: 1, y: "no" }, meta).valid).toBe(false);
  });

  it("validates colors as hex or names", () => {
    const meta = createParameterMetadata("color", "#ffffff", {});
    expect(validateParameterValue("#a1b2c3", meta).valid).toBe(true);
    expect(validateParameterValue("tomato", meta).valid).toBe(true);
    expect(validateParameterValue("#12", meta).valid).toBe(false);
  });
});
