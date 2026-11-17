import { useId } from "react";

import styles from "./ReminderOffer.module.css";

/* ------------------------------------------------------------------ */
/* Kullanım ölçümü bilgilendirmesi — ilk açılışta bir kez, engellemeden  */
/* ------------------------------------------------------------------ */

/*
  Hatırlatıcı öneri kartıyla aynı görünüm ve davranış: makinenin altında,
  odağı çekmez, kullanıcı turuna devam edebilir. Gösterildiği an kaydedilir
  (App), kapatılmasa da bir daha çıkmaz.
*/

export type UsageNoticeProps = {
  /** Ayarlar'ı açar ve odağı anahtara taşır. */
  onOpenSettings: () => void;
  onClose: () => void;
};

export function UsageNotice({ onOpenSettings, onClose }: UsageNoticeProps) {
  const textId = useId();

  return (
    <section className={styles.root} aria-labelledby={textId}>
      <p id={textId} className={styles.text}>
        Slot'u geliştirmek için kullanım istatistiği topluyoruz: hesabınla ilişkilendirilmeyen, rastgele bir
        kurulum kimliğiyle. Cevap metnin gönderilmez. Ayarlar'dan kapatabilirsin.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onOpenSettings}>
          Ayarlar
        </button>
        <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={onClose}>
          Tamam
        </button>
      </div>
    </section>
  );
}
