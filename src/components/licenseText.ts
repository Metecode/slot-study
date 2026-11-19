/* ------------------------------------------------------------------ */
/* Lisans metnini dar ekrana akıt                                       */
/*                                                                     */
/* Lisans dosyaları ~80 sütunda elle kırılmış. Dar ekranda her sert      */
/* satır sonu ayrıca sarınca "a copy" gibi tek kelimelik satırlar        */
/* çıkıyordu. Elle kırılmış paragraflar tek satıra birleştirilir; metin  */
/* değişmez, yalnızca satır sonları. Korunanlar:                        */
/*   - boş satırlar (paragraf sınırları),                               */
/*   - başlık alt çizgisi olan bloklar ("Başlık\n=====")                */
/*   - satırlarının hepsi kısa olan bloklar (repo adı + adres),          */
/*   - madde işaretli ve numaralı maddeler: her madde kendi satırında    */
/*     başlar, girintisi kalır; devam satırları maddeye eklenir.         */
/*                                                                     */
/* Eski kural son satır dışındaki HER satırın uzun olmasını istiyordu;   */
/* paragrafın ilk satırı kısa kaldığında ("... bir eserden") paragraf   */
/* hiç birleşmiyor, dar ekranda "CC BY- / SA / 4.0'a" gibi kopuyordu.   */
/* Artık blok, en uzun satırı sütun sınırına yakınsa düzyazı sayılır.   */
/* ------------------------------------------------------------------ */

/** En uzun satırı bunun altında kalan blok elle kırılmış düzyazı sayılmaz. */
const WRAPPED_LINE_MIN = 60;

/** "-", "*", "•" ya da "1.", "2)", "(a)" ile başlayan satır. */
const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)]|\([a-z0-9]+\))\s+/i;

/** Başlık alt çizgisi ya da ayırıcı: "=====", "-----". */
const RULE_LINE = /^\s*[=\-_*]{3,}\s*$/;

function reflowParagraph(paragraph: string): string {
  const lines = paragraph.split("\n");
  if (lines.length < 2) return paragraph;
  if (lines.some((line) => RULE_LINE.test(line))) return paragraph;

  const longest = Math.max(...lines.map((line) => line.trim().length));
  if (longest < WRAPPED_LINE_MIN) return paragraph;

  const joined: string[] = [];
  for (const line of lines) {
    if (LIST_ITEM.test(line)) joined.push(line.trimEnd());
    else if (joined.length === 0) joined.push(line.trim());
    else joined[joined.length - 1] += ` ${line.trim()}`;
  }
  return joined.join("\n");
}

export function reflowLicenseText(text: string): string {
  return text.replace(/\r\n/g, "\n").split(/\n{2,}/).map(reflowParagraph).join("\n\n");
}
