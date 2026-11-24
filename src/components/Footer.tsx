import { useRef, useState } from "react";

import { LicensesDialog } from "./LicensesDialog";
import { PrivacyLink } from "./PrivacyLink";
import { VersionInfo } from "./VersionInfo";
import { REPO_URL } from "../content/licenses";
import styles from "./Footer.module.css";

/* ------------------------------------------------------------------ */
/* Alt bilgi — kaynak kodu, lisanslar, gizlilik; ikincil olarak sürüm   */
/* ------------------------------------------------------------------ */

export function Footer() {
  const [licensesOpen, setLicensesOpen] = useState(false);
  // Klavyeyle etkinleştirilen düğmenin click'inde detail 0 olur.
  const [openedWithKeyboard, setOpenedWithKeyboard] = useState(false);
  const licensesButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        {/* role="list": Safari, list-style: none olan listeyi listeden saymıyor. */}
        <ul className={styles.links} role="list">
          <li>
            {/* Repo'nun tek bağlantısı: ayrıca "GitHub" yazmak aynı şeyi iki
                kez söylerdi. Adres ekran okuyucuya adda söylenir. */}
            <a
              className={styles.link}
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Açık kaynak, GitHub'da açılır"
            >
              Açık kaynak
            </a>
          </li>
          <li>
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
              Lisanslar
            </button>
          </li>
          <li>
            <PrivacyLink className={styles.link}>Gizlilik</PrivacyLink>
          </li>
        </ul>
        {/* Hangi derlemenin çalıştığını söyler; hata bildiriminde işe yarar. */}
        <div className={styles.meta}>
          <VersionInfo appVersion={__APP_VERSION__} commitSha={__COMMIT_SHA__} />
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
