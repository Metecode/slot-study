import { platformFeatures } from "./index";

/* ------------------------------------------------------------------ */
/* Haptik geri bildirim — uygulamanın tek titreşim kapısı              */
/* ------------------------------------------------------------------ */

/*
  Uygulama kodu eklentiyi doğrudan çağırmaz; olayın adını söyler
  (leverPull, reelStop...), hangi titreşimin verileceğine burası karar
  verir.

  Native'de @capacitor/haptics ilk çağrıda dinamik import ile yüklenir:
  web bundle'ına ve precache'e girmez (bkz. vite.config.ts). Web'de
  eklenti hiç yüklenmez. Web'deki tek titreşim kol çekişindeki kısa
  navigator.vibrate: Ayarlar'da anahtar yalnızca native'de görünüyor,
  web titreşimi bu yüzden ayara bağlı değil, koşulsuz.

  Haptik asla akışı bozmaz: çağıran hiçbir şey beklemez, eklentinin ya da
  importun hatası yutulur, yalnızca geliştirmede console'a yazılır.
*/

type HapticsModule = typeof import("@capacitor/haptics");
type Impact = "light" | "medium";

/** Web'de kol çekişindeki titreşim; Lever'ın eski davranışı. */
const WEB_LEVER_VIBRATE_MS = 15;

/**
 * Tambur duruşu, önceki titreşimden bu kadar kısa süre sonra gelirse
 * düşer. Hareket azaltmada iki tambur kolla aynı anda duruyor, animasyon
 * atlandığında da ikisi aynı karede; üç darbe üst üste binip tek bir
 * vızıltıya dönüşüyordu.
 */
const REEL_STOP_MIN_GAP_MS = 80;

let enabled = true;
let lastImpactAt = Number.NEGATIVE_INFINITY;
let pluginPromise: Promise<HapticsModule> | null = null;

function loadPlugin(): Promise<HapticsModule> {
  // Yükleme başarısızsa önbelleğe alınmaz, bir sonraki çağrı yeniden dener.
  pluginPromise ??= import("@capacitor/haptics").catch((error: unknown) => {
    pluginPromise = null;
    throw error;
  });
  return pluginPromise;
}

function report(error: unknown): void {
  if (import.meta.env.DEV) console.warn("[haptics]", error);
}

/** Ayara bakmadan titreşir; ayar kontrolü çağıranda. */
function impact(kind: Impact): void {
  lastImpactAt = Date.now();
  loadPlugin()
    .then(({ Haptics, ImpactStyle }) =>
      Haptics.impact({ style: kind === "light" ? ImpactStyle.Light : ImpactStyle.Medium }),
    )
    .catch(report);
}

function webVibrate(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Bazı tarayıcılar izinsiz bağlamda (ör. iframe) fırlatabilir; sessizce yut.
  }
}

export const haptics = {
  /** Kol çekildi; kol sesiyle aynı anda çağrılır. */
  leverPull(): void {
    if (!platformFeatures.haptics) {
      webVibrate(WEB_LEVER_VIBRATE_MS);
      return;
    }
    if (enabled) impact("medium");
  },

  /** Dönen bir tambur durdu; duruş sesiyle aynı anda çağrılır. */
  reelStop(): void {
    if (!platformFeatures.haptics || !enabled) return;
    if (Date.now() - lastImpactAt < REEL_STOP_MIN_GAP_MS) return;
    impact("light");
  },

  /** Öz-değerlendirme seçildi; üç seçenekte aynı, kaydın alındığını söyler. */
  rated(): void {
    if (!platformFeatures.haptics || !enabled) return;
    impact("light");
  },

  /**
   * Titreşim anahtarı açıldı: kullanıcı çalıştığını hemen hissetsin (ses
   * açılınca kol sesinin çalması gibi). Ayar henüz eşitlenmemiş olabilir,
   * bu yüzden ona bakmaz.
   */
  switchedOn(): void {
    if (!platformFeatures.haptics) return;
    impact("medium");
  },

  /** Kullanıcının tercihi; App her değişimde eşitler. */
  setEnabled(value: boolean): void {
    enabled = value;
  },
};
