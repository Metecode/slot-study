import { useEffect, useId, useRef } from "react";

import { LicenseRow } from "./LicenseRow";
import styles from "./LicensesDialog.module.css";
// Kart Ayarlar'daki grupla aynı yüzey; stil tek yerde kalsın diye oradan.
import groupStyles from "./SettingGroup.module.css";
import { LICENSE_SECTIONS, REPO_URL } from "../content/licenses";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

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
  etkisizleşmesi tarayıcıdan geliyor. Tek kaydırma alanı gövde; diyalog
  kaymıyor, arkadaki sayfa kilitli (useBodyScrollLock). Kilit olmasa iOS
  kaydırmayı sona dayanınca belgeye zincirliyordu.

  İlk odak: klavyeyle açıldıysa Kapat (halka görünür), dokunuş ya da
  fareyle açıldıysa diyaloğun kendisi. WebKit betikle verilen odağı
  :focus-visible sayıyor; Kapat'a odak verilse dokunuşta da halka
  çiziliyordu. Diyaloğun kendisi odakta halka çizmez, ekran okuyucu
  yine diyaloğun adını okur.

  Giriş hareketi yok (DeleteAccountDialog ile aynı gerekçe).
*/

export type LicensesDialogProps = {
  open: boolean;
  /** Açan etkileşim klavyeyse ilk odak Kapat'a, değilse diyaloğa gider. */
  openedWithKeyboard: boolean;
  onClose: () => void;
};

export function LicensesDialog({ open, openedWithKeyboard, onClose }: LicensesDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useBodyScrollLock(open);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      if (openedWithKeyboard) closeRef.current?.focus();
      else dialog.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, openedWithKeyboard]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      tabIndex={-1}
      onClose={onClose}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          Lisanslar
        </h2>
        <button ref={closeRef} type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>
          Kapat
        </button>
      </div>

      <div ref={bodyRef} className={styles.body}>
        <p className={styles.intro}>
          Slot açık kaynak;{" "}
          <a className={styles.link} href={REPO_URL} target="_blank" rel="noreferrer">
            kaynak kodu GitHub'da
          </a>
          . Lisansların tam metinleri aşağıda.
        </p>

        <div className={groupStyles.card}>
          {LICENSE_SECTIONS.map((section) => (
            <LicenseRow key={section.id} section={section} />
          ))}
        </div>
      </div>
    </dialog>
  );
}
