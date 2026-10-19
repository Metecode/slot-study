import { evaluateLexical, normalizeTr } from "../../src/domain/evaluate.ts";
import type { KeyConcept, Question } from "../../src/domain/question.ts";

/* ------------------------------------------------------------------ */
/* Yarı isabet çiftleri                                                 */
/*                                                                     */
/* `hedef ← diğer`: diğer sorunun model cevabı hedefin kavramlarının en  */
/* az yarısını (ceil(n/2)) tutuyor. Konuyu bilmeyen biri başka bir       */
/* sorunun cevabını yazarak bu soruda yarı puan alabilir demek. Her çift */
/* tek yöndür; `a ← b` ile `b ← a` ayrı sayılır.                        */
/* ------------------------------------------------------------------ */

/** kardeş: aynı kategori ve topic; aynı-kat: farklı topic; başka-kat: farklı kategori. */
export type PairKind = "kardeş" | "aynı-kat" | "başka-kat";

export const PAIR_KINDS: readonly PairKind[] = ["kardeş", "aynı-kat", "başka-kat"];

export type Pair = { target: Question; other: Question; kind: PairKind; hits: string[] };

export function pairKind(target: Question, other: Question): PairKind {
  if (other.category !== target.category) return "başka-kat";
  return other.topic === target.topic ? "kardeş" : "aynı-kat";
}

/** Havuzdaki bütün çiftler, iki yön de; hedefin sırasıyla. */
export function findPairs(pool: readonly Question[]): Pair[] {
  const pairs: Pair[] = [];
  for (const target of pool) {
    const needed = Math.ceil(target.keyConcepts.length / 2);
    for (const other of pool) {
      if (other.id === target.id) continue;
      const { hits } = evaluateLexical(target, other.modelAnswer);
      if (hits.length >= needed) pairs.push({ target, other, kind: pairKind(target, other), hits });
    }
  }
  return pairs;
}

/** Kavramı metinde hangi alias'ın tuttuğu; çiftin gerekçesini yazarken bakılır. */
export function matchingAlias(concept: KeyConcept, normalizedText: string): string | undefined {
  return concept.aliases.find((alias) => normalizedText.includes(normalizeTr(alias)));
}
