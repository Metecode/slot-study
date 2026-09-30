/* ------------------------------------------------------------------ */
/* Sonuç ekranının küçük simgeleri                                     */
/*                                                                     */
/* Hepsi currentColor kullanır: rengi çağıran taraf belirler, simge     */
/* kendi rengini yazmaz. aria-hidden — hiçbiri tek başına bilgi         */
/* taşımıyor, yanlarında zaten metin var.                              */
/* ------------------------------------------------------------------ */

type IconProps = {
  className?: string;
};

/** Yakalanan kavram. */
export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 6.3 4.8 8.6 9.5 3.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Kaçırılan kavram. Çarpı değil çizgi: eksik olmak bir hata değil,
 * çarpı işareti gereğinden sert okunuyor.
 */
export function DashIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Devam sorusu satırının ucundaki ok. */
export function ArrowIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 6h7M6.5 3l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Kopyala düğmesinin durağan hali: üst üste iki sayfa. */
export function CopyIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="1.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 10.5H3a1.5 1.5 0 0 1-1.5-1.5V4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Yeni sayfada açan düğmeler: kutudan dışarı çıkan ok. Genel bir sembol,
 * hiçbir markanın logosu değil.
 */
export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M9.5 7v2a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 9V4A1.5 1.5 0 0 1 3 2.5h2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 1.5h3.5V5M10.5 1.5 5.5 6.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
