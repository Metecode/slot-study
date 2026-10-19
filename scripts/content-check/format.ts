import { parseModelAnswer } from "../../src/domain/modelAnswer.ts";
import type { Question } from "../../src/domain/question.ts";

/* ------------------------------------------------------------------ */
/* Model cevap biçimi                                                   */
/*                                                                     */
/* Tek paragraf, 2–5 cümle; not kutusu, kod bloğu ve madde listesi yok. */
/* Her soruda followUp ve "Kendi derleme — <birincil belge>" source'u.  */
/* ------------------------------------------------------------------ */

export const SOURCE_PREFIX = "Kendi derleme — ";

/** Tek yıldızlı vurgu: parseInline yalnızca **kalın** ve `kod` tanıyor, yıldızlar görünür kalır. */
const ITALIC = /(^|[^*])\*[^*\s][^*]*\*(?!\*)/;

/**
 * Cümle sayısı. Satır içi kod tek kelime sayılır (`a.b()` cümleyi
 * bölmesin); bölme [.!?] ve ardından gelen boşlukta. Bu yüzden kod
 * dışındaki "ör. 500" ya da "..." da cümle böler.
 */
export function sentenceCount(text: string): number {
  return text
    .replace(/`[^`]*`/g, "x")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean).length;
}

/** Sorunun biçim sorunları; boş liste biçimin yeni kurala uyduğu demek. */
export function formatIssues(question: Question): string[] {
  const issues: string[] = [];
  const prose: string[] = [];

  for (const block of parseModelAnswer(question.modelAnswer)) {
    switch (block.kind) {
      case "code":
        issues.push("kod bloğu");
        break;
      case "note":
        // İlk ":" ilk 48 karakterdeyse paragraf not kutusu olarak çizilir (modelAnswer.ts)
        issues.push(`not kutusu: "${block.lead}"`);
        prose.push(`${block.lead}: ${block.body}`);
        break;
      case "text":
        prose.push(block.text);
        break;
    }
  }

  if (prose.length > 1) issues.push(`${prose.length} paragraf`);
  if (/^\s*(?:[-*]|\d+\.)\s/m.test(prose.join("\n"))) issues.push("madde listesi");

  const sentences = sentenceCount(prose.join(" "));
  if (sentences < 2 || sentences > 5) issues.push(`cümle sayısı ${sentences}`);

  // parseInline kalının içini düz metin çizer; backtick'ler görünür kalır
  if (/\*\*`|`\*\*/.test(question.modelAnswer)) issues.push("kalın içinde kod");
  if (ITALIC.test(question.modelAnswer.replace(/`[^`]*`/g, ""))) issues.push("italik (çizilmez)");

  if (!question.followUps?.length) issues.push("followUp yok");
  if (!question.source?.startsWith(SOURCE_PREFIX)) issues.push("source biçimi");
  return issues;
}
