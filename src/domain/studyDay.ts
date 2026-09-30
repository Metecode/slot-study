/* ------------------------------------------------------------------ */
/* Çalışma günü — "bugün", "yarın" ve tekrar gününün tek tanımı         */
/*                                                                     */
/* Tekrar zamanı (leitner.ts), arayüzdeki "yarın / N gün sonra"         */
/* metinleri ve hatırlatıcının ertesi gün kuralı (reminder.ts) günü     */
/* buradan okur; üçünün ayrı ayrı gün hesaplaması ayrışmalarına yol     */
/* açıyordu.                                                            */
/* ------------------------------------------------------------------ */

/*
  Gün gece yarısı değil yerel 04:00'da döner. Gece yarısını geçen bir
  oturum hâlâ o günün oturumu sayılır: 23:50'de görülen soru on dakika
  sonra "yarının sorusu" olmasın. Aynı kısa pencere 03:xx'e kayar; o
  saatte çalışan az.

  Yerel takvim: sonuç çalıştığı cihazın saat dilimine bağlı. Gün
  aritmetiği Date kurucusunun yerel alanlarıyla yapılır, 24 saat eklenerek
  değil: yaz saati geçişinde de gün 04:00'da başlar. Saf: şimdiki zaman
  okunmaz, gelen tarih değiştirilmez.
*/

/** Çalışma gününün başladığı yerel saat. */
export const DAY_ROLLOVER_HOUR = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Anın ait olduğu çalışma gününün başlangıcı (yerel 04:00).
 * 04:00'dan önceki saatler önceki güne sayılır.
 */
export function studyDayStart(at: Date): Date {
  const previousDay = at.getHours() < DAY_ROLLOVER_HOUR ? 1 : 0;
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() - previousDay, DAY_ROLLOVER_HOUR);
}

/** Anın çalışma gününden `days` gün sonraki çalışma gününün başlangıcı. */
export function studyDayAfter(at: Date, days: number): Date {
  const start = studyDayStart(at);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + days, DAY_ROLLOVER_HOUR);
}

/** İki anın çalışma günleri arasındaki fark; `to` sonraki bir günse pozitif. */
export function studyDaysBetween(from: Date, to: Date): number {
  // Yaz saati günü 23 ya da 25 saat sürer; yuvarlama tam gün sayısını verir.
  return Math.round((studyDayStart(to).getTime() - studyDayStart(from).getTime()) / DAY_MS);
}
