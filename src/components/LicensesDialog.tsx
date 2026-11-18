import { useEffect, useId, useRef } from "react";

import { reflowLicenseText } from "./licenseText";
import styles from "./LicensesDialog.module.css";
import { CC_BY_SA_URL, LICENSE_SECTIONS, REPO_URL } from "../content/licenses";

/* ------------------------------------------------------------------ */
/* Lisanslar — kod (MIT), içerik (CC BY-SA 4.0), üçüncü taraf bildirimi  */
/* ------------------------------------------------------------------ */

/*
  Uygulama içi diyalog, ayrı bir sayfa değil: web'de ve native'de aynı
  çalışıyor. Statik bir sayfa native'de canlı siteye gitmek zorunda
  kalırdı (bkz. PrivacyLink); buradaki metinler pakette, çevrimdışı da
  açılıyor. Dış bağlantılar target="_blank": Capacitor onları sistem
  tarayıcısına veriyor.

  Native <dialog> + showModal(): odak tuzağı, Escape ve arka planın
  etkisizleşmesi tarayıcıdan geliyor. İlk odak üstteki "Kapat"ta; ilk
  bağlantıya düşseydi uzun metin açılışta aşağı kayabilirdi.

  Giriş hareketi yok (DeleteAccountDialog ile aynı gerekçe).
*/

export type LicensesDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function LicensesDialog({ open, onClose }: LicensesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.scrollTop = 0;
      closeRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          Lisanslar
        </h2>
        <button ref={closeRef} type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>
          Kapat
        </button>
      </div>

      <p className={styles.intro}>
        Slot açık kaynak.{" "}
        <a className={styles.link} href={REPO_URL} target="_blank" rel="noreferrer">
          Kaynak kodu GitHub'da
        </a>
        . Kod MIT, soru içeriği{" "}
        <a className={styles.link} href={CC_BY_SA_URL} target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>{" "}
        lisanslı; içeriği kaynak belirterek ve aynı lisansla paylaşabilirsin.
      </p>

      {LICENSE_SECTIONS.map((section) => (
        <section key={section.id} className={styles.section} aria-labelledby={`${titleId}-${section.id}`}>
          <h3 id={`${titleId}-${section.id}`} className={styles.sectionTitle}>
            {section.title}
          </h3>
          <p className={styles.scope}>{section.scope}</p>
          {/* Elle kırılmış paragraflar akıtılır, başlık ve listeler korunur. */}
          <pre className={styles.text}>{reflowLicenseText(section.text)}</pre>
        </section>
      ))}
    </dialog>
  );
}
