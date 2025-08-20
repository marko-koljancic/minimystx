import React, { useState, useRef, useEffect, useCallback } from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import { validateParameterValue } from "../../engine/parameterUtils";
import { useMiddleMousePrecisionDrag } from "../../hooks/useMiddleMousePrecisionDrag";
import { PrecisionOverlay } from "./PrecisionOverlay";
import styles from "./InputStyles.module.css";

interface FloatInputProps {
  value: number;
  metadata: ParameterMetadata;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const FloatInput: React.FC<FloatInputProps> = ({
  value,
  metadata,
  onChange,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(value.toString());
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasFocus, setHasFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValidValue = useRef(value);

  // Initialize precision drag functionality
  const precisionDrag = useMiddleMousePrecisionDrag(value, onChange, {
    min: metadata.min,
    max: metadata.max,
    sensitivity: 0.5,
  });

  // Update input value when prop changes (external update)
  useEffect(() => {
    if (!hasFocus && !precisionDrag.state.isDragging) {
      setInputValue(value.toString());
      lastValidValue.current = value;
      setHasError(false);
      setErrorMessage("");
    }
  }, [value, hasFocus, precisionDrag.state.isDragging]);

  const commitValue = useCallback(
    (textValue: string) => {
      const numValue = parseFloat(textValue);
      const validation = validateParameterValue(numValue, metadata);

      if (validation.valid) {
        setHasError(false);
        setErrorMessage("");
        lastValidValue.current = numValue;
        onChange(numValue);
        setInputValue(numValue.toString());
      } else {
        setHasError(true);
        setErrorMessage(validation.error || "Invalid value");
      }
    },
    [metadata, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Let precision drag handle escape during drag, block other keys
    if (precisionDrag.state.isDragging) {
      precisionDrag.bind.onKeyDown(e);
      if (e.key !== "Escape") {
        e.preventDefault(); // Block all keys except escape during drag
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      commitValue(inputValue);
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue(lastValidValue.current.toString());
      setHasError(false);
      setErrorMessage("");
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    setHasFocus(false);
    if (inputValue !== lastValidValue.current.toString()) {
      commitValue(inputValue);
    }
  };

  const handleFocus = () => {
    setHasFocus(true);
  };

  // Slider handling
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value);
    setInputValue(numValue.toString());
    // For sliders, we commit immediately
    const validation = validateParameterValue(numValue, metadata);
    if (validation.valid) {
      onChange(numValue);
      lastValidValue.current = numValue;
      setHasError(false);
      setErrorMessage("");
    }
  };

  const hasSlider = metadata.min !== undefined && metadata.max !== undefined;

  // Combine input classes with precision drag styling
  const getInputClasses = (baseClasses: string) => {
    const classes = [
      baseClasses,
      styles.numericDrag, // Always apply tabular numerals
      hasError ? styles.error : "",
      precisionDrag.state.isDragging ? styles.precisionDragActive : "",
    ]
      .filter(Boolean)
      .join(" ");
    return classes;
  };

  // Get display value - precision mode or normal input value
  const displayValue = precisionDrag.state.isDragging
    ? precisionDrag.getDisplayValue()
    : inputValue;

  return (
    <div className={styles.inputContainer}>
      {hasSlider ? (
        <div className={styles.numberSliderRow}>
          <input
            ref={inputRef}
            type="number"
            className={getInputClasses(`${styles.inputField} ${styles.numberInputSmall}`)}
            value={displayValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onMouseDown={precisionDrag.bind.onMouseDown}
            step={metadata.step}
            disabled={disabled}
            placeholder={metadata.default?.toString()}
            readOnly={precisionDrag.state.isDragging}
          />
          <input
            type="range"
            className={styles.slider}
            min={metadata.min}
            max={metadata.max}
            step={metadata.step || 0.1}
            value={lastValidValue.current}
            onChange={handleSliderChange}
            disabled={disabled}
          />
        </div>
      ) : (
        <input
          ref={inputRef}
          type="number"
          className={getInputClasses(`${styles.inputField} ${styles.numberInput}`)}
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onMouseDown={precisionDrag.bind.onMouseDown}
          step={metadata.step}
          disabled={disabled}
          placeholder={metadata.default?.toString()}
          readOnly={precisionDrag.state.isDragging}
        />
      )}

      {hasError && errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}

      <PrecisionOverlay
        isVisible={precisionDrag.state.showOverlay}
        precisionList={precisionDrag.precisionList}
        selectedIndex={precisionDrag.state.selectedPrecisionIndex}
        position={precisionDrag.state.overlayPosition}
      />
    </div>
  );
};
