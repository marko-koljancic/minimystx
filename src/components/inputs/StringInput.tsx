import React, { useState, useRef, useEffect, useCallback } from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import { validateParameterValue } from "../../engine/parameterUtils";
import styles from "./InputStyles.module.css";

interface StringInputProps {
  value: string;
  metadata: ParameterMetadata;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const StringInput: React.FC<StringInputProps> = ({
  value,
  metadata,
  onChange,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [hasFocus, setHasFocus] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValidValue = useRef(value);

  useEffect(() => {
    if (!hasFocus) {
      setInputValue(value);
      lastValidValue.current = value;
      setHasError(false);
      setErrorMessage("");
    }
  }, [value, hasFocus]);

  const commitValue = useCallback(
    (textValue: string) => {
      const validation = validateParameterValue(textValue, metadata);

      if (validation.valid) {
        setHasError(false);
        setErrorMessage("");
        lastValidValue.current = textValue;
        onChange(textValue);
        setInputValue(textValue);
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
    if (e.key === "Enter") {
      e.preventDefault();
      commitValue(inputValue);
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setInputValue(lastValidValue.current);
      setHasError(false);
      setErrorMessage("");
      inputRef.current?.blur();
    }
  };

  const handleBlur = () => {
    setHasFocus(false);
    if (inputValue !== lastValidValue.current) {
      commitValue(inputValue);
    }
  };

  const handleFocus = () => {
    setHasFocus(true);
  };

  const isNameField = metadata.displayMode === "name";

  return (
    <div className={styles.inputContainer}>
      <input
        ref={inputRef}
        type="text"
        className={`${styles.inputField} ${isNameField ? styles.nameInput : styles.textInput} ${
          hasError ? styles.error : ""
        }`}
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder={metadata.default?.toString()}
      />

      {hasError && errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
    </div>
  );
};
