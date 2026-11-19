import type { AnimationMode } from "./progress";

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

/** Kısa modda tambur sürelerinin çarpanı (tamın ~%35'i). */
export const SHORT_REEL_SCALE = 0.35;

/** Kısa modda kol ve ses sürelerinin çarpanı. */
export const SHORT_LEVER_SCALE = 0.6;
export const SHORT_SOUND_SCALE = 0.6;

/**
 * Bir çekişin tam planı: süreler ve hangi geri bildirimlerin çalacağı.
 * Sonuç geri bildirimi (duruş sesi ve titreşimi) her modda var; burada
 * yalnızca isteğe bağlı olanlar.
 */
export type SpinPlan = SpinTiming & {
  /** false: tamburlar sonuca anında gelir (yalnızca oturma tıkı). */
  reelsAnimated: boolean;
  /** false: kol oynamaz, çekiliş hemen bildirilir. */
  leverAnimated: boolean;
  /** Kol sesi ve kol titreşimi. */
  leverFeedback: boolean;
  /** Dönüş sırasındaki satır tıkları. */
  ticks: boolean;
};

const FULL_PLAN: SpinPlan = {
  ...FULL_SPIN_TIMING,
  reelsAnimated: true,
  leverAnimated: true,
  leverFeedback: true,
  ticks: true,
};

function scaledReel(reel: ReelTiming): ReelTiming {
  // Tur sayısı da kısalır: tam turda kısa sürede şerit bulanıklaşırdı.
  // Tek tur ~455 ms'de satır hızını Tam'a yakın tutuyor; makara yine dönüp oturuyor.
  return { durationMs: Math.round(reel.durationMs * SHORT_REEL_SCALE), turns: 1 };
}

const SHORT_PLAN: SpinPlan = {
  left: scaledReel(FULL_SPIN_TIMING.left),
  right: scaledReel(FULL_SPIN_TIMING.right),
  leverPullMs: Math.round(FULL_SPIN_TIMING.leverPullMs * SHORT_LEVER_SCALE),
  leverRecoverMs: Math.round(FULL_SPIN_TIMING.leverRecoverMs * SHORT_LEVER_SCALE),
  soundScale: SHORT_SOUND_SCALE,
  reelsAnimated: true,
  leverAnimated: true,
  leverFeedback: true,
  ticks: true,
};

/** Kapalı: süre yok; yalnızca tek bir sonuç sesi ve titreşimi. */
const OFF_PLAN: SpinPlan = {
  left: { durationMs: 0, turns: 0 },
  right: { durationMs: 0, turns: 0 },
  leverPullMs: 0,
  leverRecoverMs: 0,
  soundScale: 1,
  reelsAnimated: false,
  leverAnimated: false,
  leverFeedback: false,
  ticks: false,
};

/**
 * Moda ve çekişin oturumdaki sırasına göre plan. spinIndex 1'den başlar:
 * oturumun (sayfa ya da uygulama açılışı) ilk çekişi 1. Kısa modda ilk
 * çekiş tam oynar: makinenin hissi bir kez görülsün, sonrakiler beklemesin.
 */
export function spinPlanFor(mode: AnimationMode, spinIndex: number): SpinPlan {
  if (mode === "off") return OFF_PLAN;
  if (mode === "short" && spinIndex > 1) return SHORT_PLAN;
  return FULL_PLAN;
}

/**
 * Bir sonuç geri bildirimi (duruş sesi ya da titreşimi) öncekinden bu
 * kadar kısa süre sonra gelirse düşer. İki tambur aynı anda durduğunda
 * (hareket azaltma, atlama) iki darbe üst üste binip tek bir vızıltıya
 * dönüşüyordu.
 */
export const RESULT_FEEDBACK_GAP_MS = 80;

/** Web'de kol çekişindeki titreşim (navigator.vibrate). */
export const WEB_LEVER_VIBRATE_MS = 15;

/**
 * Etkin animasyon modu. Kullanıcının açık seçimi her zaman kazanır;
 * seçim yoksa sistemin hareket azaltma tercihi varsayılanı belirler:
 * açıksa Kapalı, değilse Kısa.
 */
export function resolveAnimationMode(
  chosen: AnimationMode | undefined,
  prefersReducedMotion: boolean,
): AnimationMode {
  if (chosen) return chosen;
  return prefersReducedMotion ? "off" : "short";
}
