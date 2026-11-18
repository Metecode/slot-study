import { describe, expect, it } from "vitest";

import { originIssues, reposMissingFromNotices } from "../domain/origin";
import { LOADED_QUESTIONS } from "./index";
import notices from "./THIRD_PARTY_NOTICES?raw";

/* ------------------------------------------------------------------ */
/* Köken kapısı — CI'da check:content çalışmıyor, aynı kural burada.    */
/* Eksik origin'i şema zaten reddediyor (içerik yüklenemez).            */
/* ------------------------------------------------------------------ */

describe("içerik kökeni", () => {
  it("her sorunun origin'i source ile tutarlı", () => {
    const problems = LOADED_QUESTIONS.flatMap((question) => originIssues(question).map((issue) => `${question.id}: ${issue}`));
    expect(problems).toEqual([]);
  });

  it("dış kaynaklı her repo'nun THIRD_PARTY_NOTICES'ta bölümü var", () => {
    expect(reposMissingFromNotices(LOADED_QUESTIONS, notices)).toEqual([]);
  });
});
