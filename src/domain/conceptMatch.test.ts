import { describe, expect, it } from "vitest";

import { conceptMatchLevel } from "./conceptMatch";

describe("conceptMatchLevel", () => {
  it("tüm kavramlar geçiyorsa all", () => {
    expect(conceptMatchLevel(3, 3)).toBe("all");
  });

  it("en az biri geçiyorsa some", () => {
    expect(conceptMatchLevel(1, 3)).toBe("some");
    expect(conceptMatchLevel(2, 3)).toBe("some");
  });

  it("hiçbiri geçmiyorsa none", () => {
    expect(conceptMatchLevel(0, 3)).toBe("none");
  });

  it("kavramı olmayan soru all: eksik kavram yok", () => {
    expect(conceptMatchLevel(0, 0)).toBe("all");
  });
});
