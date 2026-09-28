/* ------------------------------------------------------------------ */
/* İstemi yapay zekâ aracına taşıma — platformdan bağımsız arayüz      */
/* ------------------------------------------------------------------ */

/*
  Web'de tarayıcı API'leri (webAiHandoff.ts), native'de Capacitor
  eklentileri (nativeAiHandoff.ts). Hangisinin kullanılacağına
  platform/index.ts karar verir. Sıralama bu arayüzün değil
  handoff.ts'in işi.

  Sözleşme: copy ve share işlerini ilk await'ten önce, senkron başlatır.
  Tarayıcı panoya yazmayı ve paylaşmayı yalnızca kullanıcı hareketinin
  içinde kabul ediyor; handoff.ts de kopyayı başlatıp hemen ardından
  open'ı çağırabilmek için buna dayanıyor.
*/

export type ShareResult = "shared" | "cancelled" | "failed";

export interface AiHandoffAdapter {
  /** Hata fırlatmaz; yazılamadıysa false. */
  copy(text: string): Promise<boolean>;
  /** Paylaşım sayfası bu platformda sunulmalı mı. */
  canShare(): boolean;
  /** Hata fırlatmaz; kullanıcının vazgeçmesi hata sayılmaz. */
  share(text: string): Promise<ShareResult>;
  /**
   * Adresi sistem tarayıcısında ya da yeni sekmede açar. Açılır pencere
   * engellemesi tespit edilemiyor (noopener ile window.open hep null
   * döner), bu yüzden sonuç yok.
   */
  open(url: string): void;
}
