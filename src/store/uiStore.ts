import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GraphContext } from "../engine/graphStore";
import { useCameraStore } from "./cameraStore";
import { useLayoutStore } from "./layoutStore";
import { emitAppEvent } from "./events";

type Theme = "dark" | "light" | "system";
type ConnectionLineStyle = "bezier" | "straight" | "step" | "simpleBezier";
type FocusedCanvas = "flow" | "render" | null;
type FlowViewMode = "graph" | "list";
type DisplayMode =
  | "shaded"
  | "wireframe"
  | "xray"
  | "shadedWireframe"
  | "xrayWireframe"
  | "normals"
  | "depth"
  | "normalsWireframe"
  | "depthWireframe";

// UI chrome and editor session state only. Layout panes live in layoutStore,
// camera mode/view/gizmo in cameraStore, document view data (node positions,
// viewport pan/zoom) in documentStore, and app preferences in preferencesStore.
interface UIState {
  theme: Theme;
  isDarkTheme: boolean;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  showGridInFlowCanvas: boolean;
  showGridInRenderView: boolean;
  showMinimap: boolean;
  showFlowControls: boolean;
  connectionLineStyle: ConnectionLineStyle;
  displayMode: DisplayMode;
  focusedCanvas: FocusedCanvas;
  selectedCategoryIndex: number;
  selectedNodeIndex: number;
  paletteSearchQuery: string;
  keyboardNavigationMode: boolean;
  currentContext: GraphContext;
  flowViewModes: Record<string, FlowViewMode>;
}
interface UIActions {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSelectedNode: (nodeId: string | null) => void;
  setSelectedNodes: (nodeIds: string[]) => void;
  setHoveredNode: (nodeId: string | null) => void;
  clearSelection: () => void;
  toggleGridInFlowCanvas: () => void;
  toggleGridInRenderView: () => void;
  toggleMinimap: () => void;
  toggleFlowControls: () => void;
  // Direct setters used by scene-file restore.
  setShowGridInRenderView: (visible: boolean) => void;
  setShowMinimap: (visible: boolean) => void;
  setShowFlowControls: (visible: boolean) => void;
  setConnectionLineStyle: (style: ConnectionLineStyle) => void;
  cycleConnectionLineStyle: () => void;
  resetToDefaults: () => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setFocusedCanvas: (canvas: FocusedCanvas) => void;
  fitView: () => void;
  fitNodes: () => void;
  setSelectedCategoryIndex: (index: number) => void;
  setSelectedNodeIndex: (index: number) => void;
  setPaletteSearchQuery: (query: string) => void;
  setKeyboardNavigationMode: (mode: boolean) => void;
  resetPaletteNavigation: () => void;
  setCurrentContext: (context: GraphContext) => void;
  navigateToRoot: () => void;
  navigateToSubFlow: (geoNodeId: string) => void;
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
      selectedNodeId: null,
      selectedNodeIds: [],
      hoveredNodeId: null,
      showGridInFlowCanvas: true,
      showGridInRenderView: true,
      showMinimap: false,
      showFlowControls: true,
      connectionLineStyle: "bezier",
      displayMode: "shaded" as DisplayMode,
      focusedCanvas: null,
      selectedCategoryIndex: 0,
      selectedNodeIndex: 0,
      paletteSearchQuery: "",
      keyboardNavigationMode: false,
      currentContext: { type: "root" },
      flowViewModes: {},
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
      setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
      setSelectedNodes: (nodeIds) =>
        set({
          selectedNodeIds: nodeIds,
          selectedNodeId: nodeIds.length > 0 ? nodeIds[0] : null,
        }),
      setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
      clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: [] }),
      toggleGridInFlowCanvas: () => set((state) => ({ showGridInFlowCanvas: !state.showGridInFlowCanvas })),
      toggleGridInRenderView: () => set((state) => ({ showGridInRenderView: !state.showGridInRenderView })),
      toggleMinimap: () => set((state) => ({ showMinimap: !state.showMinimap })),
      toggleFlowControls: () => set((state) => ({ showFlowControls: !state.showFlowControls })),
      setShowGridInRenderView: (visible) => set({ showGridInRenderView: visible }),
      setShowMinimap: (visible) => set({ showMinimap: visible }),
      setShowFlowControls: (visible) => set({ showFlowControls: visible }),
      setConnectionLineStyle: (style) => set({ connectionLineStyle: style }),
      cycleConnectionLineStyle: () => {
        const styles: ConnectionLineStyle[] = ["bezier", "straight", "simpleBezier", "step"];
        const currentStyle = get().connectionLineStyle;
        const currentIndex = styles.indexOf(currentStyle);
        const nextIndex = (currentIndex + 1) % styles.length;
        set({ connectionLineStyle: styles[nextIndex] });
      },
      resetToDefaults: () => {
        set({
          showGridInFlowCanvas: true,
          showGridInRenderView: true,
          showMinimap: false,
          showFlowControls: true,
          connectionLineStyle: "bezier",
          displayMode: "shaded" as DisplayMode,
          focusedCanvas: null,
        });
        useLayoutStore.getState().resetToDefaults();
        useCameraStore.getState().resetToDefaults();
      },
      setDisplayMode: (mode: DisplayMode) => set({ displayMode: mode }),
      setFocusedCanvas: (canvas: FocusedCanvas) => set({ focusedCanvas: canvas }),
      fitView: () => {
        emitAppEvent("minimystx:fitView");
      },
      fitNodes: () => {
        emitAppEvent("minimystx:fitNodes");
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
        set({
          selectedNodeId: null,
          currentContext: context,
        });
      },
      navigateToRoot: () => {
        get().setCurrentContext({ type: "root" });
      },
      navigateToSubFlow: (geoNodeId: string) => {
        get().setCurrentContext({ type: "subflow", geoNodeId });
      },
      setFlowViewMode: (contextKey: string, mode: FlowViewMode) => {
        set((state) => ({
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
      // Version 1: layout/camera/document state moved to their own stores; drop
      // any stale keys an older persisted blob may carry.
      version: 1,
      migrate: (persisted) => persisted as UIStore,
      partialize: (state) => ({
        theme: state.theme,
        isDarkTheme: state.isDarkTheme,
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
export const useSelectedCategoryIndex = () => useUIStore((state) => state.selectedCategoryIndex);
export const useSelectedNodeIndex = () => useUIStore((state) => state.selectedNodeIndex);
export const usePaletteSearchQuery = () => useUIStore((state) => state.paletteSearchQuery);
export const useKeyboardNavigationMode = () => useUIStore((state) => state.keyboardNavigationMode);
export const useSetSelectedCategoryIndex = () => useUIStore((state) => state.setSelectedCategoryIndex);
export const useSetSelectedNodeIndex = () => useUIStore((state) => state.setSelectedNodeIndex);
export const useSetPaletteSearchQuery = () => useUIStore((state) => state.setPaletteSearchQuery);
export const useSetKeyboardNavigationMode = () => useUIStore((state) => state.setKeyboardNavigationMode);
export const useResetPaletteNavigation = () => useUIStore((state) => state.resetPaletteNavigation);
export const useCurrentContext = () => useUIStore((state) => state.currentContext);
export const useSetCurrentContext = () => useUIStore((state) => state.setCurrentContext);
export const useNavigateToRoot = () => useUIStore((state) => state.navigateToRoot);
export const useNavigateToSubFlow = () => useUIStore((state) => state.navigateToSubFlow);
export const useSetFlowViewMode = () => useUIStore((state) => state.setFlowViewMode);
export const useGetFlowViewMode = () => useUIStore((state) => state.getFlowViewMode);
export const getContextKey = (context: GraphContext): string => {
  return context.type === "root" ? "root" : `subflow-${context.geoNodeId}`;
};
