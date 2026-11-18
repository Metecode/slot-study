import { describe, expect, it } from "vitest";

import { LOADED_QUESTIONS } from "./index";
import { LICENSE_SECTIONS } from "./licenses";

/* Panelde gösterilen metinler gerçekten pakette ve yükümlülükleri taşıyor. */

const byId = (id: string) => {
  const section = LICENSE_SECTIONS.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`bölüm yok: ${id}`);
  return section;
};

describe("lisans metinleri", () => {
  it("kod lisansı MIT'in tam metni", () => {
    expect(byId("kod").text).toMatch(/^MIT License/);
    expect(byId("kod").text).toContain("The above copyright notice and this permission notice shall be included");
  });

  it("içerik lisansı CC BY-SA 4.0 ve resmi metne bağlantı", () => {
    expect(byId("icerik").text).toContain("CC BY-SA 4.0");
    expect(byId("icerik").text).toContain("creativecommons.org/licenses/by-sa/4.0");
  });

  it("dış kaynaklı her repo'nun MIT bildirimi üçüncü taraf bölümünde", () => {
    const notices = byId("ucuncu-taraf").text;
    const repos = new Set(
      LOADED_QUESTIONS.flatMap((question) => (question.origin.kind === "external" ? [question.origin.repo] : [])),
    );
    expect(repos.size).toBeGreaterThan(0);
    for (const repo of repos) expect(notices).toContain(repo);
    expect(notices).toContain("Copyright (c) 2017-Present Sudheer Jonna");
    expect(notices).toContain("Permission is hereby granted");
  });

  it("üçüncü taraf bölümündeki soru sayısı içerikle aynı", () => {
    const external = LOADED_QUESTIONS.filter((question) => question.origin.kind === "external").length;
    expect(byId("ucuncu-taraf").scope).toContain(`${external} soru`);
  });
});
