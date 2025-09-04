import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GraphContext } from "../engine/graphStore";
import { useCameraStore } from "./cameraStore";
import { useLayoutStore } from "./layoutStore";
import { 
  emitSetCameraMode, 
  emitToggleAxisGizmo, 
  emitSetCameraView
} from "./eventBus";

type Theme = "dark" | "light" | "system";
type ConnectionLineStyle = "bezier" | "straight" | "step" | "simpleBezier";
type FocusedCanvas = "flow" | "render" | null;
type FlowViewMode = "graph" | "list";
type CameraView = "3d" | "top" | "front" | "left" | "right" | "bottom";
type DisplayMode = "shaded" | "wireframe" | "xray" | "shadedWireframe" | "xrayWireframe" | "normals" | "depth" | "normalsWireframe" | "depthWireframe";


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
  displayMode: DisplayMode;
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
  setDisplayMode: (mode: DisplayMode) => void;
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
      displayMode: "shaded" as DisplayMode,
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
          displayMode: "shaded" as DisplayMode,
          focusedCanvas: null,
          isOrthographicCamera: false,
          showAxisGizmo: true,
        });
      },
      setDisplayMode: (mode: DisplayMode) => set({ displayMode: mode }),
      setFocusedCanvas: (canvas: FocusedCanvas) => set({ focusedCanvas: canvas }),
      fitView: () => {
        window.dispatchEvent(new CustomEvent("minimystx:fitView"));
      },
      fitNodes: () => {
        window.dispatchEvent(new CustomEvent("minimystx:fitNodes"));
      },
      setOrthographicCamera: (isOrthographic: boolean) => {
        const cameraStore = useCameraStore.getState();
        cameraStore.setOrthographicCamera(isOrthographic);
        emitSetCameraMode(isOrthographic);
      },
      toggleCameraMode: () => {
        const cameraStore = useCameraStore.getState();
        cameraStore.toggleCameraMode();
        const isOrthographic = useCameraStore.getState().isOrthographicCamera;
        emitSetCameraMode(isOrthographic);
      },
      toggleAxisGizmo: () => {
        const cameraStore = useCameraStore.getState();
        cameraStore.toggleAxisGizmo();
        emitToggleAxisGizmo();
      },
      setCameraView: (view: "top" | "front" | "left" | "right" | "bottom") => {
        const cameraStore = useCameraStore.getState();
        cameraStore.setCameraView(view);
        emitSetCameraView(view);
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
        const layoutStore = useLayoutStore.getState();
        layoutStore.toggleRendererMaximized();
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
        displayMode: state.displayMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const computedIsDark = getIsDarkTheme(state.theme);
          if (state.isDarkTheme !== computedIsDark) {
            state.isDarkTheme = computedIsDark;
          }
          updateBodyTheme(state.theme);
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
export const useDisplayMode = () => useUIStore((state) => state.displayMode);
export const useFocusedCanvas = () => useUIStore((state) => state.focusedCanvas);
export const useSetDisplayMode = () => useUIStore((state) => state.setDisplayMode);
export const useSetFocusedCanvas = () => useUIStore((state) => state.setFocusedCanvas);
export const useFitView = () => useUIStore((state) => state.fitView);
export const useFitNodes = () => useUIStore((state) => state.fitNodes);
export const useSetOrthographicCamera = () => useUIStore((state) => state.setOrthographicCamera);
export const useToggleCameraMode = () => useUIStore((state) => state.toggleCameraMode);
export const useToggleAxisGizmo = () => useUIStore((state) => state.toggleAxisGizmo);
export const useSetCameraView = () => useUIStore((state) => state.setCameraView);
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
export const useToggleRendererMaximized = () =>
  useUIStore((state) => state.toggleRendererMaximized);
export const useSetFlowViewMode = () => useUIStore((state) => state.setFlowViewMode);
export const useGetFlowViewMode = () => useUIStore((state) => state.getFlowViewMode);
export const getContextKey = (context: GraphContext): string => {
  return context.type === "root" ? "root" : `subflow-${context.geoNodeId}`;
};

export { useIsOrthographicCamera, useCurrentCameraView, useShowAxisGizmo } from "./cameraStore";
export {
  useDrawerCollapsed,
  useDrawerHeight,
  useToggleDrawer,
  useSetDrawerHeight,
  usePaletteOpen,
  usePalettePinned,
  usePalettePosition,
  useTogglePalette,
  useOpenPalette,
  useClosePalette,
  useTogglePalettePinned,
  useSetPalettePosition,
  useIsRendererMaximized,
} from "./layoutStore";
