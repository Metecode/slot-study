/* ------------------------------------------------------------------ */
/* Canlı içerik kontrolü — sunucudaki soruları repodakiyle karşılaştırır */
/*                                                                     */
/*   npm run check:live -- [revizyon] [--url https://...]               */
/*                                                                     */
/* Sunucunun /api/questions yanıtı, verilen revizyondaki (varsayılan    */
/* HEAD) src/content/tr ile soru soru karşılaştırılır. Deploy sonrası   */
/* seeder'ın içeriği yazdığını doğrulamak için: fark yoksa çıkış kodu   */
/* 0, varsa 1.                                                         */
/* ------------------------------------------------------------------ */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTENT_PATH = "src/content/tr";
const DEFAULT_URL = "https://slot.meteucar.com";
const USAGE = "Kullanım: npm run check:live -- [revizyon] [--url <adres>]";

/** Seeder'ın veritabanına yazdığı ve /api/questions'ın döndürdüğü alanlar. */
const FIELDS = ["category", "topic", "difficulty", "kind", "prompt", "modelAnswer", "keyConcepts", "followUps", "source"];

/** Listelenen örnek id sayısı; geri kalanı yalnızca sayılır. */
const SAMPLE_SIZE = 5;

type RawQuestion = { id: string; category: string } & Record<string, unknown>;
type Pool = Map<string, { category: string; fingerprint: string }>;

async function main(argv: string[]): Promise<number> {
  const options = readOptions(argv);
  if (!options) {
    console.error(USAGE);
    return 2;
  }
  const { revision, baseUrl } = options;

  const repo = loadRevision(revision);
  const live = await loadLive(baseUrl);

  console.log(`Canlı: ${baseUrl} — ${live.size} soru`);
  console.log(`Repo:  ${git("rev-parse", "--short", revision).trim()} (${revision}) — ${repo.size} soru\n`);
  printCategoryCounts(live, repo);

  const missing = [...repo.keys()].filter((id) => !live.has(id));
  const extra = [...live.keys()].filter((id) => !repo.has(id));
  const changed = [...repo.keys()].filter((id) => live.has(id) && live.get(id)?.fingerprint !== repo.get(id)?.fingerprint);

  printGroup("Canlıda yok", missing);
  printGroup("Repoda yok", extra);
  printGroup("İçerik farklı", changed);

  if (missing.length + extra.length + changed.length === 0) {
    console.log("\nCanlı içerik bu revizyonla aynı.");
    return 0;
  }
  console.log("\nCanlı içerik bu revizyondan farklı: deploy edilmemiş ya da seeder çalışmamış olabilir.");
  return 1;
}

/** Geçersiz kullanımda null; bilinmeyen seçenek de kullanım hatası sayılır. */
function readOptions(argv: string[]): { revision: string; baseUrl: string } | null {
  try {
    const { values, positionals } = parseArgs({ args: argv, options: { url: { type: "string" } }, allowPositionals: true });
    if (positionals.length > 1) return null;
    return { revision: positionals[0] ?? "HEAD", baseUrl: values.url ?? DEFAULT_URL };
  } catch {
    return null;
  }
}

/** Bir git revizyonundaki içerik; çalışma ağacına dokunmadan `git show` ile okunur. */
function loadRevision(revision: string): Pool {
  const questions = git("ls-tree", "--name-only", revision, `${CONTENT_PATH}/`)
    .split("\n")
    .filter((path) => path.endsWith(".json"))
    .flatMap((path) => (JSON.parse(git("show", `${revision}:${path}`)) as { questions: RawQuestion[] }).questions);
  return toPool(questions);
}

async function loadLive(baseUrl: string): Promise<Pool> {
  const url = new URL("/api/questions", baseUrl);
  // fetch'in kendi mesajı yalnızca "fetch failed"; asıl neden cause'ta.
  const response = await fetch(url).catch((error: Error) => {
    throw new Error(`${url}: ${(error.cause as Error | undefined)?.message ?? error.message}`);
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return toPool((await response.json()) as RawQuestion[]);
}

function toPool(questions: RawQuestion[]): Pool {
  return new Map(questions.map((question) => [question.id, { category: question.category, fingerprint: fingerprint(question) }]));
}

function fingerprint(question: RawQuestion): string {
  return canonical(Object.fromEntries(FIELDS.map((field) => [field, question[field]])));
}

/**
 * Anahtarları sıralı, boş (null/undefined) alanları atlanmış JSON. JSONB
 * anahtar sırasını korumuyor, API de dosyada olmayan alanı null döndürüyor;
 * ikisi de içerik farkı sayılmamalı.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, field]) => field !== null && field !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([key, field]) => `${JSON.stringify(key)}:${canonical(field)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function printCategoryCounts(live: Pool, repo: Pool): void {
  const count = (pool: Pool, category: string) => [...pool.values()].filter((q) => q.category === category).length;
  const categories = [...new Set([...live.values(), ...repo.values()].map((q) => q.category))].sort();
  console.log(`${"kategori".padEnd(16)}${"canlı".padStart(6)}${"repo".padStart(6)}`);
  for (const category of categories) {
    const [liveCount, repoCount] = [count(live, category), count(repo, category)];
    const marker = liveCount === repoCount ? "" : "  ←";
    console.log(`${category.padEnd(16)}${String(liveCount).padStart(6)}${String(repoCount).padStart(6)}${marker}`);
  }
  console.log();
}

function printGroup(label: string, ids: string[]): void {
  console.log(`${label}: ${ids.length}`);
  for (const id of ids.slice(0, SAMPLE_SIZE)) console.log(`  - ${id}`);
  if (ids.length > SAMPLE_SIZE) console.log(`  … ve ${ids.length - SAMPLE_SIZE} tane daha`);
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1e8 });
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
