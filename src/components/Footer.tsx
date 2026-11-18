import { useRef, useState } from "react";

import { LicensesDialog } from "./LicensesDialog";
import { PrivacyLink } from "./PrivacyLink";
import { REPO_URL } from "../content/licenses";
import styles from "./Footer.module.css";

/* ------------------------------------------------------------------ */
/* Alt bilgi — lisanslar, gizlilik, sürüm ve kaynak koduna bağlantı     */
/* ------------------------------------------------------------------ */

export function Footer() {
  const [licensesOpen, setLicensesOpen] = useState(false);
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
            onClick={() => setLicensesOpen(true)}
          >
            Açık kaynak · Lisanslar
          </button>{" "}
          · <PrivacyLink className={styles.link}>Gizlilik</PrivacyLink>
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
      <LicensesDialog
        open={licensesOpen}
        onClose={() => {
          setLicensesOpen(false);
          // Diyalog kapanınca odak onu açan düğmeye döner.
          licensesButtonRef.current?.focus();
        }}
      />
    </footer>
  );
}
