import type { Snapshot } from "./analyze.ts";
import type { CategoryFilter } from "./lines.ts";

/* ------------------------------------------------------------------ */
/* --base karşılaştırması                                               */
/*                                                                     */
/* Sayılar aynı kalırken içerik değişebiliyor: bir çift kalkıp başka    */
/* bir çift gelince kategori sayısı yerinde durur. Bu yüzden ölçümler    */
/* satır satır, küme olarak karşılaştırılır.                            */
/* ------------------------------------------------------------------ */

export type LineDiff = { removed: string[]; added: string[] };

export function diffLines(before: readonly string[], after: readonly string[]): LineDiff {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    removed: [...beforeSet].filter((line) => !afterSet.has(line)).sort(),
    added: [...afterSet].filter((line) => !beforeSet.has(line)).sort(),
  };
}

export type ProbeChange = { id: string; before: string; after: string; dropped: boolean };

/** Doğal cevabı tutulan kavram sayısı değişen sorular; tabanda olmayan sorular atlanır. */
export function probeChanges(base: Snapshot, current: Snapshot, filter: CategoryFilter): ProbeChange[] {
  const baseById = new Map(base.probes.map((result) => [result.question.id, result]));
  const changes: ProbeChange[] = [];
  for (const result of current.probes) {
    if (filter && !filter.has(result.question.category)) continue;
    const previous = baseById.get(result.question.id);
    if (!previous || previous.hits.length === result.hits.length) continue;
    changes.push({
      id: result.question.id,
      before: `${previous.hits.length}/${previous.question.keyConcepts.length}`,
      after: `${result.hits.length}/${result.question.keyConcepts.length}`,
      dropped: result.hits.length < previous.hits.length,
    });
  }
  return changes;
}
