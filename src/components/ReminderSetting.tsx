import { useId } from "react";

import { REMINDER_DENIED_NOTE, REMINDER_DESCRIPTION } from "../domain/reminder";
import { Switch } from "./Switch";
import styles from "./ReminderSetting.module.css";

/* ------------------------------------------------------------------ */
/* Tekrar hatırlatıcısı anahtarı — yalnızca native'de çizilir           */
/* ------------------------------------------------------------------ */

export type ReminderSettingProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** İzin verilmedi ya da sistemden kaldırıldı: açıklama yerine yol tarifi. */
  denied: boolean;
};

/**
 * Anahtar açılınca izin istenir; karar App'te. Reddedilirse anahtar kapalı
 * kalır ve not değişir. Not canlı bölgede: ekran okuyucu reddi duyar, ama
 * açıklama zaten görünür olduğu için ilk çizimde okunmaz (içerik değişmedikçe).
 */
export function ReminderSetting({ checked, onChange, denied }: ReminderSettingProps) {
  const noteId = useId();

  return (
    <span className={styles.root}>
      <Switch checked={checked} onChange={onChange} label="Tekrar hatırlatıcısı" describedBy={noteId} />
      <span id={noteId} className={styles.note} role="status">
        {denied ? REMINDER_DENIED_NOTE : REMINDER_DESCRIPTION}
      </span>
    </span>
  );
}
