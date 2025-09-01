import { useState, useRef, useEffect } from "react";
import { useUIStore } from "../store";
import styles from "./ViewportControls.module.css";
interface DropdownItem {
  label: string;
  onClick: () => void;
  isActive?: boolean;
}
interface DropdownProps {
  items: DropdownItem[];
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}
function Dropdown({ items, isOpen, onClose, triggerRef }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, triggerRef]);
  if (!isOpen) return null;
  return (
    <div ref={dropdownRef} className={styles.dropdown}>
      {items.map((item, index) => (
        <button
          key={index}
          className={`${styles.dropdownItem} ${item.isActive ? styles.active : ""}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export default function ViewportControls() {
  const {
    wireframe,
    xRay,
    isOrthographicCamera,
    showAxisGizmo,
    showGridInRenderView,
    currentCameraView,
    toggleGridInRenderView,
    toggleWireframe,
    toggleXRay,
    setOrthographicCamera,
    setCameraView,
    toggleAxisGizmo,
  } = useUIStore();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const perspectiveRef = useRef<HTMLButtonElement>(null);
  const viewsRef = useRef<HTMLButtonElement>(null);
  const shadingRef = useRef<HTMLButtonElement>(null);
  const displayRef = useRef<HTMLButtonElement>(null);
  const handleDropdownToggle = (dropdown: string) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };
  const handleDropdownClose = () => {
    setOpenDropdown(null);
  };
  const perspectiveLabel = isOrthographicCamera ? "Orthographic" : "Perspective";
  const getViewLabel = () => {
    if (!isOrthographicCamera) return "3D";
    return currentCameraView.charAt(0).toUpperCase() + currentCameraView.slice(1);
  };
  const getShadingLabel = () => {
    if (wireframe) return "Wireframe";
    if (xRay) return "X-Ray";
    return "Shaded";
  };
  const viewsItems: DropdownItem[] = [
    {
      label: "3D",
      onClick: () => {
        setOrthographicCamera(false);
      },
      isActive: currentCameraView === "3d",
    },
    {
      label: "Top",
      onClick: () => {
        setCameraView("top");
        setOrthographicCamera(true);
      },
      isActive: currentCameraView === "top",
    },
    {
      label: "Front",
      onClick: () => {
        setCameraView("front");
        setOrthographicCamera(true);
      },
      isActive: currentCameraView === "front",
    },
    {
      label: "Left",
      onClick: () => {
        setCameraView("left");
        setOrthographicCamera(true);
      },
      isActive: currentCameraView === "left",
    },
    {
      label: "Right",
      onClick: () => {
        setCameraView("right");
        setOrthographicCamera(true);
      },
      isActive: currentCameraView === "right",
    },
    {
      label: "Bottom",
      onClick: () => {
        setCameraView("bottom");
        setOrthographicCamera(true);
      },
      isActive: currentCameraView === "bottom",
    },
  ];
  const shadingItems: DropdownItem[] = [
    {
      label: "Wireframe",
      onClick: toggleWireframe,
      isActive: wireframe,
    },
    {
      label: "Shaded",
      onClick: () => {
        if (wireframe) toggleWireframe();
        if (xRay) toggleXRay();
      },
      isActive: !wireframe && !xRay,
    },
    {
      label: "X-Ray",
      onClick: toggleXRay,
      isActive: xRay,
    },
  ];
  const displayItems: DropdownItem[] = [
    {
      label: "Display Grid",
      onClick: toggleGridInRenderView,
      isActive: showGridInRenderView,
    },
    {
      label: "Display Axis",
      onClick: toggleAxisGizmo,
      isActive: showAxisGizmo,
    },
  ];
  return (
    <div className={styles.viewportControls}>
      <div className={styles.controlButtonContainer}>
        <button
          ref={perspectiveRef}
          className={styles.controlButton}
          onClick={() => setOrthographicCamera(!isOrthographicCamera)}
        >
          {perspectiveLabel}
        </button>
      </div>
      <div className={styles.controlButtonContainer}>
        <button
          ref={viewsRef}
          className={styles.controlButton}
          onClick={() => handleDropdownToggle("views")}
        >
          {getViewLabel()}
        </button>
        <Dropdown
          items={viewsItems}
          isOpen={openDropdown === "views"}
          onClose={handleDropdownClose}
          triggerRef={viewsRef}
        />
      </div>
      <div className={styles.controlButtonContainer}>
        <button
          ref={shadingRef}
          className={styles.controlButton}
          onClick={() => handleDropdownToggle("shading")}
        >
          {getShadingLabel()}
        </button>
        <Dropdown
          items={shadingItems}
          isOpen={openDropdown === "shading"}
          onClose={handleDropdownClose}
          triggerRef={shadingRef}
        />
      </div>
      <div className={styles.controlButtonContainer}>
        <button
          ref={displayRef}
          className={styles.controlButton}
          onClick={() => handleDropdownToggle("display")}
        >
          Display
        </button>
        <Dropdown
          items={displayItems}
          isOpen={openDropdown === "display"}
          onClose={handleDropdownClose}
          triggerRef={displayRef}
        />
      </div>
    </div>
  );
}