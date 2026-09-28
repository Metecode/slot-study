import { deleteAll, deleteNamespace, preserveUnreadable, readNamespace, writeNamespace } from "./namespaceFile";
import { namespacePrefix, toFlatKey } from "./StorageAdapter";
import type { StorageAdapter } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* Native gerçekleme — namespace başına tek JSON dosyası               */
/* ------------------------------------------------------------------ */

/*
  iOS'ta WKWebView'in IndexedDB'si cihazda yer azalınca silinebiliyor;
  mobilde depo uygulamanın kendi klasöründeki dosyalar. Disk düzeni ve
  kurtarma kuralı namespaceFile.ts'te.

  Bütün işlemler, okumalar dahil, tek bir kuyruktan geçer. Eklenti her
  çağrıyı ayrı bir coroutine'de başlatıyor, sıra korunmuyor: emülatörde
  art arda iki yazmanın 5 denemenin 5'inde önce başlayanı sonra bitti.
  Kuyruk olmasa hızlı art arda iki turda eski store yeniyi ezerdi.

  Harita her namespace için ilk kullanımda bir kez okunup bellekte
  tutulur. Önbellek yalnızca yazma diske indikten sonra güncellenir;
  yazma düşerse bellek ile disk ayrışmaz.
*/

type NamespaceState = {
  map: Record<string, unknown>;
  /**
   * Dosya okunamadıysa ham metni. Bu durumda her get onu döner:
   * loadStore bozuk kaydı ancak ham haliyle yedekleyebilir.
   */
  raw?: string;
  /** Okunamayan dosya zaten kenara taşındı mı? (bir yazma düşmüş olabilir) */
  preserved?: boolean;
};

export function createFilesystemAdapter(now: () => Date = () => new Date()): StorageAdapter {
  const cache = new Map<string, NamespaceState>();
  let tail: Promise<unknown> = Promise.resolve();

  /** Önceki işlem başarısız olsa da sıradaki çalışır. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  }

  /** Okuma hatası önbelleğe alınmaz: loadStore'un tekrar denemesi diski yeniden okur. */
  async function stateOf(ns: string): Promise<NamespaceState> {
    namespacePrefix(ns); // geçersiz ns'i dosyaya dokunmadan reddeder
    const cached = cache.get(ns);
    if (cached) return cached;

    const read = await readNamespace(ns);
    const state: NamespaceState = read.kind === "ok" ? { map: read.map } : { map: {}, raw: read.raw };
    cache.set(ns, state);
    return state;
  }

  /** Yeni haritayı diske yazar; başarılıysa önbelleği diskteki halle değiştirir. */
  async function commit(ns: string, state: NamespaceState, next: Record<string, unknown>): Promise<void> {
    if (state.raw !== undefined && !state.preserved) {
      await preserveUnreadable(ns, now());
      state.preserved = true;
    }
    const text = JSON.stringify(next);
    await writeNamespace(ns, text);
    // Diskteki halin kopyası: sonraki okumalar yazılanla birebir aynı şeyi görür.
    cache.set(ns, { map: JSON.parse(text) as Record<string, unknown> });
  }

  /** Okunamayan dosyadaki anahtarlar bilinmiyor; yeni harita boş başlar. */
  const baseMap = (state: NamespaceState) => (state.raw === undefined ? state.map : {});

  return {
    get<T>(ns: string, key: string): Promise<T | undefined> {
      return enqueue(async () => {
        const state = await stateOf(ns);
        if (state.raw !== undefined) return state.raw as T;
        return Object.hasOwn(state.map, key) ? (structuredClone(state.map[key]) as T) : undefined;
      });
    },

    getAll<T>(ns: string): Promise<Array<{ key: string; value: T }>> {
      return enqueue(async () => {
        const map = baseMap(await stateOf(ns));
        return Object.keys(map).map((key) => ({ key, value: structuredClone(map[key]) as T }));
      });
    },

    set<T>(ns: string, key: string, value: T): Promise<void> {
      return enqueue(async () => {
        const state = await stateOf(ns);
        await commit(ns, state, { ...baseMap(state), [key]: value });
      });
    },

    setMany(items: Array<{ ns: string; key: string; value: unknown }>): Promise<void> {
      return enqueue(async () => {
        if (items.length === 0) return;
        // Önce hepsi doğrulanır: geçersiz bir ns yarıda patlarsa hiçbir şey yazılmamış olur.
        for (const item of items) toFlatKey(item.ns, item.key);
        const namespaces = new Set(items.map((item) => item.ns));
        if (namespaces.size > 1) {
          throw new Error("setMany yalnızca tek namespace içinde atomik; birden çok namespace verildi.");
        }

        const [ns] = namespaces;
        const state = await stateOf(ns);
        const next = { ...baseMap(state) };
        for (const item of items) next[item.key] = item.value;
        await commit(ns, state, next);
      });
    },

    delete(ns: string, key: string): Promise<void> {
      return enqueue(async () => {
        const state = await stateOf(ns);
        if (state.raw === undefined && !Object.hasOwn(state.map, key)) return;
        const next = { ...baseMap(state) };
        delete next[key];
        await commit(ns, state, next);
      });
    },

    clear(ns?: string): Promise<void> {
      return enqueue(async () => {
        if (ns === undefined) {
          await deleteAll();
          cache.clear();
          return;
        }
        namespacePrefix(ns);
        await deleteNamespace(ns);
        cache.set(ns, { map: {} });
      });
    },
  };
}
