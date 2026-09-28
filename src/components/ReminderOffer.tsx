import { useId, useState } from "react";

import { REMINDER_DENIED_NOTE } from "../domain/reminder";
import styles from "./ReminderOffer.module.css";

/* ------------------------------------------------------------------ */
/* Hatırlatıcı öneri kartı — tek sefer, dayatmadan                     */
/* ------------------------------------------------------------------ */

/*
  Beşinci değerlendirmenin ardından makinenin altında bir kez çıkar
  (karar domain/reminder.ts shouldOfferReminder). Accent kullanmaz: kart
  bir öneri, birincil eylem değil. Odağı çekmez; kullanıcı turuna devam
  edebilir, kart oturum boyunca yerinde kalır.
*/

export type ReminderOfferProps = {
  /** İzni ister ve açar; sonuç izin verilip verilmediği. */
  onAccept: () => Promise<boolean>;
  onClose: () => void;
};

type Step = "ask" | "pending" | "denied";

export function ReminderOffer({ onAccept, onClose }: ReminderOfferProps) {
  const [step, setStep] = useState<Step>("ask");
  const textId = useId();

  async function handleAccept() {
    setStep("pending");
    const granted = await onAccept();
    // İzin verildiyse kart işini yaptı; anahtar Ayarlar'da açık görünür.
    if (granted) onClose();
    else setStep("denied");
  }

  return (
    <section className={styles.root} aria-labelledby={textId}>
      <p id={textId} className={styles.text} role="status">
        {step === "denied" ? REMINDER_DENIED_NOTE : "Tekrar zamanı gelince akşam haber vereyim mi?"}
      </p>
      <div className={styles.actions}>
        {step === "denied" ? (
          <button type="button" className={styles.button} onClick={onClose}>
            Tamam
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.button}
              onClick={handleAccept}
              disabled={step === "pending"}
            >
              Hatırlat
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.quiet}`}
              onClick={onClose}
              disabled={step === "pending"}
            >
              Şimdi değil
            </button>
          </>
        )}
      </div>
    </section>
  );
}
