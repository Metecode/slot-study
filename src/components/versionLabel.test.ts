import { describe, expect, it } from "vitest";

import { versionLabel } from "./versionLabel";

describe("versionLabel", () => {
  it("commit varsa ayırıcıyla yazar", () => {
    expect(versionLabel("1.1.0", "abc1234")).toBe("v1.1.0 · abc1234");
  });

  it("dev sunucusunda \"dev\" yazar", () => {
    expect(versionLabel("1.1.0", "dev")).toBe("v1.1.0 · dev");
  });

  it("commit boşsa yalnızca sürüm, ayırıcı yok", () => {
    expect(versionLabel("1.1.0", "")).toBe("v1.1.0");
  });
});
