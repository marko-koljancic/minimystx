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
    displayMode,
    isOrthographicCamera,
    showAxisGizmo,
    showGridInRenderView,
    currentCameraView,
    toggleGridInRenderView,
    setDisplayMode,
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
    switch (displayMode) {
      case "shaded": return "Shaded";
      case "wireframe": return "Wireframe";
      case "xray": return "X-Ray";
      case "shadedWireframe": return "Shaded + Topo";
      case "xrayWireframe": return "X-Ray + Topo";
      case "normals": return "Normals";
      case "normalsWireframe": return "Normals + Topo";
      case "depth": return "Depth";
      case "depthWireframe": return "Depth + Topo";
      default: return "Shaded";
    }
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
      label: "Shaded",
      onClick: () => setDisplayMode("shaded"),
      isActive: displayMode === "shaded",
    },
    {
      label: "Shaded + Topo",
      onClick: () => setDisplayMode("shadedWireframe"),
      isActive: displayMode === "shadedWireframe",
    },
    {
      label: "Wireframe",
      onClick: () => setDisplayMode("wireframe"),
      isActive: displayMode === "wireframe",
    },
    {
      label: "X-Ray",
      onClick: () => setDisplayMode("xray"),
      isActive: displayMode === "xray",
    },
    {
      label: "X-Ray + Topo",
      onClick: () => setDisplayMode("xrayWireframe"),
      isActive: displayMode === "xrayWireframe",
    },
    {
      label: "Normals",
      onClick: () => setDisplayMode("normals"),
      isActive: displayMode === "normals",
    },
    {
      label: "Normals + Topo",
      onClick: () => setDisplayMode("normalsWireframe"),
      isActive: displayMode === "normalsWireframe",
    },
    {
      label: "Depth",
      onClick: () => setDisplayMode("depth"),
      isActive: displayMode === "depth",
    },
    {
      label: "Depth + Topo",
      onClick: () => setDisplayMode("depthWireframe"),
      isActive: displayMode === "depthWireframe",
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
