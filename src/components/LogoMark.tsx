/* ------------------------------------------------------------------ */
/* Logo işareti — üst çubukta                                           */
/*                                                                     */
/* ÜRETİLDİ: design/logo/build_icons.py. Elle düzenleme; geometri        */
/* değişince betiği çalıştır, ikonlarla birlikte bu da yenilenir.         */
/* ------------------------------------------------------------------ */

type LogoMarkProps = {
  className?: string;
  /** Kenar, px. Sembol kare; viewBox çizimin dış sınırına kırpılmış. */
  size?: number;
};

/**
 * Makinenin penceresi; iki ödeme oku imleci gösteriyor. 32 px kesimi:
 * ~28 px'te tam versiyonun okları kayboluyor. Vurgu yalnız imleçte.
 */
export function LogoMark({ className, size = 28 }: LogoMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="24 24 208 208"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="var(--text)">
        <path d="M24 87.57V80A56 56 0 0 1 80 24H176A56 56 0 0 1 232 80V87.57L210 95.58V80A34 34 0 0 0 176 46H80A34 34 0 0 0 46 80V95.58Z" />
        <path d="M24 168.43V176A56 56 0 0 0 80 232H176A56 56 0 0 0 232 176V168.43L210 160.42V176A34 34 0 0 1 176 210H80A34 34 0 0 1 46 176V160.42Z" />
        <path d="M24 100.34L100 128L24 155.66Z" />
        <path d="M232 100.34L156 128L232 155.66Z" />
        <path fill="var(--accent)" d="M123 84H133A6 6 0 0 1 139 90V166A6 6 0 0 1 133 172H123A6 6 0 0 1 117 166V90A6 6 0 0 1 123 84Z" />
      </g>
    </svg>
  );
}
