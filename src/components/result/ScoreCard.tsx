import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";

import { useCountUp } from "../../hooks/useCountUp";
import { conceptMatchLevel } from "../../domain/conceptMatch";
import type { Evaluation, Question } from "../../domain/question";
import { CheckIcon, DashIcon } from "./icons";
import styles from "./ScoreCard.module.css";

/* ------------------------------------------------------------------ */
/* Skor ve kavram eşleşmesi                                            */
/*                                                                     */
/* Çalışan katman kelime (alias) eşleşmesi; semantik değerlendirme      */
/* projeden çıkarıldı. Başlık bu yüzden "Kavram eşleşmesi".            */
/* ------------------------------------------------------------------ */

/** Kesme işaretinden sonraki iyelik eki, sayının okunuşunun son ünlüsüne göre. */
function possessiveSuffix(n: number): string {
  // Sıfır buraya gelmez; birler basamağı yoksa onlar basamağı okunur.
  const lastDigit = n % 10;
  if (lastDigit === 0) {
    const tens = Math.floor(n / 10) % 10;
    return ["", "u", "si", "u", "ı", "si", "ı", "i", "i", "ı"][tens] || "ü";
  }
  return ["", "i", "si", "ü", "ü", "i", "sı", "si", "i", "u"][lastDigit];
}

/** Çubuğun ekran okuyucu etiketi: "3 kavramdan 2'si". Sıfırda "0'ı" yerine "hiçbiri". */
function barLabel(hitCount: number, total: number): string {
  if (hitCount === 0) return `${total} kavramdan hiçbiri`;
  return `${total} kavramdan ${hitCount}'${possessiveSuffix(hitCount)}`;
}

/*
  Asimetrik dil: yakalanan kavram ödüllendirilir, sıfır cezalandırılmaz.
  Eşleşme kelime bazlı; doğru cevabı başka kelimelerle yazan kullanıcıyı
  da sıfır gösterebilir. Bu yüzden sıfırda suç cevaba değil eşleşmeye
  yüklenir ve kullanıcı öz-değerlendirmeye yönlendirilir.
*/
function scoreCaption(
  hitCount: number,
  total: number,
  answerEmpty: boolean,
): string {
  // Seviye kullanım ölçümüyle ortak (aliasResult): bkz. domain/conceptMatch.ts.
  const level = conceptMatchLevel(hitCount, total);
  if (level === "all") return "Tüm kavramlar cevabında geçiyor.";
  if (level === "some") {
    return `${total} kavramdan ${hitCount}'${possessiveSuffix(hitCount)} cevabında geçiyor.`;
  }
  if (answerEmpty) return `${total} kavramdan hiçbiri cevabında geçmedi.`;
  return (
    "Kelime eşleşmesi kavramları bulamadı. Farklı kelimelerle anlattıysan " +
    "kaçırmış olabilir — kendini aşağıdan değerlendir."
  );
}

export type ScoreCardProps = {
  question: Question;
  /** null ise soru pas geçilmiş demektir. */
  evaluation: Evaluation | null;
  /** Kullanıcının yazdığı cevap; boşsa sıfır skorda eski metin kalır. */
  answer: string;
  className: string;
  style: CSSProperties;
  /** Çiplerin altına gelen ikincil eylem (ör. "Kendi yapay zekâna sor"). */
  children?: ReactNode;
};

export function ScoreCard({
  question,
  evaluation,
  answer,
  className,
  style,
  children,
}: ScoreCardProps) {
  /*
    Başlık id'si useId ile üretilir, sabit yazılmaz: sahne geçişi sırasında
    çıkan ve giren panel bir an birlikte DOM'da duruyor (bkz. Stage.tsx) ve
    sabit id o anda iki kez geçiyordu. Yinelenen id'de aria-labelledby'nin
    hangi başlığı gösterdiği belirsiz.
  */
  const titleId = useId();

  const passed = evaluation === null;
  const hits = evaluation?.hits ?? [];
  const total = question.keyConcepts.length;

  // Pas geçilen soruda sayılacak bir şey yok; sayaç 0'da kalır.
  const shown = useCountUp(passed ? 0 : hits.length);
  // Rakam sayaç hedefe varınca yeşile döner; kısmi ve sıfır nötr kalır.
  const complete =
    !passed && total > 0 && hits.length === total && shown === total;

  return (
    <section className={className} style={style} aria-labelledby={titleId}>
      <h3 className={styles.hidden} id={titleId}>
        Kavram eşleşmesi
      </h3>

      <div className={styles.score}>
        {/* aria-live yok: panel zaten yeni geliyor, okuyucu baştan okuyor.
            Sayarken her ara değeri duyurmak gürültü olurdu. */}
        <span
          className={
            complete
              ? `${styles.scoreValue} ${styles.scoreComplete}`
              : styles.scoreValue
          }
        >
          {passed ? "—" : shown}
          {!passed && <span className={styles.scoreTotal}>/{total}</span>}
        </span>
        <span className={styles.scoreCaption}>
          {passed
            ? "Pas geçtin, soru kutu 1'e düştü."
            : scoreCaption(hits.length, total, answer.trim() === "")}
        </span>
      </div>

      {!passed && total > 0 && (
        <ConceptBar hitCount={hits.length} total={total} />
      )}

      <p className={styles.conceptsLabel}>KAVRAM EŞLEŞMESİ</p>

      <ul className={styles.chips}>
        {question.keyConcepts.map((concept, index) => {
          const hit = hits.includes(concept.id);
          return (
            <li
              key={concept.id}
              className={`${styles.chip} ${hit ? styles.chipHit : styles.chipMiss}`}
              /* --i: çipler 40ms arayla sırayla belirir */
              style={{ "--i": index } as CSSProperties}
            >
              {hit ? (
                <CheckIcon className={styles.chipIcon} />
              ) : (
                <DashIcon className={styles.chipIcon} />
              )}
              {concept.label}
              {/* Geliştirme aracı: ham skor ve yem havuzu baseline'ı (B).
                  Üretimde derlenmez. */}
              {import.meta.env.DEV &&
                evaluation?.scores?.[concept.id] !== undefined && (
                  <span className={styles.chipScore}>
                    {evaluation.scores[concept.id].toFixed(2)}
                    {evaluation.baseline !== undefined &&
                      ` (B ${evaluation.baseline.toFixed(2)})`}
                  </span>
                )}
            </li>
          );
        })}
      </ul>

      {children}
    </section>
  );
}

/**
 * Kavram sayısı kadar bölme; yakalananlar soldan dolar. Aşama rozetindeki
 * noktalarla aynı dil. Renk tek başına bilgi taşımaz: rakam ve metin
 * her durumda yanında, çubuğun kendi etiketi de var.
 */
function ConceptBar({ hitCount, total }: { hitCount: number; total: number }) {
  return (
    <span
      className={styles.bar}
      role="img"
      aria-label={barLabel(hitCount, total)}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            i < hitCount
              ? `${styles.segment} ${styles.segmentFilled}`
              : styles.segment
          }
          /* --i: bölmeler 40ms arayla sırayla dolar */
          style={{ "--i": i } as CSSProperties}
        />
      ))}
    </span>
  );
}
