import { describe, expect, it } from "vitest";

import policyMarkdown from "../docs/gizlilik-politikasi.md?raw";
import privacyEnHtml from "../privacy/en/index.html?raw";
import privacyTrHtml from "../privacy/index.html?raw";

/* ------------------------------------------------------------------ */
/* Gizlilik politikası — markdown kaynağı ile HTML sayfaları uyumlu mu */
/* ------------------------------------------------------------------ */

/*
  Kaynak docs/gizlilik-politikasi.md; privacy/ altındaki iki sayfa ondan elle
  çevriliyor. Bu test metnin tamamını karşılaştırmaz (HTML'de bağlantı ve
  vurgu var), iskeleti karşılaştırır: başlık, güncelleme tarihi ve bölüm
  başlıkları. Politika değişip sayfalar unutulursa burada kırılır.

  Ayrıca yayında doldurulmamış bir boşluk ("[… buraya yazılacak]") kalmasın:
  köşeli parantezle başlayan her ifade hata sayılır. Metin doldurulana kadar
  kırmızı kalması beklenen davranış; atlanmaz.
*/

type Structure = { title: string; updated: string; headings: string[] };

/**
 * Markdown'ın iki dili "---" ayırıcısıyla bölünmüş: önce Türkçe, sonra İngilizce.
 * Windows'ta core.autocrlf dosyayı CRLF ile çıkarıyor; ayırıcı ikisinde de bulunur.
 */
function markdownParts(markdown: string): { tr: string; en: string } {
  const [tr, en] = markdown.split(/\r?\n---\r?\n/);
  return { tr, en };
}

function markdownStructure(part: string): Structure {
  const lines = part.split("\n").map((line) => line.trim());
  const title = lines.find((line) => line.startsWith("# "))?.slice(2) ?? "";
  const updated = lines.find((line) => /^(Son güncelleme|Last updated):/.test(line)) ?? "";
  const headings = lines.filter((line) => line.startsWith("## ")).map((line) => line.slice(3));
  return { title, updated, headings };
}

/** Etiketleri atar, boşlukları tekler. Sayfalarda HTML varlığı kullanılmıyor. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlStructure(html: string): Structure {
  const title = textOf(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const updated = textOf(html.match(/<p class="updated">([\s\S]*?)<\/p>/)?.[1] ?? "");
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => textOf(match[1]));
  return { title, updated, headings };
}

/** Sayfanın okunan metni: yorumlar ve <head> hariç, yalnızca <main>. */
function mainTextOf(html: string): string {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
  return textOf(main);
}

const { tr, en } = markdownParts(policyMarkdown);

const PAGES = [
  { name: "Türkçe (/privacy)", html: privacyTrHtml, source: tr },
  { name: "İngilizce (/privacy/en)", html: privacyEnHtml, source: en },
];

describe.each(PAGES)("$name", ({ html, source }) => {
  it("başlık, güncelleme tarihi ve bölüm başlıkları markdown'la aynı", () => {
    const expected = markdownStructure(source);
    // Ayrıştırma bozulursa iki taraf da boş çıkıp "eşit" görünmesin.
    expect(expected.title).not.toBe("");
    expect(expected.updated).not.toBe("");
    expect(expected.headings.length).toBeGreaterThan(10);

    expect(htmlStructure(html)).toEqual(expected);
  });

  it("doldurulmamış boşluk kalmamış", () => {
    const placeholders = mainTextOf(html).match(/\[[^\]]*\]?/g) ?? [];
    expect(placeholders).toEqual([]);
  });
});

describe("bölüm bağlantıları", () => {
  it("hesap silme diyaloğunun bağlandığı bölüm var", () => {
    // DeleteAccountDialog POLICY_DELETION_URL: /privacy#hesap-silme
    // Numara değil başlık: diyalog metni bölüm numarasına bağlı değil.
    expect(privacyTrHtml).toMatch(/<section id="hesap-silme">\s*<h2>\d+\. Hesabını silme<\/h2>/);
  });

  it("İngilizce sayfada karşılığı var", () => {
    expect(privacyEnHtml).toMatch(/<section id="account-deletion">\s*<h2>\d+\. Deleting your account<\/h2>/);
  });
});
