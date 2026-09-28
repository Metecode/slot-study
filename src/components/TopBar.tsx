import { platformFeatures } from "../platform";
import { AuthArea } from "./AuthArea";
import { SyncIndicator } from "./SyncIndicator";
import styles from "./TopBar.module.css";

/* ------------------------------------------------------------------ */
/* Üst çubuk — marka, senkron ve oturum                                */
/* Sürüm alt bilgide (bkz. Footer); havuz büyüklüğü kategori seçicide. */
/* ------------------------------------------------------------------ */

/** Basit bir işaret: kare çerçeve + kol topuzunu andıran nokta. */
function LogoMark() {
  return (
    <svg
      className={styles.logo}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="14" cy="10.5" r="2.6" fill="var(--accent)" />
      <rect x="8.5" y="16.5" width="11" height="2.4" rx="1.2" fill="var(--accent)" />
    </svg>
  );
}

export function TopBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <LogoMark />
          <div className={styles.brandText}>
            <span className={styles.name}>Slot</span>
            <span className={styles.tagline}>Teorik soru pratiği</span>
          </div>
        </div>

        {/* Native'de (mobil v1) kimlik kapalı: giriş, senkron göstergesi
            ve hesap silme (AuthArea'nın içinde) hiç çizilmez. */}
        {platformFeatures.auth && (
          <div className={styles.meta}>
            {/* Kendi durumunu kendi okur; misafirde hiç çizilmez. */}
            <SyncIndicator />

            {/* Oturum alanı en sağda: kendi durumunu kendi okur, TopBar'a
                prop olarak geçirilmiyor — üst çubuğun geri kalanı oturumla
                ilgilenmiyor. */}
            <AuthArea />
          </div>
        )}
      </div>
    </header>
  );
}
