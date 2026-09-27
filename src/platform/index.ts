import { Capacitor } from "@capacitor/core";

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

/**
 * Platforma göre açık/kapalı özellikler. Modül yüklenirken bir kez
 * hesaplanır; çalışma sırasında platform değişmez.
 *
 * - auth: Mobil v1 tamamen çevrimdışı. Native'de origin https://localhost
 *   ve /api yolları paketlenmiş varlıklara düşer; giriş, oturum yenileme
 *   ve senkron hiç denenmez.
 * - serviceWorker: Native'de varlıklar zaten paketin içinde; önbellek
 *   katmanı gereksiz ve güncellemeyi uygulama mağazası yapıyor.
 */
export const platformFeatures = {
  auth: !native,
  serviceWorker: !native,
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

export type { StorageAdapter } from "./storage/StorageAdapter";
export { requestPersistentStorage } from "./storage/persist";
