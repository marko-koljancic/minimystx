import { useState, useEffect } from "react";
import { useUIStore, useCurrentContext } from "../store";
import { useGraphStore } from "../engine/graphStore";
import { nodeRegistry } from "../engine/nodeRegistry";
import { getParameterDisplayName } from "../engine/parameterUtils";
import { ParameterInput } from "./inputs/ParameterInput";
import styles from "./UnifiedPropertiesPanel.module.css";

type TabType = "general" | "transform" | "geometry" | "light" | "shadow" | "rendering" | "object";

export default function UnifiedPropertiesPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const selectedNodeId = useUIStore((state) => state.selectedNodeId);
  const selectedNodeIds = useUIStore((state) => state.selectedNodeIds);
  const currentContext = useCurrentContext();
  const { rootNodeRuntime, subFlows, setParams } = useGraphStore();

  // Get the appropriate node runtime based on current context
  const getNodeRuntime = () => {
    if (currentContext.type === "root") {
      return rootNodeRuntime;
    } else if (currentContext.type === "subflow" && currentContext.geoNodeId) {
      return subFlows[currentContext.geoNodeId]?.nodeRuntime || {};
    }
    return {};
  };

  const nodeRuntime = getNodeRuntime();

  useEffect(() => {
    if (selectedNodeId) {
      const nodeData = rootNodeRuntime[selectedNodeId];
      if (nodeData) {
        // Auto-switch to first available tab
        const availableTabs = getAvailableTabs(nodeData.params);
        if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
          setActiveTab(availableTabs[0]);
        }
      }
    }
  }, [selectedNodeId, nodeRuntime, activeTab, rootNodeRuntime]);

  // Handle multi-selection case
  if (selectedNodeIds.length > 1) {
    return (
      <div className={styles.emptyState}>
        <div>{selectedNodeIds.length} nodes selected</div>
        <div style={{ fontSize: '0.9em', opacity: 0.7, marginTop: '0.5em' }}>
          Multi-node editing not supported. Select a single node to edit its properties.
        </div>
      </div>
    );
  }

  if (!selectedNodeId) {
    return <div className={styles.emptyState}>Select a node to edit its properties</div>;
  }

  const nodeData = nodeRuntime[selectedNodeId];
  if (!nodeData) {
    return <div className={styles.emptyState}>Node data not found</div>;
  }

  const nodeDefinition = nodeRegistry[nodeData.type];
  if (!nodeDefinition) {
    return <div className={styles.emptyState}>Unknown node type: {nodeData.type}</div>;
  }

  const availableTabs = getAvailableTabs(nodeData.params);
  if (availableTabs.length === 0) {
    return <div className={styles.emptyState}>No parameters available</div>;
  }

  // Ensure current tab is valid
  const currentTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];

  const handleParamChange = (category: string, paramKey: string, value: unknown) => {
    // Special handling for certain parameter types
    let processedValue = value;

    // Handle rotation conversion (degrees to radians) if needed
    if (
      category === "transform" &&
      paramKey === "rotation" &&
      typeof value === "object" &&
      value !== null
    ) {
      const rotationValue = value as { x: number; y: number; z: number };
      processedValue = {
        x: (rotationValue.x * Math.PI) / 180,
        y: (rotationValue.y * Math.PI) / 180,
        z: (rotationValue.z * Math.PI) / 180,
      };
    }

    const newParams = {
      [category]: {
        ...nodeData.params[category],
        [paramKey]: processedValue,
      },
    };

    setParams(selectedNodeId, newParams, currentContext);
  };

  const renderTabContent = () => {
    const categoryParams = nodeData.params[currentTab];
    if (!categoryParams) {
      return <div className={styles.emptyState}>No parameters in this category</div>;
    }

    const categoryMetadata = nodeDefinition.params[currentTab];
    if (!categoryMetadata) {
      return <div className={styles.emptyState}>No parameter metadata found</div>;
    }

    // Check if shadows should be enabled (for shadow tab visibility)
    const shadowsEnabled = nodeData.params.light?.castShadow === true;

    // Special handling for shadow tab - only show if castShadow is enabled
    if (currentTab === "shadow" && !shadowsEnabled) {
      return (
        <div className={styles.emptyState}>
          Enable "Cast Shadow" in the Light tab to configure shadow properties
        </div>
      );
    }

    return (
      <div className={styles.tabContent}>
        <div className={styles.parameterGrid}>
          {Object.entries(categoryParams).map(([key, value]) => {
            const metadata = categoryMetadata[key];
            if (!metadata) {
              return null; // Skip parameters without metadata
            }

            // Special handling for transform rotation display (radians to degrees)
            let displayValue = value;
            if (
              currentTab === "transform" &&
              key === "rotation" &&
              typeof value === "object" &&
              value !== null
            ) {
              const rotationValue = value as { x: number; y: number; z: number };
              displayValue = {
                x: (rotationValue.x * 180) / Math.PI,
                y: (rotationValue.y * 180) / Math.PI,
                z: (rotationValue.z * 180) / Math.PI,
              };
            }

            return (
              <div key={key} className={styles.parameterRow}>
                <div className={styles.labelColumn}>
                  <label className={styles.parameterLabel}>
                    {getParameterDisplayName(key, metadata)}
                  </label>
                </div>
                <div className={styles.controlColumn}>
                  <ParameterInput
                    value={displayValue}
                    metadata={metadata}
                    onChange={(newValue) => handleParamChange(currentTab, key, newValue)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabNav}>
        {availableTabs.map((tab) => (
          <button
            key={tab}
            className={`${styles.tabButton} ${currentTab === tab ? styles.active : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {getTabDisplayName(tab)}
          </button>
        ))}
      </div>
      {renderTabContent()}
    </div>
  );
}

function getTabDisplayName(tab: TabType): string {
  switch (tab) {
    case "object":
      return "OBJ Model";
    case "light":
      return "Light";
    case "shadow":
      return "Shadow";
    default:
      return tab.charAt(0).toUpperCase() + tab.slice(1);
  }
}

function getAvailableTabs(params: Record<string, any>): TabType[] {
  const availableTabs: TabType[] = [];

  // Check which categories have parameters
  if (params.general && Object.keys(params.general).length > 0) availableTabs.push("general");
  if (params.transform && Object.keys(params.transform).length > 0) availableTabs.push("transform");
  if (params.geometry && Object.keys(params.geometry).length > 0) availableTabs.push("geometry");
  if (params.light && Object.keys(params.light).length > 0) availableTabs.push("light");
  if (params.shadow && Object.keys(params.shadow).length > 0) availableTabs.push("shadow");
  if (params.object && Object.keys(params.object).length > 0) availableTabs.push("object");
  if (params.rendering && Object.keys(params.rendering).length > 0) availableTabs.push("rendering");

  return availableTabs;
}
