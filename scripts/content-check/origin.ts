import { originIssues, reposMissingFromNotices } from "../../src/domain/origin.ts";
import type { Question } from "../../src/domain/question.ts";

/* ------------------------------------------------------------------ */
/* Köken denetimi — betiğin tek kapısı                                  */
/*                                                                     */
/* Diğer kontroller ölçümdür, uyarı olsa da çıkış kodu 0. Köken ise      */
/* lisans yükümlülüğü: source ile çelişen origin ya da bildirimi        */
/* olmayan bir dış repo yayına çıkmamalı. Bu yüzden sorun varsa çıkış   */
/* kodu 1. Eksik origin'i zaten şema reddediyor (dosya okunamaz).       */
/* ------------------------------------------------------------------ */

/** Bulunan sorunlar, her biri bir satır; boş liste temiz demek. */
export function originProblems(pool: readonly Question[], notices: string): string[] {
  const lines = pool.flatMap((question) => originIssues(question).map((issue) => `${question.id}: ${issue}`));
  for (const repo of reposMissingFromNotices(pool, notices)) {
    lines.push(`${repo}: THIRD_PARTY_NOTICES'ta bölümü yok`);
  }
  return lines;
}

export function printOriginProblems(lines: readonly string[]): void {
  console.log(`\n== Köken (origin) (${lines.length})`);
  for (const line of lines) console.log(`  ${line}`);
}
