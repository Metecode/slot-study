import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseQuestionFile } from "../../src/domain/question.ts";
import type { Question } from "../../src/domain/question.ts";

/* ------------------------------------------------------------------ */
/* Soru havuzu — ölçümler her zaman bütün kategorilerin üstünde yapılır */
/*                                                                     */
/* Bir cevabın değişmesi başka kategorideki bir sorunun alias'larını    */
/* etkileyebilir; bu yüzden havuz tek kategoriye daraltılmaz.          */
/* ------------------------------------------------------------------ */

const CONTENT_PATH = "src/content/tr";

/** Bir dizindeki bütün kategori dosyaları, şemadan geçirilmiş. */
export function loadFromDir(dir: string): Question[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => readQuestions(join(dir, file)));
}

/** Tek bir soru dosyası (kategori dosyası ya da merge-questions kaynağı). */
export function readQuestions(path: string): Question[] {
  return parseQuestionFile(path, JSON.parse(readFileSync(path, "utf8"))).questions;
}

/** Bir git revizyonundaki içerik; çalışma ağacına dokunmadan `git show` ile okunur. */
export function loadFromRevision(repoRoot: string, revision: string): Question[] {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 1e8 });
  return git("ls-tree", "--name-only", revision, `${CONTENT_PATH}/`)
    .split("\n")
    .filter((path) => path.endsWith(".json"))
    .sort()
    .flatMap((path) => {
      const ref = `${revision}:${path}`;
      return parseQuestionFile(ref, JSON.parse(git("show", ref))).questions;
    });
}

/**
 * Düzenlenmiş sorular aynı id'li soruların yerine geçer, yeni id'ler sona
 * eklenir. Diske yazılmaz: değişikliği merge-questions'tan önce denemek için.
 */
export function overlay(pool: readonly Question[], edits: readonly Question[]): Question[] {
  const edited = new Map(edits.map((question) => [question.id, question]));
  const known = new Set(pool.map((question) => question.id));
  return [
    ...pool.map((question) => edited.get(question.id) ?? question),
    ...edits.filter((question) => !known.has(question.id)),
  ];
}
