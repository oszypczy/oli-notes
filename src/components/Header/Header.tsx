import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <img src="/favicon.ico" alt="" className={styles.icon} />
        <h1 className={styles.title}>Studia IV - OliNotes</h1>
      </div>
      <p className={styles.credit}>
        Oliwier Szypczyn · Informatyka · Wydział EiTI · Politechnika Warszawska
      </p>
    </header>
  );
}
