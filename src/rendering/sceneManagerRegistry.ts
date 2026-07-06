// Holds the live SceneManager instance so imperative non-React code (scene IO,
// import restore) can read and write camera state with direct typed calls
// instead of request/response CustomEvent handshakes. Set on SceneManager init,
// cleared on dispose.

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
  isOrthographic?: boolean;
}

export interface RegisteredSceneManager {
  getCameraPose(): CameraPose | null;
  setCameraPose(pose: CameraPose): void;
}

let current: RegisteredSceneManager | null = null;

export function registerSceneManager(manager: RegisteredSceneManager): void {
  current = manager;
}

export function unregisterSceneManager(manager: RegisteredSceneManager): void {
  if (current === manager) {
    current = null;
  }
}

export function getSceneManager(): RegisteredSceneManager | null {
  return current;
}
