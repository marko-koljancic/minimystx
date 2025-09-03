import { create } from "zustand";
import { persist } from "zustand/middleware";

type DisplayUnit = "mm" | "cm" | "m" | "in" | "ft" | "ft-in";
type BackgroundType = "single" | "gradient";
type ToneMappingType = "None" | "Linear" | "Reinhard" | "ACES Filmic";
type CameraType = "perspective" | "orthographic";
type GizmoSize = "Small" | "Medium" | "Large";
type CaptureArea = "viewport" | "selection" | "custom";
type ResolutionPreset = "Viewport" | "1.5x" | "2x" | "4x" | "Custom";
type CountdownOption = "off" | "3s" | "5s";

export interface PreferencesState {
  units: {
    displayUnit: DisplayUnit;
  };
  renderer: {
    postProcessing: {
      enabled: boolean;
      passes: string[];
      bloomStrength: number;
      ssaoKernelRadius: number;
      ssaoMinDistance: number;
      ssaoMaxDistance: number;
      ssaoIntensity: number;
    };
    background: {
      type: BackgroundType;
      color: string;
      color2?: string;
    };
  };
  materials: {
    defaultMaterial: string;
    toneMapping: ToneMappingType;
    exposure: number;
    sRGBEncoding: boolean;
  };
  camera: {
    defaultType: CameraType;
    perspectiveFOV: number;
    orthoScale: number;
    clippingNear: number;
    clippingFar: number;
    orbitControls: {
      rotateSpeed: number;
      panSpeed: number;
      dollySpeed: number;
      dampingEnabled: boolean;
    };
  };
  guides: {
    grid: {
      enabled: boolean;
      majorSpacing: number;
      minorSubdivisions: number;
      majorGridLines: number;
    };
    axisGizmo: {
      enabled: boolean;
      size: GizmoSize;
    };
    groundPlane: {
      enabled: boolean;
      shadowsEnabled: boolean;
      elevation: number;
    };
  };
  screenshot: {
    captureArea: CaptureArea;
    cameraSource: string;
    resolution: {
      preset: ResolutionPreset;
      customWidth?: number;
      customHeight?: number;
    };
    overlays: {
      transparentBackground: boolean;
      grid: boolean;
      gizmos: boolean;
      stats: boolean;
    };
    colorManagement: {
      embedSRGB: boolean;
      bakeToneMapping: boolean;
    };
    fileNaming: {
      template: string;
    };
    captureFlow: {
      countdown: CountdownOption;
      restoreViewport: boolean;
    };
  };
}

interface PreferencesActions {
  updateUnits: (units: Partial<PreferencesState["units"]>) => void;
  updateRendererPostProcessing: (
    postProcessing: Partial<PreferencesState["renderer"]["postProcessing"]>
  ) => void;
  updateRendererBackground: (
    background: Partial<PreferencesState["renderer"]["background"]>
  ) => void;
  updateMaterials: (materials: Partial<PreferencesState["materials"]>) => void;
  updateCameraSettings: (camera: Partial<PreferencesState["camera"]>) => void;
  updateCameraOrbitControls: (
    orbitControls: Partial<PreferencesState["camera"]["orbitControls"]>
  ) => void;
  updateGridSettings: (grid: Partial<PreferencesState["guides"]["grid"]>) => void;
  updateAxisGizmo: (axisGizmo: Partial<PreferencesState["guides"]["axisGizmo"]>) => void;
  updateGroundPlane: (groundPlane: Partial<PreferencesState["guides"]["groundPlane"]>) => void;
  updateScreenshotSettings: (screenshot: Partial<PreferencesState["screenshot"]>) => void;
  updateScreenshotResolution: (
    resolution: Partial<PreferencesState["screenshot"]["resolution"]>
  ) => void;
  updateScreenshotOverlays: (overlays: Partial<PreferencesState["screenshot"]["overlays"]>) => void;
  updateScreenshotColorManagement: (
    colorManagement: Partial<PreferencesState["screenshot"]["colorManagement"]>
  ) => void;
  updateScreenshotFileNaming: (
    fileNaming: Partial<PreferencesState["screenshot"]["fileNaming"]>
  ) => void;
  updateScreenshotCaptureFlow: (
    captureFlow: Partial<PreferencesState["screenshot"]["captureFlow"]>
  ) => void;
  resetToDefaults: () => void;
}

type PreferencesStore = PreferencesState & PreferencesActions;

const defaultPreferences: PreferencesState = {
  units: {
    displayUnit: "m",
  },
  renderer: {
    postProcessing: {
      enabled: false,
      passes: [],
      bloomStrength: 0.5,
      ssaoKernelRadius: 16,
      ssaoMinDistance: 0.005,
      ssaoMaxDistance: 0.1,
      ssaoIntensity: 1.0,
    },
    background: {
      type: "single",
      color: "#191919",
    },
  },
  materials: {
    defaultMaterial: "meshStandard",
    toneMapping: "None",
    exposure: 1.0,
    sRGBEncoding: true,
  },
  camera: {
    defaultType: "perspective",
    perspectiveFOV: 75,
    orthoScale: 10,
    clippingNear: 0.1,
    clippingFar: 1000,
    orbitControls: {
      rotateSpeed: 1.0,
      panSpeed: 1.0,
      dollySpeed: 1.0,
      dampingEnabled: true,
    },
  },
  guides: {
    grid: {
      enabled: true,
      majorSpacing: 10.0,
      minorSubdivisions: 5,
      majorGridLines: 10,
    },
    axisGizmo: {
      enabled: true,
      size: "Small",
    },
    groundPlane: {
      enabled: false,
      shadowsEnabled: false,
      elevation: -0.001,
    },
  },
  screenshot: {
    captureArea: "viewport",
    cameraSource: "active",
    resolution: {
      preset: "2x",
    },
    overlays: {
      transparentBackground: false,
      grid: true,
      gizmos: true,
      stats: false,
    },
    colorManagement: {
      embedSRGB: true,
      bakeToneMapping: true,
    },
    fileNaming: {
      template: "minimystx-screenshot-{date}-{time}-{width}x{height}.png",
    },
    captureFlow: {
      countdown: "off",
      restoreViewport: true,
    },
  },
};

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      ...defaultPreferences,

      updateUnits: (units) => {
        set((state) => ({
          units: { ...state.units, ...units },
        }));
      },

      updateRendererPostProcessing: (postProcessing) => {
        set((state) => ({
          renderer: {
            ...state.renderer,
            postProcessing: { ...state.renderer.postProcessing, ...postProcessing },
          },
        }));
      },

      updateRendererBackground: (background) => {
        set((state) => ({
          renderer: {
            ...state.renderer,
            background: { ...state.renderer.background, ...background },
          },
        }));
      },

      updateMaterials: (materials) => {
        set((state) => ({
          materials: { ...state.materials, ...materials },
        }));
      },

      updateCameraSettings: (camera) => {
        set((state) => ({
          camera: { ...state.camera, ...camera },
        }));
      },

      updateCameraOrbitControls: (orbitControls) => {
        set((state) => ({
          camera: {
            ...state.camera,
            orbitControls: { ...state.camera.orbitControls, ...orbitControls },
          },
        }));
      },

      updateGridSettings: (grid) => {
        set((state) => ({
          guides: {
            ...state.guides,
            grid: { ...state.guides.grid, ...grid },
          },
        }));
      },

      updateAxisGizmo: (axisGizmo) => {
        set((state) => ({
          guides: {
            ...state.guides,
            axisGizmo: { ...state.guides.axisGizmo, ...axisGizmo },
          },
        }));
      },

      updateGroundPlane: (groundPlane) => {
        set((state) => ({
          guides: {
            ...state.guides,
            groundPlane: { ...state.guides.groundPlane, ...groundPlane },
          },
        }));
      },

      updateScreenshotSettings: (screenshot) => {
        set((state) => ({
          screenshot: { ...state.screenshot, ...screenshot },
        }));
      },

      updateScreenshotResolution: (resolution) => {
        set((state) => ({
          screenshot: {
            ...state.screenshot,
            resolution: { ...state.screenshot.resolution, ...resolution },
          },
        }));
      },

      updateScreenshotOverlays: (overlays) => {
        set((state) => ({
          screenshot: {
            ...state.screenshot,
            overlays: { ...state.screenshot.overlays, ...overlays },
          },
        }));
      },

      updateScreenshotColorManagement: (colorManagement) => {
        set((state) => ({
          screenshot: {
            ...state.screenshot,
            colorManagement: { ...state.screenshot.colorManagement, ...colorManagement },
          },
        }));
      },

      updateScreenshotFileNaming: (fileNaming) => {
        set((state) => ({
          screenshot: {
            ...state.screenshot,
            fileNaming: { ...state.screenshot.fileNaming, ...fileNaming },
          },
        }));
      },

      updateScreenshotCaptureFlow: (captureFlow) => {
        set((state) => ({
          screenshot: {
            ...state.screenshot,
            captureFlow: { ...state.screenshot.captureFlow, ...captureFlow },
          },
        }));
      },

      resetToDefaults: () => {
        set(defaultPreferences);
      },
    }),
    {
      name: "minimystx-preferences-store",
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (
            state.guides?.groundPlane &&
            typeof state.guides.groundPlane.elevation === "undefined"
          ) {
            state.guides.groundPlane.elevation = -0.001;
          }
          if (state.guides?.grid && typeof state.guides.grid.majorGridLines === "undefined") {
            state.guides.grid.majorGridLines = 10;
          }
          if (
            state.renderer?.postProcessing &&
            typeof state.renderer.postProcessing.bloomStrength === "undefined"
          ) {
            state.renderer.postProcessing.bloomStrength = 0.5;
          }
          if (state.renderer?.postProcessing) {
            if (typeof state.renderer.postProcessing.ssaoKernelRadius === "undefined") {
              state.renderer.postProcessing.ssaoKernelRadius = 16;
            }
            if (typeof state.renderer.postProcessing.ssaoMinDistance === "undefined") {
              state.renderer.postProcessing.ssaoMinDistance = 0.005;
            }
            if (typeof state.renderer.postProcessing.ssaoMaxDistance === "undefined") {
              state.renderer.postProcessing.ssaoMaxDistance = 0.1;
            }
            if (typeof state.renderer.postProcessing.ssaoIntensity === "undefined") {
              state.renderer.postProcessing.ssaoIntensity = 1.0;
            }
          }
        }
      },
    }
  )
);
