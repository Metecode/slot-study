import { useEffect, useRef } from "react";

import { PrivacyLink } from "./PrivacyLink";
import { SettingSwitchRow } from "./SettingSwitchRow";
import styles from "./UsageStatsSetting.module.css";

/* ------------------------------------------------------------------ */
/* "Kullanım istatistiklerini paylaş" — web ve native                   */
/* ------------------------------------------------------------------ */

/*
  Metinde "anonim" kelimesi geçmez: kalıcı bir kurulum kimliği anonim
  değildir (CLAUDE.md, Kullanım ölçümü). Kapatınca kuyruk ve kimlik silinir;
  karar analyticsClient.setEnabled'da.

  Açıklamadaki bağlantı satırın label'ının içinde ama anahtarı tetiklemez:
  label, içindeki etkileşimli öğeye yapılan tıklamayı iletmez
  (bkz. SettingSwitchRow).
*/

export type UsageStatsSettingProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Değişince odak anahtara gelir (bilgilendirme kartındaki "Ayarlar"). */
  focusRequest: number;
};

export function UsageStatsSetting({ checked, onChange, focusRequest }: UsageStatsSettingProps) {
  const switchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusRequest === 0) return;
    switchRef.current?.focus();
  }, [focusRequest]);

  return (
    <SettingSwitchRow
      label="Kullanım istatistiklerini paylaş"
      checked={checked}
      onChange={onChange}
      switchRef={switchRef}
      description={
        <>
          Hesabınla ilişkilendirilmeyen, rastgele bir kurulum kimliğiyle.{" "}
          <PrivacyLink className={styles.link}>Gizlilik politikası</PrivacyLink>
        </>
      }
    />
  );
}
