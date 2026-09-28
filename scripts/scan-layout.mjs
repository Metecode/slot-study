/* ------------------------------------------------------------------ */
/* Yerleşim taraması — değerlendirme ekranında yatay taşma              */
/*                                                                     */
/*   npm run scan:layout                                               */
/*   npm run scan:layout -- --only docker --screenshots                */
/*   npm run scan:layout -- --config 360@130,412@130                   */
/*                                                                     */
/* Her soru, her ekran yapılandırmasında gerçek arayüzle değerlendirme   */
/* ekranına götürülür ve sayfa genişliği ölçülür. Yeni soru eklendiğinde */
/* çalıştırılır: uzun bir kod satırı ya da kırılamayan bir kelime sayfayı */
/* telefonda yana taşırabiliyor. Taşma varsa çıkış kodu 1.              */
/*                                                                     */
/* Tarayıcı indirmez: sistemdeki Google Chrome'u kullanır.              */
/* ------------------------------------------------------------------ */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";
import { createServer } from "vite";

import { measureOverflow, scaleFonts } from "./scan-layout-page.mjs";

/*
  %130: Android'in yazı boyutu ayarı; yazılar büyür, düzen ölçüleri aynı
  kalır (bkz. scaleFonts). 277: %130 sayfa yakınlaştırmasının 360'taki
  karşılığı. Masaüstünde iki sütunlu sonuç ekranı.
*/
const CONFIGS = [
  { id: "360@100", width: 360, height: 780, fontScale: 1, mobile: true },
  { id: "360@130", width: 360, height: 780, fontScale: 1.3, mobile: true },
  { id: "412@130", width: 412, height: 915, fontScale: 1.3, mobile: true },
  { id: "277@100", width: 277, height: 600, fontScale: 1, mobile: true },
  { id: "1024@100", width: 1024, height: 800, fontScale: 1, mobile: false },
  { id: "1280@100", width: 1280, height: 800, fontScale: 1, mobile: false },
];

const OUTPUT_DIR = "scan-layout-output";
const ANSWER = "Kısa bir deneme cevabı.";

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    config: { type: "string" },
    screenshots: { type: "boolean", default: false },
  },
});

/** Sistem Chrome'u yoksa indirmeyi önermek yerine ne yapılacağını söyleyip çıkar. */
async function launchChrome() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (error) {
    const firstLine = String(error?.message ?? error).split("\n")[0];
    const missing = /distribution 'chrome' is not found/i.test(firstLine);
    console.error(
      missing
        ? "Google Chrome bulunamadı. scan:layout tarayıcı indirmez, sistemdeki Chrome'u kullanır; Chrome'u kurup tekrar çalıştır."
        : "Google Chrome başlatılamadı.",
    );
    console.error(`  ${firstLine}`);
    process.exit(2);
  }
}

/*
  Soru seçimini sabitlemek: taze bir oturumda ilerleme yok, her sorunun
  ağırlığı eşit ve havuz içerik sırasında (bkz. domain/draw.ts). Çekiliş
  Math.random'dan tek sayı alıyor; (i + 0.5) / N i. soruyu seçer. Bu
  varsayım bozulursa ekrandaki soru beklenenle tutmaz ve tarama durur.
*/
async function openResult(page, url, index, total) {
  await page.goto(url);
  const lever = page.getByRole("button", { name: "Kolu çek" });
  await lever.waitFor();
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Kolu çek"]').disabled);
  await page.evaluate((value) => (window.__scanRandom = value), (index + 0.5) / total);
  await lever.focus();
  await page.keyboard.press("Enter");

  const textarea = page.getByRole("textbox", { name: "Cevabın" });
  try {
    await textarea.waitFor({ timeout: 1500 });
  } catch {
    // Makara hâlâ dönüyorsa Escape animasyonu atlar.
    await page.keyboard.press("Escape");
    await textarea.waitFor();
  }
  await page.evaluate(() => delete window.__scanRandom);

  await textarea.fill(ANSWER);
  await page.getByRole("button", { name: "Gönder" }).click();
  await page.getByRole("heading", { name: "Model cevap" }).waitFor();
  // Çıkan katman sökülsün ve kart girişleri bitsin (hareket azaltmada ~1ms).
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-state="exit"]') &&
      document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
  return page.locator('[data-state="enter"] h2').first().textContent();
}

function printFailure(config, question, result, shot) {
  console.log(`  ✗ ${config.id.padEnd(9)} ${question.id}  +${result.overflow}px`);
  for (const culprit of result.culprits) console.log(`      taşan en dış öğe: ${culprit}`);
  const { relaxed } = result;
  console.log(`      min-width: 0 verilince taşma ${relaxed.overflow}px`);
  for (const item of relaxed.scrolling) console.log(`      kaymaya başlayan: ${item}`);
  for (const item of relaxed.sticking) console.log(`      kutusundan taşan metin: ${item}`);
  console.log(`      ekran görüntüsü: ${shot}`);
}

async function main() {
  const configs = args.config ? CONFIGS.filter((c) => args.config.split(",").includes(c.id)) : CONFIGS;
  const server = await createServer({ logLevel: "error", clearScreen: false, server: { port: 5198 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];

  // Sorular uygulamanın kendi yükleyicisinden: aynı sıra, aynı şema doğrulaması.
  const { QUESTIONS } = await server.ssrLoadModule("/src/content/index.ts");
  const questions = QUESTIONS.map((q, index) => ({ ...q, index })).filter(
    (q) => !args.only || new RegExp(args.only).test(q.id),
  );

  const browser = await launchChrome();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  let failures = 0;

  try {
    for (const config of configs) {
      const context = await browser.newContext({
        viewport: { width: config.width, height: config.height },
        isMobile: config.mobile,
        hasTouch: config.mobile,
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      // Arka uç yok: oturum yenileme 401 alır, uygulama misafir modunda açılır.
      await context.route("**/api/**", (route) =>
        route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"unauthorized"}' }),
      );
      await context.addInitScript(() => {
        const random = Math.random;
        Math.random = () => (typeof window.__scanRandom === "number" ? window.__scanRandom : random());
      });

      for (const question of questions) {
        const page = await context.newPage();
        const shown = await openResult(page, url, question.index, QUESTIONS.length);
        if (shown?.trim() !== question.prompt.trim()) {
          throw new Error(`${question.id} beklenirken başka bir soru açıldı; çekiliş varsayımı bozulmuş (bkz. openResult).`);
        }
        if (config.fontScale !== 1) await page.evaluate(scaleFonts, config.fontScale);

        const result = await page.evaluate(measureOverflow);
        const shot = join(OUTPUT_DIR, `${config.id}-${question.id}.png`);
        if (result.overflow > 0 || args.screenshots) await page.screenshot({ path: shot, fullPage: true });
        if (result.overflow > 0) {
          failures += 1;
          printFailure(config, question, result, shot);
        } else {
          console.log(`  ✓ ${config.id.padEnd(9)} ${question.id}`);
        }
        await page.close();
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const total = configs.length * questions.length;
  console.log(`\n${total} ölçüm: ${total - failures} temiz, ${failures} taşma.`);
  process.exitCode = failures > 0 ? 1 : 0;
}

await main();
