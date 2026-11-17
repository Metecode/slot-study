import { conceptMatchLevel } from "./conceptMatch";
import { isDue } from "./drawTiers";
import { nextBox } from "./leitner";
import type { QuestionProgress, SelfRating } from "./progress";
import type { Category, Evaluation, Question } from "./question";
import type { SelfEvalProps } from "./usageEvents";

/* ------------------------------------------------------------------ */
/* Kullanım ölçümü — olay alanlarının türetilmesi                      */
/* ------------------------------------------------------------------ */

/*
  Leitner tamamlanma oranı (docs/analytics/queries.sql) iki sayıdan çıkıyor:
  günün ilk app_open'ındaki dueCount ve o gün wasDue=true gelen self_eval
  sayısı. İkisi de çekilişin "zamanı gelmiş" tanımını (drawTiers.isDue)
  kullanır; ayrı bir tanım yazılırsa oran anlamını kaybeder.
*/

type ProgressMap = Readonly<Record<string, QuestionProgress>>;

/**
 * Şu an vadesi gelmiş kart sayısı: içerikte bulunan, seçili kategoride
 * olan ve zamanı gelmiş sorular. Kapatılmış kategorinin kartları
 * çekilişe girmiyor; sayılsalardı tamamlanma oranı yapay olarak düşerdi.
 * İçerikten kalkmış sorunun kaydı da sayılmaz.
 */
export function dueCountOf(
  progress: ProgressMap,
  questions: readonly Question[],
  activeCategories: readonly Category[],
  now: Date,
): number {
  const active = new Set(activeCategories);
  let count = 0;
  for (const question of questions) {
    if (!active.has(question.category)) continue;
    const entry = progress[question.id];
    if (entry !== undefined && isDue(entry, now)) count++;
  }
  return count;
}

/** Seçili kategorilerden içeriği olanların sayısı. */
export function categoryCountOf(
  activeCategories: readonly Category[],
  availableCategories: readonly Category[],
): number {
  const available = new Set(availableCategories);
  return activeCategories.filter((category) => available.has(category)).length;
}

const RESULT_BY_RATING = ["didnt", "partial", "knew"] as const;

export type SelfEvalInput = {
  question: Question;
  /** Değerlendirmeden ÖNCEKİ kayıt; soru ilk kez görülüyorsa undefined. */
  previous: QuestionProgress | undefined;
  /** Pas geçildiyse null. */
  evaluation: Evaluation | null;
  passed: boolean;
  answer: string;
  rating: SelfRating;
  now: Date;
};

/**
 * self_eval olayının alanları.
 *
 * - aliasResult: kullanıcının sonuç ekranında gördüğü seviye
 *   (conceptMatchLevel). Pas geçildiyse ya da cevap boşsa "skipped":
 *   kullanıcı yazmadan değerlendirdi.
 * - result ve box reducer'ın RATE'iyle aynı kuralla: pas geçildiyse
 *   puan "bilmiyordum" sayılır, kutu nextBox'tan gelir.
 * - wasDue: değerlendirme anında soru zamanı gelmiş miydi. İlk kez
 *   görülen soru zamanı gelmiş sayılmaz: tekrar değil, tanıtım.
 */
export function selfEvalPropsOf(input: SelfEvalInput): SelfEvalProps {
  const { question, previous, evaluation, passed, answer, rating, now } = input;
  const effectiveRating: SelfRating = passed ? 0 : rating;

  return {
    questionId: question.id,
    aliasResult: aliasResultOf(question, evaluation, passed, answer),
    result: RESULT_BY_RATING[effectiveRating],
    box: nextBox(previous?.box ?? 1, effectiveRating, passed),
    wasDue: previous !== undefined && isDue(previous, now),
  };
}

function aliasResultOf(
  question: Question,
  evaluation: Evaluation | null,
  passed: boolean,
  answer: string,
): SelfEvalProps["aliasResult"] {
  if (passed || evaluation === null || answer.trim() === "") return "skipped";
  switch (conceptMatchLevel(evaluation.hits.length, question.keyConcepts.length)) {
    case "all":
      return "match";
    case "some":
      return "partial";
    case "none":
      return "none";
  }
}
