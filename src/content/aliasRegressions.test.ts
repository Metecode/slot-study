import { describe, expect, it } from "vitest";

import { conceptMatchLevel } from "../domain/conceptMatch";
import { evaluateLexical } from "../domain/evaluate";
import { QUESTIONS } from "./index";

/* ------------------------------------------------------------------ */
/* Alias gerilemeleri — gerçek içerikte, gerçek kullanıcı yazımıyla     */
/*                                                                     */
/* Örnek cevap ve probe alias'lara yakın yazıldığı için bu vakaları     */
/* göremiyor. Her vaka, model cevaba bakmadan yazılmış ve önceden hiçbir */
/* kavram bulamayan bir cevap; seviye kullanıcının sonuç ekranında       */
/* gördüğüyle aynı fonksiyondan (conceptMatchLevel).                    */
/* ------------------------------------------------------------------ */

function levelFor(questionId: string, answer: string) {
  const question = QUESTIONS.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error(`içerikte yok: ${questionId}`);
  const { hits } = evaluateLexical(question, answer);
  return { level: conceptMatchLevel(hits.length, question.keyConcepts.length), hits };
}

describe("docker-depends-on-healthcheck", () => {
  // docs/content-audit.md 4.c: bu cevap 0/5 kavram buluyordu.
  const reproduced =
    "depends_on sadece container'ın başlamasını bekler, veritabanı hazır olana kadar beklemez. " +
    "Çözüm health check eklemek ve condition service healthy kullanmak, uygulama da tekrar denemeli.";

  it("anlamdaş yazımlı cevap en az kısmi eşleşir", () => {
    expect(levelFor("docker-depends-on-healthcheck", reproduced).level).not.toBe("none");
  });

  it("anlamdaş yazımlı cevap bütün kavramları tutar", () => {
    expect(levelFor("docker-depends-on-healthcheck", reproduced).level).toBe("all");
  });

  it.each(["healthcheck", "health check", "health-check", "health_check"])("%s yazımı healthcheck kavramını tutar", (spelling) => {
    expect(levelFor("docker-depends-on-healthcheck", `Veritabanına ${spelling} tanımlarım.`).hits).toContain("healthcheck");
  });
});
