import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GraphContext } from "../engine/graphStore";
type Theme = "dark" | "light" | "system";
type ConnectionLineStyle = "bezier" | "straight" | "step" | "simpleBezier";
type FocusedCanvas = "flow" | "render" | null;
type FlowViewMode = "graph" | "list";
type CameraView = "3d" | "top" | "front" | "left" | "right" | "bottom";

// Preferences types
type DisplayUnit = "mm" | "cm" | "m" | "in" | "ft" | "ft-in";
type AntialiasingType = "none" | "fxaa" | "msaa" | "taa";
type BackgroundType = "single" | "gradient";
type ToneMappingType = "none" | "linear" | "reinhard" | "acesFilmic";
type CameraType = "perspective" | "orthographic";
type GizmoSize = "Small" | "Medium" | "Large";
type CaptureArea = "viewport" | "selection" | "custom";
type ResolutionPreset = "Viewport" | "1.5x" | "2x" | "4x" | "Custom";
type CountdownOption = "off" | "3s" | "5s";
type LogLevel = "errors" | "warnings" | "verbose";

export interface PreferencesState {
  units: {
    displayUnit: DisplayUnit;
  };
  renderer: {
    antialiasing: AntialiasingType;
    pixelRatioCap: number;
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
  debug: {
    rendererInfo: boolean;
    logLevel: LogLevel;
    showNormals: boolean;
    revealInternalMeters: boolean;
  };
}
interface UIState {
  theme: Theme;
  isDarkTheme: boolean;
  leftPaneWidth: number;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  isPaletteOpen: boolean;
  isPalettePinned: boolean;
  palettePosition: { x: number; y: number };
  showGridInFlowCanvas: boolean;
  showGridInRenderView: boolean;
  showMinimap: boolean;
  showFlowControls: boolean;
  connectionLineStyle: ConnectionLineStyle;
  collapsed: boolean;
  bottomPaneHeight: number;
  wireframe: boolean;
  xRay: boolean;
  focusedCanvas: FocusedCanvas;
  isOrthographicCamera: boolean;
  showAxisGizmo: boolean;
  currentCameraView: CameraView;
  selectedCategoryIndex: number;
  selectedNodeIndex: number;
  paletteSearchQuery: string;
  keyboardNavigationMode: boolean;
  currentContext: GraphContext;
  viewportStates: Record<string, { x: number; y: number; zoom: number }>;
  nodePositions: Record<string, Record<string, { x: number; y: number }>>;
  isRendererMaximized: boolean;
  flowViewModes: Record<string, FlowViewMode>;
  preferences: PreferencesState;
}
interface UIActions {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  updateLayout: (layout: { leftPaneWidth?: number }) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  setHoveredNode: (nodeId: string | null) => void;
  clearSelection: () => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setPalettePinned: (pinned: boolean) => void;
  togglePalettePinned: () => void;
  setPalettePosition: (position: { x: number; y: number }) => void;
  toggleGridInFlowCanvas: () => void;
  toggleGridInRenderView: () => void;
  toggleMinimap: () => void;
  toggleFlowControls: () => void;
  setConnectionLineStyle: (style: ConnectionLineStyle) => void;
  cycleConnectionLineStyle: () => void;
  toggleDrawer: () => void;
  setBottomPaneHeight: (height: number) => void;
  resetToDefaults: () => void;
  toggleWireframe: () => void;
  toggleXRay: () => void;
  setFocusedCanvas: (canvas: FocusedCanvas) => void;
  fitView: () => void;
  fitNodes: () => void;
  setOrthographicCamera: (isOrthographic: boolean) => void;
  toggleCameraMode: () => void;
  toggleAxisGizmo: () => void;
  setCameraView: (view: "top" | "front" | "left" | "right" | "bottom") => void;
  setCurrentCameraView: (view: CameraView) => void;
  setSelectedCategoryIndex: (index: number) => void;
  setSelectedNodeIndex: (index: number) => void;
  setPaletteSearchQuery: (query: string) => void;
  setKeyboardNavigationMode: (mode: boolean) => void;
  resetPaletteNavigation: () => void;
  setCurrentContext: (context: GraphContext) => void;
  navigateToRoot: () => void;
  navigateToSubFlow: (geoNodeId: string) => void;
  saveViewportState: (contextKey: string, viewport: { x: number; y: number; zoom: number }) => void;
  getViewportState: (contextKey: string) => { x: number; y: number; zoom: number } | null;
  saveNodePositions: (
    contextKey: string,
    positions: Record<string, { x: number; y: number }>
  ) => void;
  getNodePositions: (contextKey: string) => Record<string, { x: number; y: number }> | null;
  toggleRendererMaximized: () => void;
  setFlowViewMode: (contextKey: string, mode: FlowViewMode) => void;
  getFlowViewMode: (contextKey: string) => FlowViewMode;
  updatePreferences: (preferences: Partial<PreferencesState>) => void;
  resetPreferencesToDefaults: () => void;
}
type UIStore = UIState & UIActions;
const getIsDarkTheme = (theme: Theme): boolean => {
  if (theme === "system") {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return theme === "dark";
};
const updateBodyTheme = (theme: Theme) => {
  document.body.classList.remove("dark-theme", "light-theme");
  const isDark = getIsDarkTheme(theme);
  document.body.classList.add(isDark ? "dark-theme" : "light-theme");
};
export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      isDarkTheme: true,
      leftPaneWidth: 50,
      selectedNodeId: null,
      selectedNodeIds: [],
      hoveredNodeId: null,
      isPaletteOpen: false,
      isPalettePinned: false,
      palettePosition: { x: 100, y: 100 },
      showGridInFlowCanvas: true,
      showGridInRenderView: true,
      showMinimap: false,
      showFlowControls: true,
      connectionLineStyle: "bezier",
      collapsed: false,
      bottomPaneHeight: 260,
      wireframe: false,
      xRay: false,
      focusedCanvas: null,
      isOrthographicCamera: false,
      showAxisGizmo: true,
      currentCameraView: "3d",
      selectedCategoryIndex: 0,
      selectedNodeIndex: 0,
      paletteSearchQuery: "",
      keyboardNavigationMode: false,
      currentContext: { type: "root" },
      viewportStates: {},
      nodePositions: {},
      isRendererMaximized: false,
      flowViewModes: {},
      preferences: {
        units: {
          displayUnit: "m",
        },
        renderer: {
          antialiasing: "fxaa",
          pixelRatioCap: 2.0,
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
          toneMapping: "acesFilmic",
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
        debug: {
          rendererInfo: false,
          logLevel: "warnings",
          showNormals: false,
          revealInternalMeters: true,
        },
      },
      setTheme: (theme: Theme) => {
        const isDarkTheme = getIsDarkTheme(theme);
        updateBodyTheme(theme);
        set({ theme, isDarkTheme });
      },
      toggleTheme: () => {
        const { theme } = get();
        const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
        get().setTheme(nextTheme);
      },
      updateLayout: (layout) => {
        set((state) => ({
          leftPaneWidth: layout.leftPaneWidth ?? state.leftPaneWidth,
        }));
      },
      setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
      setSelectedNodes: (nodeIds) =>
        set({
          selectedNodeIds: nodeIds,
          selectedNodeId: nodeIds.length > 0 ? nodeIds[0] : null,
        }),
      setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
      clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: [] }),
      openPalette: () => set({ isPaletteOpen: true }),
      closePalette: () => set({ isPaletteOpen: false }),
      togglePalette: () => set((state) => ({ isPaletteOpen: !state.isPaletteOpen })),
      setPalettePinned: (pinned: boolean) => set({ isPalettePinned: pinned }),
      togglePalettePinned: () => set((state) => ({ isPalettePinned: !state.isPalettePinned })),
      setPalettePosition: (position: { x: number; y: number }) =>
        set({ palettePosition: position }),
      toggleGridInFlowCanvas: () =>
        set((state) => ({ showGridInFlowCanvas: !state.showGridInFlowCanvas })),
      toggleGridInRenderView: () =>
        set((state) => ({ showGridInRenderView: !state.showGridInRenderView })),
      toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
      toggleFlowControls: () => set((state) => ({ showFlowControls: !state.showFlowControls })),
      setConnectionLineStyle: (style) => set({ connectionLineStyle: style }),
      cycleConnectionLineStyle: () => {
        const styles: ConnectionLineStyle[] = ["bezier", "straight", "simpleBezier", "step"];
        const currentStyle = get().connectionLineStyle;
        const currentIndex = styles.indexOf(currentStyle);
        const nextIndex = (currentIndex + 1) % styles.length;
        set({ connectionLineStyle: styles[nextIndex] });
      },
      toggleDrawer: () => set((state) => ({ collapsed: !state.collapsed })),
      setBottomPaneHeight: (height: number) => set({ bottomPaneHeight: height }),
      resetToDefaults: () => {
        set({
          leftPaneWidth: 50,
          showGridInFlowCanvas: true,
          showGridInRenderView: true,
          showMinimap: false,
          showFlowControls: true,
          connectionLineStyle: "bezier",
          collapsed: false,
          bottomPaneHeight: 260,
          wireframe: false,
          xRay: false,
          focusedCanvas: null,
          isOrthographicCamera: false,
          showAxisGizmo: true,
        });
      },
      toggleWireframe: () => set((state) => ({ wireframe: !state.wireframe })),
      toggleXRay: () => set((state) => ({ xRay: !state.xRay })),
      setFocusedCanvas: (canvas: FocusedCanvas) => set({ focusedCanvas: canvas }),
      fitView: () => {
        window.dispatchEvent(new CustomEvent("minimystx:fitView"));
      },
      fitNodes: () => {
        window.dispatchEvent(new CustomEvent("minimystx:fitNodes"));
      },
      setOrthographicCamera: (isOrthographic: boolean) => {
        set({ isOrthographicCamera: isOrthographic });
        if (!isOrthographic) {
          set({ currentCameraView: "3d" });
        }
        window.dispatchEvent(
          new CustomEvent("minimystx:setCameraMode", { detail: { isOrthographic } })
        );
      },
      toggleCameraMode: () => {
        const { isOrthographicCamera } = get();
        get().setOrthographicCamera(!isOrthographicCamera);
      },
      toggleAxisGizmo: () => {
        set((state) => ({ showAxisGizmo: !state.showAxisGizmo }));
        window.dispatchEvent(new CustomEvent("minimystx:toggleAxisGizmo"));
      },
      setCameraView: (view: "top" | "front" | "left" | "right" | "bottom") => {
        set({ currentCameraView: view });
        window.dispatchEvent(new CustomEvent("minimystx:setCameraView", { detail: { view } }));
      },
      setCurrentCameraView: (view: CameraView) => {
        set({ currentCameraView: view });
      },
      setSelectedCategoryIndex: (index: number) => set({ selectedCategoryIndex: index }),
      setSelectedNodeIndex: (index: number) => set({ selectedNodeIndex: index }),
      setPaletteSearchQuery: (query: string) => set({ paletteSearchQuery: query }),
      setKeyboardNavigationMode: (mode: boolean) => set({ keyboardNavigationMode: mode }),
      resetPaletteNavigation: () =>
        set({
          selectedCategoryIndex: 0,
          selectedNodeIndex: 0,
          paletteSearchQuery: "",
          keyboardNavigationMode: false,
        }),
      setCurrentContext: (context: GraphContext) => {
        set((state) => ({
          ...state,
          selectedNodeId: null,
          currentContext: context,
        }));
      },
      navigateToRoot: () => {
        get().setCurrentContext({ type: "root" });
      },
      navigateToSubFlow: (geoNodeId: string) => {
        get().setCurrentContext({ type: "subflow", geoNodeId });
      },
      saveViewportState: (contextKey: string, viewport: { x: number; y: number; zoom: number }) => {
        set((state) => ({
          ...state,
          viewportStates: {
            ...state.viewportStates,
            [contextKey]: viewport,
          },
        }));
      },
      getViewportState: (contextKey: string) => {
        const state = get();
        return state.viewportStates[contextKey] || null;
      },
      saveNodePositions: (
        contextKey: string,
        positions: Record<string, { x: number; y: number }>
      ) => {
        set((state) => ({
          ...state,
          nodePositions: {
            ...state.nodePositions,
            [contextKey]: positions,
          },
        }));
      },
      getNodePositions: (contextKey: string) => {
        const state = get();
        return state.nodePositions[contextKey] || null;
      },
      toggleRendererMaximized: () => {
        window.dispatchEvent(new CustomEvent("minimystx:saveCurrentViewport"));
        set((state) => ({ isRendererMaximized: !state.isRendererMaximized }));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("minimystx:restoreViewportAfterMaximize"));
        }, 100);
      },
      setFlowViewMode: (contextKey: string, mode: FlowViewMode) => {
        set((state) => ({
          ...state,
          flowViewModes: {
            ...state.flowViewModes,
            [contextKey]: mode,
          },
        }));
      },
      getFlowViewMode: (contextKey: string) => {
        const state = get();
        return state.flowViewModes[contextKey] || "graph";
      },
      updatePreferences: (preferences: Partial<PreferencesState>) => {
        set((state) => ({
          ...state,
          preferences: {
            ...state.preferences,
            ...preferences,
            // Deep merge nested objects to ensure proper updates
            units: preferences.units ? { ...state.preferences.units, ...preferences.units } : state.preferences.units,
            renderer: preferences.renderer ? {
              ...state.preferences.renderer,
              ...preferences.renderer,
              postProcessing: preferences.renderer.postProcessing ? {
                ...state.preferences.renderer.postProcessing,
                ...preferences.renderer.postProcessing
              } : state.preferences.renderer.postProcessing,
              background: preferences.renderer.background ? {
                ...state.preferences.renderer.background,
                ...preferences.renderer.background
              } : state.preferences.renderer.background,
            } : state.preferences.renderer,
            materials: preferences.materials ? { ...state.preferences.materials, ...preferences.materials } : state.preferences.materials,
            camera: preferences.camera ? {
              ...state.preferences.camera,
              ...preferences.camera,
              orbitControls: preferences.camera.orbitControls ? {
                ...state.preferences.camera.orbitControls,
                ...preferences.camera.orbitControls
              } : state.preferences.camera.orbitControls,
            } : state.preferences.camera,
            guides: preferences.guides ? {
              ...state.preferences.guides,
              ...preferences.guides,
              grid: preferences.guides.grid ? {
                ...state.preferences.guides.grid,
                ...preferences.guides.grid
              } : state.preferences.guides.grid,
              axisGizmo: preferences.guides.axisGizmo ? {
                ...state.preferences.guides.axisGizmo,
                ...preferences.guides.axisGizmo
              } : state.preferences.guides.axisGizmo,
              groundPlane: preferences.guides.groundPlane ? {
                ...state.preferences.guides.groundPlane,
                ...preferences.guides.groundPlane
              } : state.preferences.guides.groundPlane,
            } : state.preferences.guides,
            screenshot: preferences.screenshot ? {
              ...state.preferences.screenshot,
              ...preferences.screenshot,
              resolution: preferences.screenshot.resolution ? {
                ...state.preferences.screenshot.resolution,
                ...preferences.screenshot.resolution
              } : state.preferences.screenshot.resolution,
              overlays: preferences.screenshot.overlays ? {
                ...state.preferences.screenshot.overlays,
                ...preferences.screenshot.overlays
              } : state.preferences.screenshot.overlays,
              colorManagement: preferences.screenshot.colorManagement ? {
                ...state.preferences.screenshot.colorManagement,
                ...preferences.screenshot.colorManagement
              } : state.preferences.screenshot.colorManagement,
              fileNaming: preferences.screenshot.fileNaming ? {
                ...state.preferences.screenshot.fileNaming,
                ...preferences.screenshot.fileNaming
              } : state.preferences.screenshot.fileNaming,
              captureFlow: preferences.screenshot.captureFlow ? {
                ...state.preferences.screenshot.captureFlow,
                ...preferences.screenshot.captureFlow
              } : state.preferences.screenshot.captureFlow,
            } : state.preferences.screenshot,
            debug: preferences.debug ? { ...state.preferences.debug, ...preferences.debug } : state.preferences.debug,
          },
        }));
      },
      resetPreferencesToDefaults: () => {
        set((state) => ({
          ...state,
          preferences: {
            units: {
              displayUnit: "m",
            },
            renderer: {
              antialiasing: "fxaa",
              pixelRatioCap: 2.0,
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
              toneMapping: "acesFilmic",
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
            debug: {
              rendererInfo: false,
              logLevel: "warnings",
              showNormals: false,
              revealInternalMeters: true,
            },
          },
        }));
      },
    }),
    {
      name: "minimystx-ui-store",
      partialize: (state) => ({
        theme: state.theme,
        isDarkTheme: state.isDarkTheme,
        leftPaneWidth: state.leftPaneWidth,
        isPaletteOpen: state.isPaletteOpen,
        isPalettePinned: state.isPalettePinned,
        showGridInFlowCanvas: state.showGridInFlowCanvas,
        showGridInRenderView: state.showGridInRenderView,
        showMinimap: state.showMinimap,
        showFlowControls: state.showFlowControls,
        connectionLineStyle: state.connectionLineStyle,
        collapsed: state.collapsed,
        bottomPaneHeight: state.bottomPaneHeight,
        isRendererMaximized: state.isRendererMaximized,
        preferences: state.preferences,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const computedIsDark = getIsDarkTheme(state.theme);
          if (state.isDarkTheme !== computedIsDark) {
            state.isDarkTheme = computedIsDark;
          }
          updateBodyTheme(state.theme);

          // Migrate preferences to ensure all required properties exist
          if (state.preferences) {
            // Ensure elevation property exists for groundPlane
            if (state.preferences.guides?.groundPlane && typeof state.preferences.guides.groundPlane.elevation === 'undefined') {
              state.preferences.guides.groundPlane.elevation = -0.001;
            }
            // Ensure majorGridLines property exists for grid
            if (state.preferences.guides?.grid && typeof state.preferences.guides.grid.majorGridLines === 'undefined') {
              state.preferences.guides.grid.majorGridLines = 10;
            }
            // Ensure bloomStrength property exists for postProcessing
            if (state.preferences.renderer?.postProcessing && typeof state.preferences.renderer.postProcessing.bloomStrength === 'undefined') {
              state.preferences.renderer.postProcessing.bloomStrength = 0.5;
            }
            // Ensure SSAO properties exist for postProcessing
            if (state.preferences.renderer?.postProcessing) {
              if (typeof state.preferences.renderer.postProcessing.ssaoKernelRadius === 'undefined') {
                state.preferences.renderer.postProcessing.ssaoKernelRadius = 16;
              }
              if (typeof state.preferences.renderer.postProcessing.ssaoMinDistance === 'undefined') {
                state.preferences.renderer.postProcessing.ssaoMinDistance = 0.005;
              }
              if (typeof state.preferences.renderer.postProcessing.ssaoMaxDistance === 'undefined') {
                state.preferences.renderer.postProcessing.ssaoMaxDistance = 0.1;
              }
              if (typeof state.preferences.renderer.postProcessing.ssaoIntensity === 'undefined') {
                state.preferences.renderer.postProcessing.ssaoIntensity = 1.0;
              }
            }
          }
        }
      },
    }
  )
);
if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", () => {
    const store = useUIStore.getState();
    if (store.theme === "system") {
      store.setTheme("system");
    }
  });
  const initialTheme = useUIStore.getState().theme;
  updateBodyTheme(initialTheme);
}
export const useDrawerCollapsed = () => useUIStore((state) => state.collapsed);
export const useDrawerHeight = () => useUIStore((state) => state.bottomPaneHeight);
export const useToggleDrawer = () => useUIStore((state) => state.toggleDrawer);
export const useSetDrawerHeight = () => useUIStore((state) => state.setBottomPaneHeight);
export const usePaletteOpen = () => useUIStore((state) => state.isPaletteOpen);
export const usePalettePinned = () => useUIStore((state) => state.isPalettePinned);
export const usePalettePosition = () => useUIStore((state) => state.palettePosition);
export const useTogglePalette = () => useUIStore((state) => state.togglePalette);
export const useOpenPalette = () => useUIStore((state) => state.openPalette);
export const useClosePalette = () => useUIStore((state) => state.closePalette);
export const useTogglePalettePinned = () => useUIStore((state) => state.togglePalettePinned);
export const useSetPalettePosition = () => useUIStore((state) => state.setPalettePosition);
export const useWireframe = () => useUIStore((state) => state.wireframe);
export const useXRay = () => useUIStore((state) => state.xRay);
export const useFocusedCanvas = () => useUIStore((state) => state.focusedCanvas);
export const useToggleWireframe = () => useUIStore((state) => state.toggleWireframe);
export const useToggleXRay = () => useUIStore((state) => state.toggleXRay);
export const useSetFocusedCanvas = () => useUIStore((state) => state.setFocusedCanvas);
export const useFitView = () => useUIStore((state) => state.fitView);
export const useFitNodes = () => useUIStore((state) => state.fitNodes);
export const useIsOrthographicCamera = () => useUIStore((state) => state.isOrthographicCamera);
export const useShowAxisGizmo = () => useUIStore((state) => state.showAxisGizmo);
export const useSetOrthographicCamera = () => useUIStore((state) => state.setOrthographicCamera);
export const useToggleCameraMode = () => useUIStore((state) => state.toggleCameraMode);
export const useToggleAxisGizmo = () => useUIStore((state) => state.toggleAxisGizmo);
export const useSetCameraView = () => useUIStore((state) => state.setCameraView);
export const useCurrentCameraView = () => useUIStore((state) => state.currentCameraView);
export const useSetCurrentCameraView = () => useUIStore((state) => state.setCurrentCameraView);
export const useSelectedCategoryIndex = () => useUIStore((state) => state.selectedCategoryIndex);
export const useSelectedNodeIndex = () => useUIStore((state) => state.selectedNodeIndex);
export const usePaletteSearchQuery = () => useUIStore((state) => state.paletteSearchQuery);
export const useKeyboardNavigationMode = () => useUIStore((state) => state.keyboardNavigationMode);
export const useSetSelectedCategoryIndex = () =>
  useUIStore((state) => state.setSelectedCategoryIndex);
export const useSetSelectedNodeIndex = () => useUIStore((state) => state.setSelectedNodeIndex);
export const useSetPaletteSearchQuery = () => useUIStore((state) => state.setPaletteSearchQuery);
export const useSetKeyboardNavigationMode = () =>
  useUIStore((state) => state.setKeyboardNavigationMode);
export const useResetPaletteNavigation = () => useUIStore((state) => state.resetPaletteNavigation);
export const useCurrentContext = () => useUIStore((state) => state.currentContext);
export const useSetCurrentContext = () => useUIStore((state) => state.setCurrentContext);
export const useNavigateToRoot = () => useUIStore((state) => state.navigateToRoot);
export const useNavigateToSubFlow = () => useUIStore((state) => state.navigateToSubFlow);
export const useSaveViewportState = () => useUIStore((state) => state.saveViewportState);
export const useGetViewportState = () => useUIStore((state) => state.getViewportState);
export const useSaveNodePositions = () => useUIStore((state) => state.saveNodePositions);
export const useGetNodePositions = () => useUIStore((state) => state.getNodePositions);
export const useIsRendererMaximized = () => useUIStore((state) => state.isRendererMaximized);
export const useToggleRendererMaximized = () =>
  useUIStore((state) => state.toggleRendererMaximized);
export const useSetFlowViewMode = () => useUIStore((state) => state.setFlowViewMode);
export const useGetFlowViewMode = () => useUIStore((state) => state.getFlowViewMode);
export const getContextKey = (context: GraphContext): string => {
  return context.type === "root" ? "root" : `subflow-${context.geoNodeId}`;
};
