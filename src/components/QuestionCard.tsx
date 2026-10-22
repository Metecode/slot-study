import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { CATEGORY_LABELS } from "../content/labels";
import { evaluateLexical } from "../domain/evaluate";
import { MAX_ANSWER_LENGTH } from "../domain/progress";
import type { QuestionProgress } from "../domain/progress";
import type { Question } from "../domain/question";
import { StageBadge } from "./StageBadge";
import styles from "./QuestionCard.module.css";

/* ------------------------------------------------------------------ */
/* Soru kartı — cevap burada yazılır                                   */
/* ------------------------------------------------------------------ */

const DIFFICULTY_LABELS: Record<Question["difficulty"], string> = {
  1: "Kolay",
  2: "Orta",
  3: "Zor",
};

/**
 * Sınırlayıcı değil, yalnızca gösterge: 1200'ü aşınca sayaç --warn'a döner.
 * Sert sınır MAX_ANSWER_LENGTH, cevap alanının maxLength'inde.
 */
const ANSWER_LENGTH_WARN_AT = 1200;

export type QuestionCardProps = {
  question: Question;
  /** Sorunun kayıtlı ilerlemesi; ilk kez soruluyorsa null. */
  progress: QuestionProgress | null;
  onSubmit: (answer: string) => void;
  onPass: () => void;
};

/**
 * Cevap metni bileşenin kendi state'inde durur. Soru değişince temizlenmesi
 * çağıran tarafın işi: key={question.id} verilir, bileşen yeniden kurulur.
 */
export function QuestionCard({ question, progress, onSubmit, onPass }: QuestionCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [answer, setAnswer] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const box = progress?.box ?? 1;
  const attempts = progress?.attempts.length ?? 0;

  // İpucu her render'da tazelenir: kullanıcı yazdıkça sıradaki eksik
  // kavrama kayar, aynı ipucunda takılı kalmaz.
  const { missing } = evaluateLexical(question, answer);
  const nextMissing = question.keyConcepts.find((concept) => missing.includes(concept.id));

  /*
    Tur ilerleyince odak, ekrana yeni gelen bölüme taşınır. Kol dönüş
    boyunca disabled olduğu için odak gövdeye düşüyordu: klavyedeki
    kullanıcı her çevirişten sonra cevap alanına ulaşmak için sayfanın
    başından Tab'lamak zorunda kalıyordu.

    Odaklanan, ilk alan değil bölümün kendisi (tabIndex -1): ekran
    okuyucu önce soruyu okur, sonraki Tab yazı alanına girer — ve
    dokunmatik cihazda klavye kendiliğinden açılmaz.

    preventScroll: fareyle çalışan kullanıcı için sayfa kendiliğinden
    kaymasın; odak zaten görünür alanın içinde.
  */
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    // Varsayılan davranış satır başı ekler, gönderdikten sonra gereksiz.
    event.preventDefault();
    onSubmit(answer);
  }

  return (
    <section ref={cardRef} className={styles.card} tabIndex={-1}>
      {/* Aşama rozeti kutuyu, tekrar sıklığını ve "ilk kez"i tek başına
          anlatıyor; ayrı rozetleri kalktı. Kategori ve konunun tam adı da
          burada: makara ekran okuyucudan gizli ve büyük yazıda tambur
          etiketi kesilebiliyor. Sıra sonuç paneliyle aynı. */}
      <div className={styles.meta}>
        <StageBadge box={box} attemptCount={attempts} />
        <span className={styles.metaBadge}>{CATEGORY_LABELS[question.category]}</span>
        <span className={styles.metaBadge}>{DIFFICULTY_LABELS[question.difficulty]}</span>
        <span className={styles.metaBadge}>{question.topic}</span>
      </div>

      <h2 className={styles.question}>{question.prompt}</h2>

      <div className={styles.answerWrap}>
        <textarea
          className={styles.answer}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_ANSWER_LENGTH}
          placeholder="Cevabını yaz…"
          aria-label="Cevabın"
        />
        <span
          className={
            answer.length > ANSWER_LENGTH_WARN_AT
              ? `${styles.charCount} ${styles.charCountOver}`
              : styles.charCount
          }
        >
          {answer.length} / {ANSWER_LENGTH_WARN_AT}
        </span>
      </div>

      {hintVisible && (
        <p className={styles.hint} aria-live="polite">
          {nextMissing
            ? nextMissing.label
            : "Aranan kavramların hepsi cevabında geçiyor."}
        </p>
      )}

      <div className={styles.actions}>
        {/* Boş cevap da gönderilebilir: kullanıcı gerçekten bilmiyor olabilir,
            sonuç paneli zaten 0/5 diyecek. */}
        <button type="button" className={styles.primary} onClick={() => onSubmit(answer)}>
          Gönder
        </button>
        <button
          type="button"
          className={styles.secondary}
          aria-expanded={hintVisible}
          onClick={() => setHintVisible((visible) => !visible)}
        >
          İpucu
        </button>
        <button type="button" className={styles.tertiary} onClick={onPass}>
          Pas geç
        </button>
      </div>
    </section>
  );
}
