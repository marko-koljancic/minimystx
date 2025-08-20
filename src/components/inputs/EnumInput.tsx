import React, { useState } from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import { validateParameterValue } from "../../engine/parameterUtils";
import styles from "./InputStyles.module.css";

interface EnumInputProps {
  value: string;
  metadata: ParameterMetadata;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const EnumInput: React.FC<EnumInputProps> = ({
  value,
  metadata,
  onChange,
  disabled = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    const validation = validateParameterValue(newValue, metadata);

    if (validation.valid) {
      onChange(newValue);
      setHasError(false);
      setErrorMessage("");
    } else {
      setHasError(true);
      setErrorMessage(validation.error || "Invalid selection");
    }
  };

  const options = metadata.enumValues || [];

  return (
    <div className={styles.inputContainer}>
      <select
        className={`${styles.selectInput} ${hasError ? styles.error : ""}`}
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      {hasError && errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
    </div>
  );
};
