/* ------------------------------------------------------------------ */
/* Rastgele UUID (v4)                                                  */
/* ------------------------------------------------------------------ */

/*
  crypto.randomUUID yalnızca güvenli bağlamda var. iOS'ta origin
  capacitor://localhost ve WKWebView'in onu güvenli bağlam saydığı
  belgelenmemiş (bkz. platform/index.ts, copyToClipboard). getRandomValues
  güvenli bağlam istemiyor; yoksa aynı v4 biçimi ondan kurulur.
*/

export function randomUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  return uuidFromBytes(cryptoApi.getRandomValues(new Uint8Array(16)));
}

/** RFC 9562 v4: sürüm ve varyant bitleri sabit, gerisi rastgele. */
export function uuidFromBytes(bytes: Uint8Array): string {
  const b = Uint8Array.from(bytes);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
