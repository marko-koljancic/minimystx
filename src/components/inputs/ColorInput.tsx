import React, { useState, useRef, useCallback } from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import { validateParameterValue } from "../../engine/parameterUtils";
import styles from "./InputStyles.module.css";
interface ColorInputProps {
  value: string;
  metadata: ParameterMetadata;
  onChange: (value: string) => void;
  disabled?: boolean;
}
export const ColorInput: React.FC<ColorInputProps> = ({ value, metadata, onChange, disabled = false }) => {
  const [textValue, setTextValue] = useState(value);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const commitValue = useCallback(
    (newValue: string) => {
      const validation = validateParameterValue(newValue, metadata);
      if (validation.valid) {
        onChange(newValue);
        setTextValue(newValue);
        setHasError(false);
        setErrorMessage("");
      } else {
        setHasError(true);
        setErrorMessage(validation.error || "Invalid color");
      }
    },
    [metadata, onChange]
  );
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTextValue(newValue);
  };
  const handleTextBlur = () => {
    if (textValue !== value) {
      commitValue(textValue);
    }
  };
  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitValue(textValue);
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setTextValue(value);
      setHasError(false);
      setErrorMessage("");
      e.currentTarget.blur();
    }
  };
  const handleSwatchClick = () => {
    if (!disabled && colorPickerRef.current) {
      colorPickerRef.current.click();
    }
  };
  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    commitValue(newValue);
  };
  const getSwatchColor = () => {
    try {
      if (/^#[0-9A-F]{6}$/i.test(value)) {
        return value;
      }
      if (/^#[0-9A-F]{3}$/i.test(value)) {
        return "#" + value[1] + value[1] + value[2] + value[2] + value[3] + value[3];
      }
      return value;
    } catch {
      return "#ffffff";
    }
  };
  return (
    <div className={styles.inputContainer}>
      <div className={styles.colorContainer}>
        <div
          className={styles.colorSwatch}
          style={{ backgroundColor: getSwatchColor() }}
          onClick={handleSwatchClick}
          title="Click to open color picker"
        />
        <input
          type="text"
          className={`${styles.inputField} ${styles.colorInput} ${hasError ? styles.error : ""}`}
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          disabled={disabled}
          placeholder="#ffffff"
        />
        <input
          ref={colorPickerRef}
          type="color"
          className={styles.colorPicker}
          value={getSwatchColor()}
          onChange={handleColorPickerChange}
          disabled={disabled}
        />
      </div>
      {hasError && errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
    </div>
  );
};
