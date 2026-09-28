import type { AiTarget } from "./aiTargets";

/* ------------------------------------------------------------------ */
/* İstemi yapay zekâ servisine taşıyan adres                           */
/* ------------------------------------------------------------------ */

/**
 * Encode edilmiş tam URL'nin azami uzunluğu. Encode sonrası URL tamamen
 * ASCII olduğu için karakter sayısı bayt sayısına eşit.
 *
 * nginx'in varsayılan request line sınırı 8 KB, Apache'nin 8190 bayt
 * (ikisine de "GET " ve " HTTP/1.1" dahil); CDN'lerin çoğu 8–16 KB arası.
 * 6000 bunların altında ~2 KB pay bırakır: bilinmeyen ara katmanlar ve
 * aynı adresin sitenin kendi isteklerinde Referer başlığıyla tekrar
 * gitmesi için.
 *
 * Mevcut içerikte boş cevapla en uzun URL ~1900, 600 karakterlik Türkçe
 * cevapla ~3000: hepsi sığıyor. En uzun soruda ~2300 karakterlik Türkçe
 * cevaba kadar istem adreste gider; Türkçe harf encode sonrası 6 karakter
 * (ş → %C5%9F), boşluk 3 karakter (%20).
 */
export const MAX_HANDOFF_URL_LENGTH = 6000;

export type HandoffFailure = "unsupported" | "too_long" | "encode_error";

/**
 * promptIncluded false ise açılan sayfa boştur; arayüz kullanıcıya istemi
 * yapıştırmasını söyler.
 */
export type HandoffResult =
  | { url: string; promptIncluded: true }
  | { url: string; promptIncluded: false; reason: HandoffFailure };

/**
 * Hedef parametreyi destekliyor ve adres eşiğe sığıyorsa istemi taşıyan
 * URL; değilse baseUrl ve nedeni.
 *
 * URLSearchParams kullanılmıyor: boşluğu "+" yapıyor, istemi
 * decodeURIComponent ile okuyan bir sayfa onu düz "+" olarak gösterirdi.
 */
export function buildHandoffUrl(target: AiTarget, prompt: string): HandoffResult {
  if (target.queryParam === undefined) {
    return { url: target.baseUrl, promptIncluded: false, reason: "unsupported" };
  }

  let encoded: string;
  try {
    encoded = encodeURIComponent(prompt);
  } catch (error) {
    // Eşi olmayan surrogate URIError fırlatır; başka bir hata beklenmiyor.
    if (!(error instanceof URIError)) throw error;
    return { url: target.baseUrl, promptIncluded: false, reason: "encode_error" };
  }

  const url = `${target.baseUrl}?${target.queryParam}=${encoded}`;
  const limit = target.maxUrlLength ?? MAX_HANDOFF_URL_LENGTH;
  if (url.length > limit) {
    return { url: target.baseUrl, promptIncluded: false, reason: "too_long" };
  }
  return { url, promptIncluded: true };
}
