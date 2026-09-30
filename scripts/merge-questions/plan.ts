import { ContentError, parseQuestionFile } from "../../src/domain/question.ts";

/* ------------------------------------------------------------------ */
/* Birleştirme kararı — dosya sistemi bilmez.                           */
/*                                                                     */
/* Sorular dosyaya ŞEMADAN ÇIKAN haliyle değil, okunduğu haliyle yazılır: */
/* şema varsayılanları (ör. kind) eski sorulara eklenmesin, anahtar     */
/* sırası yazarın bıraktığı gibi kalsın. Doğrulama yine şemadan geçer.  */
/* ------------------------------------------------------------------ */

export type RawQuestion = { id: string } & Record<string, unknown>;

export type RawQuestionFile = {
  lang: string;
  category: string;
  questions: RawQuestion[];
} & Record<string, unknown>;

export type ValidationResult =
  | { ok: true; file: RawQuestionFile }
  | { ok: false; errors: string[] };

/**
 * questionFileSchema (parseQuestionFile üzerinden; dosya içi tekrar eden id
 * ve kategori uyuşmazlığı da yakalanır). Hatalar soru id'si ve alan yoluyla
 * yazılır; Zod'un verdiği dizi indisi okunamayacağı için id'ye çevrilir.
 */
export function validateQuestionFile(raw: unknown): ValidationResult {
  try {
    parseQuestionFile("", raw);
  } catch (error) {
    if (!(error instanceof ContentError)) throw error;
    return { ok: false, errors: error.issues.map((issue) => describeIssue(raw, issue.path, issue.message)) };
  }
  // Şemadan geçtiyse bu alanlar var; ham nesne olduğu gibi döner.
  return { ok: true, file: raw as RawQuestionFile };
}

function describeIssue(raw: unknown, path: readonly PropertyKey[], message: string): string {
  if (path[0] !== "questions" || path.length < 2) {
    return `dosya · ${formatPath(path) || "(kök)"}: ${message}`;
  }

  const [, position, ...field] = path;
  // parseQuestionFile'ın kendi hataları yolda id taşır, Zod'unkiler indis.
  const id = typeof position === "number" ? questionIdAt(raw, position) : `"${String(position)}"`;
  return `soru ${id} · ${formatPath(field) || "(soru)"}: ${message}`;
}

function questionIdAt(raw: unknown, index: number): string {
  const questions = (raw as { questions?: unknown })?.questions;
  const question = Array.isArray(questions) ? questions[index] : undefined;
  const id = (question as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && id.length > 0 ? `"${id}"` : `#${index} (id yok)`;
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.map(String).join(".");
}

export type MergePlan =
  | { ok: true; questions: RawQuestion[]; added: string[]; replaced: string[] }
  | { ok: false; conflicts: string[] };

/**
 * Hedefteki her soru sonuçta kalır ve yerini korur; kaynakta olmayan soru
 * asla düşmez. Seeder JSON'da olmayan soruyu siliyor ve CASCADE kullanıcı
 * ilerlemesini de götürüyor — silme bu script'in işi değil.
 *
 * Çakışan id: replace yoksa hiçbir şey birleşmez; varsa hedefteki soru
 * aynı sırada kaynaktakiyle değişir. Yeni sorular sona, kaynak sırasıyla.
 */
export function planMerge(
  targetQuestions: readonly RawQuestion[],
  sourceQuestions: readonly RawQuestion[],
  replace: boolean,
): MergePlan {
  const sourceById = new Map(sourceQuestions.map((question) => [question.id, question]));
  const conflicts = targetQuestions.filter((question) => sourceById.has(question.id)).map((question) => question.id);

  if (conflicts.length > 0 && !replace) {
    return { ok: false, conflicts };
  }

  const targetIds = new Set(targetQuestions.map((question) => question.id));
  const kept = targetQuestions.map((question) => sourceById.get(question.id) ?? question);
  const added = sourceQuestions.filter((question) => !targetIds.has(question.id));

  return {
    ok: true,
    questions: [...kept, ...added],
    added: added.map((question) => question.id),
    replaced: conflicts,
  };
}
