import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import { evaluateLexical } from "../../src/domain/evaluate.ts";
import type { Question } from "../../src/domain/question.ts";

/* ------------------------------------------------------------------ */
/* Doğal cevap denemesi                                                 */
/*                                                                     */
/* Model cevabın kendi kavramlarını tutması yetmez: alias'lar model      */
/* cevaptan bağımsız yazılmış kısa, gündelik bir mülakat cevabını da     */
/* tutmalı. Set probes/<kategori>.json dosyalarında, soru id → cevap.    */
/* ------------------------------------------------------------------ */

const probeFileSchema = z.record(z.string(), z.string().min(1));

export type ProbeResult = { question: Question; hits: string[]; missing: string[] };

/** Bütün set dosyaları tek haritada; bir id iki dosyada olamaz. */
export function loadProbeAnswers(dir: string): Map<string, string> {
  const answers = new Map<string, string>();
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    const parsed = probeFileSchema.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")));
    if (!parsed.success) throw new Error(`${file}: { "soru-id": "cevap" } biçiminde olmalı`);
    for (const [id, text] of Object.entries(parsed.data)) {
      if (answers.has(id)) throw new Error(`${file}: ${id} başka bir set dosyasında da var`);
      answers.set(id, text);
    }
  }
  return answers;
}

/** Havuzda olmayan id'ler ayrı döner: soru silinmiş ya da yeniden adlandırılmış olabilir. */
export function scoreProbes(
  pool: readonly Question[],
  answers: ReadonlyMap<string, string>,
): { results: ProbeResult[]; unknownIds: string[] } {
  const byId = new Map(pool.map((question) => [question.id, question]));
  const results: ProbeResult[] = [];
  const unknownIds: string[] = [];
  for (const [id, text] of answers) {
    const question = byId.get(id);
    if (!question) {
      unknownIds.push(id);
      continue;
    }
    const { hits, missing } = evaluateLexical(question, text);
    results.push({ question, hits, missing });
  }
  return { results, unknownIds };
}
