import { describe, expect, it } from "vitest";

import { QUESTIONS } from "../content";
import { buildHandoffUrl, MAX_HANDOFF_URL_LENGTH } from "./aiHandoff";
import type { AiTarget } from "./aiTargets";
import { AI_TARGETS } from "./aiTargets";
import { buildOwnAiPrompt } from "./ownAiPrompt";
import { MAX_ANSWER_LENGTH } from "./progress";

const withParam: AiTarget = {
  id: "chatgpt",
  label: "Test",
  openLabel: "Test'te aç",
  baseUrl: "https://example.test/new",
  queryParam: "q",
};

const withoutParam: AiTarget = {
  id: "gemini",
  label: "Test",
  openLabel: "Test'te aç",
  baseUrl: "https://example.test/app",
};

const PREFIX = "https://example.test/new?q=";

// as const'un daralttığı literal tipler yerine ortak tip: maxUrlLength ve
// queryParam her hedefte okunabilsin.
const targets: readonly AiTarget[] = AI_TARGETS;

/** Adresteki istemi geri okur. */
function decodePrompt(url: string, target: AiTarget): string {
  const prefix = `${target.baseUrl}?${target.queryParam}=`;
  expect(url.startsWith(prefix)).toBe(true);
  return decodeURIComponent(url.slice(prefix.length));
}

describe("buildHandoffUrl — encode", () => {
  it("Türkçe karakterleri UTF-8 yüzde kodlamasıyla yazar", () => {
    const result = buildHandoffUrl(withParam, "ş ı ğ İ ü ö ç â");

    expect(result).toEqual({
      url: PREFIX + "%C5%9F%20%C4%B1%20%C4%9F%20%C4%B0%20%C3%BC%20%C3%B6%20%C3%A7%20%C3%A2",
      promptIncluded: true,
    });
  });

  it("URL'de anlamı olan karakterleri kaçırır", () => {
    const result = buildHandoffUrl(withParam, "a&b=c#d?e%f+g");

    expect(result.url).toBe(PREFIX + "a%26b%3Dc%23d%3Fe%25f%2Bg");
  });

  it("satır sonunu %0A, boşluğu + değil %20 yapar", () => {
    const result = buildHandoffUrl(withParam, "bir iki\nüç");

    expect(result.url).toBe(PREFIX + "bir%20iki%0A%C3%BC%C3%A7");
  });

  it("emojiyi dört baytlık UTF-8 olarak yazar", () => {
    const result = buildHandoffUrl(withParam, "😀");

    expect(result.url).toBe(PREFIX + "%F0%9F%98%80");
  });

  it("karışık istem decode edilince aynen geri gelir", () => {
    const prompt = "Soru: Index nedir?\nCevap: B-ağacı & hash # 100% 😀\r\n\tSon.";
    const result = buildHandoffUrl(withParam, prompt);

    expect(result.promptIncluded).toBe(true);
    expect(decodePrompt(result.url, withParam)).toBe(prompt);
  });
});

describe("buildHandoffUrl — uzunluk eşiği", () => {
  it("encode edilmiş tam URL eşiğe eşitse istemi taşır", () => {
    const prompt = "a".repeat(MAX_HANDOFF_URL_LENGTH - PREFIX.length);
    const result = buildHandoffUrl(withParam, prompt);

    expect(result.url.length).toBe(MAX_HANDOFF_URL_LENGTH);
    expect(result.promptIncluded).toBe(true);
  });

  it("eşiği bir karakter aşarsa baseUrl ve too_long döner", () => {
    const prompt = "a".repeat(MAX_HANDOFF_URL_LENGTH - PREFIX.length + 1);

    expect(buildHandoffUrl(withParam, prompt)).toEqual({
      url: withParam.baseUrl,
      promptIncluded: false,
      reason: "too_long",
    });
  });

  it("eşiği encode edilmiş uzunlukla ölçer, karakter sayısıyla değil", () => {
    // Her "ş" encode sonrası 6 karakter: ham uzunluk eşiğin çok altında.
    const prompt = "ş".repeat(Math.ceil((MAX_HANDOFF_URL_LENGTH - PREFIX.length) / 6) + 1);

    expect(prompt.length).toBeLessThan(MAX_HANDOFF_URL_LENGTH / 5);
    expect(buildHandoffUrl(withParam, prompt)).toMatchObject({ promptIncluded: false, reason: "too_long" });
  });

  it("hedefin maxUrlLength'i genel eşiği geçersiz kılar", () => {
    const limited: AiTarget = { ...withParam, maxUrlLength: 100 };
    const atLimit = "a".repeat(100 - PREFIX.length);

    expect(buildHandoffUrl(limited, atLimit).promptIncluded).toBe(true);
    expect(buildHandoffUrl(limited, atLimit + "a")).toEqual({
      url: limited.baseUrl,
      promptIncluded: false,
      reason: "too_long",
    });
    // Aynı istem genel eşikle rahatça sığıyor.
    expect(buildHandoffUrl(withParam, atLimit + "a").promptIncluded).toBe(true);
  });
});

describe("buildHandoffUrl — istemi taşıyamadığında", () => {
  it.each(["", "kısa", "ş".repeat(MAX_HANDOFF_URL_LENGTH)])(
    "parametre desteklemeyen hedef hep baseUrl ve unsupported döner (%#)",
    (prompt) => {
      expect(buildHandoffUrl(withoutParam, prompt)).toEqual({
        url: withoutParam.baseUrl,
        promptIncluded: false,
        reason: "unsupported",
      });
    },
  );

  it.each(["a\uD800b", "a\uDC00b", "sonda\uD83D"])(
    "eşi olmayan surrogate fırlatmaz, encode_error döner (%#)",
    (prompt) => {
      expect(buildHandoffUrl(withParam, prompt)).toEqual({
        url: withParam.baseUrl,
        promptIncluded: false,
        reason: "encode_error",
      });
    },
  );
});

describe("buildHandoffUrl — içerikteki en uzun istem", () => {
  // Gerçekçi bir cevap ve uygulamanın izin verdiği en uzun cevap. Sayı ya da
  // snapshot yok: soru eklendikçe değişmezler yine geçerli kalır.
  const paragraph =
    "Index, veritabanının aradığı satırı tüm tabloyu taramadan bulmasını sağlar; " +
    "genellikle B-ağacı yapısında tutulur. Okumayı hızlandırır ama her ekleme, " +
    "güncelleme ve silme işleminde index de güncellendiği için yazma maliyetini artırır. ";
  const answers = {
    "600 karakter": paragraph.repeat(10).slice(0, 600),
    "azami uzunluk": paragraph.repeat(40).slice(0, MAX_ANSWER_LENGTH),
  };

  for (const [answerName, answer] of Object.entries(answers)) {
    const longestPrompt = QUESTIONS.map((question) => buildOwnAiPrompt(question, answer)).reduce((a, b) =>
      encodeURIComponent(b).length > encodeURIComponent(a).length ? b : a,
    );

    it.each(targets)(`$label: ${answerName} cevapla sonuç tutarlı`, (target) => {
      const result = buildHandoffUrl(target, longestPrompt);
      const limit = target.maxUrlLength ?? MAX_HANDOFF_URL_LENGTH;

      if (result.promptIncluded) {
        expect(result.url.length).toBeLessThanOrEqual(limit);
        expect(decodePrompt(result.url, target)).toBe(longestPrompt);
      } else {
        expect(result.url).toBe(target.baseUrl);
        expect(result.reason).toBe(target.queryParam === undefined ? "unsupported" : "too_long");
      }
    });
  }
});
