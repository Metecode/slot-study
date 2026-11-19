/* ------------------------------------------------------------------ */
/* Sonuç geri bildirimi — bir duruşta bir ses, bir titreşim              */
/*                                                                     */
/* Her tambur durduğunda duruş sesi ve titreşimi çalar. İki tambur      */
/* aynı anda durduğunda (atlama, Kapalı mod) ikisi üst üste biniyor ve   */
/* ses çift çalıyordu. Kapı, öncekinden minGapMs'ten kısa süre sonra     */
/* gelen duruşu düşürür: Tam ve Kısa'da sol ve sağın ayrı duruşları      */
/* (en az ~100 ms arayla) yine duyulur, aynı karedekiler bir kez çalar.  */
/* Zaman dışarıdan gelir: saf ve sahte saatle test edilebilir.          */
/* ------------------------------------------------------------------ */

/** true dönerse bu duruşun sesi ve titreşimi çalınır. */
export type FeedbackGate = (nowMs: number) => boolean;

export function createFeedbackGate(minGapMs: number): FeedbackGate {
  let lastAt: number | null = null;
  return (nowMs) => {
    if (lastAt !== null && nowMs - lastAt < minGapMs) return false;
    lastAt = nowMs;
    return true;
  };
}
