import { describe, it, expect } from "vitest";
import { BoxGeometry, Color, Group, Vector3 } from "three";
import {
  ContainerFactory,
  GeometryContainer,
  Object3DContainer,
  NumberContainer,
  ColorContainer,
  Vector3Container,
} from "./BaseContainer";

// Also serves as the harness check that Three.js geometry constructs headless
// in the vitest node environment (no DOM, no WebGL context required).
describe("containers in a headless node environment", () => {
  it("wraps a constructed BufferGeometry and reports it valid", () => {
    const geometry = new BoxGeometry(2, 2, 2, 2, 2, 2);
    const container = new GeometryContainer(geometry);
    expect(container.isValid()).toBe(true);
    expect(container.getVertexCount()).toBeGreaterThan(0);
    expect(container.getTriangleCount()).toBeGreaterThan(0);
  });

  it("clone() produces an independent geometry", () => {
    const original = new GeometryContainer(new BoxGeometry(1, 1, 1));
    const cloned = original.clone();
    expect(cloned).not.toBe(original);
    expect(cloned.value).not.toBe(original.value);
    expect(cloned.getVertexCount()).toBe(original.getVertexCount());
    cloned.value.scale(2, 2, 2);
    const originalX = original.value.attributes.position.getX(0);
    const clonedX = cloned.value.attributes.position.getX(0);
    expect(Math.abs(clonedX)).not.toBe(Math.abs(originalX));
  });

  it("wraps an Object3D and clones it independently", () => {
    const group = new Group();
    group.position.set(1, 2, 3);
    const container = new Object3DContainer(group);
    expect(container.isValid()).toBe(true);
    const cloned = container.clone();
    expect(cloned.value).not.toBe(group);
    expect(cloned.value.position.x).toBe(1);
  });

  it("ContainerFactory.auto dispatches on value type", () => {
    expect(ContainerFactory.auto(new BoxGeometry())).toBeInstanceOf(GeometryContainer);
    expect(ContainerFactory.auto(new Group())).toBeInstanceOf(Object3DContainer);
    expect(ContainerFactory.auto(new Vector3(1, 2, 3))).toBeInstanceOf(Vector3Container);
    expect(ContainerFactory.auto(new Color(1, 0, 0))).toBeInstanceOf(ColorContainer);
    expect(ContainerFactory.auto(42)).toBeInstanceOf(NumberContainer);
    expect(() => ContainerFactory.auto({ not: "supported" })).toThrow();
  });
});
