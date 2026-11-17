import { PrivacyLink } from "./PrivacyLink";
import styles from "./Footer.module.css";

/* ------------------------------------------------------------------ */
/* Alt bilgi — lisans notu, gizlilik, sürüm ve kaynak koduna bağlantı   */
/* ------------------------------------------------------------------ */

const REPO_URL = "https://github.com/Metecode/interview-prep-slots";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>
          Açık kaynak · MIT ·{" "}
          <PrivacyLink className={styles.link}>Gizlilik</PrivacyLink>
        </span>
        <div className={styles.end}>
          {/* Hangi derlemenin çalıştığını söyler; hata bildiriminde işe yarar. */}
          <span className={styles.version}>
            v{__APP_VERSION__} · {__COMMIT_SHA__}
          </span>
          <a className={styles.link} href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
