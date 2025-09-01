export enum ConnectionType {
  GEOMETRY = "geometry",
  OBJECT3D = "object3d",
  NUMBER = "number",
  VECTOR3 = "vector3",
  VECTOR2 = "vector2",
  COLOR = "color",
  STRING = "string",
  BOOLEAN = "boolean",
  ANY = "any",
}
export interface NodeInput<T = any> {
  name: string;
  type: ConnectionType;
  required: boolean;
  defaultValue?: T;
  description: string;
  accepts?: ConnectionType[]; // Additional types this input can accept (for ANY type)
}
export interface NodeOutput {
  name: string;
  type: ConnectionType;
  description: string;
}
export interface ConnectionMeta {
  sourceNode: string;
  sourceOutput: string;
  targetNode: string;
  targetInput: string;
  sourceType: ConnectionType;
  targetType: ConnectionType;
  isValid: boolean;
  coercionRequired: boolean;
}
export interface TypeValidationResult {
  isValid: boolean;
  canCoerce: boolean;
  error?: string;
}
export interface NodeIOSpec {
  inputs: NodeInput[];
  outputs: NodeOutput[];
}
export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  [ConnectionType.GEOMETRY]: "#4CAF50", // Green
  [ConnectionType.OBJECT3D]: "#2196F3", // Blue
  [ConnectionType.NUMBER]: "#FF9800", // Orange
  [ConnectionType.VECTOR3]: "#9C27B0", // Purple
  [ConnectionType.VECTOR2]: "#673AB7", // Deep Purple
  [ConnectionType.COLOR]: "#E91E63", // Pink
  [ConnectionType.STRING]: "#607D8B", // Blue Grey
  [ConnectionType.BOOLEAN]: "#795548", // Brown
  [ConnectionType.ANY]: "#9E9E9E", // Grey
};
const TYPE_COMPATIBILITY: Record<ConnectionType, ConnectionType[]> = {
  [ConnectionType.GEOMETRY]: [ConnectionType.GEOMETRY, ConnectionType.ANY],
  [ConnectionType.OBJECT3D]: [ConnectionType.OBJECT3D, ConnectionType.ANY],
  [ConnectionType.NUMBER]: [ConnectionType.NUMBER, ConnectionType.ANY],
  [ConnectionType.VECTOR3]: [ConnectionType.VECTOR3, ConnectionType.ANY],
  [ConnectionType.VECTOR2]: [ConnectionType.VECTOR2, ConnectionType.ANY],
  [ConnectionType.COLOR]: [ConnectionType.COLOR, ConnectionType.VECTOR3, ConnectionType.ANY],
  [ConnectionType.STRING]: [ConnectionType.STRING, ConnectionType.ANY],
  [ConnectionType.BOOLEAN]: [ConnectionType.BOOLEAN, ConnectionType.ANY],
  [ConnectionType.ANY]: Object.values(ConnectionType), // ANY accepts everything
};
export function validateConnection(
  sourceType: ConnectionType,
  targetType: ConnectionType,
  targetInput?: NodeInput
): TypeValidationResult {
  const compatibleTypes = TYPE_COMPATIBILITY[targetType] || [];
  const isDirectlyCompatible = compatibleTypes.includes(sourceType);
  const additionalTypes = targetInput?.accepts || [];
  const isAcceptedType = additionalTypes.includes(sourceType);
  if (isDirectlyCompatible || isAcceptedType) {
    return {
      isValid: true,
      canCoerce: sourceType !== targetType,
    };
  }
  if (sourceType === ConnectionType.VECTOR3 && targetType === ConnectionType.COLOR) {
    return {
      isValid: true,
      canCoerce: true,
    };
  }
  if (sourceType === ConnectionType.NUMBER && targetType === ConnectionType.STRING) {
    return {
      isValid: true,
      canCoerce: true,
    };
  }
  return {
    isValid: false,
    canCoerce: false,
    error: `Cannot connect ${sourceType} to ${targetType}`,
  };
}
export function getConnectionTypeDisplayName(type: ConnectionType): string {
  switch (type) {
    case ConnectionType.GEOMETRY:
      return "Geometry";
    case ConnectionType.OBJECT3D:
      return "Object3D";
    case ConnectionType.NUMBER:
      return "Number";
    case ConnectionType.VECTOR3:
      return "Vector3";
    case ConnectionType.VECTOR2:
      return "Vector2";
    case ConnectionType.COLOR:
      return "Color";
    case ConnectionType.STRING:
      return "String";
    case ConnectionType.BOOLEAN:
      return "Boolean";
    case ConnectionType.ANY:
      return "Any";
    default:
      return type;
  }
}
export const InputHelpers = {
  geometry: (name = "geometry", required = true): NodeInput => ({
    name,
    type: ConnectionType.GEOMETRY,
    required,
    description: `Input ${name} geometry`,
  }),
  object3d: (name = "object", required = true): NodeInput => ({
    name,
    type: ConnectionType.OBJECT3D,
    required,
    description: `Input ${name} Object3D`,
  }),
  number: (name: string, defaultValue = 0, required = false): NodeInput => ({
    name,
    type: ConnectionType.NUMBER,
    required,
    defaultValue,
    description: `Input ${name} number value`,
  }),
  vector3: (name: string, defaultValue = { x: 0, y: 0, z: 0 }, required = false): NodeInput => ({
    name,
    type: ConnectionType.VECTOR3,
    required,
    defaultValue,
    description: `Input ${name} vector3 value`,
  }),
  boolean: (name: string, defaultValue = false, required = false): NodeInput => ({
    name,
    type: ConnectionType.BOOLEAN,
    required,
    defaultValue,
    description: `Input ${name} boolean value`,
  }),
};
export const OutputHelpers = {
  geometry: (name = "geometry"): NodeOutput => ({
    name,
    type: ConnectionType.GEOMETRY,
    description: `Output ${name} geometry`,
  }),
  object3d: (name = "object"): NodeOutput => ({
    name,
    type: ConnectionType.OBJECT3D,
    description: `Output ${name} Object3D`,
  }),
  number: (name: string): NodeOutput => ({
    name,
    type: ConnectionType.NUMBER,
    description: `Output ${name} number value`,
  }),
  vector3: (name: string): NodeOutput => ({
    name,
    type: ConnectionType.VECTOR3,
    description: `Output ${name} vector3 value`,
  }),
  boolean: (name: string): NodeOutput => ({
    name,
    type: ConnectionType.BOOLEAN,
    description: `Output ${name} boolean value`,
  }),
};
