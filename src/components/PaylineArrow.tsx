import { ARROW } from "./logoGeometry";

/* ------------------------------------------------------------------ */
/* Ödeme oku — logodaki okun kendisi                                   */
/*                                                                     */
/* Elle çizilmiş bir üçgen değil: yol ve açı logoGeometry'den gelir     */
/* (32 px kesimi, üst çubuktaki LogoMark'la aynı). Logo değişince ok da */
/* değişir. Boyutu ve rengi çağıran CSS verir; renk currentColor.        */
/* ------------------------------------------------------------------ */

type PaylineArrowProps = {
  className?: string;
  /** Hangi kenarda durduğu; ok her zaman içeriyi gösterir. */
  side: "left" | "right";
};

const VIEW_BOX = `${ARROW.x} ${ARROW.y} ${ARROW.width} ${ARROW.height}`;

// Sağdaki ok soldakinin aynası: x' = 2·cx − x, cx viewBox'ın dikey ekseni.
const MIRROR = `matrix(-1 0 0 1 ${2 * ARROW.x + ARROW.width} 0)`;

export function PaylineArrow({ className, side }: PaylineArrowProps) {
  return (
    <svg className={className} viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <path
        d={ARROW.path}
        fill="currentColor"
        transform={side === "right" ? MIRROR : undefined}
      />
    </svg>
  );
}
