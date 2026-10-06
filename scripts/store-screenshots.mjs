/* ------------------------------------------------------------------ */
/* Google Play telefon ekran görüntüleri — 1080×1920, 24 bit RGB        */
/*                                                                     */
/*   npm run store:screenshots                                         */
/*                                                                     */
/* Üretim derlemesi önizleme sunucusunda, Android'deymiş gibi açılır    */
/* (Play'deki sürüm o; bkz. NATIVE_PLATFORM) ve gerçek akış oynatılır:  */
/* kol çekilir, cevap yazılır, değerlendirme gelir. Görüntü 360×640 CSS */
/* pikseli, 3x yoğunluk. Arayüz ya da logo değiştiğinde yeniden          */
/* çalıştırılır; çıktılar design/store/screenshots/ altına.             */
/*                                                                     */
/* Tarayıcı indirmez: sistemdeki Google Chrome'u kullanır.              */
/* ------------------------------------------------------------------ */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { build, createServer, preview } from "vite";

import { encodePng, launchChrome } from "./lib/raster.mjs";
import { SCREENS } from "./store-screenshots-flow.mjs";

const OUTPUT_DIR = "design/store/screenshots";
const BUILD_DIR = "node_modules/.cache/store-screenshots";
const VIEWPORT = { width: 360, height: 640 };
const SCALE = 3;

/*
  Android'de Capacitor'ın SystemBars eklentisi sistem çubuklarının
  yüksekliğini <html>'in inline stiline --safe-area-inset-* olarak yazıyor
  (bkz. index.css). Burada aynı yol izlenir; ?safe=iphone kullanılmaz,
  o iPhone ölçüsü verip üstüne teşhis şeridi çiziyor. 24: durum çubuğu,
  16: hareketle gezinme çubuğu (360 dp genişlikte tipik değerler).
*/
const SAFE_AREA = { top: 24, right: 0, bottom: 16, left: 0 };

/*
  Capacitor, window.CapacitorCustomPlatform tanımlıysa platform adını
  ondan alır: isNativePlatform() true döner, platformFeatures native
  dalına girer (giriş yok, Ayarlar'da Titreşim ve hatırlatıcı var).
  Eklentiler o zaman kendi web uygulamalarıyla çalışır.
*/
const NATIVE_PLATFORM = "android";

/*
  @capacitor/filesystem'in web uygulaması "dosya yok" hatasını kodsuz
  atıyor; native'de aynı hata OS-PLUG-FILE-0008 kodunu taşıyor ve uygulama
  ilk açılışı bu koddan tanıyor (namespaceFile.ts, isNotFound). Kodsuz
  hata "İlerlemen bu oturumda kaydedilemiyor" uyarısını açardı. Derlenmiş
  pakete giden yanıtta bu hatalara native'in kodu eklenir.
*/
// Küçültücü dizeyi ters tırnakla yazıyor; "new Error(...)" de eşleşir,
// sarmalanan ifade new'üyle birlikte alınmalı.
const NOT_FOUND_ERRORS = /(?:\bnew\s+)?\bError\((["'`])(File|Folder|Entry) does not exist\.\1\)/g;
const NOT_FOUND_CODE = "OS-PLUG-FILE-0008";

// Alt bilgideki commit özeti CI'da GITHUB_SHA'dan geliyor; yerelde "dev"
// yazmasın, görüntü o anki commit'in derlemesi olsun.
process.env.GITHUB_SHA ??= execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).trim();

const questions = await loadQuestions();
await build({ logLevel: "warn", build: { outDir: BUILD_DIR, emptyOutDir: true } });
const server = await preview({ logLevel: "warn", build: { outDir: BUILD_DIR }, preview: { port: 5197 } });
const url = server.resolvedUrls.local[0];

const browser = await launchChrome("store:screenshots");
mkdirSync(OUTPUT_DIR, { recursive: true });

try {
  for (const screen of SCREENS) {
    // Her ekran taze bağlamda: ilerleme boş, çekiliş varsayımı geçerli.
    const context = await newPhoneContext(browser);
    const page = await context.newPage();
    await page.goto(url);
    await page.evaluate(applySafeArea, SAFE_AREA);
    await page.evaluate(() => document.fonts.ready);

    await screen.run(page, { questions, safeArea: SAFE_AREA, viewport: VIEWPORT });
    await settle(page);
    // Yama tutmadıysa ya da depo başka sebeple açılamadıysa görüntü alınmaz.
    if (await page.getByText("kaydedilemiyor").count()) {
      throw new Error(`${screen.id}: depo uyarısı ekranda; Filesystem yaması tutmamış olabilir (bkz. NOT_FOUND_ERRORS).`);
    }

    const path = join(OUTPUT_DIR, `${screen.id}.png`);
    writeFileSync(path, await toRgbPng(page, await page.screenshot()));
    console.log(`${path} (${VIEWPORT.width * SCALE}×${VIEWPORT.height * SCALE}, RGB)`);
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

/** Sorular uygulamanın kendi yükleyicisinden: aynı sıra, aynı şema doğrulaması. */
async function loadQuestions() {
  const server = await createServer({ logLevel: "error", server: { middlewareMode: true } });
  try {
    const { QUESTIONS } = await server.ssrLoadModule("/src/content/index.ts");
    return QUESTIONS;
  } finally {
    await server.close();
  }
}

async function newPhoneContext(browser) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    colorScheme: "dark",
    // Animasyonlar son karede; görüntü ara bir kareye denk gelmesin.
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/assets/*.js", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      NOT_FOUND_ERRORS,
      (error) => `Object.assign(${error},{code:"${NOT_FOUND_CODE}"})`,
    );
    await route.fulfill({ response, body });
  });
  await context.addInitScript(
    ({ platform }) => {
      window.CapacitorCustomPlatform = { name: platform };
      // Çekilişi sabitlemek için (bkz. store-screenshots-flow.mjs, pull).
      const random = Math.random;
      Math.random = () => (typeof window.__storeRandom === "number" ? window.__storeRandom : random());
    },
    { platform: NATIVE_PLATFORM },
  );
  return context;
}

/** Tarayıcıda çalışır: Capacitor'ın yaptığı gibi inset'leri <html>'e yazar. */
function applySafeArea(insets) {
  for (const [edge, value] of Object.entries(insets)) {
    document.documentElement.style.setProperty(`--safe-area-inset-${edge}`, `${value}px`);
  }
}

/** Çıkan katman sökülsün, sonlu animasyonlar bitsin (hareket azaltmada ~1ms). */
async function settle(page) {
  await page.waitForFunction(
    () =>
      !document.querySelector('[data-state="exit"]') &&
      document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
  );
}

/*
  Play ekran görüntüsünde alfa kanalı istemiyor; Chrome'un PNG'si RGBA.
  Görüntü aynı sayfada canvas'a çizilip RGB olarak yeniden kodlanır.
*/
async function toRgbPng(page, png) {
  const { width, height, rgba } = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let binary = "";
    for (let i = 0; i < data.length; i += 0x8000) {
      binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
    }
    return { width: canvas.width, height: canvas.height, rgba: btoa(binary) };
  }, `data:image/png;base64,${png.toString("base64")}`);
  return encodePng(Buffer.from(rgba, "base64"), width, height, false);
}
