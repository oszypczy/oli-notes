import { MenuIcon } from '../icons';
import styles from './Header.module.css';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
        >
          <MenuIcon />
        </button>
        <img src="/favicon.ico" alt="" className={styles.icon} />
        <h1 className={styles.title}>Studia IV - OliNotes</h1>
      </div>
      <p className={styles.credit}>
        Oliwier Szypczyn · Informatyka · Wydział EiTI · Politechnika Warszawska
      </p>
    </header>
  );
}
