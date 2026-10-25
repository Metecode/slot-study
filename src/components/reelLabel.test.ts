import { describe, expect, it } from "vitest";

import { BREAK_HINT, reelLabel } from "./reelLabel";

describe("reelLabel", () => {
  it("eğik çizgiden sonra kırılma noktası ekler", () => {
    expect(reelLabel("IQueryable/IEnumerable")).toBe(`IQueryable/${BREAK_HINT}IEnumerable`);
  });

  it("her eğik çizgiye ekler", () => {
    expect(reelLabel("a/b/c")).toBe(`a/${BREAK_HINT}b/${BREAK_HINT}c`);
  });

  it("eğik çizgi yoksa metni değiştirmez", () => {
    expect(reelLabel("Kirli Okuma ve İzolasyon")).toBe("Kirli Okuma ve İzolasyon");
    expect(reelLabel("")).toBe("");
  });

  it("görünen metin aynı kalır", () => {
    expect(reelLabel("Kafka/Redis").replaceAll(BREAK_HINT, "")).toBe("Kafka/Redis");
  });

  it("farklı etiketler farklı kalır", () => {
    // Tambur komşu satırları metinle karşılaştırıyor (drumStrip.ts).
    expect(reelLabel("A/B")).not.toBe(reelLabel("AB"));
  });
});
