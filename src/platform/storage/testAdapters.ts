import { createFilesystemAdapter } from "./filesystemAdapter";
import { createMemoryAdapter } from "./memoryAdapter";
import type { StorageAdapter } from "./StorageAdapter";

/* ------------------------------------------------------------------ */
/* Testlerde aynı takımın koşturulduğu adapter'lar                     */
/* ------------------------------------------------------------------ */

/*
  describe.each ile kullanılır. filesystemAdapter'ı kullanan test dosyası
  eklentiyi kendisi taklit etmeli ve her testten önce diski sıfırlamalı:

    vi.mock("@capacitor/filesystem", () => import("../platform/storage/fakeFilesystem"));
    beforeEach(() => fakeFs.reset());
*/
export const TEST_ADAPTERS: Array<[name: string, create: () => StorageAdapter]> = [
  ["memoryAdapter", createMemoryAdapter],
  ["filesystemAdapter", () => createFilesystemAdapter()],
];
