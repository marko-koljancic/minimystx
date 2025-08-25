import { useState, useEffect, useRef } from "react";
import styles from "./PromptModal.module.css";

interface PromptModalProps {
  title: string;
  placeholder: string;
  defaultValue?: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({
  title,
  placeholder,
  defaultValue = "",
  onSave,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSave(trimmedValue);
    } else {
      onCancel();
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [value, onCancel, handleSave]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onCancel();
    }
  };

  return (
    <div className={styles.backdrop} ref={modalRef} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <h3 className={styles.title}>{title}</h3>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
        />
        <div className={styles.buttons}>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave} disabled={!value.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
