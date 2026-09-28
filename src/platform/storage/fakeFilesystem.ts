/* ------------------------------------------------------------------ */
/* @capacitor/filesystem taklidi — yalnızca testler için               */
/* ------------------------------------------------------------------ */

/*
  Testlerde vi.mock("@capacitor/filesystem", () => import("./fakeFilesystem"))
  ile gerçek eklentinin yerine geçer. Dosyalar bellekte, yola göre.

  Davranış eklentinin 8.1.3 kaynağından alındı, tahmin değil:
  - rename önce hedefi siler, SONRA taşır (Android: delete + renameTo;
    iOS: deleteFile + moveItem). Arada öldürülmeyi afterRenameDelete taklit eder.
  - "Dosya yok" hatasının kodu iki platformda da OS-PLUG-FILE-0008.
  - readdir ve rmdir olmayan klasörde aynı hatayı verir.

  Depo yalnızca Directory.Library kullanmalı; başka dizin gelirse hata.
*/

export const Directory = { Library: "LIBRARY" } as const;
export const Encoding = { UTF8: "utf8" } as const;

type Method = "readFile" | "writeFile" | "rename" | "deleteFile" | "readdir" | "rmdir";

export const fakeFs = {
  files: new Map<string, string>(),
  /** Her çağrı, sırasıyla: "writeFile <yol>" gibi. */
  calls: [] as string[],
  /** Çağrı başlamadan önce; fırlatırsa çağrı hiçbir şey yapmadan düşer. */
  beforeCall: undefined as undefined | ((method: Method, path: string) => void),
  /** Çağrının ne kadar süreceği (ms); eşzamanlılık testleri için. */
  delayMs: undefined as undefined | ((method: Method, path: string) => number),
  /** rename hedefi sildikten sonra, taşımadan önce; fırlatırsa "arada öldürüldü". */
  afterRenameDelete: undefined as undefined | (() => void),

  reset(): void {
    this.files.clear();
    this.calls = [];
    this.beforeCall = undefined;
    this.delayMs = undefined;
    this.afterRenameDelete = undefined;
  },
};

function notFound(method: Method, path: string): Error {
  return Object.assign(new Error(`'${method}' failed because file at '${path}' does not exist.`), {
    code: "OS-PLUG-FILE-0008",
  });
}

async function begin(method: Method, path: string, directory: string | undefined): Promise<void> {
  fakeFs.calls.push(`${method} ${path}`);
  if (directory !== Directory.Library) throw new Error(`Beklenmeyen dizin: ${directory}`);
  fakeFs.beforeCall?.(method, path);
  const delay = fakeFs.delayMs?.(method, path) ?? 0;
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

/** Klasörün doğrudan altındaki dosya adları. */
function childrenOf(dir: string): string[] {
  const prefix = `${dir}/`;
  return [...fakeFs.files.keys()]
    .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
    .map((path) => path.slice(prefix.length));
}

type PathOptions = { path: string; directory?: string };

export const Filesystem = {
  async readFile({ path, directory }: PathOptions & { encoding?: string }) {
    await begin("readFile", path, directory);
    const data = fakeFs.files.get(path);
    if (data === undefined) throw notFound("readFile", path);
    return { data };
  },

  async writeFile({ path, directory, data }: PathOptions & { data: string; encoding?: string; recursive?: boolean }) {
    await begin("writeFile", path, directory);
    fakeFs.files.set(path, data);
    return { uri: path };
  },

  async rename({ from, to, directory }: { from: string; to: string; directory?: string }) {
    await begin("rename", `${from} -> ${to}`, directory);
    const data = fakeFs.files.get(from);
    if (data === undefined) throw notFound("rename", from);
    fakeFs.files.delete(to);
    fakeFs.afterRenameDelete?.();
    fakeFs.files.set(to, data);
    fakeFs.files.delete(from);
  },

  async deleteFile({ path, directory }: PathOptions) {
    await begin("deleteFile", path, directory);
    if (!fakeFs.files.delete(path)) throw notFound("deleteFile", path);
  },

  async readdir({ path, directory }: PathOptions) {
    await begin("readdir", path, directory);
    const names = childrenOf(path);
    if (names.length === 0) throw notFound("readdir", path);
    return { files: names.map((name) => ({ name })) };
  },

  async rmdir({ path, directory }: PathOptions & { recursive?: boolean }) {
    await begin("rmdir", path, directory);
    const inside = [...fakeFs.files.keys()].filter((key) => key.startsWith(`${path}/`));
    if (inside.length === 0) throw notFound("rmdir", path);
    for (const key of inside) fakeFs.files.delete(key);
  },
};
