import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  usePaletteOpen,
  usePalettePinned,
  useClosePalette,
  usePalettePosition,
  useSelectedCategoryIndex,
  useSelectedNodeIndex,
  usePaletteSearchQuery,
  useKeyboardNavigationMode,
  useSetSelectedCategoryIndex,
  useSetSelectedNodeIndex,
  useSetPaletteSearchQuery,
  useSetKeyboardNavigationMode,
  useResetPaletteNavigation,
  useCurrentContext,
} from "../../store";
import {
  getNodesByCategoryForContext,
  getAvailableCategoriesForContext,
  getFilteredNodesByCategoryForContext,
  searchNodesForContext,
} from "../../flow/nodes/nodeRegistry";
import { SearchInput } from "../../components/inputs";
import NodePaletteItem from "./NodePaletteItem";
import styles from "./NodePalette.module.css";
export default function NodePalette() {
  const isOpen = usePaletteOpen();
  const isPinned = usePalettePinned();
  const closePalette = useClosePalette();
  const palettePosition = usePalettePosition();
  const selectedCategoryIndex = useSelectedCategoryIndex();
  const selectedNodeIndex = useSelectedNodeIndex();
  const searchQuery = usePaletteSearchQuery();
  const keyboardMode = useKeyboardNavigationMode();
  const setSelectedCategoryIndex = useSetSelectedCategoryIndex();
  const setSelectedNodeIndex = useSetSelectedNodeIndex();
  const setSearchQuery = useSetPaletteSearchQuery();
  const setKeyboardMode = useSetKeyboardNavigationMode();
  const resetNavigation = useResetPaletteNavigation();
  const currentContext = useCurrentContext();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [isHoveringNodes, setIsHoveringNodes] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const allCategories = useMemo(
    () => getAvailableCategoriesForContext(currentContext.type),
    [currentContext.type]
  );
  const { categories, nodesByCategory, searchResults } = useMemo(() => {
    if (searchQuery.trim()) {
      const results = searchNodesForContext(searchQuery, currentContext.type, 100);
      const filteredByCategory = getFilteredNodesByCategoryForContext(
        searchQuery,
        currentContext.type
      );
      return {
        categories: Object.keys(filteredByCategory).sort(),
        nodesByCategory: filteredByCategory,
        searchResults: results,
      };
    }
    return {
      categories: allCategories,
      nodesByCategory: getNodesByCategoryForContext(currentContext.type),
      searchResults: [],
    };
  }, [searchQuery, allCategories, currentContext.type]);
  const activeCategory = keyboardMode ? categories[selectedCategoryIndex] || null : hoveredCategory;
  const currentNodes = useMemo(() => {
    return searchQuery.trim()
      ? searchResults
      : activeCategory
      ? nodesByCategory[activeCategory] || []
      : [];
  }, [searchQuery, searchResults, activeCategory, nodesByCategory]);
  const handleNodeDrop = useCallback(() => {
    if (!isPinned) {
      closePalette();
      resetNavigation();
    }
  }, [isPinned, closePalette, resetNavigation]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          closePalette();
          resetNavigation();
          break;
        case "ArrowUp":
          e.preventDefault();
          setKeyboardMode(true);
          if (searchQuery.trim() || !categories.length) {
            setSelectedNodeIndex(Math.max(0, selectedNodeIndex - 1));
          } else {
            setSelectedCategoryIndex(Math.max(0, selectedCategoryIndex - 1));
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          setKeyboardMode(true);
          if (searchQuery.trim() || !categories.length) {
            setSelectedNodeIndex(Math.min(currentNodes.length - 1, selectedNodeIndex + 1));
          } else {
            setSelectedCategoryIndex(Math.min(categories.length - 1, selectedCategoryIndex + 1));
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (!searchQuery.trim() && categories.length > 0) {
            setKeyboardMode(true);
            setSelectedNodeIndex(0);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (!searchQuery.trim() && categories.length > 0) {
            setKeyboardMode(true);
            setSelectedNodeIndex(0);
          }
          break;
        case "Enter":
          e.preventDefault();
          if (currentNodes.length > 0) {
            const selectedNode = currentNodes[selectedNodeIndex];
            if (selectedNode) {
              const event = new CustomEvent("minimystx:createNode", {
                detail: {
                  nodeType: selectedNode.type,
                  position: palettePosition,
                },
              });
              window.dispatchEvent(event);
              handleNodeDrop();
            }
          }
          break;
      }
    },
    [
      isOpen,
      searchQuery,
      categories,
      currentNodes,
      selectedCategoryIndex,
      selectedNodeIndex,
      closePalette,
      resetNavigation,
      setKeyboardMode,
      setSelectedCategoryIndex,
      setSelectedNodeIndex,
      palettePosition,
      handleNodeDrop,
    ]
  );
  useEffect(() => {
    resetNavigation();
  }, [currentContext, resetNavigation]);
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setSelectedCategoryIndex(0);
      setSelectedNodeIndex(0);
      setKeyboardMode(true);
    },
    [setSearchQuery, setSelectedCategoryIndex, setSelectedNodeIndex, setKeyboardMode]
  );
  useEffect(() => {
    if (isOpen) {
      resetNavigation();
    }
  }, [isOpen, resetNavigation]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  if (!isOpen) return null;
  return (
    <div
      ref={paletteRef}
      className={styles.palette}
      style={{
        left: palettePosition.x,
        top: palettePosition.y,
      }}
      role="dialog"
      aria-label="Node Palette"
      aria-describedby="palette-description"
    >
      <div id="palette-description" className={styles.srOnly}>
        Type to search, use arrow keys to navigate, Enter to create node, Escape to close
      </div>
      <SearchInput
        ref={searchInputRef}
        value={searchQuery}
        onChange={handleSearchChange}
        onKeyDown={handleKeyDown}
        placeholder="Search nodes..."
        autoFocus={true}
      />
      <div aria-live="polite" aria-atomic="true" className={styles.srOnly}>
        {searchQuery.trim() && `${currentNodes.length} nodes found`}
      </div>
      <div className={styles.paletteBody}>
        {!searchQuery.trim() && categories.length > 0 && (
          <div className={styles.categoriesColumn} role="listbox" aria-label="Node categories">
            {categories.map((category, index) => (
              <div
                key={category}
                className={`${styles.categoryItem} ${
                  (keyboardMode && selectedCategoryIndex === index) ||
                  (!keyboardMode && hoveredCategory === category)
                    ? styles.active
                    : ""
                }`}
                role="option"
                aria-selected={
                  (keyboardMode && selectedCategoryIndex === index) ||
                  (!keyboardMode && hoveredCategory === category)
                }
                tabIndex={-1}
                onMouseEnter={() => {
                  if (!keyboardMode) {
                    setHoveredCategory(category);
                    setSelectedCategoryIndex(index);
                  }
                }}
                onMouseLeave={() => {
                  if (!keyboardMode && !isHoveringNodes) {
                    setHoveredCategory(null);
                  }
                }}
                onClick={() => {
                  setSelectedCategoryIndex(index);
                  setSelectedNodeIndex(0);
                  setKeyboardMode(true);
                }}
              >
                {category}
              </div>
            ))}
          </div>
        )}
        {(activeCategory || searchQuery.trim()) && currentNodes.length > 0 && (
          <div
            className={styles.nodesColumn}
            role="listbox"
            aria-label={searchQuery.trim() ? "Search results" : `${activeCategory} nodes`}
            onMouseEnter={() => setIsHoveringNodes(true)}
            onMouseLeave={() => {
              setIsHoveringNodes(false);
              if (!keyboardMode) {
                setHoveredCategory(null);
              }
            }}
          >
            {currentNodes.map((node, index) => (
              <NodePaletteItem
                key={node.type}
                node={node}
                onDrop={handleNodeDrop}
                isSelected={keyboardMode && selectedNodeIndex === index}
                onMouseEnter={() => {
                  if (!keyboardMode) {
                    setSelectedNodeIndex(index);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
