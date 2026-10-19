import { CATEGORIES } from "../../src/domain/question.ts";
import type { Category } from "../../src/domain/question.ts";

/* Komut satırı seçenekleri. Bilinmeyen seçenek hata: yazım yanlışı sessizce yok sayılmasın. */

export type Options = {
  /** Ayrıntının gösterileceği kategoriler; ölçüm yine bütün havuzda. */
  categories: ReadonlySet<Category> | undefined;
  /** Depodaki aynı id'li soruların yerine geçecek dosyalar (merge-questions biçimi). */
  edits: string[];
  /** Karşılaştırılacak git revizyonu. */
  base: string | undefined;
  verbose: boolean;
  /** Alt dize taramasında önek eşleşmeleri de listelensin mi. */
  prefix: boolean;
};

export const USAGE = [
  "Kullanım: npm run check:content -- [seçenekler]",
  "  --category <a,b>     ayrıntıyı bu kategorilerle sınırla (ölçüm yine bütün içerikte)",
  "  --edits <a.json,b>   düzenlenmiş soru dosyalarını depodakilerin yerine koyarak dene",
  "  --base <rev>         bir git revizyonuyla satır satır karşılaştır (ör. main)",
  "  --prefix             alt dize taramasında önek eşleşmelerini de listele",
  "  -v, --verbose        çiftlerde eşleşen alias'ı, doğal cevapta kaçan kavramları göster",
].join("\n");

export function parseArgs(argv: readonly string[]): Options | { error: string } {
  let categories: Set<Category> | undefined;
  const edits: string[] = [];
  let base: string | undefined;
  let verbose = false;
  let prefix = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "-v" || arg === "--verbose") {
      verbose = true;
      continue;
    }
    if (arg === "--prefix") {
      prefix = true;
      continue;
    }
    if (arg !== "--category" && arg !== "--edits" && arg !== "--base") return { error: `bilinmeyen seçenek: ${arg}` };

    const value = argv[++index];
    if (!value || value.startsWith("-")) return { error: `${arg} bir değer ister` };
    if (arg === "--base") {
      base = value;
      continue;
    }
    const items = value.split(",").map((item) => item.trim()).filter(Boolean);
    if (arg === "--edits") {
      edits.push(...items);
      continue;
    }
    for (const item of items) {
      if (!isCategory(item)) return { error: `bilinmeyen kategori: ${item} (${CATEGORIES.join(", ")})` };
      (categories ??= new Set()).add(item);
    }
  }
  return { categories, edits, base, verbose, prefix };
}

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
