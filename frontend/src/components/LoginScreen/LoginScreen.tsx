import styles from './LoginScreen.module.css';

export function LoginScreen() {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error');

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <img src="/favicon.ico" alt="" className={styles.icon} />
        <h1 className={styles.title}>OliNotes</h1>
        <p className={styles.subtitle}>
          Notatki studenckie — Informatyka, Wydział EiTI, PW
        </p>

        {authError && (
          <p className={styles.error}>
            Logowanie nie powiodło się. Spróbuj ponownie.
          </p>
        )}

        <a href="/auth/login" className={styles.loginBtn}>
          Zaloguj się przez USOS
        </a>
        <p className={styles.hint}>
          Wymagane konto USOS Politechniki Warszawskiej
        </p>
      </div>
    </div>
  );
}
