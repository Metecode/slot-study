import { FACES } from "../domain/reels";

/* ------------------------------------------------------------------ */
/* Tambur şeridi — kurulumu ve ötelemesi, saf hesap                     */
/*                                                                     */
/* Öteleme piksel değil, şeridin kendi boyuna göre yüzde: translateY(%) */
/* öğenin kendi yüksekliğine göre çözülür. Satır yüksekliği değişince   */
/* (dar ekranda --row 64 → 56) konum kendiliğinden ölçeklenir.          */
/* Piksel yazıldığında 1280 → 360 geçişinde 48 satırlık öteleme 3072 px */
/* kalıyor, 51 satırlık şerit 2856 px'e iniyordu: şeridin tamamı        */
/* pencerenin üstünde kalıp makara boş görünüyordu.                     */
/* ------------------------------------------------------------------ */

/**
 * Şeridi `rows` satır yukarı kaydıran transform. Kesirli satır da olur
 * (dönüş sonundaki taşma). Şeridin bütün satırları aynı yükseklikte
 * olmalı; `totalRows` şeritteki satır sayısı.
 */
export function stripTransform(rows: number, totalRows: number): string {
  if (!(totalRows > 0) || rows === 0) return "translateY(0%)";
  return `translateY(${(-rows / totalRows) * 100}%)`;
}

/**
 * Şeritte ortaya gelen yüzün indeksi. Pencere üç satır gösterir;
 * 0 üstte, 1 ortada, 2 altta. Şerit hiç kaydırılmadığında ortada
 * duran yüz budur.
 */
export const CENTER = 1;

/**
 * Pencerede aynı anda görünen üç satırdan ortadaki ile komşularının aynı
 * olmasını engeller. Havuzda başka bir değer yoksa dokunmaz.
 */
function separateNeighbors(
  items: string[],
  center: number,
  pool: readonly string[],
): void {
  const label = items[center];
  const other = pool.find((value) => value !== label);
  if (other === undefined) return;

  for (const index of [center - 1, center + 1]) {
    if (index >= 0 && index < items.length && items[index] === label) {
      items[index] = other;
    }
  }
}

/**
 * Şeridi kurar. Dinlenme etiketi CENTER'a konur ki dönüş başlarken
 * ekrandaki yazı değişmesin; kazanan, turların sonundaki konuma düşer.
 *
 * Yüz halkası kazanan hizalı sarılır: şeritte kazananın üstünde ve
 * altında halkadaki komşuları (labels[targetIndex ± 1]) durur. Machine
 * o iki yüzü bilerek seçiyor (kazananın kategorisinin konuları); halka
 * başka bir noktadan sarılsaydı duruşta rastgele iki yüz görünürdü.
 *
 * Komşular yine de ayrıştırılıyor: tek ya da iki değerli havuzda halka
 * tekrarsız kurulamayabilir.
 */
export function buildStrip(
  labels: string[],
  targetIndex: number,
  turns: number,
  restLabel: string,
): { items: string[]; winnerPos: number } {
  const pool = labels.length > 0 ? labels : [""];
  const winnerPos = CENTER + Math.max(1, turns) * FACES;
  const shift = targetIndex - winnerPos;
  const items: string[] = [];

  // Altta bir satır fazlası olsun, kayarken boşluk görünmesin.
  for (let i = 0; i <= winnerPos + 1; i++) {
    const index = (((i + shift) % pool.length) + pool.length) % pool.length;
    items.push(pool[index] ?? "");
  }

  items[CENTER] = restLabel;

  separateNeighbors(items, CENTER, pool);
  separateNeighbors(items, winnerPos, pool);

  return { items, winnerPos };
}
