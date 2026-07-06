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
