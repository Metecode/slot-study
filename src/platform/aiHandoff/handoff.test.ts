import { describe, expect, it, vi } from "vitest";

import { AI_TARGETS } from "../../domain/aiTargets";
import type { AiTarget } from "../../domain/aiTargets";
import type { AiHandoffAdapter } from "./AiHandoffAdapter";
import { handoff } from "./handoff";

/* ------------------------------------------------------------------ */
/* Sıralama ve sonuç — sahte adapter, çağrılar günlüğe yazılır          */
/* ------------------------------------------------------------------ */

const targets: readonly AiTarget[] = AI_TARGETS;

function target(id: AiTarget["id"]): AiTarget {
  const found = targets.find((t) => t.id === id);
  if (!found) throw new Error(`hedef yok: ${id}`);
  return found;
}

/** copy'nin sonucunu test belirler; çağrı sırası log'da. */
function fakeAdapter(copy: (text: string) => Promise<boolean>) {
  const log: string[] = [];
  const adapter = {
    copy: vi.fn((text: string) => {
      log.push("copy");
      return copy(text);
    }),
    canShare: () => false,
    share: vi.fn(() => Promise.resolve("shared" as const)),
    open: vi.fn((url: string) => {
      log.push(`open ${url}`);
    }),
  } satisfies AiHandoffAdapter;
  return { adapter, log };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("handoff — sıralama", () => {
  it("kopyayı başlatır, çözülmesini beklemeden aynı çağrıda açar", async () => {
    const copy = deferred<boolean>();
    const { adapter, log } = fakeAdapter(() => copy.promise);

    const pending = handoff(target("chatgpt"), "ışık", adapter);

    // Henüz hiçbir mikro görev çalışmadı: open senkron çağrılmış olmalı.
    expect(log).toEqual(["copy", "open https://chatgpt.com/?q=%C4%B1%C5%9F%C4%B1k"]);

    copy.resolve(true);
    await expect(pending).resolves.toEqual({ promptIncluded: true, copied: true });
  });

  it("istemin tamamını kopyalar, adreste gitse de", async () => {
    const { adapter } = fakeAdapter(() => Promise.resolve(true));

    await handoff(target("claude"), "Soru\nCevap", adapter);

    expect(adapter.copy).toHaveBeenCalledExactlyOnceWith("Soru\nCevap");
  });
});

describe("handoff — kopya başarısız", () => {
  it("copy false dönerse copied false", async () => {
    const { adapter } = fakeAdapter(() => Promise.resolve(false));

    await expect(handoff(target("chatgpt"), "istem", adapter)).resolves.toEqual({
      promptIncluded: true,
      copied: false,
    });
    expect(adapter.open).toHaveBeenCalledOnce();
  });

  it("reddedilen kopya yutulmaz ama fırlamaz: copied false", async () => {
    const { adapter } = fakeAdapter(() => Promise.reject(new DOMException("Document is not focused.", "NotAllowedError")));

    await expect(handoff(target("perplexity"), "istem", adapter)).resolves.toEqual({
      promptIncluded: true,
      copied: false,
    });
  });

  it("senkron fırlatan kopya da açmayı engellemez", async () => {
    const { adapter } = fakeAdapter(() => {
      throw new Error("sözleşme dışı");
    });

    await expect(handoff(target("chatgpt"), "istem", adapter)).resolves.toMatchObject({ copied: false });
    expect(adapter.open).toHaveBeenCalledOnce();
  });
});

describe("handoff — istem adreste gidemediğinde", () => {
  it("parametre desteklemeyen hedefte baseUrl açılır, kopya alınır", async () => {
    const { adapter } = fakeAdapter(() => Promise.resolve(true));

    const outcome = await handoff(target("gemini"), "istem", adapter);

    expect(outcome).toEqual({ promptIncluded: false, reason: "unsupported", copied: true });
    expect(adapter.open).toHaveBeenCalledExactlyOnceWith("https://gemini.google.com/app");
    expect(adapter.copy).toHaveBeenCalledExactlyOnceWith("istem");
  });

  it("uzun istemde baseUrl açılır, reason too_long", async () => {
    const { adapter } = fakeAdapter(() => Promise.resolve(true));

    const outcome = await handoff(target("chatgpt"), "ş".repeat(5000), adapter);

    expect(outcome).toEqual({ promptIncluded: false, reason: "too_long", copied: true });
    expect(adapter.open).toHaveBeenCalledExactlyOnceWith("https://chatgpt.com/");
  });

  it("eşi olmayan surrogate'te baseUrl açılır, istem yine kopyalanır", async () => {
    const { adapter } = fakeAdapter(() => Promise.resolve(true));

    const outcome = await handoff(target("claude"), "a\uD800b", adapter);

    expect(outcome).toEqual({ promptIncluded: false, reason: "encode_error", copied: true });
    expect(adapter.open).toHaveBeenCalledExactlyOnceWith("https://claude.ai/new");
    expect(adapter.copy).toHaveBeenCalledExactlyOnceWith("a\uD800b");
  });

  it("istem gidemedi ve kopya da tutmadı: ikisi birlikte raporlanır", async () => {
    const { adapter } = fakeAdapter(() => Promise.resolve(false));

    await expect(handoff(target("gemini"), "istem", adapter)).resolves.toEqual({
      promptIncluded: false,
      reason: "unsupported",
      copied: false,
    });
  });
});
