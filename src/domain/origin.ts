// Yalnızca tip import'u: content-check bu dosyayı Node'la doğrudan
// yüklüyor ve uzantısız bir değer import'unu çözemiyor.
import type { Question } from "./question";

/* ------------------------------------------------------------------ */
/* Sorunun kökeni — source metniyle origin alanının tutarlılığı         */
/*                                                                     */
/* Dış kaynaklı bir soru source'unun sonunda                            */
/*   "soru kaynağı: <sahip/repo> (<lisans>)"                            */
/* taşır (katkı rehberi). origin bunun yapısal karşılığıdır; ikisi       */
/* çelişirse hangisinin doğru olduğu bilinemez, bu yüzden çelişki        */
/* içerik denetiminde ve testte reddedilir.                             */
/* ------------------------------------------------------------------ */

const EXTERNAL_MARKER = /soru kaynağı:\s*([\w.-]+\/[\w.-]+)\s*\(([^)]+)\)\s*$/;

/** Doğrulanmamış köken; lisansı originSchema kabul eder ya da reddeder. */
export type OriginCandidate =
  | { kind: "own" }
  | { kind: "external"; repo: string; url: string; license: string };

/**
 * source metninden köken adayı. İşaret yoksa "own". Lisans burada
 * denetlenmez: aday soruya yazılıp şemadan geçer, kabul edilmeyen lisans
 * orada reddedilir. Eski revizyonlarda (origin alanı yokken) kıyas
 * yapabilmek ve ilk doldurma için kullanılır.
 */
export function originFromSource(source: string | undefined): OriginCandidate {
  const match = source?.match(EXTERNAL_MARKER);
  if (!match) return { kind: "own" };

  const [, repo, license] = match;
  return { kind: "external", repo, url: `https://github.com/${repo}`, license };
}

/** origin ile source çelişiyorsa sabit metinli nedenler; boş liste tutarlı demek. */
export function originIssues(question: Pick<Question, "source" | "origin">): string[] {
  const { origin, source } = question;
  const match = source?.match(EXTERNAL_MARKER);

  if (origin.kind === "own") {
    return match ? [`source dış kaynak diyor (${match[1]}), origin own`] : [];
  }

  if (!match) return [`origin external (${origin.repo}), source'ta "soru kaynağı:" yok`];

  const issues: string[] = [];
  const [, repo, license] = match;
  if (repo !== origin.repo) issues.push(`repo uyuşmuyor: source ${repo}, origin ${origin.repo}`);
  if (license !== origin.license) issues.push(`lisans uyuşmuyor: source ${license}, origin ${origin.license}`);
  return issues;
}

/**
 * Dış kaynaklı her repo'nun üçüncü taraf bildiriminde bir bölümü olmalı;
 * lisans metni olmadan içerik dağıtılamaz. Eksik repo'lar döner.
 */
export function reposMissingFromNotices(questions: readonly Pick<Question, "origin">[], notices: string): string[] {
  const repos = new Set<string>();
  for (const { origin } of questions) {
    if (origin.kind === "external") repos.add(origin.repo);
  }
  return [...repos].filter((repo) => !notices.includes(repo)).sort();
}
