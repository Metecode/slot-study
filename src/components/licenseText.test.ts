import { describe, expect, it } from "vitest";

import { LICENSE_SECTIONS } from "../content/licenses";
import { reflowLicenseText } from "./licenseText";

const LONG_A = "Permission is hereby granted, free of charge, to any person obtaining a copy";
const LONG_B = "of this software and associated documentation files (the \"Software\"), to deal";

describe("reflowLicenseText", () => {
  it("elle kırılmış paragrafı tek satıra birleştirir", () => {
    expect(reflowLicenseText(`${LONG_A}\n${LONG_B}\nin the Software.`)).toBe(`${LONG_A} ${LONG_B} in the Software.`);
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

  it("CRLF satır sonlarını da tanır", () => {
    expect(reflowLicenseText(`${LONG_A}\r\n${LONG_B}`)).toBe(`${LONG_A} ${LONG_B}`);
  });

  it("gerçek metinlerde kelime kaybetmez", () => {
    const words = (text: string) => text.split(/\s+/).filter(Boolean);
    for (const section of LICENSE_SECTIONS) {
      expect(words(reflowLicenseText(section.text))).toEqual(words(section.text));
    }
  });
});
