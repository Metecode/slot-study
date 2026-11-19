import { describe, expect, it } from "vitest";

import {
  FULL_SPIN_TIMING,
  RESULT_FEEDBACK_GAP_MS,
  resolveAnimationMode,
  SHORT_LEVER_SCALE,
  SHORT_REEL_SCALE,
  SHORT_SOUND_SCALE,
  spinPlanFor,
} from "./spinTiming";

describe("resolveAnimationMode", () => {
  it("seçim yoksa hareket azaltma açıkken Kapalı", () => {
    expect(resolveAnimationMode(undefined, true)).toBe("off");
  });

  it("seçim yoksa ve hareket azaltma kapalıysa Kısa", () => {
    expect(resolveAnimationMode(undefined, false)).toBe("short");
  });

  it("kullanıcının açık seçimi her zaman kazanır", () => {
    for (const reduced of [true, false]) {
      expect(resolveAnimationMode("full", reduced)).toBe("full");
      expect(resolveAnimationMode("short", reduced)).toBe("short");
      expect(resolveAnimationMode("off", reduced)).toBe("off");
    }
  });
});

describe("spinPlanFor — mod başına süreler", () => {
  it("Tam: her çekişte tam süreler ve bütün geri bildirimler", () => {
    for (const index of [1, 2, 50]) {
      const plan = spinPlanFor("full", index);
      expect(plan.left).toEqual({ durationMs: 1300, turns: 3 });
      expect(plan.right).toEqual({ durationMs: 1600, turns: 4 });
      expect(plan.leverPullMs).toBe(165);
      expect(plan.leverRecoverMs).toBe(430);
      expect(plan.soundScale).toBe(1);
      expect(plan).toMatchObject({ reelsAnimated: true, leverAnimated: true, leverFeedback: true, ticks: true });
    }
  });

  it("Kısa: oturumun ilk çekişi tam", () => {
    expect(spinPlanFor("short", 1)).toEqual(spinPlanFor("full", 1));
  });

  it("Kısa: sonraki çekişler tamın %30-40'ı, makara yine döner", () => {
    for (const index of [2, 3, 100]) {
      const plan = spinPlanFor("short", index);
      expect(plan.left).toEqual({ durationMs: 455, turns: 1 });
      expect(plan.right).toEqual({ durationMs: 560, turns: 1 });
      for (const reel of [plan.left, plan.right]) {
        const ratio = reel.durationMs / (reel === plan.left ? FULL_SPIN_TIMING.left : FULL_SPIN_TIMING.right).durationMs;
        expect(ratio).toBeGreaterThanOrEqual(0.3);
        expect(ratio).toBeLessThanOrEqual(0.4);
        expect(reel.turns).toBeGreaterThan(0);
      }
      expect(plan.leverPullMs).toBe(Math.round(165 * SHORT_LEVER_SCALE));
      expect(plan.leverRecoverMs).toBe(Math.round(430 * SHORT_LEVER_SCALE));
      expect(plan.soundScale).toBe(SHORT_SOUND_SCALE);
      expect(plan).toMatchObject({ reelsAnimated: true, leverAnimated: true, leverFeedback: true, ticks: true });
    }
    expect(SHORT_REEL_SCALE).toBe(0.35);
  });

  it("Kısa: sol tambur sağdan önce, sonuç geri bildirimleri ayrı duyulacak kadar arayla durur", () => {
    const plan = spinPlanFor("short", 2);
    expect(plan.right.durationMs - plan.left.durationMs).toBeGreaterThanOrEqual(RESULT_FEEDBACK_GAP_MS);
  });

  it("Kapalı: süre yok, kol sesi/titreşimi ve tıklar yok", () => {
    for (const index of [1, 2]) {
      const plan = spinPlanFor("off", index);
      expect(plan.left.durationMs).toBe(0);
      expect(plan.right.durationMs).toBe(0);
      expect(plan.leverPullMs).toBe(0);
      expect(plan.leverRecoverMs).toBe(0);
      expect(plan).toMatchObject({ reelsAnimated: false, leverAnimated: false, leverFeedback: false, ticks: false });
    }
  });
});
