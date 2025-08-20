import React from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import {
  FloatInput,
  VectorInput,
  BooleanInput,
  EnumInput,
  ColorInput,
  StringInput,
  FileInput,
} from "./index";

interface ParameterInputProps {
  value: any;
  metadata: ParameterMetadata;
  onChange: (value: any) => void;
  disabled?: boolean;
}

export const ParameterInput: React.FC<ParameterInputProps> = ({
  value,
  metadata,
  onChange,
  disabled = false,
}) => {
  // Check for special display modes based on metadata
  if (metadata.displayMode === "description") {
    return (
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: "1.1rem",
          lineHeight: "1.4",
          fontStyle: "normal",
          textAlign: "left",
          margin: 0,
          padding: 0,
        }}
      >
        {value as string}
      </div>
    );
  }

  switch (metadata.type) {
    case "number":
      return (
        <FloatInput
          value={value as number}
          metadata={metadata}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "vector2":
    case "vector3":
    case "vector4":
      return (
        <VectorInput
          value={value as { x: number; y: number; z?: number; w?: number }}
          metadata={metadata}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "boolean":
      return (
        <BooleanInput
          value={value as boolean}
          metadata={metadata}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "enum":
      return (
        <EnumInput
          value={value as string}
          metadata={metadata}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "color":
      return (
        <ColorInput
          value={value as string}
          metadata={metadata}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "string":
      // Handle name field differently - full width
      if (metadata.displayMode === "name") {
        return (
          <StringInput
            value={value as string}
            metadata={metadata}
            onChange={onChange}
            disabled={disabled}
          />
        );
      }
      return (
        <StringInput
          value={value as string}
          metadata={metadata}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "file":
      return (
        <FileInput
          value={value as File | null}
          metadata={metadata}
          onChange={onChange}
          disabled={disabled}
        />
      );

    default:
      return (
        <div style={{ color: "var(--text-quaternary)", fontStyle: "italic" }}>
          Unsupported parameter type: {metadata.type}
        </div>
      );
  }
};
