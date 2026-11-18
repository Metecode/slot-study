import { describe, expect, it } from "vitest";

import { originFromSource, originIssues, reposMissingFromNotices } from "./origin";
import { originSchema } from "./question";
import type { Origin } from "./question";

const SUDHEERJ: Origin = {
  kind: "external",
  repo: "sudheerj/reactjs-interview-questions",
  url: "https://github.com/sudheerj/reactjs-interview-questions",
  license: "MIT",
};
const EXTERNAL_SOURCE = "Kendi derleme — react.dev: Hooks; soru kaynağı: sudheerj/reactjs-interview-questions (MIT)";

describe("originFromSource", () => {
  it("işaret yoksa own", () => {
    expect(originFromSource("Kendi derleme — PostgreSQL 18 Docs: Indexes")).toEqual({ kind: "own" });
    expect(originFromSource(undefined)).toEqual({ kind: "own" });
  });

  it("işaretten repo, adres ve lisansı çıkarır", () => {
    expect(originFromSource(EXTERNAL_SOURCE)).toEqual(SUDHEERJ);
  });

  it("lisansı olduğu gibi aktarır, kabul ya da ret şemanın işi", () => {
    const candidate = originFromSource("soru kaynağı: a/b (GPL-3.0)");
    expect(candidate).toMatchObject({ kind: "external", repo: "a/b", license: "GPL-3.0" });
    expect(originSchema.safeParse(candidate).success).toBe(false);
    expect(originSchema.safeParse(originFromSource(EXTERNAL_SOURCE)).success).toBe(true);
  });
});

describe("originIssues", () => {
  it("tutarlı kökenlerde sorun yok", () => {
    expect(originIssues({ source: "Kendi derleme — MDN: Closures", origin: { kind: "own" } })).toEqual([]);
    expect(originIssues({ source: EXTERNAL_SOURCE, origin: SUDHEERJ })).toEqual([]);
  });

  it("source dış kaynak diyor, origin own", () => {
    expect(originIssues({ source: EXTERNAL_SOURCE, origin: { kind: "own" } })).toHaveLength(1);
  });

  it("origin external, source'ta işaret yok", () => {
    expect(originIssues({ source: "Kendi derleme — MDN: Closures", origin: SUDHEERJ })).toHaveLength(1);
    expect(originIssues({ source: undefined, origin: SUDHEERJ })).toHaveLength(1);
  });

  it("repo ya da lisans uyuşmuyor", () => {
    expect(originIssues({ source: EXTERNAL_SOURCE, origin: { ...SUDHEERJ, repo: "baska/repo" } })).toEqual([
      "repo uyuşmuyor: source sudheerj/reactjs-interview-questions, origin baska/repo",
    ]);
    expect(originIssues({ source: EXTERNAL_SOURCE, origin: { ...SUDHEERJ, license: "Apache-2.0" } })).toEqual([
      "lisans uyuşmuyor: source MIT, origin Apache-2.0",
    ]);
  });
});

describe("reposMissingFromNotices", () => {
  it("bildirimde olmayan dış repo'ları döner, own'u saymaz", () => {
    const questions = [{ origin: SUDHEERJ }, { origin: { ...SUDHEERJ, repo: "yeni/repo" } }, { origin: { kind: "own" } as Origin }];
    expect(reposMissingFromNotices(questions, "sudheerj/reactjs-interview-questions\nMIT License")).toEqual(["yeni/repo"]);
  });
});
