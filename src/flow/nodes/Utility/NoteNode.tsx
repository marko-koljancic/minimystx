import React, { useState, useRef, useEffect, useCallback } from "react";
import { NodeProps, NodeResizer } from "@xyflow/react";
import { useGraphStore } from "../../../engine/graphStore";
import { useCurrentContext } from "../../../store/uiStore";
import { NoteNodeData, NOTE_COLORS } from "./Note";
import styles from "../Styles/NoteNode.module.css";

const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;

export default function NoteNode(props: NodeProps) {
  const { data, selected, id } = props;
  const nodeData = data as NoteNodeData;
  const { setParams } = useGraphStore();
  const currentContext = useCurrentContext();

  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(nodeData.note?.text || "");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const currentWidth = nodeData.note?.width || MIN_WIDTH;
  const currentHeight = nodeData.note?.height || MIN_HEIGHT;
  const currentColor = nodeData.note?.color || NOTE_COLORS[0];
  const colorIndex = NOTE_COLORS.indexOf(currentColor);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  const handleTextBlur = useCallback(() => {
    setIsEditing(false);
    setParams(id, {
      note: {
        ...nodeData.note,
        text: text,
      },
    }, currentContext);
  }, [id, nodeData.note, setParams, text, currentContext]);

  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsEditing(false);
      setText(nodeData.note?.text || "");
    } else if (e.key === "Enter" && e.ctrlKey) {
      handleTextBlur();
    }
    e.stopPropagation();
  }, [handleTextBlur, nodeData.note?.text]);

  const handleColorClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIndex = (colorIndex + 1) % NOTE_COLORS.length;
    const nextColor = NOTE_COLORS[nextIndex];
    setParams(id, {
      note: {
        ...nodeData.note,
        color: nextColor,
      },
    }, currentContext);
  }, [colorIndex, id, nodeData.note, setParams, currentContext]);

  const handleResize = useCallback((_event: unknown, data: { width: number; height: number }) => {
    setParams(id, {
      note: {
        ...nodeData.note,
        width: data.width,
        height: data.height,
      },
    }, currentContext);
  }, [id, nodeData.note, setParams, currentContext]);


  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setText(nodeData.note?.text || "");
  }, [nodeData.note?.text]);

  const colorClassName = `color${colorIndex >= 0 ? colorIndex : 0}`;

  return (
    <div
      className={`${styles.noteContainer} ${styles[colorClassName]} ${
        selected ? styles.selected : ""
      } ${isEditing ? styles.editing : ""}`}
      style={{
        width: `${currentWidth}px`,
        height: `${currentHeight}px`,
      }}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        isVisible={selected}
        color="#3b82f6"
        onResize={handleResize}
        handleStyle={{
          backgroundColor: '#3b82f6',
          border: '1px solid #ffffff',
          borderRadius: '2px',
          width: '8px',
          height: '8px',
        }}
      />
      {isEditing ? (
        <textarea
          ref={textAreaRef}
          className={styles.textArea}
          value={text}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          placeholder="Enter note text..."
        />
      ) : (
        <div className={styles.textDisplay}>
          {nodeData.note?.text || "Double-click to edit"}
        </div>
      )}

      <div
        className={styles.colorSwitcher}
        onClick={handleColorClick}
        title="Change note color"
        data-noDrag
      />

    </div>
  );
}