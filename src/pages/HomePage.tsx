import { Link } from "react-router";
import styles from "./HomePage.module.css";
export default function HomePage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Minimystx</h1>
        <p>Browser-based parametric 3D design studio.</p>
        <p>
          <Link to="/design">Open the studio</Link>
        </p>
      </div>
    </div>
  );
}
