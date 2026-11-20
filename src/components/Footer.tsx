import { useRef, useState } from "react";

import { LicensesDialog } from "./LicensesDialog";
import { PrivacyLink } from "./PrivacyLink";
import { versionLabel } from "./versionLabel";
import { REPO_URL } from "../content/licenses";
import styles from "./Footer.module.css";

/* ------------------------------------------------------------------ */
/* Alt bilgi — lisanslar, gizlilik, sürüm ve kaynak koduna bağlantı     */
/* ------------------------------------------------------------------ */

export function Footer() {
  const [licensesOpen, setLicensesOpen] = useState(false);
  // Klavyeyle etkinleştirilen düğmenin click'inde detail 0 olur.
  const [openedWithKeyboard, setOpenedWithKeyboard] = useState(false);
  const licensesButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.start}>
          {/* Diyalog açar, sayfaya gitmez: düğme, bağlantı değil. */}
          <button
            ref={licensesButtonRef}
            type="button"
            className={`${styles.link} ${styles.button}`}
            aria-haspopup="dialog"
            onClick={(event) => {
              setOpenedWithKeyboard(event.detail === 0);
              setLicensesOpen(true);
            }}
          >
            {/* Satır yalnızca birimler arasında kırılır; "·" kendinden
                sonraki öğeyle birlikte alta iner, satır sonunda asılı kalmaz. */}
            <span className={styles.unit}>Açık kaynak</span>{" "}
            <span className={styles.unit}>· Lisanslar</span>
          </button>{" "}
          <span className={styles.unit}>
            · <PrivacyLink className={styles.link}>Gizlilik</PrivacyLink>
          </span>
        </span>
        <div className={styles.end}>
          {/* Hangi derlemenin çalıştığını söyler; hata bildiriminde işe yarar. */}
          <span className={styles.version}>{versionLabel(__APP_VERSION__, __COMMIT_SHA__)}</span>
          <a className={styles.link} href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </div>
      <LicensesDialog
        open={licensesOpen}
        openedWithKeyboard={openedWithKeyboard}
        onClose={() => {
          setLicensesOpen(false);
          // Diyalog kapanınca odak onu açan düğmeye döner. Dokunuşla
          // açıldıysa halka çizilmesin: WebKit betikle verilen odağı
          // :focus-visible sayıyor. focusVisible'ı tanımayan tarayıcı
          // seçeneği yok sayar, kendi buluşsalına döner.
          licensesButtonRef.current?.focus({ focusVisible: openedWithKeyboard });
        }}
      />
    </footer>
  );
}
