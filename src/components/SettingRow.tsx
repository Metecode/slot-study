import type { ReactNode } from "react";

import styles from "./SettingRow.module.css";

/* ------------------------------------------------------------------ */
/* Ayarlar satırı — anahtar dışındaki kontroller için (Animasyon)       */
/*                                                                     */
/* Kontrol kendi etiketini taşır (SegmentedControl'ün radio grubu       */
/* etiketine bağlı); satır yalnızca düzeni ve dokunma alanını verir.    */
/* Anahtarlı satır SettingSwitchRow'da: orada satırın tamamı label.     */
/* ------------------------------------------------------------------ */

export type SettingRowProps = {
  /** Etiket üstte, kontrol altında ve tam genişlikte. */
  stacked?: boolean;
  children: ReactNode;
};

export function SettingRow({ stacked = false, children }: SettingRowProps) {
  return <div className={stacked ? `${styles.row} ${styles.stacked}` : styles.row}>{children}</div>;
}
