import React, { useRef } from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import styles from "./InputStyles.module.css";
interface FileInputProps {
  value: File | null;
  metadata: ParameterMetadata;
  onChange: (value: File | null) => void;
  disabled?: boolean;
}
export const FileInput: React.FC<FileInputProps> = ({
  value,
  metadata,
  onChange,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onChange(file);
  };
  const handleButtonClick = () => {
    if (fileInputRef.current && !disabled) {
      fileInputRef.current.click();
    }
  };
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  return (
    <div className={styles.inputContainer}>
      <input
        ref={fileInputRef}
        type="file"
        accept={metadata.accept || ".obj"}
        onChange={handleFileChange}
        disabled={disabled}
        style={{ display: "none" }}
      />
      <div className={styles.fileInputWrapper}>
        <button
          type="button"
          className={`${styles.fileSelectButton} ${disabled ? styles.disabled : ""}`}
          onClick={handleButtonClick}
          disabled={disabled}
        >
          {value ? "Change File" : "Select File"}
        </button>
        {value && (
          <>
            <span className={styles.fileName} title={value.name}>
              {value.name}
            </span>
            <button
              type="button"
              className={styles.fileClearButton}
              onClick={handleClear}
              disabled={disabled}
              title="Clear file"
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
};
