
export interface ShadowCameraConstraints {
  cameraNear: number;
  cameraFar: number;
}

export function validateAndFixShadowCamera<T extends ShadowCameraConstraints>(shadowParams: T): T {
  if (shadowParams.cameraFar <= shadowParams.cameraNear) {
    shadowParams.cameraFar = shadowParams.cameraNear + 1;
  }

  return shadowParams;
}

export function validateShadowMapSize(width: number, height: number, lightType: string): void {
  const isPowerOfTwo = (n: number) => (n & (n - 1)) === 0;

  if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
  }
}
