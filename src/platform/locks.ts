/* ------------------------------------------------------------------ */
/* Adlandırılmış kilit — oku-değiştir-yaz adımlarını sıraya sokar       */
/* ------------------------------------------------------------------ */

/*
  StorageAdapter'da oku-değiştir-yaz için transaction yok. Web'de iki
  sekme aynı kuyruğu okuyup birbirinin yazdığını ezebiliyor; Web Locks API
  sekmeler arasında sıraya sokar. Native'de tek WebView var, API olmasa da
  aynı sayfadaki çağrılar aşağıdaki zincirle sıraya girer.
*/

const chains = new Map<string, Promise<unknown>>();

/** fn'in hatası çağırana döner; zincir bir sonraki çağrı için açık kalır. */
export function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  const run = locks ? () => locks.request(name, fn) : fn;

  const previous = chains.get(name) ?? Promise.resolve();
  const result = previous.then(run, run);
  chains.set(
    name,
    result.catch(() => undefined),
  );
  return result;
}
