/* ------------------------------------------------------------------ */
/* Soru birleştirme — bir kaynak dosyadaki soruları içeriğe ekler        */
/*                                                                     */
/*   npm run merge-questions -- <kaynak.json> [--replace]              */
/*                                                                     */
/* Hedef: src/content/<lang>/content-<category>.json (kaynaktan).       */
/* Id çakışmasında hiçbir şey yazılmaz; --replace hedefteki çakışanları */
/* kaynaktakiyle değiştirir. Hedefte olup kaynakta olmayan soru asla    */
/* silinmez. Kurallar: scripts/merge-questions/plan.ts ve run.ts.        */
/* ------------------------------------------------------------------ */

import { relative } from "node:path";
import { fileURLToPath } from "node:url";

import { mergeQuestions } from "./merge-questions/run.ts";
import type { MergeOutcome } from "./merge-questions/run.ts";

const CONTENT_DIR = fileURLToPath(new URL("../src/content", import.meta.url));

function main(argv: string[]): number {
  const replace = argv.includes("--replace");
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const unknownFlags = argv.filter((arg) => arg.startsWith("--") && arg !== "--replace");

  if (positional.length !== 1 || unknownFlags.length > 0) {
    console.error("Kullanım: npm run merge-questions -- <kaynak.json> [--replace]");
    return 2;
  }

  const outcome = mergeQuestions({ sourcePath: positional[0], contentDir: CONTENT_DIR, replace });
  report(outcome);
  return outcome.status === "merged" ? 0 : 1;
}

function report(outcome: MergeOutcome): void {
  switch (outcome.status) {
    case "invalid-source":
      console.error("Kaynak dosya geçersiz, hiçbir şey yazılmadı:");
      for (const error of outcome.errors) console.error(`  - ${error}`);
      return;

    case "invalid-target":
      console.error(`Hedef dosya geçersiz (${display(outcome.targetPath)}), hiçbir şey yazılmadı:`);
      for (const error of outcome.errors) console.error(`  - ${error}`);
      return;

    case "conflict":
      console.error("Id çakışması, hiçbir şey yazılmadı.");
      if (outcome.targetConflicts.length > 0) {
        console.error(`Hedefte zaten var (${display(outcome.targetPath)}) — değiştirmek için --replace:`);
        for (const id of outcome.targetConflicts) console.error(`  - ${id}`);
      }
      if (outcome.otherFileConflicts.length > 0) {
        console.error("Başka kategori dosyasında var (--replace bunları çözmez):");
        for (const { id, file } of outcome.otherFileConflicts) console.error(`  - ${id}  (${file})`);
      }
      return;

    case "merged":
      if (outcome.created) console.log(`Yeni dosya: ${display(outcome.targetPath)}`);
      console.log(`${outcome.added.length} eklendi, ${outcome.replaced.length} değiştirildi, toplam ${outcome.total}`);
      if (outcome.replaced.length > 0) {
        console.log("Değiştirilen (çakışan) id'ler:");
        for (const id of outcome.replaced) console.log(`  - ${id}`);
      }
      return;
  }
}

function display(path: string): string {
  return relative(process.cwd(), path);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
