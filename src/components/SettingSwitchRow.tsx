import { useId } from "react";
import type { ReactNode, Ref } from "react";

import rowStyles from "./SettingRow.module.css";
import styles from "./SettingSwitchRow.module.css";

/* ------------------------------------------------------------------ */
/* Anahtarlı ayar satırı — satırın tamamı dokunulabilir                 */
/* ------------------------------------------------------------------ */

/*
  Satırın tamamı bir <label>: etikete, açıklamaya ya da boş alana dokunmak
  içindeki anahtara iletilir ve anahtarı bir kez değiştirir. Anahtarın
  kendisine dokunmak da bir kez: label, içindeki etkileşimli öğeye
  (anahtar, açıklamadaki bağlantı) yapılan tıklamayı ayrıca iletmez.
  Açıklamadaki "Gizlilik politikası" bağlantısı bu yüzden anahtarı
  tetiklemez.

  Erişilebilir ad yalnızca etiket metninden (aria-labelledby): label'ın
  bütün metni açıklamayı da içerdiği için ad "Ses iPhone sessiz…" gibi
  okunurdu. Açıklama aria-describedby ile kendi anahtarına bağlı.

  Anahtar role="switch" taşıyan bir button. VoiceOver role="switch"
  taşıyan bir button'da örtük label'ı her zaman okumuyordu; ad bu yüzden
  açık bağla geliyor.
*/

export type SettingSwitchRowProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Etiketin altındaki açıklama; yalnızca bu satırın anahtarına bağlanır. */
  description?: ReactNode;
  /** Açıklama sonradan değişirse (ör. izin reddi) ekran okuyucu duysun. */
  descriptionLive?: boolean;
  /** Dışarıdan odak vermek için (bilgilendirme kartındaki "Ayarlar"). */
  switchRef?: Ref<HTMLButtonElement>;
};

export function SettingSwitchRow({
  label,
  checked,
  onChange,
  description,
  descriptionLive = false,
  switchRef,
}: SettingSwitchRowProps) {
  const labelId = useId();
  const descriptionId = useId();
  const hasDescription = description !== undefined && description !== null;

  return (
    <label className={`${rowStyles.row} ${styles.row}`}>
      <span className={rowStyles.text}>
        <span id={labelId} className={rowStyles.label}>
          {label}
        </span>
        {hasDescription && (
          <span id={descriptionId} className={rowStyles.description} role={descriptionLive ? "status" : undefined}>
            {description}
          </span>
        )}
      </span>
      <button
        ref={switchRef}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hasDescription ? descriptionId : undefined}
        className={styles.track}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
      </button>
    </label>
  );
}
