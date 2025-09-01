/**
 * Container System for Minimystx
 * 
 * Inspired by PolygonJS container patterns, provides unified data flow
 * through typed container classes that wrap Three.js objects and primitives.
 */

import { ConnectionType } from '../types/NodeIO';
import { BufferGeometry, Object3D, Color, Vector2, Vector3 } from 'three';

/**
 * Abstract base class for all data containers
 */
export abstract class BaseContainer<T = any> {
  abstract readonly type: ConnectionType;
  public value: T;

  constructor(value: T) {
    this.value = value;
  }

  /**
   * Validates that the container holds valid data
   */
  abstract isValid(): boolean;

  /**
   * Creates a deep clone of this container
   */
  abstract clone(): BaseContainer<T>;

  /**
   * Serializes container data for caching
   */
  abstract serialize(): any;

  /**
   * Gets hash for content-addressed caching
   */
  abstract getContentHash(): string;

  /**
   * Type guard to check if container is of specific type
   */
  isType<U extends BaseContainer>(type: new (...args: any[]) => U): this is U {
    return this instanceof type;
  }

  /**
   * Safe casting with validation
   */
  cast<U extends BaseContainer>(type: new (...args: any[]) => U): U | null {
    if (this.isType(type)) {
      return this as U;
    }
    return null;
  }
}

/**
 * Container for Three.js BufferGeometry objects
 */
export class GeometryContainer extends BaseContainer<BufferGeometry> {
  readonly type = ConnectionType.GEOMETRY;

  constructor(geometry: BufferGeometry) {
    super(geometry);
  }

  isValid(): boolean {
    return this.value instanceof BufferGeometry && 
           this.value.attributes.position !== undefined;
  }

  clone(): GeometryContainer {
    return new GeometryContainer(this.value.clone());
  }

  serialize(): any {
    return {
      type: this.type,
      vertexCount: this.value.attributes.position?.count || 0,
      hasNormals: !!this.value.attributes.normal,
      hasUVs: !!this.value.attributes.uv,
      boundingBox: this.value.boundingBox,
    };
  }

  getContentHash(): string {
    const positions = this.value.attributes.position;
    const indices = this.value.index;
    
    // Simple hash based on vertex count and bounding box
    const vertexCount = positions ? positions.count : 0;
    const bbox = this.value.boundingBox;
    const bboxStr = bbox ? `${bbox.min.x},${bbox.min.y},${bbox.min.z},${bbox.max.x},${bbox.max.y},${bbox.max.z}` : '';
    
    return `geometry-${vertexCount}-${indices?.count || 0}-${bboxStr}`;
  }

  /**
   * Get vertex count for performance metrics
   */
  getVertexCount(): number {
    return this.value.attributes.position?.count || 0;
  }

  /**
   * Get triangle count for performance metrics
   */
  getTriangleCount(): number {
    const index = this.value.index;
    const position = this.value.attributes.position;
    
    if (index) {
      return index.count / 3;
    } else if (position) {
      return position.count / 3;
    }
    
    return 0;
  }
}

/**
 * Container for Three.js Object3D objects
 */
export class Object3DContainer extends BaseContainer<Object3D> {
  readonly type = ConnectionType.OBJECT3D;

  constructor(object: Object3D) {
    super(object);
  }

  isValid(): boolean {
    return this.value instanceof Object3D;
  }

  clone(): Object3DContainer {
    return new Object3DContainer(this.value.clone());
  }

  serialize(): any {
    return {
      type: this.type,
      childCount: this.value.children.length,
      hasGeometry: !!(this.value as any).geometry,
      hasMaterial: !!(this.value as any).material,
      position: this.value.position.toArray(),
      rotation: this.value.rotation.toArray(),
      scale: this.value.scale.toArray(),
    };
  }

  getContentHash(): string {
    const pos = this.value.position;
    const rot = this.value.rotation;
    const scale = this.value.scale;
    
    return `object3d-${this.value.children.length}-${pos.x},${pos.y},${pos.z}-${rot.x},${rot.y},${rot.z}-${scale.x},${scale.y},${scale.z}`;
  }
}

/**
 * Container for numeric values
 */
export class NumberContainer extends BaseContainer<number> {
  readonly type = ConnectionType.NUMBER;

  constructor(value: number) {
    super(value);
  }

  isValid(): boolean {
    return typeof this.value === 'number' && !isNaN(this.value);
  }

  clone(): NumberContainer {
    return new NumberContainer(this.value);
  }

  serialize(): any {
    return {
      type: this.type,
      value: this.value,
    };
  }

  getContentHash(): string {
    return `number-${this.value}`;
  }
}

/**
 * Container for Vector3 values
 */
export class Vector3Container extends BaseContainer<Vector3> {
  readonly type = ConnectionType.VECTOR3;

  constructor(value: Vector3) {
    super(value.clone());
  }

  isValid(): boolean {
    return this.value instanceof Vector3 &&
           !isNaN(this.value.x) && !isNaN(this.value.y) && !isNaN(this.value.z);
  }

  clone(): Vector3Container {
    return new Vector3Container(this.value);
  }

  serialize(): any {
    return {
      type: this.type,
      x: this.value.x,
      y: this.value.y,
      z: this.value.z,
    };
  }

  getContentHash(): string {
    return `vector3-${this.value.x},${this.value.y},${this.value.z}`;
  }
}

/**
 * Container for Vector2 values
 */
export class Vector2Container extends BaseContainer<Vector2> {
  readonly type = ConnectionType.VECTOR2;

  constructor(value: Vector2) {
    super(value.clone());
  }

  isValid(): boolean {
    return this.value instanceof Vector2 &&
           !isNaN(this.value.x) && !isNaN(this.value.y);
  }

  clone(): Vector2Container {
    return new Vector2Container(this.value);
  }

  serialize(): any {
    return {
      type: this.type,
      x: this.value.x,
      y: this.value.y,
    };
  }

  getContentHash(): string {
    return `vector2-${this.value.x},${this.value.y}`;
  }
}

/**
 * Container for Color values
 */
export class ColorContainer extends BaseContainer<Color> {
  readonly type = ConnectionType.COLOR;

  constructor(value: Color) {
    super(value.clone());
  }

  isValid(): boolean {
    return this.value instanceof Color;
  }

  clone(): ColorContainer {
    return new ColorContainer(this.value);
  }

  serialize(): any {
    return {
      type: this.type,
      r: this.value.r,
      g: this.value.g,
      b: this.value.b,
    };
  }

  getContentHash(): string {
    return `color-${this.value.r},${this.value.g},${this.value.b}`;
  }
}

/**
 * Container for String values
 */
export class StringContainer extends BaseContainer<string> {
  readonly type = ConnectionType.STRING;

  constructor(value: string) {
    super(value);
  }

  isValid(): boolean {
    return typeof this.value === 'string';
  }

  clone(): StringContainer {
    return new StringContainer(this.value);
  }

  serialize(): any {
    return {
      type: this.type,
      value: this.value,
    };
  }

  getContentHash(): string {
    return `string-${this.value.length}-${this.value.slice(0, 50)}`;
  }
}

/**
 * Container for Boolean values
 */
export class BooleanContainer extends BaseContainer<boolean> {
  readonly type = ConnectionType.BOOLEAN;

  constructor(value: boolean) {
    super(value);
  }

  isValid(): boolean {
    return typeof this.value === 'boolean';
  }

  clone(): BooleanContainer {
    return new BooleanContainer(this.value);
  }

  serialize(): any {
    return {
      type: this.type,
      value: this.value,
    };
  }

  getContentHash(): string {
    return `boolean-${this.value}`;
  }
}

/**
 * Container factory functions
 */
export const ContainerFactory = {
  geometry: (value: BufferGeometry) => new GeometryContainer(value),
  object3d: (value: Object3D) => new Object3DContainer(value),
  number: (value: number) => new NumberContainer(value),
  vector3: (value: Vector3) => new Vector3Container(value),
  vector2: (value: Vector2) => new Vector2Container(value),
  color: (value: Color) => new ColorContainer(value),
  string: (value: string) => new StringContainer(value),
  boolean: (value: boolean) => new BooleanContainer(value),

  /**
   * Auto-detect container type from value
   * Only handles direct Three.js types and primitives - no legacy object patterns
   */
  auto: (value: any): BaseContainer => {
    // Direct Three.js object types
    if (value instanceof BufferGeometry) return new GeometryContainer(value);
    if (value instanceof Object3D) return new Object3DContainer(value);
    if (value instanceof Vector3) return new Vector3Container(value);
    if (value instanceof Vector2) return new Vector2Container(value);
    if (value instanceof Color) return new ColorContainer(value);
    
    // Primitive types
    if (typeof value === 'number') return new NumberContainer(value);
    if (typeof value === 'string') return new StringContainer(value);
    if (typeof value === 'boolean') return new BooleanContainer(value);
    
    // Provide clear error message for unsupported types
    const valueType = typeof value;
    const constructorName = value?.constructor?.name || 'unknown';
    
    throw new Error(
      `Cannot create container for value of type '${valueType}' (constructor: ${constructorName}). ` +
      `Supported types: BufferGeometry, Object3D, Vector3, Vector2, Color, number, string, boolean. ` +
      `If this is a node output, ensure the node returns a proper container using computeTyped().`
    );
  }
};

/**
 * Type coercion utilities
 */
export class TypeCoercion {
  /**
   * Attempt to coerce one container type to another
   */
  static coerce(source: BaseContainer, targetType: ConnectionType): BaseContainer | null {
    // Vector3 to Color
    if (source.type === ConnectionType.VECTOR3 && targetType === ConnectionType.COLOR) {
      const vec = source as Vector3Container;
      return new ColorContainer(new Color(vec.value.x, vec.value.y, vec.value.z));
    }

    // Number to String
    if (source.type === ConnectionType.NUMBER && targetType === ConnectionType.STRING) {
      const num = source as NumberContainer;
      return new StringContainer(num.value.toString());
    }

    // Color to Vector3
    if (source.type === ConnectionType.COLOR && targetType === ConnectionType.VECTOR3) {
      const color = source as ColorContainer;
      return new Vector3Container(new Vector3(color.value.r, color.value.g, color.value.b));
    }

    return null;
  }
}