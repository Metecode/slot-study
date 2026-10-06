import { describe, expect, it } from "vitest";

import { ARROW, ARROW_DEG } from "./logoGeometry";

/** "M24 100.34L100 128L24 155.66Z" → [[24, 100.34], [100, 128], [24, 155.66]] */
function points(path: string): number[][] {
  return [...path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

// Ödeme oku bu geometriyi viewBox olarak kullanıyor; üretici başka bir ok
// çizerse ok kırpılır ya da açı logodan ayrılır.
describe("logoGeometry ARROW", () => {
  const [base, tip, end] = points(ARROW.path);

  it("kutusu yolun sınırıyla aynı", () => {
    expect(base).toEqual([ARROW.x, ARROW.y]);
    expect(end[0]).toBe(ARROW.x);
    expect(end[1]).toBeCloseTo(ARROW.y + ARROW.height, 2);
    expect(tip[0]).toBe(ARROW.x + ARROW.width);
  });

  it("ucu tabanın ortasında", () => {
    expect(tip[1]).toBeCloseTo((base[1] + end[1]) / 2, 2);
  });

  it("kenar açısı ARROW_DEG", () => {
    const degrees = (Math.atan2(tip[1] - base[1], tip[0] - base[0]) * 180) / Math.PI;
    expect(degrees).toBeCloseTo(ARROW_DEG, 1);
  });
});
