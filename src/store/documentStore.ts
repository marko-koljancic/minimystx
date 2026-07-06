import { create } from "zustand";

// Document-scoped view data that round-trips with the scene file: node canvas
// positions and viewport pan/zoom per context ("root" or "subflow-<geoNodeId>").
// This is document data, not UI preference, so it lives outside uiStore and is
// NOT persisted to localStorage; it is saved into and restored from .mxscene.

type Viewport = { x: number; y: number; zoom: number };
type Positions = Record<string, { x: number; y: number }>;

interface DocumentState {
  viewportStates: Record<string, Viewport>;
  nodePositions: Record<string, Positions>;
}

interface DocumentActions {
  saveViewportState: (contextKey: string, viewport: Viewport) => void;
  getViewportState: (contextKey: string) => Viewport | null;
  saveNodePositions: (contextKey: string, positions: Positions) => void;
  getNodePositions: (contextKey: string) => Positions | null;
  clearDocument: () => void;
}

export const useDocumentStore = create<DocumentState & DocumentActions>()((set, get) => ({
  viewportStates: {},
  nodePositions: {},
  saveViewportState: (contextKey, viewport) =>
    set((state) => ({
      viewportStates: { ...state.viewportStates, [contextKey]: viewport },
    })),
  getViewportState: (contextKey) => get().viewportStates[contextKey] || null,
  saveNodePositions: (contextKey, positions) =>
    set((state) => ({
      nodePositions: { ...state.nodePositions, [contextKey]: positions },
    })),
  getNodePositions: (contextKey) => get().nodePositions[contextKey] || null,
  clearDocument: () => set({ viewportStates: {}, nodePositions: {} }),
}));

export const useSaveViewportState = () => useDocumentStore((state) => state.saveViewportState);
export const useGetViewportState = () => useDocumentStore((state) => state.getViewportState);
export const useSaveNodePositions = () => useDocumentStore((state) => state.saveNodePositions);
export const useGetNodePositions = () => useDocumentStore((state) => state.getNodePositions);
