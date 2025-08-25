import React, { useState, useRef, useEffect, useCallback } from "react";
import { ParameterMetadata } from "../../engine/graphStore";
import { validateParameterValue } from "../../engine/parameterUtils";
import { useMiddleMousePrecisionDrag } from "../../hooks/useMiddleMousePrecisionDrag";
import { PrecisionOverlay } from "./PrecisionOverlay";
import styles from "./InputStyles.module.css";

interface VectorInputProps {
  value: { x: number; y: number; z?: number; w?: number };
  metadata: ParameterMetadata;
  onChange: (value: { x: number; y: number; z?: number; w?: number }) => void;
  disabled?: boolean;
}

export const VectorInput: React.FC<VectorInputProps> = ({
  value,
  metadata,
  onChange,
  disabled = false,
}) => {
  const components = React.useMemo(() => {
    switch (metadata.type) {
      case "vector2":
        return ["x", "y"];
      case "vector3":
        return ["x", "y", "z"];
      case "vector4":
        return ["x", "y", "z", "w"];
      default:
        return ["x", "y", "z"];
    }
  }, [metadata.type]);
  const [inputValues, setInputValues] = useState(() => {
    const initial: Record<string, string> = {};
    components.forEach((comp) => {
      initial[comp] = (value[comp as keyof typeof value] || 0).toString();
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedComponent, setFocusedComponent] = useState<string | null>(null);
  const lastValidValues = useRef({ ...value });
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const xPrecisionDrag = useMiddleMousePrecisionDrag(
    value.x || 0,
    (newValue) => {
      const updatedVector = { ...lastValidValues.current, x: newValue };
      lastValidValues.current = updatedVector;
      onChange(updatedVector);
    },
    {
      min: metadata.min,
      max: metadata.max,
      sensitivity: 0.5,
    }
  );

  const yPrecisionDrag = useMiddleMousePrecisionDrag(
    value.y || 0,
    (newValue) => {
      const updatedVector = { ...lastValidValues.current, y: newValue };
      lastValidValues.current = updatedVector;
      onChange(updatedVector);
    },
    {
      min: metadata.min,
      max: metadata.max,
      sensitivity: 0.5,
    }
  );

  const zPrecisionDrag = useMiddleMousePrecisionDrag(
    value.z || 0,
    (newValue) => {
      const updatedVector = { ...lastValidValues.current, z: newValue };
      lastValidValues.current = updatedVector;
      onChange(updatedVector);
    },
    {
      min: metadata.min,
      max: metadata.max,
      sensitivity: 0.5,
    }
  );

  const wPrecisionDrag = useMiddleMousePrecisionDrag(
    value.w || 0,
    (newValue) => {
      const updatedVector = { ...lastValidValues.current, w: newValue };
      lastValidValues.current = updatedVector;
      onChange(updatedVector);
    },
    {
      min: metadata.min,
      max: metadata.max,
      sensitivity: 0.5,
    }
  );

  const precisionDragHooks: Record<string, ReturnType<typeof useMiddleMousePrecisionDrag>> = {
    x: xPrecisionDrag,
    y: yPrecisionDrag,
    z: zPrecisionDrag,
    w: wPrecisionDrag,
  };

  const isAnyDragging = components.some((comp) => precisionDragHooks[comp]?.state.isDragging);

  useEffect(() => {
    if (!focusedComponent && !isAnyDragging) {
      const newInputValues: Record<string, string> = {};
      components.forEach((comp) => {
        newInputValues[comp] = (value[comp as keyof typeof value] || 0).toString();
      });
      setInputValues(newInputValues);
      lastValidValues.current = { ...value };
      setErrors({});
    }
  }, [value, focusedComponent, isAnyDragging, components]);

  const commitValue = useCallback(
    (component: string, textValue: string) => {
      const numValue = parseFloat(textValue);

      const tempVector = { ...lastValidValues.current };
      tempVector[component as keyof typeof tempVector] = numValue;

      const validation = validateParameterValue(tempVector, metadata);

      if (validation.valid) {
        lastValidValues.current[component as keyof typeof lastValidValues.current] = numValue;

        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[component];
          return newErrors;
        });

        setInputValues((prev) => ({
          ...prev,
          [component]: numValue.toString(),
        }));

        onChange(lastValidValues.current);
      } else {
        setErrors((prev) => ({
          ...prev,
          [component]: validation.error || "Invalid value",
        }));
      }
    },
    [metadata, onChange]
  );

  const handleInputChange = (component: string, value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [component]: value,
    }));
  };

  const handleKeyDown = (component: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (precisionDragHooks[component]?.state.isDragging) {
      precisionDragHooks[component].bind.onKeyDown(e);
      if (e.key !== "Escape") {
        e.preventDefault();
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      commitValue(component, inputValues[component]);
      inputRefs.current[component]?.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      const validValue =
        lastValidValues.current[component as keyof typeof lastValidValues.current] || 0;
      setInputValues((prev) => ({
        ...prev,
        [component]: validValue.toString(),
      }));
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[component];
        return newErrors;
      });
      inputRefs.current[component]?.blur();
    }
  };

  const handleBlur = (component: string) => {
    setFocusedComponent(null);
    if (
      inputValues[component] !==
      (lastValidValues.current[component as keyof typeof lastValidValues.current] || 0).toString()
    ) {
      commitValue(component, inputValues[component]);
    }
  };

  const handleFocus = (component: string) => {
    setFocusedComponent(component);
  };

  const getInputClasses = (component: string) => {
    const classes = [
      styles.inputField,
      styles.vectorInput,
      styles.numericDrag,
      errors[component] ? styles.error : "",
      precisionDragHooks[component]?.state.isDragging ? styles.precisionDragActive : "",
    ]
      .filter(Boolean)
      .join(" ");
    return classes;
  };

  const getDisplayValue = (component: string) => {
    const hook = precisionDragHooks[component];
    return hook?.state.isDragging ? hook.getDisplayValue() : inputValues[component];
  };

  const activeDragComponent = components.find((comp) => precisionDragHooks[comp]?.state.isDragging);
  const activePrecisionDrag = activeDragComponent ? precisionDragHooks[activeDragComponent] : null;

  return (
    <div className={styles.inputContainer}>
      <div className={styles.vectorContainer}>
        {components.map((component) => (
          <div key={component} className={styles.vectorComponent}>
            <span className={styles.vectorLabel}>{component.toUpperCase()}</span>
            <input
              ref={(ref) => {
                inputRefs.current[component] = ref;
              }}
              type="number"
              className={getInputClasses(component)}
              value={getDisplayValue(component)}
              onChange={(e) => handleInputChange(component, e.target.value)}
              onKeyDown={(e) => handleKeyDown(component, e)}
              onBlur={() => handleBlur(component)}
              onFocus={() => handleFocus(component)}
              onMouseDown={precisionDragHooks[component]?.bind.onMouseDown}
              step={metadata.step}
              disabled={disabled}
              placeholder="0"
              readOnly={precisionDragHooks[component]?.state.isDragging}
            />
          </div>
        ))}
      </div>

      {Object.entries(errors).map(([component, error]) => (
        <div key={component} className={styles.errorMessage}>
          {component.toUpperCase()}: {error}
        </div>
      ))}

      {activePrecisionDrag && (
        <PrecisionOverlay
          isVisible={activePrecisionDrag.state.showOverlay}
          precisionList={activePrecisionDrag.precisionList}
          selectedIndex={activePrecisionDrag.state.selectedPrecisionIndex}
          position={activePrecisionDrag.state.overlayPosition}
        />
      )}
    </div>
  );
};
