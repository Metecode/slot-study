/* ------------------------------------------------------------------ */
/* Namespace dosyası — native deponun disk katmanı                     */
/* ------------------------------------------------------------------ */

/*
  Her namespace tek dosya: <ns>.json, içinde { key: value } haritası.
  Yazma tüm haritayı <ns>.json.tmp'ye yazar, sonra <ns>.json üzerine
  taşır. Tek dosya olduğu için setMany de atomik.

  Taşıma atomik bir "üzerine yaz" DEĞİL. @capacitor/filesystem 8.1.3
  iki platformda da önce hedefi siliyor, sonra taşıyor (Android:
  delete + renameTo, başarısızsa kopyala + sil; iOS: deleteFile +
  moveItem). Hiçbiri fsync çağırmıyor. Bu yüzden okuma önce .tmp'ye
  bakar: .tmp yalnızca yarıda kalmış bir yazmadan artar, dolayısıyla
  varsa <ns>.json'dan her zaman yenidir; yarım yazılmış bir JSON
  nesnesi de hiçbir zaman parse edilmez. Süreç her noktada öldürülse
  de son tamamlanmış yazma geri gelir. Ani güç kaybı fsync olmadan
  garanti değil; o durumda dosya bozuk görünür ve loadStore'un bozuk
  kayıt yolu devreye girer.

  Eklenti yalnızca burada, ilk kullanımda dinamik import ile yüklenir:
  web bundle'ına ve precache'e girmez (bkz. vite.config.ts).
*/

type FilesystemModule = typeof import("@capacitor/filesystem");

/**
 * iOS'ta Library/Application Support: Apple'ın uygulama verisi için
 * önerdiği, yedeğe giren ve sistemin temizlemediği klasör. Android'de
 * aynı çağrı uygulamaya özel iç depolamaya (filesDir) düşer.
 */
const DIRECTORY_PATH = "Application Support/com.meteucar.slot";

/** Eklentinin iki platformda da "dosya yok" hata kodu. */
const NOT_FOUND = "OS-PLUG-FILE-0008";

/** Okunamayan dosyanın saklanan kopyaları; MAX_CORRUPT_BACKUPS ile aynı sınır. */
export const MAX_UNREADABLE_COPIES = 3;

let pluginPromise: Promise<FilesystemModule> | null = null;

function loadPlugin(): Promise<FilesystemModule> {
  // Yükleme başarısızsa önbelleğe alınmaz, bir sonraki çağrı yeniden dener.
  pluginPromise ??= import("@capacitor/filesystem").catch((error: unknown) => {
    pluginPromise = null;
    throw error;
  });
  return pluginPromise;
}

const jsonPath = (ns: string) => `${DIRECTORY_PATH}/${ns}.json`;
const tmpPath = (ns: string) => `${jsonPath(ns)}.tmp`;
const unreadablePrefix = (ns: string) => `${ns}.json.unreadable-`;

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === NOT_FOUND;
}

/** Dosya yoksa undefined; diğer her hata çağırana iletilir. */
async function readText(path: string): Promise<string | undefined> {
  const { Filesystem, Directory, Encoding } = await loadPlugin();
  try {
    const result = await Filesystem.readFile({ path, directory: Directory.Library, encoding: Encoding.UTF8 });
    // Blob yalnızca web'de döner; native'de her zaman metin.
    return typeof result.data === "string" ? result.data : await result.data.text();
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

/** Düz bir nesne değilse (dizi, null, sayı, bozuk metin) undefined. */
function parseMap(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Bozuk metin: çağıran karar verir.
  }
  return undefined;
}

export type NamespaceRead =
  | { kind: "ok"; map: Record<string, unknown> }
  /** Ne .tmp ne .json okunabildi; raw <ns>.json'un ham metni. */
  | { kind: "unreadable"; raw: string };

export async function readNamespace(ns: string): Promise<NamespaceRead> {
  const tmp = await readText(tmpPath(ns));
  const fromTmp = tmp === undefined ? undefined : parseMap(tmp);
  if (fromTmp) return { kind: "ok", map: fromTmp };

  const json = await readText(jsonPath(ns));
  // .json yok ve .tmp yarım: ilk yazma yarıda kalmış, hiç tamamlanmış
  // veri yok. (.json yalnızca .tmp tamamen yazıldıktan sonra silinir.)
  if (json === undefined) return { kind: "ok", map: {} };

  const fromJson = parseMap(json);
  return fromJson ? { kind: "ok", map: fromJson } : { kind: "unreadable", raw: json };
}

/** Metni .tmp'ye yazar, sonra .json üzerine taşır. */
export async function writeNamespace(ns: string, text: string): Promise<void> {
  const { Filesystem, Directory, Encoding } = await loadPlugin();
  await Filesystem.writeFile({
    path: tmpPath(ns),
    data: text,
    directory: Directory.Library,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  await Filesystem.rename({ from: tmpPath(ns), to: jsonPath(ns), directory: Directory.Library });
}

/**
 * Okunamayan <ns>.json'u zaman damgalı bir ada taşır; en yeni
 * MAX_UNREADABLE_COPIES tanesi kalır. Harita tek dosyada olduğu için
 * herhangi bir anahtarın yazılması okunamayan her şeyin üzerine yazardı.
 */
export async function preserveUnreadable(ns: string, now: Date): Promise<void> {
  const { Filesystem, Directory } = await loadPlugin();
  // ":" bazı dosya sistemlerinde sorun; sözlük sırası yine zaman sırası.
  const stamp = now.toISOString().replace(/:/g, "-");
  await Filesystem.rename({
    from: jsonPath(ns),
    to: `${DIRECTORY_PATH}/${unreadablePrefix(ns)}${stamp}`,
    directory: Directory.Library,
  });

  const copies = (await listNamespaceFiles(ns)).filter((name) => name.startsWith(unreadablePrefix(ns))).sort();
  for (const name of copies.slice(0, Math.max(0, copies.length - MAX_UNREADABLE_COPIES))) {
    await deleteIfExists(`${DIRECTORY_PATH}/${name}`);
  }
}

/**
 * Namespace'in bütün dosyaları. Sıra önemli: önce .tmp. Tersi olsaydı
 * yarıda kesilen bir silme, yarım kalmış eski bir yazmayı (.tmp)
 * bir sonraki açılışta geri getirirdi.
 */
export async function deleteNamespace(ns: string): Promise<void> {
  await deleteIfExists(tmpPath(ns));
  await deleteIfExists(jsonPath(ns));
  for (const name of await listNamespaceFiles(ns)) {
    if (name.startsWith(unreadablePrefix(ns))) await deleteIfExists(`${DIRECTORY_PATH}/${name}`);
  }
}

/** Deponun bütün klasörü. */
export async function deleteAll(): Promise<void> {
  const { Filesystem, Directory } = await loadPlugin();
  try {
    await Filesystem.rmdir({ path: DIRECTORY_PATH, directory: Directory.Library, recursive: true });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

async function listNamespaceFiles(ns: string): Promise<string[]> {
  const { Filesystem, Directory } = await loadPlugin();
  try {
    const { files } = await Filesystem.readdir({ path: DIRECTORY_PATH, directory: Directory.Library });
    return files.map((file) => file.name).filter((name) => name.startsWith(`${ns}.json`));
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

async function deleteIfExists(path: string): Promise<void> {
  const { Filesystem, Directory } = await loadPlugin();
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Library });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}
