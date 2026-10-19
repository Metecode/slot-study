import { normalizeTr } from "../../src/domain/evaluate.ts";
import type { Category } from "../../src/domain/question.ts";

import type { Snapshot } from "./analyze.ts";
import { matchingAlias } from "./pairs.ts";
import type { Pair } from "./pairs.ts";
import type { WordHit } from "./substrings.ts";

/* ------------------------------------------------------------------ */
/* Ölçümlerin satır hali                                                */
/*                                                                     */
/* Rapor bu satırları yazdırır, --base karşılaştırması bunları küme     */
/* olarak karşılaştırır. Satırda sıraya bağlı bir şey olmamalı.         */
/* ------------------------------------------------------------------ */

/** Ayrıntının gösterileceği kategoriler; tanımsızsa hepsi. */
export type CategoryFilter = ReadonlySet<Category> | undefined;

const shown = (filter: CategoryFilter, category: Category) => !filter || filter.has(category);

export function warningLines(snapshot: Snapshot, filter: CategoryFilter): string[] {
  return snapshot.notes
    .filter((note) => shown(filter, note.question.category))
    .flatMap((note) => note.warnings.map((warning) => `${note.question.id}: ${warning}`));
}

export function formatLines(snapshot: Snapshot, filter: CategoryFilter): string[] {
  return snapshot.notes
    .filter((note) => shown(filter, note.question.category))
    .flatMap((note) => note.format.map((issue) => `${note.question.id}: ${issue}`));
}

/** Çift, hedefin kategorisinde gösterilir. withAliases: her kavramı hangi alias'ın tuttuğu. */
export function pairLines(snapshot: Snapshot, filter: CategoryFilter, withAliases: boolean): string[] {
  return snapshot.pairs
    .filter((pair) => shown(filter, pair.target.category))
    .map((pair) => describePair(pair, withAliases));
}

function describePair(pair: Pair, withAliases: boolean): string {
  const { target, other, kind, hits } = pair;
  const text = normalizeTr(other.modelAnswer);
  const concepts = hits.map((id) => {
    const concept = target.keyConcepts.find((candidate) => candidate.id === id);
    const alias = withAliases && concept ? matchingAlias(concept, text) : undefined;
    return alias ? `${id}="${alias}"` : id;
  });
  return `${target.id} [${target.topic}] ← ${other.id} [${kind}] ${hits.length}/${target.keyConcepts.length} (${concepts.join(" + ")})`;
}

/** En sık 8 kelime; tuzağı tanımaya yeter. */
export function trapLines(snapshot: Snapshot, filter: CategoryFilter): string[] {
  const words = (hits: WordHit[]) => hits.slice(0, 8).map((hit) => `${hit.word}×${hit.answers}`).join(", ");
  return snapshot.traps
    .filter((trap) => shown(filter, trap.category))
    .map((trap) => {
      const inside = trap.inside.length > 0 ? `  kelime ortasında: ${words(trap.inside)}` : "";
      const prefix = trap.prefix.length > 0 ? `  önek: ${words(trap.prefix)}` : "";
      return `${trap.questionId}/${trap.conceptId} "${trap.alias}"${inside}${prefix}`;
    });
}

export function probeMissLines(snapshot: Snapshot, filter: CategoryFilter): string[] {
  return snapshot.probes
    .filter((result) => shown(filter, result.question.category) && result.missing.length > 0)
    .map((result) => `${result.question.id}: ${result.hits.length}/${result.question.keyConcepts.length}  kaçan: ${result.missing.join(", ")}`);
}
