import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWebAiHandoff, WEB_COPY_ORDER } from "./webAiHandoff";

/* ------------------------------------------------------------------ */
/* Web — navigator, window ve document taklit edilir                   */
/* ------------------------------------------------------------------ */

type Env = {
  /** false: güvenli olmayan bağlam, navigator.clipboard hiç yok. */
  clipboard?: boolean;
  writeText?: (text: string) => Promise<void>;
  share?: (data: ShareData) => Promise<void>;
  execCommand?: boolean;
  hasFocus?: boolean;
  touch?: boolean;
};

function stubBrowser(env: Env = {}) {
  const writeText = vi.fn(env.writeText ?? (() => Promise.resolve()));
  const execCommand = vi.fn(() => env.execCommand ?? true);
  const open = vi.fn();
  const textarea = { value: "", style: {}, setAttribute: vi.fn(), select: vi.fn(), remove: vi.fn() };

  vi.stubGlobal("navigator", {
    ...(env.clipboard === false ? {} : { clipboard: { writeText } }),
    ...(env.share ? { share: env.share } : {}),
  });
  vi.stubGlobal("document", {
    createElement: vi.fn(() => textarea),
    body: { appendChild: vi.fn() },
    execCommand,
    hasFocus: vi.fn(() => env.hasFocus ?? true),
  });
  vi.stubGlobal("window", {
    open,
    matchMedia: vi.fn((query: string) => ({ matches: env.touch ?? false, media: query })),
  });

  return { writeText, execCommand, open, textarea };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webAiHandoff — varsayılan", () => {
  it("şimdilik clipboard-first", () => {
    expect(WEB_COPY_ORDER).toBe("clipboard-first");
  });
});

describe("copy — clipboard-first", () => {
  const adapter = createWebAiHandoff("clipboard-first");

  it("writeText'i senkron başlatır ve başarıda true döner", async () => {
    const { writeText, execCommand } = stubBrowser();

    const copying = adapter.copy("ş\n😀");
    expect(writeText).toHaveBeenCalledExactlyOnceWith("ş\n😀");

    await expect(copying).resolves.toBe(true);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("writeText reddeder, belge odakta: execCommand yedeği", async () => {
    const { execCommand, textarea } = stubBrowser({
      writeText: () => Promise.reject(new DOMException("izin yok", "NotAllowedError")),
    });

    await expect(adapter.copy("metin")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
    expect(textarea.value).toBe("metin");
    expect(textarea.remove).toHaveBeenCalledOnce();
  });

  it("writeText reddeder, belge odakta değil: yedek denenmez, false", async () => {
    const { execCommand } = stubBrowser({
      writeText: () => Promise.reject(new DOMException("Document is not focused.", "NotAllowedError")),
      hasFocus: false,
    });

    await expect(adapter.copy("metin")).resolves.toBe(false);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("writeText senkron fırlatsa da false, hata dışarı çıkmaz", async () => {
    stubBrowser({
      writeText: () => {
        throw new TypeError("beklenmedik");
      },
      execCommand: false,
    });

    await expect(adapter.copy("metin")).resolves.toBe(false);
  });

  it("Clipboard API yoksa execCommand beklemeden, senkron çalışır", async () => {
    const { execCommand } = stubBrowser({ clipboard: false });

    const copying = adapter.copy("metin");
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");

    await expect(copying).resolves.toBe(true);
  });

  it("execCommand fırlatırsa false", async () => {
    stubBrowser({ clipboard: false });
    vi.mocked(document.execCommand).mockImplementation(() => {
      throw new Error("desteklenmiyor");
    });

    await expect(adapter.copy("metin")).resolves.toBe(false);
  });
});

describe("copy — exec-command-first", () => {
  const adapter = createWebAiHandoff("exec-command-first");

  it("execCommand senkron çalışır, başarıdaysa writeText çağrılmaz", async () => {
    const { execCommand, writeText } = stubBrowser();

    const copying = adapter.copy("metin");
    expect(execCommand).toHaveBeenCalledOnce();

    await expect(copying).resolves.toBe(true);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("execCommand false dönerse writeText denenir", async () => {
    const { writeText } = stubBrowser({ execCommand: false });

    await expect(adapter.copy("metin")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith("metin");
  });

  it("ikisi de tutmazsa false", async () => {
    stubBrowser({ execCommand: false, writeText: () => Promise.reject(new Error("ret")) });

    await expect(adapter.copy("metin")).resolves.toBe(false);
  });
});

describe("open", () => {
  it("yeni sekmede, opener ve referrer olmadan açar", () => {
    const { open } = stubBrowser();

    createWebAiHandoff("clipboard-first").open("https://chatgpt.com/?q=a");

    expect(open).toHaveBeenCalledExactlyOnceWith("https://chatgpt.com/?q=a", "_blank", "noopener,noreferrer");
  });
});

describe("canShare", () => {
  const adapter = createWebAiHandoff("clipboard-first");
  const share = () => Promise.resolve();

  it.each([
    { share, touch: true, expected: true },
    { share, touch: false, expected: false },
    { share: undefined, touch: true, expected: false },
    { share: undefined, touch: false, expected: false },
  ])("share: $share, dokunmatik: $touch → $expected", ({ share, touch, expected }) => {
    stubBrowser({ share, touch });

    expect(adapter.canShare()).toBe(expected);
  });

  it("dokunmatik birincil işaretçiyi sorar", () => {
    stubBrowser({ share, touch: true });

    adapter.canShare();

    expect(window.matchMedia).toHaveBeenCalledWith("(hover: none) and (pointer: coarse)");
  });
});

describe("share", () => {
  const adapter = createWebAiHandoff("clipboard-first");

  it("paylaşılırsa shared, metni text alanında gönderir", async () => {
    const share = vi.fn(() => Promise.resolve());
    stubBrowser({ share });

    await expect(adapter.share("istem")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledExactlyOnceWith({ text: "istem" });
  });

  it("AbortError vazgeçmedir: cancelled", async () => {
    stubBrowser({ share: () => Promise.reject(new DOMException("vazgeçti", "AbortError")) });

    await expect(adapter.share("istem")).resolves.toBe("cancelled");
  });

  it("başka her hata failed", async () => {
    stubBrowser({ share: () => Promise.reject(new DOMException("izin yok", "NotAllowedError")) });

    await expect(adapter.share("istem")).resolves.toBe("failed");
  });

  it("navigator.share yoksa failed, fırlatmaz", async () => {
    stubBrowser();

    await expect(adapter.share("istem")).resolves.toBe("failed");
  });
});
