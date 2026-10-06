/* ------------------------------------------------------------------ */
/* Google Play özellik grafiği — 1024×500, 24 bit RGB (şeffaflık yok)   */
/*                                                                     */
/*   npm run feature-graphic                                           */
/*                                                                     */
/* Logo design/logo/slot-lockup.svg (sembol + kelime markası), altında  */
/* uygulamanın Inter'iyle alt başlık. Logo yeniden üretilirse bu da     */
/* yeniden çalıştırılır; çıktılar repoya girer.                         */
/* ------------------------------------------------------------------ */

import { readFileSync, writeFileSync } from "node:fs";

import { encodePng, launchChrome } from "./lib/raster.mjs";

const LOGO = "design/logo";
const FONTS = "src/assets/fonts";
const OUTPUT = "design/icon/store";
const WIDTH = 1024;
const HEIGHT = 500;

const VARIANTS = [
  { path: `${OUTPUT}/slot_feature_tr.png`, subtitle: "Teknik soru pratiği" },
  { path: `${OUTPUT}/slot_feature_en.png`, subtitle: "Technical question practice" },
];

/*
  Play bu görseli bazı yüzeylerde kenarlardan kırpıyor, tanıtım videosu
  varsa ortasına oynat düğmesi koyuyor. İçerik ortadaki kutuda kalır;
  betik taşarsa durur, kimse kırpılmış bir grafiği fark etmeden yüklemesin.
*/
const SAFE = { width: 720, height: 300 };

// Renkler build_logo.py'deki gibi: koyu zeminde logo --text, imleç --accent.
const BACKGROUND = "#0b0f14"; // --bg
const PAPER = "#e6edf3"; // --text
const ACCENT = "#22d3ee"; // --accent
const SUBTITLE_COLOR = "#8b98a9"; // --text-dim

/*
  Lockup açık zemin için tek renk (INK) çizilmiş. Koyu zeminde PAPER'a
  çevrilir; imleç, vurgulu sembol dosyasında ayrı renk alan yoldan
  tanınır ve ACCENT'e boyanır. Logo üreticisi yolu değiştirirse eşleşme
  bulunamaz ve betik durur — imleçsiz bir grafik sessizce çıkmasın.
*/
const lockupSource = readFileSync(`${LOGO}/slot-lockup.svg`, "utf-8");
const cursorPath = readFileSync(`${LOGO}/slot-symbol-accent.svg`, "utf-8").match(/<path fill="#[0-9a-f]{6}" d="([^"]+)"/i)?.[1];
if (!cursorPath || !lockupSource.includes(`<path d="${cursorPath}"/>`)) {
  throw new Error("Lockup'ta imleç yolu bulunamadı; slot-lockup.svg ve slot-symbol-accent.svg uyuşmuyor.");
}
const lockup = lockupSource
  .replace(/<g fill="#[0-9a-f]{6}">/i, `<g fill="${PAPER}">`)
  .replace(`<path d="${cursorPath}"/>`, `<path fill="${ACCENT}" d="${cursorPath}"/>`);

/*
  Lockup ölçüleri (viewBox 0 0 636 256): sembolün mürekkebi 24..232,
  kelime markası x 276'da başlıyor, taban çizgisi y 180. Alt başlık
  kelime markasıyla aynı soldan, taban çizgisinin altına dizilir.
*/
const LOCKUP = {
  viewBox: { width: 636, height: 256 },
  ink: { left: 24, top: 24, right: 612, bottom: 232 },
  wordmarkLeft: 276,
  baseline: 180,
};

const layout = {
  width: WIDTH,
  height: HEIGHT,
  background: BACKGROUND,
  safe: SAFE,
  lockup: `data:image/svg+xml;base64,${Buffer.from(lockup).toString("base64")}`,
  geometry: LOCKUP,
  scale: 0.9,
  subtitle: { font: "500 30px Inter", color: SUBTITLE_COLOR },
  subtitleGap: 30,
  // Inter latin ve latin-ext alt kümeleri ayrı dosya; "ğ" latin-ext'te.
  fonts: ["inter-latin.woff2", "inter-latin-ext.woff2"].map((file) =>
    readFileSync(`${FONTS}/${file}`).toString("base64"),
  ),
};

const browser = await launchChrome("feature-graphic");
try {
  const page = await browser.newPage();
  for (const variant of VARIANTS) {
    const result = await page.evaluate(draw, { ...layout, subtitle: { ...layout.subtitle, text: variant.subtitle } });
    if (result.overflow) throw new Error(`${variant.path}: içerik güvenli alanı aşıyor (${result.overflow}).`);
    writeFileSync(variant.path, encodePng(Buffer.from(result.rgba, "base64"), WIDTH, HEIGHT, false));
    console.log(`${variant.path} (${WIDTH}×${HEIGHT}, RGB)`);
  }
} finally {
  await browser.close();
}

/**
 * Tarayıcıda çalışır. Lockup ve altındaki alt başlık tek grup; grubun
 * mürekkep kutusu yatayda ve dikeyde ortalanır. RGBA baytlarını base64,
 * güvenli alan taşmasını metin olarak döner.
 */
async function draw({ width, height, background, safe, lockup, geometry, scale, subtitle, subtitleGap, fonts }) {
  for (const font of fonts) {
    const bytes = Uint8Array.from(atob(font), (char) => char.charCodeAt(0));
    document.fonts.add(await new FontFace("Inter", bytes, { weight: "400 800" }).load());
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.font = subtitle.font;
  const metrics = context.measureText(subtitle.text);

  // Lockup koordinatında grup kutusu: logo mürekkebi ve alt başlık.
  const subtitleLeft = geometry.wordmarkLeft;
  const subtitleTop = geometry.baseline + subtitleGap / scale;
  const subtitleBottom = subtitleTop + (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) / scale;
  const box = {
    left: geometry.ink.left,
    top: geometry.ink.top,
    right: Math.max(geometry.ink.right, subtitleLeft + metrics.width / scale),
    bottom: Math.max(geometry.ink.bottom, subtitleBottom),
  };
  const groupWidth = (box.right - box.left) * scale;
  const groupHeight = (box.bottom - box.top) * scale;

  // Lockup'ın (0, 0) noktasının tuvaldeki yeri.
  const originX = (width - groupWidth) / 2 - box.left * scale;
  const originY = (height - groupHeight) / 2 - box.top * scale;

  const image = new Image();
  image.src = lockup;
  await image.decode();
  context.drawImage(image, originX, originY, geometry.viewBox.width * scale, geometry.viewBox.height * scale);

  context.textBaseline = "alphabetic";
  context.fillStyle = subtitle.color;
  context.fillText(
    subtitle.text,
    originX + subtitleLeft * scale,
    originY + subtitleTop * scale + metrics.actualBoundingBoxAscent,
  );

  const overflow =
    groupWidth > safe.width
      ? `genişlik ${Math.ceil(groupWidth)} > ${safe.width}`
      : groupHeight > safe.height
        ? `yükseklik ${Math.ceil(groupHeight)} > ${safe.height}`
        : null;

  const { data } = context.getImageData(0, 0, width, height);
  let binary = "";
  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return { rgba: btoa(binary), overflow };
}
