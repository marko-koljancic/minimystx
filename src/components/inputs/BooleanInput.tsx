import React from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import styles from "./InputStyles.module.css";
interface BooleanInputProps {
  value: boolean;
  metadata: ParameterMetadata;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}
export const BooleanInput: React.FC<BooleanInputProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };
  return (
    <div className={styles.inputContainer}>
      <input
        type="checkbox"
        className={styles.checkboxInput}
        checked={value}
        onChange={handleChange}
        disabled={disabled}
      />
    </div>
  );
};
