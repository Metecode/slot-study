import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Footer } from "./Footer";
import { VersionInfo } from "./VersionInfo";
import { REPO_URL } from "../content/licenses";

/* ------------------------------------------------------------------ */
/* Alt bilgi — test ortamında DOM yok, bileşenler HTML'e çizilir.       */
/* ------------------------------------------------------------------ */

describe("VersionInfo", () => {
  it("commit kapalı gelir ve düğme onu işaret eder", () => {
    const html = renderToStaticMarkup(<VersionInfo appVersion="1.1.0" commitSha="abc1234" />);
    expect(html).toContain('aria-expanded="false"');
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(html).toMatch(new RegExp(`<code id="${controls}"[^>]* hidden="">abc1234</code>`));
  });

  it("erişilebilir ad görünen sürümle başlar", () => {
    const html = renderToStaticMarkup(<VersionInfo appVersion="1.1.0" commitSha="abc1234" />);
    expect(html).toContain('aria-label="v1.1.0, ');
  });

  it("commit boşsa yalnızca sürüm, düğme yok", () => {
    const html = renderToStaticMarkup(<VersionInfo appVersion="1.1.0" commitSha="" />);
    expect(html).toContain("v1.1.0");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<code");
  });
});

describe("Footer", () => {
  // Lisanslar diyaloğu kapalıyken de çizilir ve repo'ya kendi bağlantısı var.
  const html = renderToStaticMarkup(<Footer />).split("<dialog")[0];

  it("repo'ya tek bağlantı verir", () => {
    expect(html.split(`href="${REPO_URL}"`)).toHaveLength(2);
  });

  it("birincil bağlantılar sürümden önce gelir", () => {
    const positions = ["Açık kaynak<", "Lisanslar<", "Gizlilik<", "aria-expanded"].map((text) => html.indexOf(text));
    expect(positions).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
