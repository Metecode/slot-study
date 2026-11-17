import type { ReactNode } from "react";

import { platformFeatures } from "../platform";

/* ------------------------------------------------------------------ */
/* Gizlilik politikası bağlantısı — web'de göreli, native'de canlı site  */
/* ------------------------------------------------------------------ */

/** Mobil uygulamada göreli yol işe yaramaz (bkz. platformFeatures.sameOriginPages). */
const PRIVACY_URL_LIVE = "https://slot.meteucar.com/privacy";

export function PrivacyLink({ className, children }: { className: string; children: ReactNode }) {
  return platformFeatures.sameOriginPages ? (
    /* Statik sayfa, React'in dışında: tam sayfa geçişi. Service worker
       /privacy'yi SPA yedeğine düşürmüyor (vite.config.ts). */
    <a className={className} href="/privacy">
      {children}
    </a>
  ) : (
    /* Native: dış adres, Capacitor sistem tarayıcısında açar. */
    <a className={className} href={PRIVACY_URL_LIVE} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}
