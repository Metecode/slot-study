import { describe, expect, it } from "vitest";

import { resolveAnimationMode } from "./spinTiming";

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
