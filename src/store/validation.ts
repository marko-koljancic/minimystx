export const validateNumber = (value: unknown, min?: number, max?: number): number => {
  if (typeof value !== "number" || isNaN(value)) {
    throw new Error(`Invalid number: ${value}`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`Number ${value} is below minimum ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`Number ${value} is above maximum ${max}`);
  }
  return value;
};

export const validateString = (value: unknown, allowedValues?: string[]): string => {
  if (typeof value !== "string") {
    throw new Error(`Invalid string: ${value}`);
  }
  if (allowedValues && !allowedValues.includes(value)) {
    throw new Error(`String "${value}" not in allowed values: ${allowedValues.join(", ")}`);
  }
  return value;
};

export const validateBoolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid boolean: ${value}`);
  }
  return value;
};

export const validateArray = <T>(value: unknown, validator: (item: unknown) => T): T[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid array: ${value}`);
  }
  return value.map(validator);
};

export const validateObject = <T>(value: unknown, validator: (obj: unknown) => T): T => {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid object: ${value}`);
  }
  return validator(value);
};

export const isValidDisplayUnit = (value: string): boolean => {
  return ["mm", "cm", "m", "in", "ft", "ft-in"].includes(value);
};

export const isValidBackgroundType = (value: string): boolean => {
  return ["single", "gradient"].includes(value);
};

export const isValidToneMappingType = (value: string): boolean => {
  return ["None", "Linear", "Reinhard", "ACES Filmic"].includes(value);
};

export const isValidCameraType = (value: string): boolean => {
  return ["perspective", "orthographic"].includes(value);
};

export const isValidGizmoSize = (value: string): boolean => {
  return ["Small", "Medium", "Large"].includes(value);
};

export const isValidCaptureArea = (value: string): boolean => {
  return ["viewport", "selection", "custom"].includes(value);
};

export const isValidResolutionPreset = (value: string): boolean => {
  return ["Viewport", "1.5x", "2x", "4x", "Custom"].includes(value);
};

export const isValidCountdownOption = (value: string): boolean => {
  return ["off", "3s", "5s"].includes(value);
};
