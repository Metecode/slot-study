import { normalizeTr } from "../../src/domain/evaluate.ts";
import type { Category, Question } from "../../src/domain/question.ts";

import type { AnswerText } from "./rules.ts";

/* ------------------------------------------------------------------ */
/* Alt dize tuzakları                                                   */
/*                                                                     */
/* Eşleşme düz `includes`: alias başka bir cevapta bir kelimenin         */
/* ortasında geçerse ("slim" → "teslim", "reload" → "preload") o kavramı */
/* bedavaya kazandırır. Kelime başından eşleşip uzayanlar (önek:          */
/* "window" → "windows") çoğu zaman Türkçe ektir; yalnızca istenince     */
/* listelenir ve elle bakılır.                                          */
/* ------------------------------------------------------------------ */

/** Alias'ı içinde taşıyan kelime ve kaç farklı cevapta geçtiği. */
export type WordHit = { word: string; answers: number };

export type SubstringTrap = {
  category: Category;
  questionId: string;
  conceptId: string;
  alias: string;
  /** Alias'ın kelimenin ortasından başladığı eşleşmeler: kesin tuzak. */
  inside: WordHit[];
  /** Kelime başından eşleşip uzayanlar; yalnızca includePrefix ile dolar. */
  prefix: WordHit[];
};

const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function findSubstringTraps(
  question: Question,
  answers: readonly AnswerText[],
  includePrefix: boolean,
): SubstringTrap[] {
  const traps: SubstringTrap[] = [];
  for (const concept of question.keyConcepts) {
    for (const alias of concept.aliases) {
      const { inside, prefix } = scanAlias(normalizeTr(alias), question.id, answers);
      if (inside.length === 0 && !(includePrefix && prefix.length > 0)) continue;
      traps.push({
        category: question.category,
        questionId: question.id,
        conceptId: concept.id,
        alias,
        inside,
        prefix: includePrefix ? prefix : [],
      });
    }
  }
  return traps;
}

function scanAlias(alias: string, ownerId: string, answers: readonly AnswerText[]) {
  const inside = new Map<string, Set<string>>();
  const prefix = new Map<string, Set<string>>();
  if (!alias) return { inside: [], prefix: [] };

  for (const { id, text } of answers) {
    if (id === ownerId) continue;
    for (let at = text.indexOf(alias); at >= 0; at = text.indexOf(alias, at + 1)) {
      let start = at;
      while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
      let end = at + alias.length;
      while (end < text.length && WORD_CHAR.test(text[end])) end++;

      // Alias noktalamayla başlıyorsa ("-slim") kelime ortası sayılmaz
      const startsMidWord = start < at && WORD_CHAR.test(alias[0]);
      const extendsWord = !startsMidWord && end > at + alias.length && WORD_CHAR.test(alias[alias.length - 1]);
      const bucket = startsMidWord ? inside : extendsWord ? prefix : undefined;
      if (!bucket) continue;

      const word = text.slice(start, end);
      bucket.set(word, (bucket.get(word) ?? new Set<string>()).add(id));
    }
  }
  return { inside: rank(inside), prefix: rank(prefix) };
}

function rank(words: Map<string, Set<string>>): WordHit[] {
  return [...words]
    .map(([word, ids]) => ({ word, answers: ids.size }))
    .sort((a, b) => b.answers - a.answers);
}
