import { useEffect, useRef, useCallback } from "react";
import styles from "./ScreenshotModal.module.css";
interface ScreenshotModalProps {
  imageUrl: string;
  filename: string;
  onClose: () => void;
  onDownload: () => void;
}
export function ScreenshotModal({ imageUrl, filename, onClose, onDownload }: ScreenshotModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      onClose();
    }
  };
  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onDownload();
  }, [imageUrl, filename, onDownload]);
  return (
    <div className={styles.backdrop} ref={modalRef} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Screenshot Result</h3>
        <div className={styles.imageContainer}>
          <img src={imageUrl} alt="Screenshot preview" className={styles.preview} />
        </div>
        <div className={styles.buttons}>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
          <button className={styles.downloadButton} onClick={handleDownload}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
