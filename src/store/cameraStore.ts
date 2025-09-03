import { create } from "zustand";
import { persist } from "zustand/middleware";

type CameraView = "3d" | "top" | "front" | "left" | "right" | "bottom";

interface CameraState {
  isOrthographicCamera: boolean;
  currentCameraView: CameraView;
  showAxisGizmo: boolean;
}

interface CameraActions {
  setOrthographicCamera: (isOrthographic: boolean) => void;
  toggleCameraMode: () => void;
  setCameraView: (view: "top" | "front" | "left" | "right" | "bottom") => void;
  setCurrentCameraView: (view: CameraView) => void;
  toggleAxisGizmo: () => void;
}

type CameraStore = CameraState & CameraActions;

const isCameraView = (view: string): view is "top" | "front" | "left" | "right" | "bottom" => {
  return ["top", "front", "left", "right", "bottom"].includes(view);
};

const isValidCameraView = (view: unknown): view is CameraView => {
  return (
    typeof view === "string" && ["3d", "top", "front", "left", "right", "bottom"].includes(view)
  );
};

export const useCameraStore = create<CameraStore>()(
  persist(
    (set, get) => ({
      isOrthographicCamera: false,
      currentCameraView: "3d",
      showAxisGizmo: true,

      setOrthographicCamera: (isOrthographic: boolean) => {
        set({ isOrthographicCamera: isOrthographic });
        if (!isOrthographic) {
          set({ currentCameraView: "3d" });
        }
      },

      toggleCameraMode: () => {
        const { isOrthographicCamera } = get();
        get().setOrthographicCamera(!isOrthographicCamera);
      },

      setCameraView: (view: "top" | "front" | "left" | "right" | "bottom") => {
        if (!isCameraView(view)) {
          throw new Error(`Invalid camera view: ${view}`);
        }
        set({ currentCameraView: view });
      },

      setCurrentCameraView: (view: CameraView) => {
        if (!isValidCameraView(view)) {
          throw new Error(`Invalid camera view: ${view}`);
        }
        set({ currentCameraView: view });
      },

      toggleAxisGizmo: () => {
        set((state) => ({ showAxisGizmo: !state.showAxisGizmo }));
      },
    }),
    {
      name: "minimystx-camera-store",
    }
  )
);

export const useIsOrthographicCamera = () => useCameraStore((state) => state.isOrthographicCamera);
export const useCurrentCameraView = () => useCameraStore((state) => state.currentCameraView);
export const useShowAxisGizmo = () => useCameraStore((state) => state.showAxisGizmo);
export const useSetOrthographicCamera = () =>
  useCameraStore((state) => state.setOrthographicCamera);
export const useToggleCameraMode = () => useCameraStore((state) => state.toggleCameraMode);
export const useSetCameraView = () => useCameraStore((state) => state.setCameraView);
export const useSetCurrentCameraView = () => useCameraStore((state) => state.setCurrentCameraView);
export const useToggleAxisGizmo = () => useCameraStore((state) => state.toggleAxisGizmo);
