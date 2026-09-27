import { afterEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Platform bayrakları — Capacitor taklit edilir                       */
/* ------------------------------------------------------------------ */

/*
  Bayraklar modül yüklenirken bir kez hesaplanıyor; her test Capacitor'ı
  kendi değeriyle taklit edip modülleri yeniden yükler.
*/
function mockCapacitor(native: boolean): void {
  vi.resetModules();
  vi.doMock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => native },
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
  it("web'de auth ve service worker açık", async () => {
    mockCapacitor(false);
    const { platformFeatures } = await import("./index");

    expect(platformFeatures).toEqual({ auth: true, serviceWorker: true });
  });

  it("native'de auth ve service worker kapalı", async () => {
    mockCapacitor(true);
    const { platformFeatures } = await import("./index");

    expect(platformFeatures).toEqual({ auth: false, serviceWorker: false });
  });
});

describe("storage seçimi", () => {
  afterEach(() => {
    vi.doUnmock("./storage/filesystemAdapter");
  });

  it("web'de IndexedDB adapter'ı", async () => {
    mockCapacitor(false);
    const { storage } = await import("./index");
    const { indexedDbAdapter } = await import("./storage/indexedDbAdapter");

    expect(storage).toBe(indexedDbAdapter);
  });

  it("native'de dosya adapter'ı, modül yüklenirken değil ilk çağrıda yüklenir", async () => {
    mockCapacitor(true);
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

describe("registerServiceWorker", () => {
  it("web'de /sw.js'i kök kapsamla kaydeder", async () => {
    mockCapacitor(false);
    const register = stubBrowser();
    const { registerServiceWorker } = await import("./serviceWorker");

    registerServiceWorker();

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("native'de kayıt yapmaz", async () => {
    mockCapacitor(true);
    const register = stubBrowser();
    const { registerServiceWorker } = await import("./serviceWorker");

    registerServiceWorker();

    expect(register).not.toHaveBeenCalled();
  });
});
