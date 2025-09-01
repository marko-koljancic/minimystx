import styles from "./NotFound.module.css";
export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Page Not Found</h1>
        <p className={styles.message}>The page you are looking for does not exist.</p>
      </div>
    </div>
  );
}
