import { afterEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Platform bayrakları — Capacitor taklit edilir                       */
/* ------------------------------------------------------------------ */

/*
  Bayraklar modül yüklenirken bir kez hesaplanıyor; her test Capacitor'ı
  kendi değeriyle taklit edip modülleri yeniden yükler.
*/
function mockCapacitor(platform: "web" | "android" | "ios"): void {
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => platform !== "web", getPlatform: () => platform },
  }));
}

/** load olayını beklemeden çalıştıran sahte window ve navigator. */
function stubBrowser() {
  const register = vi.fn(() => Promise.resolve({} as ServiceWorkerRegistration));
  vi.stubGlobal("navigator", { serviceWorker: { register } });
  vi.stubGlobal("window", {
    addEventListener: (_type: string, listener: () => void) => listener(),
  });
  return register;
}

afterEach(() => {
  vi.doUnmock("@capacitor/core");
  vi.unstubAllGlobals();
});

describe("platformFeatures", () => {
  it("web'de auth, service worker ve aynı origin sayfalar açık, haptik ve hatırlatıcı kapalı", async () => {
    mockCapacitor("web");
    const { platformFeatures } = await import("./index");

    expect(platformFeatures).toEqual({
      auth: true,
      serviceWorker: true,
      haptics: false,
      reminders: false,
      notificationChannels: false,
      sameOriginPages: true,
    });
  });

  it("Android'de auth, service worker ve aynı origin sayfalar kapalı, haptik, hatırlatıcı ve kanal açık", async () => {
    mockCapacitor("android");
    const { platformFeatures } = await import("./index");

    expect(platformFeatures).toEqual({
      auth: false,
      serviceWorker: false,
      haptics: true,
      reminders: true,
      notificationChannels: true,
      sameOriginPages: false,
    });
  });

  it("iOS'ta Android ile aynı, yalnızca bildirim kanalı yok", async () => {
    mockCapacitor("ios");
    const { platformFeatures } = await import("./index");

    expect(platformFeatures).toEqual({
      auth: false,
      serviceWorker: false,
      haptics: true,
      reminders: true,
      notificationChannels: false,
      sameOriginPages: false,
    });
  });
});

describe("storage seçimi", () => {
  afterEach(() => {
    vi.doUnmock("./storage/filesystemAdapter");
  });

  it("web'de IndexedDB adapter'ı", async () => {
    mockCapacitor("web");
    const { storage } = await import("./index");
    const { indexedDbAdapter } = await import("./storage/indexedDbAdapter");

    expect(storage).toBe(indexedDbAdapter);
  });

  it("native'de dosya adapter'ı, modül yüklenirken değil ilk çağrıda yüklenir", async () => {
    mockCapacitor("android");
    const { createMemoryAdapter } = await import("./storage/memoryAdapter");
    const createFilesystemAdapter = vi.fn(createMemoryAdapter);
    vi.doMock("./storage/filesystemAdapter", () => ({ createFilesystemAdapter }));

    const { storage } = await import("./index");
    const { indexedDbAdapter } = await import("./storage/indexedDbAdapter");
    expect(storage).not.toBe(indexedDbAdapter);
    expect(createFilesystemAdapter).not.toHaveBeenCalled();

    await storage.set("ns", "k", 1);
    expect(await storage.get("ns", "k")).toBe(1);
    expect(createFilesystemAdapter).toHaveBeenCalledTimes(1);
  });
});

describe("aiHandoff seçimi", () => {
  afterEach(() => {
    vi.doUnmock("./aiHandoff/nativeAiHandoff");
  });

  it("web'de web adapter'ı", async () => {
    mockCapacitor("web");
    const { aiHandoff } = await import("./index");
    const { webAiHandoff } = await import("./aiHandoff/webAiHandoff");

    expect(aiHandoff).toBe(webAiHandoff);
  });

  it("native'de native adapter'ı, modül yüklenirken oluşturulur", async () => {
    mockCapacitor("android");
    const nativeAdapter = { copy: vi.fn(), canShare: vi.fn(), share: vi.fn(), open: vi.fn() };
    const createNativeAiHandoff = vi.fn(() => nativeAdapter);
    vi.doMock("./aiHandoff/nativeAiHandoff", () => ({ createNativeAiHandoff }));

    const { aiHandoff } = await import("./index");

    expect(aiHandoff).toBe(nativeAdapter);
    expect(createNativeAiHandoff).toHaveBeenCalledOnce();
  });

  it("copyToClipboard native'de eklentili adapter'dan geçer, navigator.clipboard'a gitmez", async () => {
    mockCapacitor("ios");
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const copy = vi.fn(() => Promise.resolve(true));
    const nativeAdapter = { copy, canShare: vi.fn(), share: vi.fn(), open: vi.fn() };
    vi.doMock("./aiHandoff/nativeAiHandoff", () => ({ createNativeAiHandoff: () => nativeAdapter }));

    const { copyToClipboard } = await import("./index");

    await expect(copyToClipboard("SELECT 1;")).resolves.toBe(true);
    expect(copy).toHaveBeenCalledExactlyOnceWith("SELECT 1;");
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("registerServiceWorker", () => {
  it("web'de /sw.js'i kök kapsamla kaydeder", async () => {
    mockCapacitor("web");
    const register = stubBrowser();
    const { registerServiceWorker } = await import("./serviceWorker");

    registerServiceWorker();

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("native'de kayıt yapmaz", async () => {
    mockCapacitor("android");
    const register = stubBrowser();
    const { registerServiceWorker } = await import("./serviceWorker");

    registerServiceWorker();

    expect(register).not.toHaveBeenCalled();
  });
});
