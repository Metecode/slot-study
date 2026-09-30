/* ------------------------------------------------------------------ */
/* İkon üretimi — design/icon/ kaynaklarından PNG ve favicon            */
/*                                                                     */
/*   npm run icons                                                     */
/*                                                                     */
/* Kaynak değiştiğinde çalıştırılır; çıktılar repoya girer. Tarayıcı     */
/* indirmez, sistemdeki Google Chrome'da canvas'a çizer. PNG kodlaması   */
/* Node'da: alfa kanalı dosya başına seçilsin (apple-touch şeffaflıksız). */
/*                                                                     */
/* Üretmediği, elle aktarılanlar (kaynak değişirse onlar da güncellenir): */
/*   android/.../drawable/ic_launcher_foreground.xml  ← slot_foreground  */
/*   android/.../drawable/ic_launcher_monochrome.xml  ← slot_monochrome  */
/*   android/.../drawable/ic_stat_slot.xml  ← slot_notification_24      */
/*   android/.../values/ic_launcher_background.xml  ← slot_background   */
/* ------------------------------------------------------------------ */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { crc32, deflateSync } from "node:zlib";

import { chromium } from "playwright-core";

const SOURCE = "design/icon";
const ANDROID_RES = "android/app/src/main/res";

const foreground = innerSvg(readFileSync(`${SOURCE}/slot_foreground.svg`, "utf-8"));
const background = readFileSync(`${SOURCE}/slot_background.svg`, "utf-8").match(/fill="(#[0-9a-f]{6})"/i)[1];
const iosPng = readFileSync(`${SOURCE}/slot_ios_1024.png`).toString("base64");

/*
  Kırpmalar 108'lik uyarlanabilir tuval üzerinden. Android maskesinin
  görünür alanı ortadaki 72 (18..90); çizim onun içindeki 66'lık güvenli
  alanda. Her çıktı bu 72'yi kendi kurallarına göre yerleştirir.
*/

/** Yuvarlatılmış kare, köşeler şeffaf: favicon ve manifest "any" ikonları. */
const rounded = (pad = 0) =>
  svg(18 - pad, 72 + 2 * pad, `<rect x="18" y="18" width="72" height="72" rx="16" fill="${background}"/>${foreground}`);

/** Daire: Android 7.1 round ikonu. */
const circle = (pad = 0) =>
  svg(18 - pad, 72 + 2 * pad, `<circle cx="54" cy="54" r="36" fill="${background}"/>${foreground}`);

/*
  Maskable: zemin kenara kadar. Güvenli bölge merkezde çapı %80 olan daire;
  viewBox 90 seçildi ki Android'in 72'lik dairesi tam o daireye denk gelsin
  (72 / 90 = 0.8). İkon her iki platformda aynı büyüklükte görünür.
*/
const maskable = svg(9, 90, `<rect x="9" y="9" width="90" height="90" fill="${background}"/>${foreground}`);

/*
  Android 7.1 ve öncesi (minSdk 24, uyarlanabilir ikon 26'da geldi):
  kenardan 2/76 pay, launcher'ın gölgesine yer kalsın.
*/
const LEGACY_PAD = 2;
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const outputs = [
  { path: "public/pwa-192x192.png", size: 192, svg: rounded() },
  { path: "public/pwa-512x512.png", size: 512, svg: rounded() },
  { path: "public/maskable-icon-512x512.png", size: 512, svg: maskable },
  // iOS köşeleri kendisi yuvarlar ve şeffaf pikseli siyaha boyar: RGB.
  { path: "public/apple-touch-icon-180x180.png", size: 180, png: iosPng, alpha: false },
  // Play Console: 512, 32-bit. Köşeleri Play yuvarlar; zemin kenara kadar.
  { path: `${SOURCE}/store/slot_play_512.png`, size: 512, png: iosPng },
  ...Object.entries(DENSITIES).flatMap(([density, size]) => [
    { path: `${ANDROID_RES}/mipmap-${density}/ic_launcher.png`, size, svg: rounded(LEGACY_PAD) },
    { path: `${ANDROID_RES}/mipmap-${density}/ic_launcher_round.png`, size, svg: circle(LEGACY_PAD) },
  ]),
];

// Favicon vektör kalır: her boyutta keskin, dosya birkaç yüz bayt.
writeFileSync("public/favicon.svg", `${rounded()}\n`);
console.log("public/favicon.svg");

const browser = await launchChrome();
try {
  const page = await browser.newPage();
  for (const output of outputs) {
    const source = output.svg
      ? `data:image/svg+xml;base64,${Buffer.from(output.svg).toString("base64")}`
      : `data:image/png;base64,${output.png}`;
    const rgba = Buffer.from(await page.evaluate(rasterize, { source, size: output.size }), "base64");
    const alpha = output.alpha ?? true;
    mkdirSync(dirname(output.path), { recursive: true });
    writeFileSync(output.path, encodePng(rgba, output.size, alpha));
    console.log(`${output.path} (${output.size}, ${alpha ? "RGBA" : "RGB"})`);
  }
} finally {
  await browser.close();
}

/** Tarayıcıda çalışır: görüntüyü size×size canvas'a çizer, RGBA baytlarını base64 döner. */
async function rasterize({ source, size }) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);
  let binary = "";
  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** SVG'nin kök etiketi dışındaki içeriği. */
function innerSvg(text) {
  return text.slice(text.indexOf(">", text.indexOf("<svg")) + 1, text.lastIndexOf("</svg>")).trim();
}

/** Kare viewBox'lı SVG; boyut vermeden de ölçeklenir (favicon), canvas'a çizerken hedef boyuta. */
function svg(origin, extent, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${origin} ${origin} ${extent} ${extent}">${body}</svg>`;
}

/** 8 bit RGBA ya da RGB PNG. Satır filtresi yok; ikonlar küçük, boyut sorun değil. */
function encodePng(rgba, size, alpha) {
  const channels = alpha ? 4 : 3;
  const rows = Buffer.alloc(size * (size * channels + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    rows[offset++] = 0; // filtre: yok
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!alpha && rgba[i + 3] !== 255) throw new Error("Şeffaflıksız olması gereken görüntüde şeffaf piksel var.");
      for (let c = 0; c < channels; c++) rows[offset++] = rgba[i + c];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit derinliği
  header[9] = alpha ? 6 : 2; // renk tipi: RGBA ya da RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

/** Sistem Chrome'u yoksa indirmeyi önermek yerine ne yapılacağını söyleyip çıkar. */
async function launchChrome() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (error) {
    const firstLine = String(error?.message ?? error).split("\n")[0];
    console.error("Google Chrome başlatılamadı. icons tarayıcı indirmez, sistemdeki Chrome'u kullanır.");
    console.error(`  ${firstLine}`);
    process.exit(1);
  }
}
