/* ------------------------------------------------------------------ */
/* Rasterleme yardımcıları: sistem Chrome'u ve PNG kodlayıcı            */
/*                                                                     */
/* Tarayıcı indirilmez; playwright-core sistemdeki Google Chrome'u      */
/* başlatır. PNG kodlaması bağımlılıksız (node:zlib).                   */
/* ------------------------------------------------------------------ */

import { crc32, deflateSync } from "node:zlib";

import { chromium } from "playwright-core";

/** Sistem Chrome'u yoksa indirmeyi önermek yerine ne yapılacağını söyleyip çıkar. */
export async function launchChrome(tool) {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (error) {
    const firstLine = String(error?.message ?? error).split("\n")[0];
    const missing = /distribution 'chrome' is not found/i.test(firstLine);
    console.error(
      missing
        ? `Google Chrome bulunamadı. ${tool} tarayıcı indirmez, sistemdeki Chrome'u kullanır; Chrome'u kurup tekrar çalıştır.`
        : "Google Chrome başlatılamadı.",
    );
    console.error(`  ${firstLine}`);
    process.exit(2);
  }
}

/**
 * RGBA baytlarından PNG. `alpha` false ise alfa atılır (RGB, renk tipi 2):
 * iOS şeffaf pikseli siyaha boyadığı için apple-touch ikonu alfasız olmalı.
 */
export function encodePng(rgba, width, height, alpha = true) {
  const channels = alpha ? 4 : 3;
  const stride = width * channels;
  // Her satırın başında filtre baytı (0: filtresiz).
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = row + 1 + x * channels;
      raw[to] = rgba[from];
      raw[to + 1] = rgba[from + 1];
      raw[to + 2] = rgba[from + 2];
      if (alpha) raw[to + 3] = rgba[from + 3];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // kanal başına 8 bit
  header[9] = alpha ? 6 : 2; // RGBA : RGB
  // 10-12: sıkıştırma, filtre, interlace — hepsi 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
