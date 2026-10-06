/* ------------------------------------------------------------------ */
/* Kelime markası — "slot"                                            */
/*                                                                     */
/* ÜRETİLDİ: design/logo/build_ui.py. Elle düzenleme; geometri          */
/* değişince betiği çalıştır.                                           */
/* ------------------------------------------------------------------ */

type WordmarkProps = {
  className?: string;
  /** Yükseklik, px: l'nin tepesinden taban çizgisine. Genişlik orandan gelir. */
  height: number;
};

/** Tek renk, currentColor. viewBox harflerin dış sınırına kırpılmış. */
export function Wordmark({ className, height }: WordmarkProps) {
  return (
    <svg
      className={className}
      height={height}
      width={(height * 336) / 144}
      viewBox="0 36 336 144"
      role="img"
      aria-label="Slot"
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M28 76H82A6 6 0 0 1 88 82V92A6 6 0 0 1 82 98H28A6 6 0 0 0 22 104V111A6 6 0 0 0 28 117H60A28 28 0 0 1 88 145V152A28 28 0 0 1 60 180H6A6 6 0 0 1 0 174V164A6 6 0 0 1 6 158H60A6 6 0 0 0 66 152V145A6 6 0 0 0 60 139H28A28 28 0 0 1 0 111V104A28 28 0 0 1 28 76Z" />
        <rect x="106" y="36" width="22" height="144" rx="6" />
        <path d="M174 76H222A28 28 0 0 1 250 104V152A28 28 0 0 1 222 180H174A28 28 0 0 1 146 152V104A28 28 0 0 1 174 76ZM174 98A6 6 0 0 0 168 104V152A6 6 0 0 0 174 158H222A6 6 0 0 0 228 152V104A6 6 0 0 0 222 98Z" fillRule="evenodd" />
        <path d="M286 58A6 6 0 0 1 292 52H302A6 6 0 0 1 308 58V152A6 6 0 0 0 314 158H330A6 6 0 0 1 336 164V174A6 6 0 0 1 330 180H314A28 28 0 0 1 286 152Z" />
        <rect x="264" y="76" width="66" height="22" rx="6" />
      </g>
    </svg>
  );
}
