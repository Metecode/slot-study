import { platformFeatures } from "./index";

/* ------------------------------------------------------------------ */
/* Tekrar hatırlatıcısı — yerel bildirimin tek kapısı                  */
/* ------------------------------------------------------------------ */

/*
  Ne zaman çalacağına domain/reminder.ts karar verir; burası yalnızca
  bildirimi kurar, iptal eder ve izni sorar. Uygulama kodu eklentiyi
  doğrudan çağırmaz.

  Native'de @capacitor/local-notifications ilk çağrıda dinamik import ile
  yüklenir: web bundle'ına ve precache'e girmez (bkz. vite.config.ts).
  Web'de hiçbir şey yapılmaz, eklenti hiç yüklenmez.

  Tek bildirim bekler (REMINDER_ID) ve tek sefer çalar. Her kurulum önce
  iptal eder: zamanlama hep uygulama açıkken yeniden hesaplanıyor.

  Kesin alarm yok: isExactNotification: false her çağrıda açıkça verilir.
  Varsayılanı true ve Android 12+'da izin yoksa eklenti kullanıcıyı
  "Alarmlar ve hatırlatıcılar" ayar ekranına gönderiyor; izin de
  AndroidManifest'ten çıkarıldı. allowWhileIdle ile eklenti
  setAndAllowWhileIdle(RTC_WAKEUP) kuruyor: doze'da da çalar, sistem
  birkaç dakika kaydırabilir. Günlük bir hatırlatma için yeterli.

  Eklenti hatası akışı bozmaz: yutulur, yalnızca geliştirmede console'a
  yazılır. İzin sorularında hata "denied" sayılır; anahtar kapalı kalır.
*/

type LocalNotificationsModule = typeof import("@capacitor/local-notifications");

export type ReminderPermission = "granted" | "denied";

const REMINDER_ID = 1;

/** Bildirim kanalı; önem 3 (DEFAULT): ses, durum çubuğu, üstten açılmaz. */
const CHANNEL = {
  id: "review-reminders",
  name: "Tekrar hatırlatıcısı",
  description: "Tekrar zamanı gelen soru olduğunda günde en fazla bir hatırlatma.",
  importance: 3,
} as const;

const TITLE = "Tekrar zamanı";
const BODY = "Birkaç soru çevirmeye ne dersin? Öğrendiklerini taze tutmanın vakti.";

let pluginPromise: Promise<LocalNotificationsModule> | null = null;
let channelPromise: Promise<void> | null = null;

function loadPlugin(): Promise<LocalNotificationsModule> {
  // Yükleme başarısızsa önbelleğe alınmaz, bir sonraki çağrı yeniden dener.
  pluginPromise ??= import("@capacitor/local-notifications").catch((error: unknown) => {
    pluginPromise = null;
    throw error;
  });
  return pluginPromise;
}

/** Kanal oturum başına bir kez kurulur; Android'de aynı id ile tekrar kurmak zararsız. */
function ensureChannel({ LocalNotifications }: LocalNotificationsModule): Promise<void> {
  channelPromise ??= LocalNotifications.createChannel({ ...CHANNEL }).catch((error: unknown) => {
    channelPromise = null;
    throw error;
  });
  return channelPromise;
}

function report(error: unknown): void {
  if (import.meta.env.DEV) console.warn("[reminders]", error);
}

/** İzin verildi VE sistemde bildirimler açık. */
async function isGranted({ LocalNotifications }: LocalNotificationsModule): Promise<boolean> {
  const { display } = await LocalNotifications.checkPermissions();
  if (display !== "granted") return false;
  // Android 13 öncesinde izin hep "granted"; kullanıcı bildirimleri
  // sistemden kapatmış olabilir.
  const { value } = await LocalNotifications.areEnabled();
  return value;
}

async function apply(at: Date | null): Promise<void> {
  const plugin = await loadPlugin();
  const { LocalNotifications } = plugin;

  // Panelde duran eski hatırlatma da gider: kullanıcı uygulamayı zaten açtı.
  await LocalNotifications.removeDeliveredNotificationsById({ ids: [REMINDER_ID] });
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  if (at === null) return;

  await ensureChannel(plugin);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: TITLE,
        body: BODY,
        channelId: CHANNEL.id,
        // Küçük ikon ve rengi capacitor.config.ts'te (LocalNotifications).
        autoCancel: true,
        isExactNotification: false,
        schedule: { at, allowWhileIdle: true },
      },
    ],
  });
}

/*
  Kurulumlar sıraya girer ve yalnızca en son istenen uygulanır: ilerleme
  değişimi ile arka plana geçiş aynı anda tetikleyebiliyor, iptal ve
  kurulum iç içe geçerse eski zaman kazanabilirdi.
*/
let queue: Promise<void> = Promise.resolve();
let latestTicket = 0;

export const reminders = {
  /**
   * Bekleyen hatırlatmayı verilen zamana kurar; null yalnızca iptal eder.
   * Hata fırlatmaz.
   */
  sync(at: Date | null): Promise<void> {
    if (!platformFeatures.reminders) return Promise.resolve();
    const ticket = ++latestTicket;
    queue = queue.then(() => (ticket === latestTicket ? apply(at) : undefined)).catch(report);
    return queue;
  },

  /** İzin şu an var mı; sormaz. */
  async checkPermission(): Promise<ReminderPermission> {
    if (!platformFeatures.reminders) return "denied";
    try {
      return (await isGranted(await loadPlugin())) ? "granted" : "denied";
    } catch (error) {
      report(error);
      return "denied";
    }
  },

  /**
   * İzni ister; yalnızca kullanıcı anahtarı ya da öneri kartını açtığında.
   * Zaten verildiyse sormadan döner. Kalıcı reddedildiyse Android kutuyu
   * bir daha göstermez, sonuç doğrudan "denied" gelir.
   */
  async requestPermission(): Promise<ReminderPermission> {
    if (!platformFeatures.reminders) return "denied";
    try {
      const plugin = await loadPlugin();
      if (await isGranted(plugin)) return "granted";
      const { display } = await plugin.LocalNotifications.requestPermissions();
      if (display !== "granted") return "denied";
      return (await isGranted(plugin)) ? "granted" : "denied";
    } catch (error) {
      report(error);
      return "denied";
    }
  },
};
