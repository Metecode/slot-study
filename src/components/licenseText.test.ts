import { describe, expect, it } from "vitest";

import { LICENSE_SECTIONS } from "../content/licenses";
import { reflowLicenseText } from "./licenseText";

const LONG_A = "Permission is hereby granted, free of charge, to any person obtaining a copy";
const LONG_B = "of this software and associated documentation files (the \"Software\"), to deal";

const sectionText = (id: string) => {
  const section = LICENSE_SECTIONS.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`bölüm yok: ${id}`);
  return section.text.replace(/\r\n/g, "\n");
};

const paragraphs = (text: string) => text.split(/\n{2,}/);

/** Metindeki bir paragrafı ilk kelimelerinden bulur. */
const paragraphStartingWith = (text: string, start: string) => {
  const found = paragraphs(text).find((paragraph) => paragraph.startsWith(start));
  if (!found) throw new Error(`paragraf yok: ${start}`);
  return found;
};

describe("reflowLicenseText", () => {
  it("elle kırılmış paragrafı tek satıra birleştirir", () => {
    expect(reflowLicenseText(`${LONG_A}\n${LONG_B}\nin the Software.`)).toBe(`${LONG_A} ${LONG_B} in the Software.`);
  });

  it("ilk satırı kısa olan paragrafı da birleştirir", () => {
    expect(reflowLicenseText(`Kısa bir ilk satır\n${LONG_A}\nson.`)).toBe(`Kısa bir ilk satır ${LONG_A} son.`);
  });

  it("paragraf sınırlarını korur", () => {
    expect(reflowLicenseText(`MIT License\n\nCopyright (c) 2026\n\n${LONG_A}\n${LONG_B}`)).toBe(
      `MIT License\n\nCopyright (c) 2026\n\n${LONG_A} ${LONG_B}`,
    );
  });

  it("kısa satırlı blokları (başlık, alt çizgi, adres) olduğu gibi bırakır", () => {
    const block = "Üçüncü taraf bildirimleri\n=========================";
    const repo = "sudheerj/reactjs-interview-questions\nhttps://github.com/sudheerj/reactjs-interview-questions";
    expect(reflowLicenseText(`${block}\n\n${repo}`)).toBe(`${block}\n\n${repo}`);
  });

  it("madde işaretli maddeler ayrı satırda kalır, devam satırı maddeye eklenir", () => {
    const input = `${LONG_A}\nconditions:\n- first item that wraps\n  onto a second line\n* second item\n• third item`;
    expect(reflowLicenseText(input)).toBe(
      `${LONG_A} conditions:\n- first item that wraps onto a second line\n* second item\n• third item`,
    );
  });

  it("numaralı maddeler ayrı satırda ve girintisiyle kalır", () => {
    const input = `${LONG_A}\n  1. first numbered clause\n     continued here\n  2) second clause\n  (a) lettered clause`;
    expect(reflowLicenseText(input)).toBe(
      `${LONG_A}\n  1. first numbered clause continued here\n  2) second clause\n  (a) lettered clause`,
    );
  });

  it("CRLF satır sonlarını da tanır", () => {
    expect(reflowLicenseText(`${LONG_A}\r\n${LONG_B}`)).toBe(`${LONG_A} ${LONG_B}`);
  });
});

/* Üç gerçek metin: önce (ham) ve sonra (akıtılmış) karşılaştırması. */
describe("reflowLicenseText — gerçek lisans metinleri", () => {
  it.each(LICENSE_SECTIONS.map((section) => [section.id]))(
    "%s: kelime kaybı yok, paragraf sayısı ve boş satırlar aynı",
    (id) => {
      const before = sectionText(id);
      const after = reflowLicenseText(before);
      const words = (text: string) => text.split(/\s+/).filter(Boolean);
      expect(words(after)).toEqual(words(before));
      expect(paragraphs(after)).toHaveLength(paragraphs(before).length);
      // Boş satırlar yalnızca paragraf sınırında: biri eklenmez, biri silinmez.
      expect(after.match(/\n\n/g)?.length).toBe(before.match(/\n\n/g)?.length);
    },
  );

  it("kod (MIT): izin ve garanti paragrafları tek satır, başlık satırları aynı", () => {
    const before = sectionText("kod");
    const after = reflowLicenseText(before);

    expect(paragraphStartingWith(before, "Permission is hereby granted")).toContain("\n");
    expect(paragraphStartingWith(after, "Permission is hereby granted")).not.toContain("\n");
    expect(paragraphStartingWith(after, "THE SOFTWARE IS PROVIDED")).not.toContain("\n");
    expect(paragraphs(after)[0]).toBe("MIT License");
    expect(paragraphs(after)[1]).toBe(paragraphs(before)[1]);
  });

  it("içerik (CC BY-SA): kopuk 'CC BY-SA / 4.0'a' paragrafı tek satır", () => {
    const before = sectionText("icerik");
    const after = reflowLicenseText(before);

    expect(before).toContain("CC BY-SA\n4.0'a");
    const react = paragraphStartingWith(after, "React kategorisindeki 44 soru");
    expect(react).not.toContain("\n");
    expect(react).toContain("CC BY-SA 4.0'a ek olarak");
    // Bu metindeki her paragraf düzyazı: hiçbirinde sert satır sonu kalmaz.
    expect(paragraphs(after).filter((paragraph) => paragraph.includes("\n"))).toEqual([]);
  });

  it("üçüncü taraf: başlık, ayırıcı ve repo/adres blokları aynı, düzyazı birleşik", () => {
    const before = sectionText("ucuncu-taraf");
    const after = reflowLicenseText(before);

    for (const kept of ["Üçüncü taraf bildirimleri\n=====", "sudheerj/reactjs-interview-questions\nhttps://", "-----"]) {
      expect(paragraphStartingWith(after, kept)).toBe(paragraphStartingWith(before, kept));
    }
    for (const prose of ["Bu dizindeki", "Kullanıldığı yer", "Lisans metni reponun", "Permission is hereby", "THE SOFTWARE"]) {
      expect(paragraphStartingWith(before, prose)).toContain("\n");
      expect(paragraphStartingWith(after, prose)).not.toContain("\n");
    }
  });
});
