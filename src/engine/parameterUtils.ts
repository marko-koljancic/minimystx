import { ParameterMetadata, NodeParams } from "./graphStore";
type ParameterValue = string | number | boolean | { x: number; y: number; z?: number; w?: number } | File | null;
export const createParameterMetadata = (
  type: ParameterMetadata["type"],
  defaultValue: ParameterValue,
  options: Partial<Omit<ParameterMetadata, "default" | "type">> = {}
): ParameterMetadata => ({
  default: defaultValue,
  type,
  ...options,
});
export const validateParameterValue = (value: any, metadata: ParameterMetadata): { valid: boolean; error?: string } => {
  if (value === null || value === undefined) {
    return { valid: false, error: "Value is required" };
  }
  switch (metadata.type) {
    case "number":
      const num = Number(value);
      if (isNaN(num)) {
        return { valid: false, error: "Must be a valid number" };
      }
      if (metadata.min !== undefined && num < metadata.min) {
        return { valid: false, error: `Must be at least ${metadata.min}` };
      }
      if (metadata.max !== undefined && num > metadata.max) {
        return { valid: false, error: `Must be at most ${metadata.max}` };
      }
      return { valid: true };
    case "boolean":
      if (typeof value !== "boolean") {
        return { valid: false, error: "Must be true or false" };
      }
      return { valid: true };
    case "string":
      if (typeof value !== "string") {
        return { valid: false, error: "Must be a text value" };
      }
      return { valid: true };
    case "enum":
      if (!metadata.enumValues || !metadata.enumValues.includes(value)) {
        return { valid: false, error: `Must be one of: ${metadata.enumValues?.join(", ")}` };
      }
      return { valid: true };
    case "color":
      if (typeof value !== "string") {
        return { valid: false, error: "Color must be a string" };
      }
      if (!/^#([0-9A-F]{3}){1,2}$/i.test(value) && !/^[a-zA-Z]+$/.test(value)) {
        return { valid: false, error: "Must be a valid color (hex or name)" };
      }
      return { valid: true };
    case "vector2":
    case "vector3":
    case "vector4":
      if (typeof value !== "object" || value === null) {
        return { valid: false, error: "Must be an object with x, y components" };
      }
      const expectedKeys =
        metadata.type === "vector2" ? ["x", "y"] : metadata.type === "vector3" ? ["x", "y", "z"] : ["x", "y", "z", "w"];
      for (const key of expectedKeys) {
        if (!(key in value) || isNaN(Number(value[key]))) {
          return { valid: false, error: `${key.toUpperCase()} component must be a valid number` };
        }
        const componentValue = Number(value[key]);
        if (metadata.min !== undefined && componentValue < metadata.min) {
          return { valid: false, error: `${key.toUpperCase()} must be at least ${metadata.min}` };
        }
        if (metadata.max !== undefined && componentValue > metadata.max) {
          return { valid: false, error: `${key.toUpperCase()} must be at most ${metadata.max}` };
        }
      }
      return { valid: true };
    case "file":
      if (value === null || value === undefined) {
        return { valid: true };
      }
      if (value instanceof File) {
        return { valid: true };
      }
      if (typeof value === "object" && value !== null) {
        const objFile = value as any;
        if (
          typeof objFile.name === "string" &&
          typeof objFile.size === "number" &&
          typeof objFile.lastModified === "number" &&
          typeof objFile.content === "string"
        ) {
          return { valid: true };
        }
      }
      return { valid: false, error: "Must be a valid file" };
    default:
      return { valid: true };
  }
};
export const getParameterDisplayName = (paramKey: string, metadata: ParameterMetadata): string => {
  return metadata.displayName || paramKey.charAt(0).toUpperCase() + paramKey.slice(1);
};
export const flattenNodeParams = (
  params: NodeParams
): Array<{
  category: string;
  key: string;
  metadata: ParameterMetadata;
  fullKey: string;
}> => {
  const flattened: Array<{
    category: string;
    key: string;
    metadata: ParameterMetadata;
    fullKey: string;
  }> = [];
  for (const [category, categoryParams] of Object.entries(params)) {
    for (const [key, metadata] of Object.entries(categoryParams)) {
      flattened.push({
        category,
        key,
        metadata,
        fullKey: `${category}.${key}`,
      });
    }
  }
  return flattened;
};
export const extractDefaultValues = (params: NodeParams): Record<string, any> => {
  const defaults: Record<string, any> = {};
  for (const [category, categoryParams] of Object.entries(params)) {
    defaults[category] = {};
    for (const [key, metadata] of Object.entries(categoryParams)) {
      defaults[category][key] = metadata.default;
    }
  }
  return defaults;
};
export const validateAndNormalizeParams = (params: Record<string, any>, paramsDef: NodeParams): Record<string, any> => {
  const validated: Record<string, any> = {};
  for (const [category, categoryDef] of Object.entries(paramsDef)) {
    validated[category] = {};
    for (const [key, metadata] of Object.entries(categoryDef)) {
      const currentValue = params[category]?.[key];
      if (currentValue === undefined || currentValue === null) {
        validated[category][key] = metadata.default;
        continue;
      }
      const validation = validateParameterValue(currentValue, metadata);
      if (validation.valid) {
        validated[category][key] = currentValue;
      } else {
        validated[category][key] = metadata.default;
      }
    }
  }
  return validated;
};
