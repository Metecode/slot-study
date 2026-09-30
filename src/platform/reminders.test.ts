import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Hatırlatıcı — Capacitor ve eklenti taklit edilir                    */
/* ------------------------------------------------------------------ */

/*
  Platform bayrağı modül yüklenirken bir kez hesaplanıyor; her test
  Capacitor'ı kendi değeriyle taklit edip modülü yeniden yükler. Modülün
  durumu (yüklü eklenti, kanal, kuyruk) da böylece sıfırlanır.
*/

type Display = "granted" | "denied" | "prompt";

const calls: string[] = [];
let display: Display = "granted";
let enabled = true;
let requestResult: Display = "granted";

const LocalNotifications = {
  checkPermissions: vi.fn(async () => ({ display })),
  requestPermissions: vi.fn(async () => {
    display = requestResult;
    return { display };
  }),
  areEnabled: vi.fn(async () => ({ value: enabled })),
  createChannel: vi.fn<(channel: unknown) => Promise<void>>(async () => {
    calls.push("createChannel");
  }),
  removeDeliveredNotificationsById: vi.fn<(options: unknown) => Promise<void>>(async () => {
    calls.push("removeDelivered");
  }),
  cancel: vi.fn<(options: unknown) => Promise<void>>(async () => {
    calls.push("cancel");
  }),
  schedule: vi.fn<
    (options: { notifications: Record<string, unknown>[] }) => Promise<{ notifications: { id: number }[] }>
  >(async () => {
    calls.push("schedule");
    return { notifications: [{ id: 1 }] };
  }),
};
const pluginFactory = vi.fn(() => ({ LocalNotifications }));

async function loadReminders(native: boolean) {
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => native },
  }));
  vi.doMock("@capacitor/local-notifications", pluginFactory);
  const { reminders } = await import("./reminders");
  return reminders;
}

/** Son schedule çağrısındaki tek bildirim. */
function scheduledNotification(): Record<string, unknown> {
  const options = LocalNotifications.schedule.mock.lastCall?.[0];
  if (!options) throw new Error("schedule çağrılmadı");
  return options.notifications[0];
}

beforeEach(() => {
  calls.length = 0;
  display = "granted";
  enabled = true;
  requestResult = "granted";
  for (const fn of Object.values(LocalNotifications)) fn.mockClear();
  pluginFactory.mockClear();
});

afterEach(() => {
  vi.doUnmock("@capacitor/core");
  vi.doUnmock("@capacitor/local-notifications");
  vi.restoreAllMocks();
});

describe("web", () => {
  it("hiçbir şey yapmaz, eklentiyi yüklemez", async () => {
    const reminders = await loadReminders(false);

    await reminders.sync(new Date("2026-03-11T16:00:00.000Z"));
    await reminders.sync(null);
    expect(await reminders.checkPermission()).toBe("denied");
    expect(await reminders.requestPermission()).toBe("denied");

    expect(pluginFactory).not.toHaveBeenCalled();
  });
});

describe("native — kurulum", () => {
  it("eklenti modül yüklenirken değil ilk çağrıda yüklenir", async () => {
    const reminders = await loadReminders(true);
    expect(pluginFactory).not.toHaveBeenCalled();

    await reminders.sync(null);
    expect(pluginFactory).toHaveBeenCalledTimes(1);
  });

  it("önce panelden kaldırır ve iptal eder, sonra kanalı kurup zamanlar", async () => {
    const reminders = await loadReminders(true);
    const at = new Date("2026-03-11T16:00:00.000Z");

    await reminders.sync(at);

    expect(calls).toEqual(["removeDelivered", "cancel", "createChannel", "schedule"]);
    expect(LocalNotifications.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
    expect(LocalNotifications.removeDeliveredNotificationsById).toHaveBeenCalledWith({ ids: [1] });
  });

  it("kesin alarm istemez, doze'da çalabilir, kendi kanalıyla kurar", async () => {
    const reminders = await loadReminders(true);
    const at = new Date("2026-03-11T16:00:00.000Z");

    await reminders.sync(at);

    expect(scheduledNotification()).toEqual({
      id: 1,
      title: "Tekrar zamanı",
      body: "Birkaç soru çevirmeye ne dersin? Öğrendiklerini taze tutmanın vakti.",
      channelId: "review-reminders",
      autoCancel: true,
      isExactNotification: false,
      schedule: { at, allowWhileIdle: true },
    });
  });

  it("kanal Türkçe adıyla ve önem 3 ile bir kez kurulur", async () => {
    const reminders = await loadReminders(true);

    await reminders.sync(new Date("2026-03-11T16:00:00.000Z"));
    await reminders.sync(new Date("2026-03-12T16:00:00.000Z"));

    expect(LocalNotifications.createChannel).toHaveBeenCalledExactlyOnceWith({
      id: "review-reminders",
      name: "Tekrar hatırlatıcısı",
      description: "Tekrar zamanı gelen soru olduğunda günde en fazla bir hatırlatma.",
      importance: 3,
    });
  });

  it("null (ayar kapalı ya da hatırlatacak soru yok) yalnızca iptal eder", async () => {
    const reminders = await loadReminders(true);

    await reminders.sync(null);

    expect(calls).toEqual(["removeDelivered", "cancel"]);
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("art arda çağrılarda yalnızca sonuncusu uygulanır", async () => {
    const reminders = await loadReminders(true);
    const last = new Date("2026-03-13T16:00:00.000Z");

    void reminders.sync(new Date("2026-03-11T16:00:00.000Z"));
    void reminders.sync(null);
    await reminders.sync(last);

    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
    expect(scheduledNotification().schedule).toEqual({ at: last, allowWhileIdle: true });
  });

  it("eklenti hatası fırlatmaz, sonraki kurulumu engellemez", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    LocalNotifications.schedule.mockRejectedValueOnce(new Error("OS-PLUG-LNOT-0005"));
    const reminders = await loadReminders(true);

    await expect(reminders.sync(new Date("2026-03-11T16:00:00.000Z"))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith("[reminders]", expect.any(Error));

    await reminders.sync(new Date("2026-03-12T16:00:00.000Z"));
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(2);
  });

  it("import hatası fırlatmaz, sonraki çağrı yeniden dener", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    pluginFactory.mockImplementationOnce(() => {
      throw new Error("chunk yüklenemedi");
    });
    const reminders = await loadReminders(true);

    await expect(reminders.sync(null)).resolves.toBeUndefined();
    expect(LocalNotifications.cancel).not.toHaveBeenCalled();

    await reminders.sync(null);
    expect(LocalNotifications.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("native — izin", () => {
  it("izin zaten varsa sormadan granted döner", async () => {
    const reminders = await loadReminders(true);

    expect(await reminders.requestPermission()).toBe("granted");
    expect(LocalNotifications.requestPermissions).not.toHaveBeenCalled();
  });

  it("izin yoksa sorar; verilirse granted", async () => {
    display = "prompt";
    const reminders = await loadReminders(true);

    expect(await reminders.requestPermission()).toBe("granted");
    expect(LocalNotifications.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it("kullanıcı reddederse denied döner ve hiçbir şey zamanlamaz", async () => {
    display = "prompt";
    requestResult = "denied";
    const reminders = await loadReminders(true);

    expect(await reminders.requestPermission()).toBe("denied");
    expect(LocalNotifications.schedule).not.toHaveBeenCalled();
  });

  it("izin var ama sistemde bildirimler kapalıysa denied", async () => {
    enabled = false;
    const reminders = await loadReminders(true);

    expect(await reminders.checkPermission()).toBe("denied");
    expect(await reminders.requestPermission()).toBe("denied");
  });

  it("checkPermission hiç sormaz", async () => {
    display = "prompt";
    const reminders = await loadReminders(true);

    expect(await reminders.checkPermission()).toBe("denied");
    expect(LocalNotifications.requestPermissions).not.toHaveBeenCalled();
  });

  it("eklenti hatasında izin denied sayılır, fırlatmaz", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    LocalNotifications.checkPermissions.mockRejectedValueOnce(new Error("bridge"));
    const reminders = await loadReminders(true);

    expect(await reminders.requestPermission()).toBe("denied");
  });
});
