import type { Category } from "./question";

/* ------------------------------------------------------------------ */
/* Kategori seçicinin kapalı özet metni — saf                          */
/* ------------------------------------------------------------------ */

/**
 * "6 kategori · 13 soru" (hepsi seçili) ya da "5/6 kategori · 11 soru".
 * Havuzdaki soru sayısı ayrı bir sayaç yerine özetin içinde: dar ekranda
 * sayaç satıra sığmayıp kopuk bir alt satıra düşüyordu.
 *
 * Seçili sayısı yalnızca görünen kategoriler üzerinden sayılır — seçimde
 * kalmış ama içeriği olmayan bir kategori özeti şişirmesin. Hangi
 * kategorilerin seçili olduğu özette yazmaz, çiplerde görünür.
 */
export function summarizeCategories(
  active: readonly Category[],
  categories: readonly Category[],
  poolCount: number,
): string {
  const selected = categories.filter((category) => active.includes(category)).length;
  const total = categories.length;
  const categoryPart = selected === total ? `${total} kategori` : `${selected}/${total} kategori`;
  return `${categoryPart} · ${poolCount} soru`;
}
