import { describe, expect, it } from "vitest";

import type { HandoffFailure } from "../../domain/aiHandoff";
import type { AskOwnAiEvent } from "./askOwnAiStatus";
import { askOwnAiStatus } from "./askOwnAiStatus";

const FAILURES: HandoffFailure[] = ["unsupported", "too_long", "encode_error"];

describe("askOwnAiStatus — hedefte açma", () => {
  it.each([true, false])("prompt adreste gittiyse mesaj yok (kopya: %s)", (copied) => {
    expect(askOwnAiStatus({ kind: "handoff", outcome: { promptIncluded: true, copied } })).toBeNull();
  });

  it.each(FAILURES)("prompt gitmedi, kopya tuttu: yapıştırma yönergesi, kalıcı (%s)", (reason) => {
    expect(
      askOwnAiStatus({ kind: "handoff", outcome: { promptIncluded: false, reason, copied: true } }),
    ).toEqual({
      message: "Prompt kopyalandı, açılan sayfaya yapıştırman yeterli.",
      visible: true,
      revealPrompt: false,
      confirmCopyButton: false,
      transient: false,
    });
  });

  it.each(FAILURES)("prompt gitmedi, kopya da tutmadı: elle kopyalama, alan açılır (%s)", (reason) => {
    expect(
      askOwnAiStatus({ kind: "handoff", outcome: { promptIncluded: false, reason, copied: false } }),
    ).toEqual({
      message: "Kopyalanamadı. Promptu aşağıdan elle kopyalayabilirsin.",
      visible: true,
      revealPrompt: true,
      confirmCopyButton: false,
      transient: false,
    });
  });
});

describe("askOwnAiStatus — kopyala", () => {
  it("tuttu: düğme onaylar, okuyucuya duyurulur, kısa sürede silinir", () => {
    expect(askOwnAiStatus({ kind: "copy", copied: true })).toEqual({
      message: "Prompt panoya kopyalandı.",
      visible: false,
      revealPrompt: false,
      confirmCopyButton: true,
      transient: true,
    });
  });

  it("tutmadı: hedefteki kopya hatasıyla aynı mesaj, alan açılır", () => {
    expect(askOwnAiStatus({ kind: "copy", copied: false })).toEqual(
      askOwnAiStatus({ kind: "handoff", outcome: { promptIncluded: false, reason: "unsupported", copied: false } }),
    );
  });
});

describe("askOwnAiStatus — paylaş", () => {
  it.each(["shared", "cancelled"] as const)("%s: mesaj yok", (result) => {
    expect(askOwnAiStatus({ kind: "share", result })).toBeNull();
  });

  it("failed: kopyalamaya yönlendirir, alanı açmaz", () => {
    expect(askOwnAiStatus({ kind: "share", result: "failed" })).toEqual({
      message: "Paylaşılamadı. Promptu kopyalayıp yapıştırabilirsin.",
      visible: true,
      revealPrompt: false,
      confirmCopyButton: false,
      transient: false,
    });
  });
});

describe("askOwnAiStatus — genel", () => {
  const events: AskOwnAiEvent[] = [
    ...[true, false].map((copied) => ({ kind: "copy", copied }) as const),
    ...(["shared", "cancelled", "failed"] as const).map((result) => ({ kind: "share", result }) as const),
    ...FAILURES.flatMap((reason) =>
      [true, false].map((copied) => ({ kind: "handoff", outcome: { promptIncluded: false, reason, copied } }) as const),
    ),
  ];

  it.each(events)("mesaj varsa boş değil ve 'prompt' der, 'istem' demez (%#)", (event) => {
    const status = askOwnAiStatus(event);
    if (status === null) return;

    expect(status.message.trim()).not.toBe("");
    expect(status.message).not.toMatch(/istem/i);
  });

  it.each(events)("görünmeyen mesaj kalıcı değil: okuyucu duyurusu ekranda asılı kalmaz (%#)", (event) => {
    const status = askOwnAiStatus(event);
    if (status === null || status.visible) return;

    expect(status.transient).toBe(true);
  });
});
