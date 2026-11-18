/* ------------------------------------------------------------------ */
/* İçerik denetimi — alias eşleşmesinin zayıf noktalarını ölçer         */
/*                                                                     */
/*   npm run check:content -- [--category a,b] [--edits x.json]         */
/*                            [--base main] [--prefix] [-v]             */
/*                                                                     */
/* Rapor üretir, kapı değildir: uyarı olsa da çıkış kodu 0. Ölçümler     */
/* her zaman bütün kategorilerde yapılır. Ayrıntı:                       */
/* scripts/content-check/README.md.                                    */
/* ------------------------------------------------------------------ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { analyze, summarize } from "./content-check/analyze.ts";
import { parseArgs, USAGE } from "./content-check/cli.ts";
import { originProblems, printOriginProblems } from "./content-check/origin.ts";
import { loadFromDir, loadFromRevision, overlay, readQuestions } from "./content-check/pool.ts";
import { loadProbeAnswers } from "./content-check/probes.ts";
import { printComparison, printDetails, printSummary } from "./content-check/report.ts";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTENT_DIR = fileURLToPath(new URL("../src/content/tr", import.meta.url));
const PROBES_DIR = fileURLToPath(new URL("./content-check/probes", import.meta.url));
const NOTICES_PATH = fileURLToPath(new URL("../src/content/THIRD_PARTY_NOTICES", import.meta.url));

function main(argv: string[]): number {
  const options = parseArgs(argv);
  if ("error" in options) {
    console.error(options.error);
    console.error(USAGE);
    return 2;
  }

  const probeAnswers = loadProbeAnswers(PROBES_DIR);
  const pool = overlay(loadFromDir(CONTENT_DIR), options.edits.flatMap(readQuestions));
  const current = analyze(pool, probeAnswers, options.prefix);

  if (options.base) {
    const base = analyze(loadFromRevision(REPO_ROOT, options.base), probeAnswers, options.prefix);
    printComparison(base, current, options.categories, options.base);
    printSummary(summarize(current), summarize(base));
  } else {
    printDetails(current, options.categories, options.verbose);
    printSummary(summarize(current));
  }

  // Köken her zaman bütün havuzda ve yalnızca çalışma ağacında denetlenir.
  const origin = originProblems(pool, readFileSync(NOTICES_PATH, "utf8"));
  printOriginProblems(origin);
  return origin.length > 0 ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}
