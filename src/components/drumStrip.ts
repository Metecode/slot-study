/* ------------------------------------------------------------------ */
/* Tambur şeridinin ötelemesi — saf hesap                              */
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
