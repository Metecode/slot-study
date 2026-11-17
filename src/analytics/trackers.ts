import { AVAILABLE_CATEGORIES } from "../content";
import { MAX_ANSWER_LENGTH } from "../domain/progress";
import type { Category, Question } from "../domain/question";
import { categoryCountOf, selfEvalPropsOf } from "../domain/usageMetrics";
import type { SelfEvalInput } from "../domain/usageMetrics";
import { analytics } from "./analytics";

/* ------------------------------------------------------------------ */
/* Oturumdaki olaylar — App'in çağırdığı tek satırlar                   */
/* ------------------------------------------------------------------ */

/*
  Alanların nasıl türetildiği domain/usageMetrics.ts'te (saf, testli);
  burası yalnızca onları istemciye iletir. Hiçbiri hata fırlatmaz.
*/

/** Gerçekten başlayan bir dönüşte (reducer çekilişi reddettiyse çağrılmaz). */
export function trackSpin(activeCategories: readonly Category[]): void {
  analytics.track({
    name: "spin",
    props: { categoryCount: categoryCountOf(activeCategories, AVAILABLE_CATEGORIES) },
  });
}

/** Cevap METNİ gitmez, yalnızca uzunluğu. */
export function trackAnswerSubmitted(question: Question, answer: string): void {
  analytics.track({
    name: "answer_submitted",
    props: { questionId: question.id, answerLength: Math.min(answer.length, MAX_ANSWER_LENGTH) },
  });
}

/** Değerlendirme reducer'a gitmeden önce: önceki kutu ve kart o an hâlâ elde. */
export function trackSelfEval(input: SelfEvalInput): void {
  try {
    analytics.track({ name: "self_eval", props: selfEvalPropsOf(input) });
  } catch {
    // Ölçüm uygulamayı bozmaz.
  }
}
