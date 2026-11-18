/* ------------------------------------------------------------------ */
/* Lisans metnini dar ekrana akıt                                       */
/*                                                                     */
/* Lisans dosyaları ~80 sütunda elle kırılmış. Dar ekranda her sert      */
/* satır sonu ayrıca sarınca "a copy" gibi tek kelimelik satırlar        */
/* çıkıyordu. Elle kırılmış paragraflar tek satıra birleştirilir;        */
/* başlık, alt çizgi, adres listesi gibi kısa satırlı bloklar olduğu     */
/* gibi kalır. Metin değişmez, yalnızca satır sonları: boş satırlar      */
/* (paragraf sınırları) korunur.                                        */
/* ------------------------------------------------------------------ */

/** Bu uzunluğun altındaki bir satır elle kırılmış düzyazı sayılmaz. */
const WRAPPED_LINE_MIN = 60;

function isWrappedProse(lines: readonly string[]): boolean {
  if (lines.length < 2) return false;
  // Son satır kısa olabilir; ondan öncekilerin hepsi sütun sınırına yakın.
  return lines.slice(0, -1).every((line) => line.trim().length >= WRAPPED_LINE_MIN);
}

export function reflowLicenseText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      return isWrappedProse(lines) ? lines.map((line) => line.trim()).join(" ") : paragraph;
    })
    .join("\n\n");
}
