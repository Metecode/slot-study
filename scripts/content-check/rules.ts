import { evaluateLexical, normalizeTr } from "../../src/domain/evaluate.ts";
import type { Question } from "../../src/domain/question.ts";

import { genericWordsFor } from "./generic.ts";

/* ------------------------------------------------------------------ */
/* Kavram ve alias kuralları                                            */
/*                                                                     */
/* Mesajlar sabit metin: --base karşılaştırması satır satır yapılıyor,   */
/* metin değişirse bütün uyarılar "değişti" görünür.                   */
/* ------------------------------------------------------------------ */

/** Tek kelimelik bir alias bu kadar başka model cevapta geçiyorsa ifadeye çevrilir. */
export const FREQUENT_WORD_LIMIT = 5;

/** Normalize edilmiş model cevap; sıklık ve alt dize taramaları bunun üstünde. */
export type AnswerText = { id: string; text: string };

export function indexAnswers(pool: readonly Question[]): AnswerText[] {
  return pool.map((question) => ({ id: question.id, text: normalizeTr(question.modelAnswer) }));
}

/** Sorunun kavram ve alias uyarıları; boş liste her şeyin yolunda olduğu demek. */
export function conceptWarnings(question: Question, answers: readonly AnswerText[]): string[] {
  const warnings: string[] = [];

  const self = evaluateLexical(question, question.modelAnswer);
  if (self.missing.length > 0) warnings.push(`model cevap tutmuyor: ${self.missing.join(", ")}`);

  const conceptCount = question.keyConcepts.length;
  if (conceptCount < 3 || conceptCount > 5) warnings.push(`${conceptCount} kavram`);

  const context: AliasContext = {
    prompt: normalizeTr(question.prompt),
    generic: genericWordsFor(question.category),
    answers,
    ownerId: question.id,
  };
  for (const concept of question.keyConcepts) {
    const aliasCount = concept.aliases.length;
    if (aliasCount < 2 || aliasCount > 6) warnings.push(`${concept.id}: ${aliasCount} alias`);
    for (const alias of concept.aliases) {
      for (const problem of aliasProblems(alias, context)) warnings.push(`${concept.id}: ${problem}`);
    }
  }
  return warnings;
}

type AliasContext = {
  prompt: string;
  generic: ReadonlySet<string>;
  answers: readonly AnswerText[];
  ownerId: string;
};

function aliasProblems(alias: string, context: AliasContext): string[] {
  const normalized = normalizeTr(alias);
  const problems: string[] = [];

  // 3 harf ve altı başka kelimelerin içinde kaçınılmaz olarak geçer ("id" → "video"); harfsizler ("::") serbest
  if (/^(?=.*[a-z])[a-z0-9]{1,3}$/.test(normalized)) problems.push(`kısa alias "${alias}"`);
  // Soruda geçen terim cevapta da geçer; kavramı bilmeden kazanılır
  if (context.prompt.includes(normalized)) problems.push(`alias soruda geçiyor "${alias}"`);
  if (context.generic.has(normalized)) problems.push(`genel alias "${alias}"`);
  // Noktalama silinmiyor: "@Transactional" alias'ı "@" yazmayan cevabı kaçırır
  if (alias.includes("@")) problems.push(`@ içeren alias "${alias}"`);
  if (/[A-ZÇĞİÖŞÜ]/.test(alias)) problems.push(`büyük harfli alias "${alias}"`);

  if (!/\s/.test(normalized)) {
    const others = context.answers.filter((answer) => answer.id !== context.ownerId && answer.text.includes(normalized));
    if (others.length >= FREQUENT_WORD_LIMIT) problems.push(`sık tek kelime "${alias}" (${others.length} başka cevap)`);
  }
  return problems;
}
