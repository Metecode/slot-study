import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { planMerge, validateQuestionFile } from "./plan.ts";
import type { RawQuestionFile } from "./plan.ts";

/* ------------------------------------------------------------------ */
/* Birleştirmenin dosya tarafı: oku, karar ver (plan.ts), doğrula, yaz. */
/* Herhangi bir adım durursa hiçbir dosyaya dokunulmaz.                 */
/* ------------------------------------------------------------------ */

export type MergeOptions = {
  sourcePath: string;
  /** src/content — altında <lang>/content-<category>.json dosyaları. */
  contentDir: string;
  replace: boolean;
};

export type OtherFileConflict = { id: string; file: string };

export type MergeOutcome =
  | { status: "invalid-source"; errors: string[] }
  | { status: "invalid-target"; targetPath: string; errors: string[] }
  | { status: "conflict"; targetPath: string; targetConflicts: string[]; otherFileConflicts: OtherFileConflict[] }
  | { status: "merged"; targetPath: string; created: boolean; added: string[]; replaced: string[]; total: number };

/**
 * Hedef adı `content-<category>.json`: src/content/index.ts bu adları
 * içe aktarıyor. Seeder ise klasördeki her .json'u okuyor; başka adla
 * açılan dosya arayüze girmez ama sunucuya girerdi.
 */
export function targetPathFor(contentDir: string, lang: string, category: string): string {
  return join(contentDir, lang, `content-${category}.json`);
}

export function mergeQuestions({ sourcePath, contentDir, replace }: MergeOptions): MergeOutcome {
  const source = validateQuestionFile(readJson(sourcePath));
  if (!source.ok) return { status: "invalid-source", errors: source.errors };

  const { lang, category } = source.file;
  const targetPath = targetPathFor(contentDir, lang, category);
  const created = !existsSync(targetPath);

  let target: RawQuestionFile = { lang, category, questions: [] };
  if (!created) {
    const existing = validateQuestionFile(readJson(targetPath));
    if (!existing.ok) return { status: "invalid-target", targetPath, errors: existing.errors };
    target = existing.file;
  }

  // Seeder dosyalar arası tekrar eden id'yi reddediyor; --replace yalnızca
  // hedef dosya için geçerli, başka kategorideki soruyu ezmez.
  const otherFileConflicts = findOtherFileConflicts(join(contentDir, lang), basename(targetPath), source.file);
  const plan = planMerge(target.questions, source.file.questions, replace);
  const targetConflicts = plan.ok ? [] : plan.conflicts;

  if (!plan.ok || otherFileConflicts.length > 0) {
    return { status: "conflict", targetPath, targetConflicts, otherFileConflicts };
  }

  const merged: RawQuestionFile = { ...target, questions: plan.questions };
  const check = validateQuestionFile(merged);
  if (!check.ok) return { status: "invalid-target", targetPath, errors: check.errors };

  writeJsonAtomically(targetPath, merged);
  return {
    status: "merged",
    targetPath,
    created,
    added: plan.added,
    replaced: plan.replaced,
    total: plan.questions.length,
  };
}

function findOtherFileConflicts(langDir: string, targetName: string, source: RawQuestionFile): OtherFileConflict[] {
  if (!existsSync(langDir)) return [];

  const sourceIds = new Set(source.questions.map((question) => question.id));
  const conflicts: OtherFileConflict[] = [];

  for (const name of readdirSync(langDir).sort()) {
    if (!name.endsWith(".json") || name === targetName) continue;

    const other = readJson(join(langDir, name)) as { questions?: Array<{ id?: unknown }> };
    for (const question of other.questions ?? []) {
      if (typeof question.id === "string" && sourceIds.has(question.id)) {
        conflicts.push({ id: question.id, file: name });
      }
    }
  }
  return conflicts;
}

function readJson(path: string): unknown {
  const text = readFileSync(path, "utf-8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path}: geçerli JSON değil (${(error as Error).message})`, { cause: error });
  }
}

/** Yarıda kalan bir yazma hedef dosyayı bozmasın: önce yanına, sonra üstüne. */
function writeJsonAtomically(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  renameSync(temporary, path);
}
