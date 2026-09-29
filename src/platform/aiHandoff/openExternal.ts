/**
 * Web'de yeni sekme. Native'de (Capacitor) de aynı çağrı yeterli: WebView
 * dış bir host'a gitmek istediğinde Capacitor adresi sistem tarayıcısına
 * verir; @capacitor/app-launcher bu yüzden yok.
 */
export function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
