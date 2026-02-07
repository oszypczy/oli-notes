import { DocumentIcon } from '../icons';
import styles from './EmptyState.module.css';

export function EmptyState() {
  return (
    <div className={styles.container}>
      <DocumentIcon className={styles.icon} />
      <p className={styles.text}>Wybierz plik z menu po lewej stronie</p>
    </div>
  );
}
