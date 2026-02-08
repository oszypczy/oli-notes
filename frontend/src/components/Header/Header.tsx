import { MenuIcon } from '../icons';
import styles from './Header.module.css';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  user?: { name: string };
  onLogout?: () => void;
}

export function Header({ onToggleSidebar, user, onLogout }: HeaderProps) {
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
      <div className={styles.right}>
        <p className={styles.credit}>
          Oliwier Szypczyn · Informatyka · Wydział EiTI · Politechnika Warszawska
        </p>
        {user && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <button onClick={onLogout} className={styles.logoutBtn}>Wyloguj</button>
          </div>
        )}
      </div>
    </header>
  );
}
