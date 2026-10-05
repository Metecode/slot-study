import { platformFeatures } from "../platform";
import { AuthArea } from "./AuthArea";
import { LogoMark } from "./LogoMark";
import { SyncIndicator } from "./SyncIndicator";
import styles from "./TopBar.module.css";

/* ------------------------------------------------------------------ */
/* Üst çubuk — marka, senkron ve oturum                                */
/* Sürüm alt bilgide (bkz. Footer); havuz büyüklüğü kategori seçicide. */
/* ------------------------------------------------------------------ */

export function TopBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <LogoMark className={styles.logo} />
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
