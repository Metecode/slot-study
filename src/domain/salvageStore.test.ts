import { describe, expect, it } from "vitest";

import { emptyStore, SCHEMA_VERSION } from "./progress";
import type { QuestionProgress } from "./progress";
import { recoveryLoss, salvageStore } from "./salvageStore";

const valid = (questionId: string): QuestionProgress => ({
  questionId,
  box: 3,
  lastSeenAt: "2026-04-01T10:00:00.000Z",
  attempts: [],
});

describe("salvageStore", () => {
  it("geçerli ilerleme kayıtlarını korur, geçersizleri sayarak atar", () => {
    const result = salvageStore({
      schemaVersion: SCHEMA_VERSION,
      progress: {
        q1: valid("q1"),
        q2: { ...valid("q2"), box: 9 },
        q3: "bozuk",
      },
      settings: emptyStore().settings,
    });

    expect(result.store.progress).toEqual({ q1: valid("q1") });
    expect(result.keptProgress).toBe(1);
    expect(result.droppedProgress).toBe(2);
    expect(result.progressUnreadable).toBe(false);
    expect(result.resetSettings).toEqual([]);
  });

  it("geçerli ayarları korur, geçersizleri varsayılana döndürür", () => {
    const result = salvageStore({
      schemaVersion: SCHEMA_VERSION,
      progress: {},
      settings: { fastMode: true, soundEnabled: "evet", hapticsEnabled: 1, lang: "de", initialized: true },
    });

    expect(result.store.settings).toEqual({
      ...emptyStore().settings,
      fastMode: true,
      initialized: true,
    });
    // Eksik alanlar (soundHintShown, activeCategories) sıfırlanmış sayılmaz.
    expect(result.resetSettings).toEqual(["soundEnabled", "hapticsEnabled", "lang"]);
  });

  it("nesne olmayan settings'in tüm alanlarını sıfırlanmış sayar", () => {
    const result = salvageStore({ schemaVersion: SCHEMA_VERSION, progress: {}, settings: 42 });
    expect(result.store.settings).toEqual(emptyStore().settings);
    expect(result.resetSettings).toEqual(Object.keys(emptyStore().settings));
  });

  it("nesne olmayan kayıttan boş store çıkarır", () => {
    const result = salvageStore("tamamen bozuk");
    expect(result.store).toEqual(emptyStore());
    expect(result.progressUnreadable).toBe(true);
  });

  it("bozuk sürüm alanını bugünkü sürümle değiştirir", () => {
    const result = salvageStore({ schemaVersion: 99, progress: { q1: valid("q1") }, settings: {} });
    expect(result.store.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.store.progress.q1).toEqual(valid("q1"));
  });
});

describe("recoveryLoss", () => {
  it("hiçbir ilerleme kurtarılamadıysa allProgress", () => {
    expect(recoveryLoss(salvageStore({ progress: { q1: "bozuk" }, settings: {} }))).toBe("allProgress");
    expect(recoveryLoss(salvageStore({ progress: "bozuk", settings: {} }))).toBe("allProgress");
  });

  it("bir kısmı kurtarıldıysa someProgress", () => {
    const raw = { progress: { q1: valid("q1"), q2: "bozuk" }, settings: {} };
    expect(recoveryLoss(salvageStore(raw))).toBe("someProgress");
  });

  it("ilerleme tamsa settingsOnly", () => {
    const raw = { progress: { q1: valid("q1") }, settings: { lang: "de" } };
    expect(recoveryLoss(salvageStore(raw))).toBe("settingsOnly");
  });

  it("boş ama okunabilir ilerleme kayıp sayılmaz", () => {
    expect(recoveryLoss(salvageStore({ progress: {}, settings: { lang: "de" } }))).toBe("settingsOnly");
  });
});
