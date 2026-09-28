import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DAY_ROLLOVER_HOUR, studyDayAfter, studyDayStart, studyDaysBetween } from "./studyDay";

/*
  Çalışma günü yerel takvime bağlı. Varsayılan İstanbul (yaz saati yok),
  yaz saati testleri Berlin'de. Tarihler her testin İÇİNDE kurulur: modül
  seviyesinde kurulsa saat dilimi ayarlanmadan önce hesaplanırdı.
*/
function useTimeZone(tz: string): void {
  beforeAll(() => {
    vi.stubEnv("TZ", tz);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
}

/** Yerel saat; ay 1'den başlar. */
function local(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute);
}

describe("studyDayStart", () => {
  useTimeZone("Europe/Istanbul");

  it("gün yerel 04:00'da döner", () => {
    expect(DAY_ROLLOVER_HOUR).toBe(4);
    expect(studyDayStart(local(2026, 3, 10, 4))).toEqual(local(2026, 3, 10, 4));
    expect(studyDayStart(local(2026, 3, 10, 15, 30))).toEqual(local(2026, 3, 10, 4));
    expect(studyDayStart(local(2026, 3, 10, 23, 59))).toEqual(local(2026, 3, 10, 4));
  });

  it("gece yarısından 04:00'a kadar önceki güne sayılır", () => {
    expect(studyDayStart(local(2026, 3, 11, 0, 0))).toEqual(local(2026, 3, 10, 4));
    expect(studyDayStart(local(2026, 3, 11, 3, 59))).toEqual(local(2026, 3, 10, 4));
  });

  it("ay ve yıl sınırında önceki güne geçer", () => {
    expect(studyDayStart(local(2026, 3, 1, 2))).toEqual(local(2026, 2, 28, 4));
    expect(studyDayStart(local(2027, 1, 1, 1))).toEqual(local(2026, 12, 31, 4));
  });

  it("gelen tarihi değiştirmez", () => {
    const at = local(2026, 3, 11, 2);
    const before = at.getTime();
    studyDayStart(at);
    expect(at.getTime()).toBe(before);
  });
});

describe("studyDayAfter", () => {
  useTimeZone("Europe/Istanbul");

  it("çalışma gününe gün ekler, saat hep 04:00", () => {
    expect(studyDayAfter(local(2026, 3, 10, 20, 30), 1)).toEqual(local(2026, 3, 11, 4));
    expect(studyDayAfter(local(2026, 3, 10, 9), 4)).toEqual(local(2026, 3, 14, 4));
  });

  it("23:50'de görülene 'yarın' ertesi gün 04:00, on dakika sonra değil", () => {
    expect(studyDayAfter(local(2026, 3, 10, 23, 50), 1)).toEqual(local(2026, 3, 11, 4));
  });

  it("gece 01:30 hâlâ önceki gün: 'yarın' aynı takvim gününün 04:00'ı", () => {
    expect(studyDayAfter(local(2026, 3, 11, 1, 30), 1)).toEqual(local(2026, 3, 11, 4));
  });

  it("0 gün çalışma gününün kendi başlangıcıdır", () => {
    expect(studyDayAfter(local(2026, 3, 10, 18), 0)).toEqual(local(2026, 3, 10, 4));
  });

  it("ay ve yıl sınırını takvimle aşar", () => {
    expect(studyDayAfter(local(2026, 12, 20, 21), 16)).toEqual(local(2027, 1, 5, 4));
  });
});

describe("studyDaysBetween", () => {
  useTimeZone("Europe/Istanbul");

  it("aynı çalışma günü 0", () => {
    expect(studyDaysBetween(local(2026, 3, 10, 5), local(2026, 3, 11, 3))).toBe(0);
  });

  it("04:00 sınırını geçince 1", () => {
    expect(studyDaysBetween(local(2026, 3, 10, 23), local(2026, 3, 11, 4))).toBe(1);
  });

  it("geriye doğru negatif", () => {
    expect(studyDaysBetween(local(2026, 3, 14, 12), local(2026, 3, 10, 12))).toBe(-4);
  });

  it("studyDayAfter ile tutarlı: n gün sonrası n gün farktır", () => {
    const from = local(2026, 3, 10, 21);
    for (const days of [1, 2, 4, 8, 16]) {
      expect(studyDaysBetween(from, studyDayAfter(from, days))).toBe(days);
    }
  });
});

describe("çalışma günü — yaz saati (Europe/Berlin)", () => {
  useTimeZone("Europe/Berlin");

  it("ileri alma gününde (29 Mart 2026) gün yine 04:00'da başlar", () => {
    const start = studyDayAfter(local(2026, 3, 28, 21), 1);
    expect(start).toEqual(local(2026, 3, 29, 4));
    expect(start.toISOString()).toBe("2026-03-29T02:00:00.000Z");
  });

  it("ileri alma gününde 04:30 o güne aittir (gece yalnızca 3 saat 30 dakika sürdü)", () => {
    expect(studyDayStart(local(2026, 3, 29, 4, 30))).toEqual(local(2026, 3, 29, 4));
  });

  it("geri alma gününde (25 Ekim 2026) gün 04:00'da başlar", () => {
    const start = studyDayAfter(local(2026, 10, 24, 21), 1);
    expect(start).toEqual(local(2026, 10, 25, 4));
    expect(start.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("23 ve 25 saatlik günler de bir gün sayılır", () => {
    expect(studyDaysBetween(local(2026, 3, 28, 12), local(2026, 3, 29, 12))).toBe(1);
    expect(studyDaysBetween(local(2026, 10, 24, 12), local(2026, 10, 25, 12))).toBe(1);
  });
});
