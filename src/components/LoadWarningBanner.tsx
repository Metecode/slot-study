import { useState } from "react";

import styles from "./LoadWarningBanner.module.css";

/* ------------------------------------------------------------------ */
/* Açılışta okumanın sonucuyla ilgili uyarı bandı                      */
/* ------------------------------------------------------------------ */

export type LoadWarningBannerProps = {
  /** storage/loadWarning'in sonucu; her şey yolundaysa null ve bant çizilmez. */
  warning: string | null;
};

/** Kapatılınca oturum boyunca geri gelmez; kapatma diske yazılmaz. */
export function LoadWarningBanner({ warning }: LoadWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!warning || dismissed) return null;

  return (
    <div className={styles.warning} role="alert">
      <span>{warning}</span>
      <button
        type="button"
        className={styles.warningClose}
        onClick={() => setDismissed(true)}
        aria-label="Uyarıyı kapat"
      >
        ×
      </button>
    </div>
  );
}
