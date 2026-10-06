/* ------------------------------------------------------------------ */
/* Logo ölçüleri — arayüzde yeniden kullanılanlar                     */
/*                                                                     */
/* ÜRETİLDİ: design/logo/build_ui.py. Elle düzenleme; geometri          */
/* değişince betiği çalıştır.                                           */
/* ------------------------------------------------------------------ */

/** Ok kenarının yatayla açısı, derece (build_logo.py → ARROW_DEG). */
export const ARROW_DEG = 20;

/** Sembolün kenarı (çerçevenin dış sınırı), logo birimiyle. */
export const SYMBOL_EDGE = 208;

/**
 * 32 px kesiminin sol oku, logo birimiyle: taban çerçevenin dış kenarında,
 * uç imlecin dikey ortasında. Sağdaki bunun aynası.
 */
export const ARROW = {
  path: "M24 100.34L100 128L24 155.66Z",
  x: 24,
  y: 100.34,
  width: 76,
  height: 55.32,
} as const;

/** Kelime markasının yüksekliği / sembol kenarı: lockup'taki ölçek. */
export const WORDMARK_TO_SYMBOL = 144 / 208;
