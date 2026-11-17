import { describe, expect, it } from "vitest";

import { shouldShowUsageNotice } from "./usageNotice";

describe("shouldShowUsageNotice", () => {
  it("ilk açılışta gösterilir", () => {
    expect(shouldShowUsageNotice({ enabled: true, noticeShown: false }, true)).toBe(true);
  });

  it("bir kez gösterildiyse bir daha gösterilmez", () => {
    expect(shouldShowUsageNotice({ enabled: true, noticeShown: true }, true)).toBe(false);
  });

  it("tercih okunmadan gösterilmez", () => {
    expect(shouldShowUsageNotice(null, true)).toBe(false);
  });

  it("ölçüm bu derlemede kapalıysa gösterilmez", () => {
    expect(shouldShowUsageNotice({ enabled: true, noticeShown: false }, false)).toBe(false);
  });

  it("kullanıcı zaten kapattıysa gösterilmez", () => {
    expect(shouldShowUsageNotice({ enabled: false, noticeShown: false }, true)).toBe(false);
  });
});
