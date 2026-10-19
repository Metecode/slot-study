import type { CategorySummary, Snapshot } from "./analyze.ts";
import { diffLines, probeChanges } from "./compare.ts";
import type { LineDiff } from "./compare.ts";
import { formatLines, pairLines, probeMissLines, trapLines, warningLines } from "./lines.ts";
import type { CategoryFilter } from "./lines.ts";

/* ------------------------------------------------------------------ */
/* Konsol çıktısı                                                       */
/*                                                                     */
/* Ayrıntı önce, özet tablo en sonda: terminalde son görünen o olsun.  */
/* ------------------------------------------------------------------ */

export function printDetails(snapshot: Snapshot, filter: CategoryFilter, verbose: boolean): void {
  printSection("Uyarılar (kavram ve alias)", warningLines(snapshot, filter));
  printSection("Biçim", formatLines(snapshot, filter));
  printSection("Yarı isabet çiftleri (hedef ← cevabı onu tutan soru)", pairLines(snapshot, filter, verbose));
  printSection("Alt dize tuzakları", trapLines(snapshot, filter));
  if (verbose) printSection("Doğal cevapta kaçan kavramlar", probeMissLines(snapshot, filter));
  printUnknownProbes(snapshot);
}

export function printComparison(base: Snapshot, current: Snapshot, filter: CategoryFilter, revision: string): void {
  console.log(`\nKarşılaştırma: ${revision} → çalışma ağacı (− kalkan, + gelen)`);
  printDiff("Yarı isabet çiftleri", diffLines(pairLines(base, filter, false), pairLines(current, filter, false)));
  printDiff("Uyarılar", diffLines(warningLines(base, filter), warningLines(current, filter)));
  printDiff("Biçim", diffLines(formatLines(base, filter), formatLines(current, filter)));
  printDiff("Alt dize tuzakları", diffLines(trapLines(base, filter), trapLines(current, filter)));
  const changes = probeChanges(base, current, filter);
  printSection(
    "Doğal cevap",
    changes.map((change) => `${change.dropped ? "düştü" : "arttı"}  ${change.id}: ${change.before} → ${change.after}`),
  );
  printUnknownProbes(current);
}

/** Kategori başına özet; taban verilirse değişen hücreler "önce → sonra" yazılır. */
export function printSummary(rows: readonly CategorySummary[], baseRows?: readonly CategorySummary[]): void {
  const header = ["kategori", "soru", "çift (kardeş/aynı/başka)", "uyarı", "biçim", "alt dize", "doğal cevap"];
  const lines = [...rows.map((row) => row.category), "toplam"].map((name, index) => {
    const after = index < rows.length ? cells(rows[index]) : cells(total(rows));
    const baseRow = name === "toplam" ? (baseRows && total(baseRows)) : baseRows?.find((row) => row.category === name);
    if (!baseRows) return [name, ...after];
    const before = baseRow ? cells(baseRow) : after.map(() => "-");
    return [name, ...after.map((cell, column) => (cell === before[column] ? cell : `${before[column]} → ${cell}`))];
  });
  console.log("\n== Özet");
  printTable([header, ...lines]);
}

function cells(row: Omit<CategorySummary, "category">): string[] {
  const { pairs } = row;
  const pairTotal = pairs["kardeş"] + pairs["aynı-kat"] + pairs["başka-kat"];
  return [
    String(row.questions),
    `${pairTotal} (${pairs["kardeş"]}/${pairs["aynı-kat"]}/${pairs["başka-kat"]})`,
    String(row.warnings),
    String(row.formatIssues),
    String(row.traps),
    row.probe ? `${row.probe.hits}/${row.probe.total}` : "-",
  ];
}

function total(rows: readonly CategorySummary[]): Omit<CategorySummary, "category"> {
  const sum = (pick: (row: CategorySummary) => number) => rows.reduce((acc, row) => acc + pick(row), 0);
  const withProbe = rows.filter((row) => row.probe !== undefined);
  return {
    questions: sum((row) => row.questions),
    pairs: {
      "kardeş": sum((row) => row.pairs["kardeş"]),
      "aynı-kat": sum((row) => row.pairs["aynı-kat"]),
      "başka-kat": sum((row) => row.pairs["başka-kat"]),
    },
    warnings: sum((row) => row.warnings),
    formatIssues: sum((row) => row.formatIssues),
    traps: sum((row) => row.traps),
    probe: withProbe.length === 0 ? undefined : {
      hits: withProbe.reduce((acc, row) => acc + (row.probe?.hits ?? 0), 0),
      total: withProbe.reduce((acc, row) => acc + (row.probe?.total ?? 0), 0),
    },
  };
}

function printSection(title: string, lines: readonly string[]): void {
  console.log(`\n== ${title} (${lines.length})`);
  for (const line of lines) console.log(`  ${line}`);
}

function printDiff(title: string, diff: LineDiff): void {
  console.log(`\n== ${title}: −${diff.removed.length} +${diff.added.length}`);
  if (diff.removed.length === 0 && diff.added.length === 0) console.log("  fark yok");
  for (const line of diff.removed) console.log(`  − ${line}`);
  for (const line of diff.added) console.log(`  + ${line}`);
}

function printUnknownProbes(snapshot: Snapshot): void {
  if (snapshot.unknownProbeIds.length === 0) return;
  printSection("Doğal cevap setinde olup içerikte olmayan id'ler", snapshot.unknownProbeIds);
}

function printTable(rows: readonly string[][]): void {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  for (const row of rows) console.log(row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd());
}
