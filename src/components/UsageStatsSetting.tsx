import { useEffect, useId, useRef } from "react";

import { PrivacyLink } from "./PrivacyLink";
import { Switch } from "./Switch";
import styles from "./UsageStatsSetting.module.css";

/* ------------------------------------------------------------------ */
/* "Kullanım istatistiklerini paylaş" — web ve native                   */
/* ------------------------------------------------------------------ */

/*
  Metinde "anonim" kelimesi geçmez: kalıcı bir kurulum kimliği anonim
  değildir (CLAUDE.md, Kullanım ölçümü). Kapatınca kuyruk ve kimlik silinir;
  karar analyticsClient.setEnabled'da.
*/

export type UsageStatsSettingProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Değişince odak anahtara gelir (bilgilendirme kartındaki "Ayarlar"). */
  focusRequest: number;
};

export function UsageStatsSetting({ checked, onChange, focusRequest }: UsageStatsSettingProps) {
  const noteId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (focusRequest === 0) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="switch"]')?.focus();
  }, [focusRequest]);

  return (
    <span className={styles.root} ref={rootRef}>
      <Switch
        checked={checked}
        onChange={onChange}
        label="Kullanım istatistiklerini paylaş"
        describedBy={noteId}
      />
      <span id={noteId} className={styles.note}>
        Hesabınla ilişkilendirilmeyen, rastgele bir kurulum kimliğiyle.{" "}
        <PrivacyLink className={styles.link}>Gizlilik politikası</PrivacyLink>
      </span>
    </span>
  );
}
