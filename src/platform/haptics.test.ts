import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Haptik — Capacitor ve eklenti taklit edilir                         */
/* ------------------------------------------------------------------ */

/*
  Platform bayrağı modül yüklenirken bir kez hesaplanıyor; her test
  Capacitor'ı kendi değeriyle taklit edip modülü yeniden yükler. Bu
  modülün durumu (ayar, son titreşim zamanı) da böylece sıfırlanır.
*/

const impact = vi.fn<(options: { style: string }) => Promise<void>>(() => Promise.resolve());
const pluginFactory = vi.fn(() => ({
  Haptics: { impact },
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
}));
const vibrate = vi.fn<(ms: number) => boolean>(() => true);

async function loadHaptics(native: boolean) {
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => native },
  }));
  vi.doMock("@capacitor/haptics", pluginFactory);
  const { haptics } = await import("./haptics");
  return haptics;
}

/** Dinamik import ve eklenti çağrısının zinciri bitsin. */
async function flush(): Promise<void> {
  await vi.dynamicImportSettled();
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  impact.mockReset().mockImplementation(() => Promise.resolve());
  pluginFactory.mockClear();
  vibrate.mockClear();
  vi.stubGlobal("navigator", { vibrate });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.doUnmock("@capacitor/core");
  vi.doUnmock("@capacitor/haptics");
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("web", () => {
  it("leverPull yalnızca navigator.vibrate(15) çağırır, eklentiyi yüklemez", async () => {
    const haptics = await loadHaptics(false);

    haptics.leverPull();
    await flush();

    expect(vibrate).toHaveBeenCalledExactlyOnceWith(15);
    expect(pluginFactory).not.toHaveBeenCalled();
  });

  it("leverPull ayar kapalıyken de titreşir: web'de anahtar yok", async () => {
    const haptics = await loadHaptics(false);

    haptics.setEnabled(false);
    haptics.leverPull();

    expect(vibrate).toHaveBeenCalledExactlyOnceWith(15);
  });

  it("diğer olaylar hiçbir şey yapmaz", async () => {
    const haptics = await loadHaptics(false);

    haptics.reelStop();
    haptics.rated();
    haptics.switchedOn();
    await flush();

    expect(vibrate).not.toHaveBeenCalled();
    expect(pluginFactory).not.toHaveBeenCalled();
  });

  it("navigator.vibrate yoksa ya da fırlatırsa akış bozulmaz", async () => {
    const haptics = await loadHaptics(false);

    vi.stubGlobal("navigator", {});
    expect(() => haptics.leverPull()).not.toThrow();

    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("izin yok");
      },
    });
    expect(() => haptics.leverPull()).not.toThrow();
  });
});

describe("native", () => {
  it("olayları impact türlerine eşler, navigator.vibrate'i hiç çağırmaz", async () => {
    const haptics = await loadHaptics(true);

    haptics.leverPull();
    vi.advanceTimersByTime(1000);
    haptics.reelStop();
    vi.advanceTimersByTime(1000);
    haptics.rated();
    vi.advanceTimersByTime(1000);
    haptics.switchedOn();
    await flush();

    expect(impact.mock.calls.map(([options]) => options.style)).toEqual([
      "MEDIUM",
      "LIGHT",
      "LIGHT",
      "MEDIUM",
    ]);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("eklenti modül yüklenirken değil ilk olayda yüklenir", async () => {
    const haptics = await loadHaptics(true);
    await flush();
    expect(pluginFactory).not.toHaveBeenCalled();

    haptics.leverPull();
    await flush();
    expect(pluginFactory).toHaveBeenCalledTimes(1);
  });

  it("ayar kapalıyken eklentiyi çağırmaz", async () => {
    const haptics = await loadHaptics(true);

    haptics.setEnabled(false);
    haptics.leverPull();
    haptics.reelStop();
    haptics.rated();
    await flush();

    expect(impact).not.toHaveBeenCalled();
  });

  it("anahtar açılınca ayar henüz eşitlenmemiş olsa da titreşir", async () => {
    const haptics = await loadHaptics(true);

    haptics.setEnabled(false);
    haptics.switchedOn();
    await flush();

    expect(impact).toHaveBeenCalledExactlyOnceWith({ style: "MEDIUM" });
  });

  it("80 ms içinde gelen tambur duruşu düşer, sonrası titreşir", async () => {
    const haptics = await loadHaptics(true);

    // Hareket azaltma: kol ve iki tambur aynı anda.
    haptics.leverPull();
    haptics.reelStop();
    haptics.reelStop();
    await flush();
    expect(impact).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(79);
    haptics.reelStop();
    vi.advanceTimersByTime(1);
    haptics.reelStop();
    await flush();
    expect(impact.mock.calls.map(([options]) => options.style)).toEqual(["MEDIUM", "LIGHT"]);
  });

  it("eklenti hatası fırlatmaz, geliştirmede console'a yazılır", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    impact.mockImplementation(() => Promise.reject(new Error("titreşim motoru yok")));
    const haptics = await loadHaptics(true);

    expect(() => haptics.leverPull()).not.toThrow();
    await flush();

    expect(warn).toHaveBeenCalledWith("[haptics]", expect.any(Error));
  });

  it("import hatası fırlatmaz, sonraki olay yeniden dener", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    pluginFactory.mockImplementationOnce(() => {
      throw new Error("chunk yüklenemedi");
    });
    const haptics = await loadHaptics(true);

    expect(() => haptics.leverPull()).not.toThrow();
    await flush();
    expect(impact).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    haptics.leverPull();
    await flush();
    expect(impact).toHaveBeenCalledExactlyOnceWith({ style: "MEDIUM" });
  });
});
