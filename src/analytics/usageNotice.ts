import type { Consent } from "./analyticsStorage";

/* ------------------------------------------------------------------ */
/* İlk açılış bilgilendirmesi — ne zaman gösterilir                     */
/* ------------------------------------------------------------------ */

/**
 * Tercih okunduysa, ölçüm bu derlemede mümkünse ve kart daha önce hiç
 * gösterilmediyse. Kapatmış kullanıcıya da gösterilmez: bilgilendirmenin
 * işi kapatma yolunu söylemek, o zaten bulmuş.
 */
export function shouldShowUsageNotice(consent: Consent | null, available: boolean): boolean {
  return available && consent !== null && consent.enabled && !consent.noticeShown;
}
