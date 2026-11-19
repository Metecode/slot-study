import { useEffect } from "react";

import { createScrollLock } from "./bodyScrollLock";
import type { ScrollLock } from "./bodyScrollLock";

/* ------------------------------------------------------------------ */
/* active iken arkadaki sayfanın kaymasını engeller                     */
/*                                                                     */
/* Tek, modül düzeyinde kilit: sayaç bütün diyaloglar arasında ortak.   */
/* Bugün LicensesDialog kullanıyor; DeleteAccountDialog da ileride      */
/* aynı hook'a geçebilir (CLAUDE.md, Diyaloglar).                       */
/* ------------------------------------------------------------------ */

let shared: ScrollLock | null = null;

function sharedLock(): ScrollLock {
  shared ??= createScrollLock({
    style: document.body.style,
    getScrollY: () => window.scrollY,
    scrollTo: (y) => window.scrollTo(0, y),
  });
  return shared;
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return sharedLock().acquire();
  }, [active]);
}
