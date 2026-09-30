import { platformFeatures } from "./index";

/* ------------------------------------------------------------------ */
/* Service worker kaydı                                                */
/* ------------------------------------------------------------------ */

/*
  vite-plugin-pwa'nın injectRegister: "script" ile ürettiği registerSW.js
  ile birebir aynı iş: sayfa yüklenince /sw.js'i "/" kapsamıyla kaydet.
  Kayıt buraya native'de kapatılabilsin diye taşındı (vite.config.ts'te
  injectRegister: false). workbox-window kullanılmıyor, yeni bağımlılık yok.

  Güncelleme davranışı kayıttan değil sw.js'ten geliyor: registerType
  "prompt" skipWaiting/clientsClaim'i kapalı tutuyor, yeni sürüm bekler ve
  sonraki açılışta devreye girer. Burada onay isteyen bir akış yok, eski
  betikte de yoktu.

  "/sw.js" eklentinin varsayılan dosya adı (filename ayarı değişirse
  burası da değişmeli).
*/
const SW_URL = "/sw.js";
const SW_SCOPE = "/";

export function registerServiceWorker(): void {
  if (!platformFeatures.serviceWorker) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  });
}
