import { useMemo, useCallback } from "react";
import { useContextNodes } from "../hooks/useContextNodes";
import { nodeRegistry } from "./nodes/nodeRegistry";
import { useUIStore } from "../store";
import styles from "./FlowListView.module.css";
interface NodeListItem {
  id: string;
  name: string;
  type: string;
  displayName: string;
}
const FlowListView = () => {
  const contextNodes = useContextNodes();
  const { setSelectedNode, selectedNodeId } = useUIStore();
  const nodeListItems: NodeListItem[] = useMemo(() => {
    return contextNodes.map((node) => {
      const nodeDefinition = nodeRegistry[node.type];
      const name = node.data?.general?.name || nodeDefinition?.displayName || node.type;
      const displayName = nodeDefinition?.displayName || node.type;
      return {
        id: node.id,
        name: name,
        type: node.type,
        displayName: displayName,
      };
    });
  }, [contextNodes]);
  const sortedNodes = nodeListItems;
  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNode(nodeId);
    },
    [setSelectedNode]
  );
  if (sortedNodes.length === 0) {
    return (
      <div className={styles.listContainer}>
        <div className={styles.emptyState}>No nodes in this flow</div>
      </div>
    );
  }
  return (
    <div className={styles.listContainer}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <tbody>
            {sortedNodes.map((node) => (
              <tr
                key={node.id}
                className={`${styles.tr} ${selectedNodeId === node.id ? styles.selectedRow : ""}`}
              >
                <td className={`${styles.td} ${styles.nameColumn}`} title={node.name}>
                  {node.name}
                </td>
                <td className={`${styles.td} ${styles.typeColumn}`}>{node.displayName}</td>
                <td className={`${styles.td} ${styles.actionColumn}`}>
                  <button className={styles.selectButton} onClick={() => handleSelectNode(node.id)}>
                    Select
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default FlowListView;
