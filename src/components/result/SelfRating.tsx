import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { haptics } from "../../platform/haptics";
import { ratingSavedLabel, reviewWhenLabel } from "../../domain/leitner";
import type { Box, SelfRating as Rating } from "../../domain/progress";
import { RatingIcon } from "./RatingIcon";
import styles from "./SelfRating.module.css";

/* ------------------------------------------------------------------ */
/* Öz-değerlendirme — kutuyu bu belirler, skor değil                   */
/* ------------------------------------------------------------------ */

/**
 * En iyiden en kötüye: kullanıcı önce kendine güvendiği seçeneği görsün.
 * Kısayol tuşu görsel sırayla aynı: soldaki (dar ekranda üstteki) 1.
 */
const RATINGS: ReadonlyArray<{ rating: Rating; label: string; shortcut: string }> = [
  { rating: 2, label: "Biliyordum", shortcut: "1" },
  { rating: 1, label: "Kısmen", shortcut: "2" },
  { rating: 0, label: "Bilmiyordum", shortcut: "3" },
];

/**
 * Seçimden sonra kolun çekilmesine kadar geçen süre. Seçili durum ve
 * "Kaydedildi" satırı bu arada görünür; kullanıcı neye bastığını ve
 * sonucunu okumadan ekran değişmesin.
 */
const CHOICE_HOLD_MS = 400;

/**
 * Kısayollar yazı alanındayken çalışmaz: cevabın içine "1" yazan
 * kullanıcı soruyu değerlendirmiş olmasın.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement
  );
}

export type SelfRatingProps = {
  /** Sorunun şu anki kutusu; ilk kez soruluyorsa 1. */
  box: Box;
  /** Şu ana kadarki deneme sayısı; aşamanın yükselip yükselmediği buna bağlı. */
  attemptCount: number;
  passed: boolean;
  onRate: (rating: Rating) => void;
  className: string;
  style: CSSProperties;
};

export function SelfRating({
  box,
  attemptCount,
  passed,
  onRate,
  className,
  style,
}: SelfRatingProps) {
  /*
    Başlık id'si useId ile üretilir, sabit yazılmaz: sahne geçişi sırasında
    çıkan ve giren panel bir an birlikte DOM'da duruyor (bkz. Stage.tsx) ve
    sabit id o anda iki kez geçiyordu. Yinelenen id'de aria-labelledby'nin
    hangi başlığı gösterdiği belirsiz.
  */
  const titleId = useId();

  const reduced = usePrefersReducedMotion();
  const [chosen, setChosen] = useState<Rating | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tur kapanınca bileşen sökülüyor; bekleyen sayaç kalmasın.
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function handleChoose(rating: Rating) {
    // İkinci tıklama ya da tuş ilk seçimin kaydını ikiye katlamasın.
    if (chosen !== null) return;
    setChosen(rating);
    // Dokunulduğu anda, 400 ms beklemeden: kayıt alındı. Üç seçenekte aynı;
    // "Bilmiyordum"a farklı titreşim dürüst cevabı cezalandırırdı.
    haptics.rated();

    if (reduced) {
      onRate(rating);
      return;
    }
    timerRef.current = setTimeout(() => onRate(rating), CHOICE_HOLD_MS);
  }

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    const match = RATINGS.find((item) => item.shortcut === event.key);
    if (!match) return;
    event.preventDefault();
    handleChoose(match.rating);
  });

  /*
    Dinleyici pencerede: tur açıldığında odak panelin kendisinde duruyor
    (bkz. ResultPanel), düğmelerde değil. Seçim yapılınca söküyoruz.
  */
  useEffect(() => {
    if (chosen !== null) return;
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [chosen]);

  return (
    <section className={className} style={style} aria-labelledby={titleId}>
      <h3 className={styles.title} id={titleId}>
        Bu soruyu ne kadar biliyordun?
      </h3>
      <p className={styles.note}>Seçimine göre soru tekrar karşına çıkar.</p>

      <div className={styles.ratingButtons}>
        {RATINGS.map(({ rating, label, shortcut }) => (
          <button
            key={rating}
            type="button"
            className={styles.ratingButton}
            data-primary={rating === 2}
            data-chosen={chosen === rating}
            aria-keyshortcuts={shortcut}
            disabled={chosen !== null}
            onClick={() => handleChoose(rating)}
          >
            <span className={styles.ratingLabel}>
              <RatingIcon rating={rating} />
              {label}
            </span>
            {/* Yalnızca ne zaman döneceği; aşama değişikliği seçimden sonra. */}
            <span className={styles.ratingInterval}>
              {reviewWhenLabel(box, rating, passed)}
            </span>
            {/* Kısayol aria-keyshortcuts ile duyuruluyor; etiketi ikinci
                kez okutmamak için görsel ipucu ekran okuyucudan gizli. */}
            <kbd className={styles.kbd} aria-hidden="true">
              {shortcut}
            </kbd>
          </button>
        ))}
      </div>

      {/* Yer baştan ayrılı: satır belirince düğmeler ve alttaki kart kaymasın. */}
      <p className={styles.saved} aria-live="polite">
        {chosen !== null && ratingSavedLabel(box, attemptCount, chosen, passed)}
      </p>
    </section>
  );
}
