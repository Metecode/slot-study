/* ------------------------------------------------------------------ */
/* İkon üretimi — design/icon/ kaynaklarından PNG ve favicon            */
/*                                                                     */
/*   python design/logo/build_icons.py   (geometri değiştiyse)         */
/*   npm run icons                                                     */
/*                                                                     */
/* Kaynak SVG'ler ve Android vektörleri (drawable/ic_launcher_*.xml,     */
/* ic_stat_slot.xml) build_icons.py'nin çıktısı: yerleşim, maskelenen    */
/* ikonların güvenli alan oranları ve renkler orada. Bu betik yalnızca   */
/* rasterler. Çıktılar repoya girer. Tarayıcı indirmez, sistemdeki       */
/* Google Chrome'da canvas'a çizer. PNG kodlaması Node'da: alfa kanalı   */
/* dosya başına seçilsin (apple-touch şeffaflıksız).                    */
/* ------------------------------------------------------------------ */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { encodePng, launchChrome } from "./lib/raster.mjs";

const SOURCE = "design/icon";
const ANDROID_RES = "android/app/src/main/res";

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const outputs = [
  // Manifest "any": köşeleri şeffaf karo. Maskable: zemin kenara kadar.
  { path: "public/pwa-192x192.png", size: 192, source: "slot_any.svg" },
  { path: "public/pwa-512x512.png", size: 512, source: "slot_any.svg" },
  { path: "public/maskable-icon-512x512.png", size: 512, source: "slot_maskable.svg" },
  // iOS köşeleri kendisi yuvarlar ve şeffaf pikseli siyaha boyar: RGB.
  { path: "public/apple-touch-icon-180x180.png", size: 180, source: "slot_ios.svg", alpha: false },
  // Play Console: 512, 32-bit. Köşeleri Play yuvarlar; zemin kenara kadar.
  { path: `${SOURCE}/store/slot_play_512.png`, size: 512, source: "slot_ios.svg" },
  // Android 7.1 ve öncesi (minSdk 24, uyarlanabilir ikon 26'da geldi).
  ...Object.entries(DENSITIES).flatMap(([density, size]) => [
    { path: `${ANDROID_RES}/mipmap-${density}/ic_launcher.png`, size, source: "slot_legacy.svg" },
    { path: `${ANDROID_RES}/mipmap-${density}/ic_launcher_round.png`, size, source: "slot_legacy_round.svg" },
  ]),
];

// Favicon vektör kalır: her boyutta keskin, dosya birkaç yüz bayt.
copyFileSync(`${SOURCE}/slot_favicon.svg`, "public/favicon.svg");
console.log("public/favicon.svg");

const browser = await launchChrome("icons");
try {
  const page = await browser.newPage();
  for (const output of outputs) {
    const svg = readFileSync(`${SOURCE}/${output.source}`);
    const source = `data:image/svg+xml;base64,${svg.toString("base64")}`;
    const rgba = Buffer.from(await page.evaluate(rasterize, { source, size: output.size }), "base64");
    const alpha = output.alpha ?? true;
    mkdirSync(dirname(output.path), { recursive: true });
    writeFileSync(output.path, encodePng(rgba, output.size, output.size, alpha));
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
