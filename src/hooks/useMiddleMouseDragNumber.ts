import { useState, useRef, useCallback, useEffect } from "react";

export interface NumericDragConfig {
  min?: number;
  max?: number;
  step?: number;
  onCommit?: (value: number) => void;
  onCancel?: (originalValue: number) => void;
}

export interface NumericDragState {
  isDragging: boolean;
  originalValue: number;
  currentValue: number;
  selectedPrecision: number;
  selectorPosition: { x: number; y: number };
  showPrecisionSelector: boolean;
}

export function useMiddleMouseDragNumber(
  value: number,
  setValue: (v: number) => void,
  config?: NumericDragConfig
) {
  const { min, max, onCommit, onCancel } = config || {};

  const [state, setState] = useState<NumericDragState>({
    isDragging: false,
    originalValue: value,
    currentValue: value,
    selectedPrecision: 0.1,
    selectorPosition: { x: 0, y: 0 },
    showPrecisionSelector: false,
  });

  const startXRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const inputElementRef = useRef<HTMLElement | null>(null);

  // Clamp value to min/max constraints
  const clampValue = useCallback(
    (val: number) => {
      let clamped = val;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max]
  );

  // Handle mouse movement during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!state.isDragging) return;

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - startXRef.current;
        // Left decreases (negative deltaX), right increases (positive deltaX)
        const deltaValue = deltaX * state.selectedPrecision;
        const newValue = clampValue(state.originalValue + deltaValue);

        setState((prev) => ({ ...prev, currentValue: newValue }));
        setValue(newValue);
      });
    },
    [state.isDragging, state.originalValue, state.selectedPrecision, clampValue, setValue]
  );

  // Handle mouse up to commit changes
  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!state.isDragging || e.button !== 1) return;

      setState((prev) => ({
        ...prev,
        isDragging: false,
        showPrecisionSelector: false,
        originalValue: prev.currentValue,
      }));

      onCommit?.(state.currentValue);

      // Remove event listeners
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Remove body class
      document.body.classList.remove("numdrag-lock");
    },
    [state.isDragging, state.currentValue, onCommit, handleMouseMove]
  );

  // Handle escape key to cancel drag
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (state.isDragging && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();

        // Revert to original value
        setValue(state.originalValue);
        setState((prev) => ({
          ...prev,
          isDragging: false,
          showPrecisionSelector: false,
          currentValue: prev.originalValue,
        }));

        onCancel?.(state.originalValue);

        // Remove event listeners
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        // Remove body class
        document.body.classList.remove("numdrag-lock");
      }
    },
    [state.isDragging, state.originalValue, setValue, onCancel, handleMouseMove, handleMouseUp]
  );

  // Handle precision selection
  const handlePrecisionSelect = useCallback((precision: number) => {
    setState((prev) => ({ ...prev, selectedPrecision: precision }));
  }, []);

  // Handle mouse down to start drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 1) return; // Only middle mouse button

      e.preventDefault();
      e.stopPropagation();

      // Store reference to the input element
      inputElementRef.current = e.currentTarget as HTMLElement;

      // Calculate selector position (to the left of the input)
      const rect = inputElementRef.current.getBoundingClientRect();
      const selectorPosition = {
        x: rect.left - 80, // Position to the left
        y: rect.top,
      };

      startXRef.current = e.clientX;
      setState((prev) => ({
        ...prev,
        isDragging: true,
        showPrecisionSelector: true,
        originalValue: value,
        currentValue: value,
        selectorPosition,
      }));

      // Add global drag lock
      document.body.classList.add("numdrag-lock");

      // Add window event listeners for drag
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [value, handleMouseMove, handleMouseUp]
  );

  // Update original value when external value changes (but not during drag)
  useEffect(() => {
    if (!state.isDragging) {
      setState((prev) => ({
        ...prev,
        originalValue: value,
        currentValue: value,
      }));
    }
  }, [value, state.isDragging]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("numdrag-lock");
    };
  }, [handleMouseMove, handleMouseUp]);

  return {
    bind: {
      onMouseDown: handleMouseDown,
      onKeyDown: handleKeyDown,
    },
    isDragging: state.isDragging,
    currentValue: state.currentValue,
    showPrecisionSelector: state.showPrecisionSelector,
    selectedPrecision: state.selectedPrecision,
    selectorPosition: state.selectorPosition,
    onPrecisionSelect: handlePrecisionSelect,
  };
}
