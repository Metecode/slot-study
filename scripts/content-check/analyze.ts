import { CATEGORIES } from "../../src/domain/question.ts";
import type { Category, Question } from "../../src/domain/question.ts";

import { formatIssues } from "./format.ts";
import { findPairs } from "./pairs.ts";
import type { Pair, PairKind } from "./pairs.ts";
import { scoreProbes } from "./probes.ts";
import type { ProbeResult } from "./probes.ts";
import { conceptWarnings, indexAnswers } from "./rules.ts";
import { findSubstringTraps } from "./substrings.ts";
import type { SubstringTrap } from "./substrings.ts";

/* ------------------------------------------------------------------ */
/* Bir soru havuzunun bütün ölçümleri                                   */
/*                                                                     */
/* Rapor ve --base karşılaştırması aynı Snapshot'ın üstünde çalışır.    */
/* ------------------------------------------------------------------ */

export type QuestionNotes = { question: Question; warnings: string[]; format: string[] };

export type Snapshot = {
  notes: QuestionNotes[];
  pairs: Pair[];
  traps: SubstringTrap[];
  probes: ProbeResult[];
  /** Doğal cevap setinde olup havuzda olmayan id'ler. */
  unknownProbeIds: string[];
};

export function analyze(
  pool: readonly Question[],
  probeAnswers: ReadonlyMap<string, string>,
  includePrefix: boolean,
): Snapshot {
  const answers = indexAnswers(pool);
  const { results, unknownIds } = scoreProbes(pool, probeAnswers);
  return {
    notes: pool.map((question) => ({
      question,
      warnings: conceptWarnings(question, answers),
      format: formatIssues(question),
    })),
    pairs: findPairs(pool),
    traps: pool.flatMap((question) => findSubstringTraps(question, answers, includePrefix)),
    probes: results,
    unknownProbeIds: unknownIds,
  };
}

export type CategorySummary = {
  category: Category;
  questions: number;
  /** Hedefi bu kategoride olan çiftler; diğer soru hangi kategoriden olursa olsun. */
  pairs: Record<PairKind, number>;
  warnings: number;
  formatIssues: number;
  /** Kelime ortasında eşleşen alias sayısı (önek eşleşmeleri sayılmaz). */
  traps: number;
  /** Kategorinin doğal cevap seti yoksa tanımsız. */
  probe: { hits: number; total: number } | undefined;
};

/** Kategori başına sayılar, seçicideki kategori sırasıyla. */
export function summarize(snapshot: Snapshot): CategorySummary[] {
  const present = new Set(snapshot.notes.map((note) => note.question.category));
  return CATEGORIES.filter((category) => present.has(category)).map((category) => {
    const notes = snapshot.notes.filter((note) => note.question.category === category);

    const pairs: Record<PairKind, number> = { "kardeş": 0, "aynı-kat": 0, "başka-kat": 0 };
    for (const pair of snapshot.pairs) if (pair.target.category === category) pairs[pair.kind]++;

    const probes = snapshot.probes.filter((result) => result.question.category === category);
    const probe = probes.length === 0 ? undefined : {
      hits: probes.reduce((sum, result) => sum + result.hits.length, 0),
      total: probes.reduce((sum, result) => sum + result.question.keyConcepts.length, 0),
    };

    return {
      category,
      questions: notes.length,
      pairs,
      warnings: notes.reduce((sum, note) => sum + note.warnings.length, 0),
      formatIssues: notes.reduce((sum, note) => sum + note.format.length, 0),
      traps: snapshot.traps.filter((trap) => trap.category === category && trap.inside.length > 0).length,
      probe,
    };
  });
}
