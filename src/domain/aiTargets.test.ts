import { describe, expect, it } from "vitest";

import { AI_TARGETS } from "./aiTargets";

describe("AI_TARGETS", () => {
  it("id'ler tekil", () => {
    const ids = AI_TARGETS.map((target) => target.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(AI_TARGETS)("$label: baseUrl https ve sorgu/parça içermiyor", (target) => {
    // buildHandoffUrl parametreyi "?" ile ekliyor; baseUrl'de sorgu olsaydı adres bozulurdu.
    const url = new URL(target.baseUrl);

    expect(url.protocol).toBe("https:");
    expect(target.baseUrl).not.toMatch(/[?#]/);
  });

  it.each(AI_TARGETS)("$label: düğme metni marka adıyla başlıyor", (target) => {
    expect(target.openLabel.startsWith(`${target.label}'`)).toBe(true);
    expect(target.openLabel.endsWith(" aç")).toBe(true);
  });
});
