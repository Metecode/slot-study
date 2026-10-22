/* ------------------------------------------------------------------ */
/* Yerleşim taraması — tambur etiketleri ve değerlendirme ekranı        */
/*                                                                     */
/*   npm run scan:layout                                               */
/*   npm run scan:layout -- --reels                                    */
/*   npm run scan:layout -- --only docker --screenshots                */
/*   npm run scan:layout -- --config 360@130,412@130                   */
/*                                                                     */
/* İki kontrol var. Tambur kontrolü: her kategori adı ve her konu,      */
/* makaranın tamburuna yazılıp kutusuna sığıyor mu diye bakılır; birkaç */
/* saniye sürer, --reels yalnızca onu çalıştırır. Soru taraması: her    */
/* soru, gerçek arayüzle değerlendirme ekranına götürülür ve sayfa      */
/* genişliği ölçülür. Yeni soru eklendiğinde çalıştırılır: uzun bir     */
/* konu adı tamburda kesiliyor, uzun bir kod satırı ya da kırılamayan   */
/* bir kelime sayfayı telefonda yana taşırabiliyor. Sorun varsa çıkış   */
/* kodu 1.                                                             */
/*                                                                     */
/* Tarayıcı indirmez: sistemdeki Google Chrome'u kullanır.              */
/* ------------------------------------------------------------------ */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";
import { createServer } from "vite";

import { measureOverflow, measureReelLabels, scaleFonts } from "./scan-layout-page.mjs";

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

/*
  Yalnızca tambur kontrolünde: iPhone (390), Galaxy A52 (412) ve tablet.
  Bu genişlikler değerlendirme ekranını yeni bir duruma sokmuyor, makarayı
  sokuyor; soru taramasına girselerdi her biri ~2.5 dakika eklerdi.
  400: kol panelinin büyüdüğü sınır (Machine.module.css), tamburdaki payın
  en ince olduğu yerlerden biri.
*/
const REEL_ONLY_CONFIGS = [
  { id: "390@100", width: 390, height: 844, fontScale: 1, mobile: true },
  { id: "400@100", width: 400, height: 860, fontScale: 1, mobile: true },
  { id: "412@100", width: 412, height: 915, fontScale: 1, mobile: true },
  { id: "768@100", width: 768, height: 1024, fontScale: 1, mobile: true },
];

/** Tambur etiketinin kaplayabileceği satır sayısı; Drum.module.css'teki .label ile aynı. */
const REEL_MAX_LINES = 2;

const OUTPUT_DIR = "scan-layout-output";
const ANSWER = "Kısa bir deneme cevabı.";

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    config: { type: "string" },
    reels: { type: "boolean", default: false },
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

async function newContext(browser, config) {
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
  return context;
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

/** Kesik adın neden kesik olduğu: satır sayısı ya da yatay taşma. */
function describeCut({ text, lines, overflow }) {
  const reasons = [];
  if (lines > REEL_MAX_LINES) reasons.push(`${lines} satır`);
  if (overflow > 0) reasons.push(`+${overflow}px`);
  return `"${text.replaceAll("​", "")}" (${reasons.join(", ")})`;
}

/*
  %130 yazıda ve 277'de (%130 sayfa yakınlaştırması) her adın sığması
  hedeflenmiyor: o genişlikte yazıya düşen alan buna yetmiyor. Kesilenler
  raporlanır, hata sayılmaz.
*/
function reelStrict(config) {
  return config.fontScale === 1 && config.width >= 360;
}

/** Her yapılandırmada makine ekranını bir kez açar, bütün adları tamburda dener. */
async function checkReels(browser, url, configs, labels) {
  console.log("Tambur etiketleri");
  let failures = 0;
  let warnings = 0;
  for (const config of configs) {
    const context = await newContext(browser, config);
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole("button", { name: "Kolu çek" }).waitFor();
    if (config.fontScale !== 1) await page.evaluate(scaleFonts, config.fontScale);
    const result = await page.evaluate(measureReelLabels, { ...labels, maxLines: REEL_MAX_LINES });
    await context.close();

    const { categories, topics } = result;
    const area = `yazı alanı ${topics.space}px, ${topics.fontSize}px`;
    if (categories.cut.length + topics.cut.length === 0) {
      console.log(`  ✓ ${config.id.padEnd(9)} ${labels.categories.length} kategori, ${labels.topics.length} konu (${area})`);
      continue;
    }
    const strict = reelStrict(config);
    if (strict) failures += 1;
    else warnings += 1;
    console.log(
      `  ${strict ? "✗" : "!"} ${config.id.padEnd(9)} ${categories.cut.length} kategori, ${topics.cut.length} konu kesik (${area})${strict ? "" : ", uyarı"}`,
    );
    for (const item of categories.cut) console.log(`      kategori: ${describeCut(item)}`);
    for (const item of topics.cut) console.log(`      konu: ${describeCut(item)}`);
  }
  return { failures, warnings };
}

async function main() {
  const pick = (list) => (args.config ? list.filter((c) => args.config.split(",").includes(c.id)) : list);
  const reelConfigs = pick([...CONFIGS, ...REEL_ONLY_CONFIGS]);
  const configs = args.reels ? [] : pick(CONFIGS);
  const server = await createServer({ logLevel: "error", clearScreen: false, server: { port: 5198 } });
  await server.listen();
  const url = server.resolvedUrls.local[0];

  // Sorular uygulamanın kendi yükleyicisinden: aynı sıra, aynı şema doğrulaması.
  const { QUESTIONS, AVAILABLE_CATEGORIES } = await server.ssrLoadModule("/src/content/index.ts");
  const { CATEGORY_LABELS } = await server.ssrLoadModule("/src/content/labels.ts");
  const { reelLabel } = await server.ssrLoadModule("/src/components/reelLabel.ts");
  const questions = QUESTIONS.map((q, index) => ({ ...q, index })).filter(
    (q) => !args.only || new RegExp(args.only).test(q.id),
  );
  // Adlar tamburda uygulamanın yazdığı hâliyle denenir (reelLabel).
  const reelLabels = {
    categories: AVAILABLE_CATEGORIES.map((category) => reelLabel(CATEGORY_LABELS[category])),
    topics: [...new Set(QUESTIONS.map((q) => q.topic))].map(reelLabel),
  };

  const browser = await launchChrome();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  let failures = 0;
  let reels;

  try {
    reels = await checkReels(browser, url, reelConfigs, reelLabels);
    if (configs.length > 0) console.log("\nDeğerlendirme ekranı");

    for (const config of configs) {
      const context = await newContext(browser, config);

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

  console.log(
    `\nTambur: ${reelConfigs.length} yapılandırma, ${reels.failures} kesilme, ${reels.warnings} uyarı.`,
  );
  if (configs.length > 0) {
    const total = configs.length * questions.length;
    console.log(`Değerlendirme ekranı: ${total} ölçüm, ${total - failures} temiz, ${failures} taşma.`);
  }
  process.exitCode = failures > 0 || reels.failures > 0 ? 1 : 0;
}

await main();
