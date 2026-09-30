import { fakeFs } from "./fakeFilesystem";
import { createFilesystemAdapter } from "./filesystemAdapter";

/* ------------------------------------------------------------------ */
/* filesystemAdapter testlerinin ortak kurulumu                        */
/* ------------------------------------------------------------------ */

/*
  filesystemAdapter.*.test.ts dosyaları bunu kullanır. Eklentinin taklidi
  her test dosyasında ayrıca yazılmalı; vi.mock yalnızca yazıldığı
  dosyada başa taşınır:

    vi.mock("@capacitor/filesystem", () => import("./fakeFilesystem"));
    beforeEach(() => fakeFs.reset());
*/

export const DIR = "Application Support/com.meteucar.slot";
export const JSON_PATH = `${DIR}/ns.json`;
export const TMP_PATH = `${JSON_PATH}.tmp`;
export const NOW = new Date("2026-05-01T12:00:00.000Z");
export const UNREADABLE = `${DIR}/ns.json.unreadable-2026-05-01T12-00-00.000Z`;

export const text = (map: Record<string, unknown>) => JSON.stringify(map);
/** Yarıda kesilmiş yazma: metnin ilk yarısı. */
export const half = (value: string) => value.slice(0, Math.floor(value.length / 2));
/** Uygulamanın yeniden açılması: önbelleği olmayan yeni bir örnek. */
export const reopen = () => createFilesystemAdapter(() => NOW);
/** Yalnızca yazma ve taşıma çağrıları, sırasıyla. */
export const writes = () => fakeFs.calls.filter((call) => /^(writeFile|rename|deleteFile) /.test(call));
