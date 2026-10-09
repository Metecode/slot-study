/**
 * Web'de yeni sekme. Native'de (Capacitor) de aynı çağrı yeterli: WebView
 * dış bir host'a gitmek istediğinde Capacitor adresi sistem tarayıcısına
 * verir; @capacitor/app-launcher bu yüzden yok. iOS'ta yeni pencere isteği
 * UIApplication.open'a gider ve Safari açılır; adres yüklü bir uygulamanın
 * universal link'iyse (ör. chatgpt.com) o uygulama açılabilir ve sorgu
 * parametresi düşebilir. İstem bu yüzden her durumda panoya da kopyalanıyor
 * (bkz. handoff.ts).
 */
export function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
