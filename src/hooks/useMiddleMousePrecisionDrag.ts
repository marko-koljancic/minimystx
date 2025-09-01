import { useState, useRef, useCallback, useEffect } from "react";
export interface PrecisionDragConfig {
  min?: number;
  max?: number;
  sensitivity?: number;
  precisionList?: number[];
  onCommit?: (value: number) => void;
  onCancel?: (originalValue: number) => void;
}
export interface PrecisionDragState {
  isDragging: boolean;
  originalValue: number;
  currentValue: number;
  selectedPrecision: number;
  selectedPrecisionIndex: number;
  overlayPosition: { x: number; y: number };
  showOverlay: boolean;
}
const DEFAULT_PRECISION_LIST = [1, 0.1, 0.01, 0.001, 0.0001, 0.00001];
const ROW_HEIGHT = 28;
const DEADZONE = 6;
const HYSTERESIS = 12;
export function useMiddleMousePrecisionDrag(
  value: number,
  setValue: (v: number) => void,
  config?: PrecisionDragConfig
) {
  const {
    min,
    max,
    sensitivity = 0.5,
    precisionList = DEFAULT_PRECISION_LIST,
    onCommit,
    onCancel,
  } = config || {};
  const [state, setState] = useState<PrecisionDragState>({
    isDragging: false,
    originalValue: value,
    currentValue: value,
    selectedPrecision: 0.01,
    selectedPrecisionIndex: 2,
    overlayPosition: { x: 0, y: 0 },
    showOverlay: false,
  });
  const startPositionRef = useRef({ x: 0, y: 0 });
  const lastPrecisionChangeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const inputElementRef = useRef<HTMLElement | null>(null);
  const clampValue = useCallback(
    (val: number) => {
      let clamped = val;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max]
  );
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      setState((prevState) => {
        if (!prevState.isDragging) return prevState;
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }
        rafIdRef.current = requestAnimationFrame(() => {
          const mouseX = e.clientX;
          const mouseY = e.clientY;
          const deltaY = mouseY - startPositionRef.current.y;
          let newPrecisionIndex = prevState.selectedPrecisionIndex;
          if (Math.abs(deltaY) >= DEADZONE) {
            const rawRowIndex = Math.floor(deltaY / ROW_HEIGHT);
            const candidateIndex = Math.max(0, Math.min(precisionList.length - 1, rawRowIndex + 2));
            const lastChangeY = lastPrecisionChangeRef.current;
            const distanceFromLastChange = Math.abs(mouseY - lastChangeY);
            if (
              candidateIndex !== prevState.selectedPrecisionIndex &&
              distanceFromLastChange >= HYSTERESIS
            ) {
              lastPrecisionChangeRef.current = mouseY;
              newPrecisionIndex = candidateIndex;
            }
          }
          const newPrecision = precisionList[newPrecisionIndex];
          const deltaX = mouseX - startPositionRef.current.x;
          const deltaValue = deltaX * newPrecision * sensitivity;
          const newValue = clampValue(prevState.originalValue + deltaValue);
          setState((prev) => ({
            ...prev,
            currentValue: newValue,
            selectedPrecision: newPrecision,
            selectedPrecisionIndex: newPrecisionIndex,
          }));
          setValue(newValue);
        });
        return prevState;
      });
    },
    [precisionList, sensitivity, clampValue, setValue]
  );
  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 1 && !state.isDragging) return;
      setState((prevState) => {
        if (!prevState.isDragging) return prevState;
        onCommit?.(prevState.currentValue);
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        document.body.classList.remove("precision-drag-active");
        return {
          ...prevState,
          isDragging: false,
          showOverlay: false,
          originalValue: prevState.currentValue,
        };
      });
    },
    [onCommit, state.isDragging]
  );
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      setState((prevState) => {
        if (prevState.isDragging && e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setValue(prevState.originalValue);
          onCancel?.(prevState.originalValue);
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          document.body.classList.remove("precision-drag-active");
          return {
            ...prevState,
            isDragging: false,
            showOverlay: false,
            currentValue: prevState.originalValue,
          };
        }
        return prevState;
      });
    },
    [setValue, onCancel]
  );
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      inputElementRef.current = e.currentTarget as HTMLElement;
      const rect = inputElementRef.current.getBoundingClientRect();
      const overlayPosition = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      startPositionRef.current = { x: e.clientX, y: e.clientY };
      lastPrecisionChangeRef.current = e.clientY;
      const currentDisplayPrecision = 0.01;
      const closestIndex = precisionList.findIndex(
        (p, i) =>
          i === precisionList.length - 1 ||
          Math.abs(p - currentDisplayPrecision) <=
            Math.abs(precisionList[i + 1] - currentDisplayPrecision)
      );
      setState({
        isDragging: true,
        showOverlay: true,
        originalValue: value,
        currentValue: value,
        selectedPrecision: precisionList[closestIndex],
        selectedPrecisionIndex: closestIndex,
        overlayPosition,
      });
      document.body.classList.add("precision-drag-active");
    },
    [value, precisionList]
  );
  useEffect(() => {
    if (!state.isDragging) {
      setState((prev) => ({
        ...prev,
        originalValue: value,
        currentValue: value,
      }));
    }
  }, [value, state.isDragging]);
  const handleWindowBlur = useCallback(() => {
    setState((prevState) => {
      if (!prevState.isDragging) return prevState;
      setValue(prevState.originalValue);
      onCancel?.(prevState.originalValue);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.body.classList.remove("precision-drag-active");
      return {
        ...prevState,
        isDragging: false,
        showOverlay: false,
        currentValue: prevState.originalValue,
      };
    });
  }, [setValue, onCancel]);
  const handleMouseLeave = useCallback(
    (e: MouseEvent) => {
      if (
        e.clientY < 0 ||
        e.clientX < 0 ||
        e.clientX > window.innerWidth ||
        e.clientY > window.innerHeight
      ) {
        setState((prevState) => {
          if (!prevState.isDragging) return prevState;
          onCommit?.(prevState.currentValue);
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
          document.body.classList.remove("precision-drag-active");
          return {
            ...prevState,
            isDragging: false,
            showOverlay: false,
            originalValue: prevState.currentValue,
          };
        });
      }
    },
    [onCommit]
  );
  useEffect(() => {
    if (state.isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("mouseleave", handleMouseLeave);
      window.addEventListener("blur", handleWindowBlur);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("mouseleave", handleMouseLeave);
        window.removeEventListener("blur", handleWindowBlur);
      };
    }
  }, [state.isDragging, handleMouseMove, handleMouseUp, handleMouseLeave, handleWindowBlur]);
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("blur", handleWindowBlur);
      document.body.classList.remove("precision-drag-active");
    };
  }, [handleMouseMove, handleMouseUp, handleMouseLeave, handleWindowBlur]);
  return {
    bind: {
      onMouseDown: handleMouseDown,
      onKeyDown: handleKeyDown,
    },
    state,
    precisionList,
    getDisplayValue: () => {
      if (state.isDragging) {
        return state.currentValue.toFixed(6);
      }
      return value.toString();
    },
  };
}
