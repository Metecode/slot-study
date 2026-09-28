import type { Phase } from "../domain/session";
import styles from "./StepIndicator.module.css";

/* ------------------------------------------------------------------ */
/* Adım göstergesi — turun neresindeyiz                                */
/* ------------------------------------------------------------------ */

/**
 * `short` dar ekranda görünen etiket: numarasız ve kısa. Ekran okuyucu
 * her genişlikte numaralı tam etiketi okur.
 */
const STEPS: readonly { label: string; short: string }[] = [
  { label: "1. Soru", short: "Soru" },
  { label: "2. Yanıt", short: "Yanıt" },
  { label: "3. Değerlendirme", short: "Kontrol" },
];

/**
 * Faz → adım. Makara dönerken de "Soru" adımındayız: kazanan henüz
 * ekrana gelmedi, kullanıcı hâlâ soruyu bekliyor.
 */
function stepOfPhase(phase: Phase): number {
  switch (phase) {
    case "answering":
      return 1;
    case "evaluated":
      return 2;
    default:
      return 0;
  }
}

export type StepIndicatorProps = {
  phase: Phase;
};

export function StepIndicator({ phase }: StepIndicatorProps) {
  const active = stepOfPhase(phase);

  return (
    <nav className={styles.bar} aria-label="Tur adımları">
      {/*
        Kayan gösterge ayrı bir katman: adım değişince `--step` değişiyor,
        işaretçi transform ile bir adımdan diğerine kayıyor. Adım
        düğmelerinin arka planını animasyona sokmak (her birinde ayrı
        geçiş) aynı etkiyi vermiyor, anında atlıyordu.
      */}
      <div className={styles.track} style={{ "--step": active } as React.CSSProperties}>
        <span className={styles.marker} aria-hidden="true" />
        <ol className={styles.steps}>
          {STEPS.map(({ label, short }, index) => (
            <li
              key={label}
              className={styles.step}
              /* geçmiş / şimdi / gelecek — renk farkı buradan sürülüyor */
              data-state={index === active ? "active" : index < active ? "done" : "next"}
              aria-current={index === active ? "step" : undefined}
            >
              <span className={styles.full}>{label}</span>
              <span className={styles.short} aria-hidden="true">
                {short}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
