import { platformFeatures } from "../platform";
import styles from "./Footer.module.css";

/* ------------------------------------------------------------------ */
/* Alt bilgi — lisans notu, gizlilik, sürüm ve kaynak koduna bağlantı   */
/* ------------------------------------------------------------------ */

const REPO_URL = "https://github.com/Metecode/interview-prep-slots";
/** Mobil uygulamada göreli yol işe yaramaz (bkz. platformFeatures.sameOriginPages). */
const PRIVACY_URL_LIVE = "https://slot.meteucar.com/privacy";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>
          Açık kaynak · MIT ·{" "}
          {platformFeatures.sameOriginPages ? (
            /* Statik sayfa, React'in dışında: tam sayfa geçişi. Service worker
               /privacy'yi SPA yedeğine düşürmüyor (vite.config.ts). */
            <a className={styles.link} href="/privacy">
              Gizlilik
            </a>
          ) : (
            /* Native: dış adres, Capacitor sistem tarayıcısında açar. */
            <a className={styles.link} href={PRIVACY_URL_LIVE} target="_blank" rel="noreferrer">
              Gizlilik
            </a>
          )}
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
