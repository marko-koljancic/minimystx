import React, { useEffect, useRef, useCallback, forwardRef } from "react";
import styles from "./SearchInput.module.css";
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoFocus?: boolean;
}
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onKeyDown, placeholder = "Search nodes...", autoFocus = true }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const inputRef = ref || internalRef;
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.value);
      },
      [onChange]
    );
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        onKeyDown?.(event);
      },
      [onKeyDown]
    );
    useEffect(() => {
      if (autoFocus && inputRef && "current" in inputRef && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus, inputRef]);
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={styles.searchInput}
        autoComplete="off"
        spellCheck={false}
      />
    );
  }
);
