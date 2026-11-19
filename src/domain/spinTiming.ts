/* ------------------------------------------------------------------ */
/* Dönüş süreleri — animasyon, ses ve haptiğin tek kaynağı              */
/*                                                                     */
/* Tambur, kol, ses ve titreşim süreleri burada; bileşenler kendi       */
/* sabitlerini tutmaz. Şeridin biçimi (aşma payı, easing) Drum.tsx'te    */
/* kalır: süre değil, hareketin şekli. Tık aralığı (reelTicks.ts) de    */
/* orada: kulağın ayırt edebildiği en kısa aralık, moda bağlı değil.    */
/* Saf: React ve DOM bilmez.                                           */
/* ------------------------------------------------------------------ */

export type ReelTiming = {
  durationMs: number;
  /** Hedefe varmadan kaç tur atılacağı. Tur = FACES satır (domain/reels.ts). */
  turns: number;
};

export type SpinTiming = {
  /** Sol tambur önce durur. */
  left: ReelTiming;
  /** Sağ tambur ikinci durur ve turu açar. */
  right: ReelTiming;
  /** Kolun inişi. */
  leverPullMs: number;
  /** Kolun yerine dönüşü. */
  leverRecoverMs: number;
  /** Ses zarflarının süre çarpanı (sounds.ts); 1 = tam. */
  soundScale: number;
};

/** Tam animasyon: makinenin asıl hissi. */
export const FULL_SPIN_TIMING: SpinTiming = {
  left: { durationMs: 1300, turns: 3 },
  right: { durationMs: 1600, turns: 4 },
  leverPullMs: 165,
  leverRecoverMs: 430,
  soundScale: 1,
};

/** Eski ikili "hızlı mod"un tambur süreleri. */
export const LEGACY_FAST_REELS: Pick<SpinTiming, "left" | "right"> = {
  left: { durationMs: 300, turns: 1 },
  right: { durationMs: 400, turns: 1 },
};

/**
 * Bir sonuç geri bildirimi (duruş sesi ya da titreşimi) öncekinden bu
 * kadar kısa süre sonra gelirse düşer. İki tambur aynı anda durduğunda
 * (hareket azaltma, atlama) iki darbe üst üste binip tek bir vızıltıya
 * dönüşüyordu.
 */
export const RESULT_FEEDBACK_GAP_MS = 80;

/** Web'de kol çekişindeki titreşim (navigator.vibrate). */
export const WEB_LEVER_VIBRATE_MS = 15;
