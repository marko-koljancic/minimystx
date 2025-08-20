/**
 * Shared shadow validation utilities for light nodes
 */

export interface ShadowCameraConstraints {
  cameraNear: number;
  cameraFar: number;
}

/**
 * Validates and fixes shadow camera near/far constraints
 * Ensures that camera far is always greater than camera near
 * @param shadowParams - Shadow parameters containing near/far values
 * @returns The corrected shadow parameters
 */
export function validateAndFixShadowCamera<T extends ShadowCameraConstraints>(shadowParams: T): T {
  if (shadowParams.cameraFar <= shadowParams.cameraNear) {
    console.error("Shadow camera far must be greater than near");
    // Auto-fix the constraint by setting far to near + 1
    shadowParams.cameraFar = shadowParams.cameraNear + 1;
  }

  return shadowParams;
}

/**
 * Checks if shadow map size is a power of two (for performance warnings)
 * @param width - Shadow map width
 * @param height - Shadow map height
 * @param lightType - Type of light for logging context
 */
export function validateShadowMapSize(width: number, height: number, lightType: string): void {
  const isPowerOfTwo = (n: number) => (n & (n - 1)) === 0;

  if (!isPowerOfTwo(width) || !isPowerOfTwo(height)) {
    console.warn(
      `${lightType} shadow map size should be power of two. Current: ${width}x${height}`
    );
  }
}
