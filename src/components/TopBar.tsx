import { platformFeatures } from "../platform";
import { AuthArea } from "./AuthArea";
import { SyncIndicator } from "./SyncIndicator";
import styles from "./TopBar.module.css";

/* ------------------------------------------------------------------ */
/* Üst çubuk — marka, senkron ve oturum                                */
/* Sürüm alt bilgide (bkz. Footer); havuz büyüklüğü kategori seçicide. */
/* ------------------------------------------------------------------ */

/**
 * Uygulama ikonunun motifi (design/icon/slot_foreground.svg): makara penceresi
 * içinde süslü parantezler. Yollar 108'lik ikon tuvalinde. viewBox çizimin dış
 * sınırına kırpılmış: çizgi dahil 62×40 (x 23..85, y 34..74), boyutun 3:2
 * oranına uysun diye yükseklik 41.33'e açılıp merkezde (54) tutuldu.
 * Kaynak değişirse buradaki yollar da güncellenir.
 */
function LogoMark() {
  return (
    <svg
      className={styles.logo}
      width="36"
      height="24"
      viewBox="23 33.33 62 41.33"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M35 37 H73 A9 9 0 0 1 82 46 V62 A9 9 0 0 1 73 71 H35 A9 9 0 0 1 26 62 V46 A9 9 0 0 1 35 37 Z" />
        <path d="M42 46.5 C38.5 46.5 38 48 38 50.5 L38 51.5 C38 53 37 54 35 54 C37 54 38 55 38 56.5 L38 57.5 C38 60 38.5 61.5 42 61.5" />
        <path d="M66 46.5 C69.5 46.5 70 48 70 50.5 L70 51.5 C70 53 71 54 73 54 C71 54 70 55 70 56.5 L70 57.5 C70 60 69.5 61.5 66 61.5" />
        <path d="M54 49 L54 59" />
      </g>
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
