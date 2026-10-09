import { Capacitor } from "@capacitor/core";

import type { AiHandoffAdapter } from "./aiHandoff/AiHandoffAdapter";
import { createNativeAiHandoff } from "./aiHandoff/nativeAiHandoff";
import { webAiHandoff } from "./aiHandoff/webAiHandoff";
import { indexedDbAdapter } from "./storage/indexedDbAdapter";
import { createLazyAdapter } from "./storage/lazyAdapter";
import type { StorageAdapter } from "./storage/StorageAdapter";

/* ------------------------------------------------------------------ */
/* Native mi web mi — kod tabanındaki tek kontrol                      */
/* ------------------------------------------------------------------ */

/*
  Bilerek dışa aktarılmıyor: uygulama kodu "native miyim" diye sormaz,
  aşağıdaki özellik bayraklarına bakar. Yeni bir fark gerektiğinde yeni
  bir bayrak eklenir; platform kontrolü kod tabanına dağılmaz.
*/
function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

const native = isNativePlatform();

/** Yalnızca Android'e özgü bayraklar için; o da dışa aktarılmaz. */
const android = Capacitor.getPlatform() === "android";

/**
 * Platforma göre açık/kapalı özellikler. Modül yüklenirken bir kez
 * hesaplanır; çalışma sırasında platform değişmez.
 *
 * - auth: Mobil v1 tamamen çevrimdışı. Native'de origin yerel
 *   (Android https://localhost, iOS capacitor://localhost) ve /api yolları
 *   paketlenmiş varlıklara düşer; giriş, oturum yenileme ve senkron hiç
 *   denenmez.
 * - serviceWorker: Native'de varlıklar zaten paketin içinde; önbellek
 *   katmanı gereksiz ve güncellemeyi uygulama mağazası yapıyor.
 * - haptics: Native'de @capacitor/haptics ile titreşim ve Ayarlar'da
 *   "Titreşim" anahtarı. Web'de anahtar yok; kol çekişindeki kısa
 *   navigator.vibrate koşulsuz kalır (bkz. haptics.ts).
 * - reminders: Native'de yerel bildirimle tekrar hatırlatıcısı, Ayarlar'da
 *   anahtarı ve öneri kartı. Web'de hiçbiri yok (bkz. reminders.ts).
 * - notificationChannels: Bildirim kanalı yalnızca Android'de var. iOS
 *   eklentisi createChannel'ı "unimplemented" ile reddediyor; kanal
 *   kurulmadan zamanlamaya geçilmediği için iOS'ta hatırlatıcı hiç
 *   kurulmuyordu.
 * - sameOriginPages: Sitenin statik sayfaları (/privacy) uygulamayla aynı
 *   origin'de mi. Native'de origin yerel (yukarıda); göreli /privacy
 *   paketteki kopyaya ya da uygulamanın kendisine düşerdi. Bağlantı orada
 *   canlı sitenin mutlak adresine gider, Capacitor onu sistem tarayıcısına
 *   (iOS'ta Safari) verir.
 */
export const platformFeatures = {
  auth: !native,
  serviceWorker: !native,
  haptics: native,
  reminders: native,
  notificationChannels: android,
  sameOriginPages: !native,
} as const;

/* ------------------------------------------------------------------ */
/* Platform seçimi — tek karar noktası                                 */
/* ------------------------------------------------------------------ */

/*
  Uygulamanın kullandığı depo burada seçilir; modüller kendi adapter'ını
  oluşturmaz. Web'de IndexedDB. Native'de uygulama klasöründeki JSON
  dosyaları: iOS'ta WKWebView'in IndexedDB'si cihazda yer azalınca
  silinebiliyor. Native adapter ve @capacitor/filesystem ilk çağrıda
  dinamik import ile yüklenir, web bundle'ına ve precache'e girmez
  (bkz. vite.config.ts). IndexedDB'den taşıma yok: v1 yayında değil.
*/
export const storage: StorageAdapter = native
  ? createLazyAdapter(() => import("./storage/filesystemAdapter").then((m) => m.createFilesystemAdapter()))
  : indexedDbAdapter;

/*
  İstemi yapay zekâ aracına taşıma. Depodan farklı olarak adapter tembel
  sarılmaz: open ve kopyanın başlaması tıklamayla aynı senkron akışta
  olmalı. Native'de yalnızca eklentiler dinamik import ile gelir (bkz.
  aiHandoff/nativeAiHandoff.ts); sıralama aiHandoff/handoff.ts'te.
*/
export const aiHandoff: AiHandoffAdapter = native ? createNativeAiHandoff() : webAiHandoff;

/**
 * Uygulamanın her yerindeki pano yazımı buradan geçer; navigator.clipboard
 * doğrudan çağrılmaz. Native'de @capacitor/clipboard: iOS'ta origin
 * capacitor://localhost ve WKWebView'in onu güvenli bağlam saydığı
 * belgelenmemiş, saymazsa navigator.clipboard hiç yok. Web'de Clipboard
 * API, olmazsa execCommand yedeği (bkz. aiHandoff/webAiHandoff.ts).
 * Hata fırlatmaz; yazılamadıysa false.
 */
export function copyToClipboard(text: string): Promise<boolean> {
  return aiHandoff.copy(text);
}

export type { AiHandoffAdapter, ShareResult } from "./aiHandoff/AiHandoffAdapter";
export type { StorageAdapter } from "./storage/StorageAdapter";
export { requestPersistentStorage } from "./storage/persist";
