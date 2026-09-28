import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Native — pano ve paylaşım eklentileri taklit edilir                  */
/* ------------------------------------------------------------------ */

const write = vi.fn<(options: { string: string }) => Promise<void>>(() => Promise.resolve());
const shareCall = vi.fn<(options: { text: string }) => Promise<{ activityType?: string }>>(() =>
  Promise.resolve({}),
);
const clipboardFactory = vi.fn(() => ({ Clipboard: { write } }));
const shareFactory = vi.fn(() => ({ Share: { share: shareCall } }));

async function loadAdapter() {
  vi.resetModules();
  vi.doMock("@capacitor/clipboard", clipboardFactory);
  vi.doMock("@capacitor/share", shareFactory);
  const { createNativeAiHandoff } = await import("./nativeAiHandoff");
  return createNativeAiHandoff();
}

beforeEach(() => {
  write.mockReset().mockImplementation(() => Promise.resolve());
  shareCall.mockReset().mockImplementation(() => Promise.resolve({}));
  clipboardFactory.mockClear();
  shareFactory.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock("@capacitor/clipboard");
  vi.doUnmock("@capacitor/share");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("önceden yükleme", () => {
  it("adapter oluşturulurken iki eklenti de yüklenmeye başlar", async () => {
    await loadAdapter();
    await vi.dynamicImportSettled();

    expect(clipboardFactory).toHaveBeenCalledOnce();
    expect(shareFactory).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it("yükleme hatası önbelleğe alınmaz, ilk kopya yeniden dener", async () => {
    clipboardFactory.mockImplementationOnce(() => {
      throw new Error("chunk yüklenemedi");
    });
    const adapter = await loadAdapter();
    await vi.dynamicImportSettled();

    await expect(adapter.copy("istem")).resolves.toBe(true);
    expect(clipboardFactory).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledExactlyOnceWith({ string: "istem" });
  });
});

describe("copy", () => {
  it("eklentiye yazar, true döner", async () => {
    const adapter = await loadAdapter();

    await expect(adapter.copy("ş\n😀")).resolves.toBe(true);
    expect(write).toHaveBeenCalledExactlyOnceWith({ string: "ş\n😀" });
  });

  it("eklenti reddederse false, fırlatmaz", async () => {
    write.mockImplementation(() => Promise.reject(new Error("pano yok")));
    const adapter = await loadAdapter();

    await expect(adapter.copy("istem")).resolves.toBe(false);
  });

  it("navigator.clipboard'a dokunmaz", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const adapter = await loadAdapter();

    await adapter.copy("istem");

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("share", () => {
  it("canShare hep true", async () => {
    expect((await loadAdapter()).canShare()).toBe(true);
  });

  it("paylaşılırsa shared, metni text alanında gönderir", async () => {
    const adapter = await loadAdapter();

    await expect(adapter.share("istem")).resolves.toBe("shared");
    expect(shareCall).toHaveBeenCalledExactlyOnceWith({ text: "istem" });
  });

  it("eklentinin vazgeçme mesajı cancelled", async () => {
    shareCall.mockImplementation(() => Promise.reject(new Error("Share canceled")));
    const adapter = await loadAdapter();

    await expect(adapter.share("istem")).resolves.toBe("cancelled");
  });

  it("başka her hata failed", async () => {
    shareCall.mockImplementation(() => Promise.reject(new Error("Can't share while sharing is in progress")));
    const adapter = await loadAdapter();

    await expect(adapter.share("istem")).resolves.toBe("failed");
  });
});

describe("open", () => {
  it("window.open ile açar; sistem tarayıcısına Capacitor verir", async () => {
    const open = vi.fn();
    vi.stubGlobal("window", { open });
    const adapter = await loadAdapter();

    adapter.open("https://claude.ai/new?q=a");

    expect(open).toHaveBeenCalledExactlyOnceWith("https://claude.ai/new?q=a", "_blank", "noopener,noreferrer");
  });
});
