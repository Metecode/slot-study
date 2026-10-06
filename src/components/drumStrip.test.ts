import { describe, expect, it } from "vitest";

import { stripTransform } from "./drumStrip";

/**
 * Tarayıcının yaptığını taklit eder: translateY(%) şeridin kendi
 * yüksekliğine (satır sayısı × satır yüksekliği) göre piksele çözülür.
 */
function resolvePx(transform: string, totalRows: number, rowHeight: number): number {
  const match = /^translateY\((-?[\d.e-]+)%\)$/.exec(transform);
  if (!match) throw new Error(`beklenmeyen transform: ${transform}`);
  return (Number(match[1]) / 100) * totalRows * rowHeight;
}

/** Penceredeki üç satırdan ortadakine (indeks 1) denk gelen şerit satırı. */
function centerRowAt(transform: string, totalRows: number, rowHeight: number): number {
  const y = resolvePx(transform, totalRows, rowHeight);
  return 1 + Math.round(-y / rowHeight);
}

describe("stripTransform", () => {
  // Makinedeki gerçek ölçüler: 3 turda kazanan 49. satırda, şerit 51 satır.
  const TOTAL = 51;
  const WINNER = 49;
  const SHIFT = WINNER - 1;

  // 64: masaüstü --row, 56: dar ekran; 40 ve 72: başka bir ölçek gelirse.
  it.each([64, 56, 40, 72])("satır %i px iken kazanan ortada kalır", (row) => {
    expect(centerRowAt(stripTransform(SHIFT, TOTAL), TOTAL, row)).toBe(WINNER);
  });

  it("aynı transform satır yüksekliği değişince de kazananı gösterir", () => {
    // Hatanın kendisi: bir kez yazılan değer 1280 → 360 → 1280 boyunca kalıyor.
    const transform = stripTransform(SHIFT, TOTAL);
    for (const row of [64, 56, 64]) {
      const y = resolvePx(transform, TOTAL, row);
      // Kazananın üst kenarı pencerenin ikinci satırında, şerit pencereyi dolduruyor.
      expect(y + WINNER * row).toBeCloseTo(row, 6);
      expect(y + TOTAL * row).toBeGreaterThanOrEqual(3 * row);
    }
  });

  it("kesirli satır (taşma) satır yüksekliğiyle orantılı", () => {
    expect(resolvePx(stripTransform(SHIFT + 0.3, TOTAL), TOTAL, 56)).toBeCloseTo(-(SHIFT + 0.3) * 56, 6);
  });

  it("öteleme yoksa ya da şerit boşsa 0", () => {
    expect(stripTransform(0, TOTAL)).toBe("translateY(0%)");
    expect(stripTransform(5, 0)).toBe("translateY(0%)");
  });
});
