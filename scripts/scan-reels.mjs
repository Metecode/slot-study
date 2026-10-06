/* ------------------------------------------------------------------ */
/* Makara taraması — boyut değişince makara yerinde mi                  */
/*                                                                     */
/*   npm run scan:reels                                                */
/*                                                                     */
/* Gerçek tarayıcıda viewport değiştirilir (1280 → 360 → 1280, dönüş    */
/* sırasında da) ve her adımda iki tamburun ödeme çizgisindeki satırı   */
/* ölçülür: kazanan (.mid) satır çizginin üstünde ve pencere dolu mu.   */
/* jsdom yerleşim hesaplamadığı için Vitest'te yapılamıyor; öteleme     */
/* hesabının birim testi src/components/drumStrip.test.ts.              */
/* Sorun varsa çıkış kodu 1.                                            */
/*                                                                     */
/* Tarayıcı indirmez: sistemdeki Google Chrome'u kullanır.              */
/* ------------------------------------------------------------------ */

import { chromium } from "playwright-core";
import { createServer } from "vite";

const WIDE = { width: 1280, height: 800 };
const NARROW = { width: 360, height: 780 };

/*
  Sayfada çalışır. Her tambur için: ödeme çizgisinin dikey ortasına en
  yakın satır, kazanan satır ve pencerede görünen dolu satır sayısı.
  Makine dar ekranda rotateX ile eğik; ölçüler izdüşüm, tolerans buna göre.
*/
function measureReels() {
  const bay = document.querySelector("[data-rows]");
  const payline = bay.querySelector(':scope > [class*="payline"]');
  const line = payline.getBoundingClientRect();
  const lineCenter = (line.top + line.bottom) / 2;

  return [...bay.querySelectorAll('[class*="window"]')].map((win) => {
    const box = win.getBoundingClientRect();
    const faces = [...win.querySelectorAll('[class*="face"]')];
    const rects = faces.map((face) => face.getBoundingClientRect());
    const visible = rects.filter((r) => r.bottom > box.top + 1 && r.top < box.bottom - 1);
    const filled = faces.filter((face, i) => visible.includes(rects[i]) && face.textContent.trim() !== "");

    let nearest = 0;
    rects.forEach((r, i) => {
      const d = Math.abs((r.top + r.bottom) / 2 - lineCenter);
      if (d < Math.abs((rects[nearest].top + rects[nearest].bottom) / 2 - lineCenter)) nearest = i;
    });
    const winner = faces.findIndex((face) => face.className.includes("mid"));
    const offset = Math.abs((rects[nearest].top + rects[nearest].bottom) / 2 - lineCenter);

    return {
      frozen: win.dataset.frozen === "true",
      onLine: faces[nearest].textContent,
      winner: faces[winner]?.textContent ?? null,
      atLine: nearest === winner && offset < rects[nearest].height / 4,
      filled: filled.length,
      expected: win.dataset.frozen === "true" ? 1 : 3,
    };
  });
}

/** Tamburların durmasını bekler: koşan animasyon kalmasın. */
async function waitSettled(page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  // Ödeme çizgisinin opaklık geçişi; ölçümü etkilemiyor ama ekran görüntüsü için.
  await page.waitForTimeout(300);
}

let failures = 0;

async function check(page, label) {
  const reels = await page.evaluate(measureReels);
  const problems = reels.flatMap((reel, i) => {
    const side = i === 0 ? "sol" : "sağ";
    const out = [];
    if (!reel.atLine) out.push(`${side}: çizgide "${reel.onLine}", kazanan "${reel.winner}"`);
    if (reel.filled !== reel.expected) out.push(`${side}: ${reel.filled}/${reel.expected} satır dolu`);
    return out;
  });
  if (problems.length > 0) {
    failures += 1;
    console.log(`  ✗ ${label}`);
    for (const problem of problems) console.log(`      ${problem}`);
  } else {
    console.log(`  ✓ ${label}  (${reels.map((r) => r.winner).join(" / ")})`);
  }
}

async function pull(page) {
  const lever = page.getByRole("button", { name: "Kolu çek" });
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Kolu çek"]')?.disabled);
  await lever.focus();
  await page.keyboard.press("Enter");
}

async function main() {
  const server = await createServer({ logLevel: "error", clearScreen: false, server: { port: 5197 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome" });
  } catch (error) {
    console.error("Google Chrome başlatılamadı; scan:reels sistemdeki Chrome'u kullanır.");
    console.error(`  ${String(error?.message ?? error).split("\n")[0]}`);
    await server.close();
    process.exit(2);
  }

  try {
    const context = await browser.newContext({ viewport: WIDE, serviceWorkers: "block" });
    // Arka uç yok: oturum yenileme 401 alır, uygulama misafir modunda açılır.
    await context.route("**/api/**", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthorized"}' }),
    );
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole("button", { name: "Kolu çek" }).waitFor();
    await waitSettled(page);

    console.log("Duruşta boyut değişimi");
    await check(page, "1280 açılış");
    await page.setViewportSize(NARROW);
    await waitSettled(page);
    await check(page, "1280 → 360");
    await page.setViewportSize(WIDE);
    await waitSettled(page);
    await check(page, "360 → 1280");

    console.log("Dönüş sırasında boyut değişimi");
    for (const [from, to, label] of [
      [WIDE, NARROW, "1280'de çek, dönerken 360"],
      [NARROW, WIDE, "360'ta çek, dönerken 1280"],
    ]) {
      await page.setViewportSize(from);
      await pull(page);
      // Normal dönüş 1300-1600 ms; ortasında değiştir.
      await page.waitForTimeout(500);
      await page.setViewportSize(to);
      await waitSettled(page);
      await check(page, label);
      // Değerlendirme ekranından makineye dön: bir sonraki çekiş için.
      await page.goto(url);
      await page.getByRole("button", { name: "Kolu çek" }).waitFor();
      await waitSettled(page);
    }
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(failures > 0 ? `\n${failures} adımda sorun.` : "\nMakaralar her adımda yerinde.");
  process.exitCode = failures > 0 ? 1 : 0;
}

await main();
