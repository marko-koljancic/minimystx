import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LayoutState {
  leftPaneWidth: number;
  collapsed: boolean;
  bottomPaneHeight: number;
  isPaletteOpen: boolean;
  isPalettePinned: boolean;
  palettePosition: { x: number; y: number };
  isRendererMaximized: boolean;
}

interface LayoutActions {
  updateLayout: (layout: { leftPaneWidth?: number }) => void;
  toggleDrawer: () => void;
  setBottomPaneHeight: (height: number) => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setPalettePinned: (pinned: boolean) => void;
  togglePalettePinned: () => void;
  setPalettePosition: (position: { x: number; y: number }) => void;
  setRendererMaximized: (maximized: boolean) => void;
  toggleRendererMaximized: () => void;
  resetToDefaults: () => void;
}

type LayoutStore = LayoutState & LayoutActions;

const isValidPosition = (position: unknown): position is { x: number; y: number } => {
  return (
    typeof position === "object" &&
    position !== null &&
    "x" in position &&
    "y" in position &&
    typeof (position as { x: unknown; y: unknown }).x === "number" &&
    typeof (position as { x: unknown; y: unknown }).y === "number"
  );
};

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set) => ({
      leftPaneWidth: 50,
      collapsed: false,
      bottomPaneHeight: 260,
      isPaletteOpen: false,
      isPalettePinned: false,
      palettePosition: { x: 100, y: 100 },
      isRendererMaximized: false,

      updateLayout: (layout) => {
        set((state) => ({
          leftPaneWidth: layout.leftPaneWidth ?? state.leftPaneWidth,
        }));
      },

      toggleDrawer: () => {
        set((state) => ({ collapsed: !state.collapsed }));
      },

      setBottomPaneHeight: (height: number) => {
        if (typeof height !== "number" || height < 0) {
          throw new Error(`Invalid bottom pane height: ${height}`);
        }
        set({ bottomPaneHeight: height });
      },

      openPalette: () => {
        set({ isPaletteOpen: true });
      },

      closePalette: () => {
        set({ isPaletteOpen: false });
      },

      togglePalette: () => {
        set((state) => ({ isPaletteOpen: !state.isPaletteOpen }));
      },

      setPalettePinned: (pinned: boolean) => {
        set({ isPalettePinned: pinned });
      },

      togglePalettePinned: () => {
        set((state) => ({ isPalettePinned: !state.isPalettePinned }));
      },

      setPalettePosition: (position: { x: number; y: number }) => {
        if (!isValidPosition(position)) {
          throw new Error(`Invalid palette position: ${JSON.stringify(position)}`);
        }
        set({ palettePosition: position });
      },

      setRendererMaximized: (maximized: boolean) => {
        set({ isRendererMaximized: maximized });
      },

      toggleRendererMaximized: () => {
        set((state) => ({ isRendererMaximized: !state.isRendererMaximized }));
      },

      resetToDefaults: () => {
        set({
          leftPaneWidth: 50,
          collapsed: false,
          bottomPaneHeight: 260,
          isPaletteOpen: false,
          isPalettePinned: false,
          palettePosition: { x: 100, y: 100 },
          isRendererMaximized: false,
        });
      },
    }),
    {
      name: "minimystx-layout-store",
    }
  )
);

export const useDrawerCollapsed = () => useLayoutStore((state) => state.collapsed);
export const useDrawerHeight = () => useLayoutStore((state) => state.bottomPaneHeight);
export const useToggleDrawer = () => useLayoutStore((state) => state.toggleDrawer);
export const useSetDrawerHeight = () => useLayoutStore((state) => state.setBottomPaneHeight);
export const usePaletteOpen = () => useLayoutStore((state) => state.isPaletteOpen);
export const usePalettePinned = () => useLayoutStore((state) => state.isPalettePinned);
export const usePalettePosition = () => useLayoutStore((state) => state.palettePosition);
export const useTogglePalette = () => useLayoutStore((state) => state.togglePalette);
export const useOpenPalette = () => useLayoutStore((state) => state.openPalette);
export const useClosePalette = () => useLayoutStore((state) => state.closePalette);
export const useTogglePalettePinned = () => useLayoutStore((state) => state.togglePalettePinned);
export const useSetPalettePosition = () => useLayoutStore((state) => state.setPalettePosition);
export const useIsRendererMaximized = () => useLayoutStore((state) => state.isRendererMaximized);
export const useToggleRendererMaximized = () =>
  useLayoutStore((state) => state.toggleRendererMaximized);
