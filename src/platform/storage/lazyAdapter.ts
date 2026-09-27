import type { StorageAdapter } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* Tembel adapter — gerçeklemeyi ilk çağrıda yükler                    */
/* ------------------------------------------------------------------ */

/*
  platform/index.ts deponun adapter'ını modül yüklenirken, eşzamanlı
  seçiyor. Native gerçekleme ise dinamik import ile gelmek zorunda:
  kodu ve eklentisi web bundle'ına ve precache'e girmemeli. Bu sarmalayıcı
  aradaki köprü; her çağrıyı yüklenen gerçeklemeye aynen iletir.
*/

export function createLazyAdapter(load: () => Promise<StorageAdapter>): StorageAdapter {
  let loading: Promise<StorageAdapter> | null = null;

  function adapter(): Promise<StorageAdapter> {
    // Yükleme düşerse önbelleğe alınmaz, bir sonraki çağrı yeniden dener.
    loading ??= load().catch((error: unknown) => {
      loading = null;
      throw error;
    });
    return loading;
  }

  return {
    async get<T>(ns: string, key: string) {
      return (await adapter()).get<T>(ns, key);
    },
    async getAll<T>(ns: string) {
      return (await adapter()).getAll<T>(ns);
    },
    async set<T>(ns: string, key: string, value: T) {
      return (await adapter()).set(ns, key, value);
    },
    async setMany(items: Array<{ ns: string; key: string; value: unknown }>) {
      return (await adapter()).setMany(items);
    },
    async delete(ns: string, key: string) {
      return (await adapter()).delete(ns, key);
    },
    async clear(ns?: string) {
      return (await adapter()).clear(ns);
    },
  };
}
