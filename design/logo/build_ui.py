"""Arayüzdeki logo parçalarını üretir: üst çubuğun sembolü ve kelime markası,
makaradaki ödeme oklarının geometrisi (src/components/).

Geometri build_logo.py'den gelir; burada yalnızca TSX'e çeviri var. Renk
yazılmaz: gövde currentColor, imleç var(--accent). Rengi çağıran CSS verir.

Çalıştır: python design/logo/build_ui.py
"""
import re
from pathlib import Path

import build_logo as L

ROOT = Path(__file__).resolve().parents[2]
COMPONENTS = ROOT / "src" / "components"

SYMBOL_EDGE = L.O1 - L.O0  # 256'lık tuvalde sembolün kenarı: 208
CARET_MARK = "CARET"       # imlecin path'ini ayırt etmek için geçici renk

# Kelime markasının dikey sınırı: l'nin tepesi ve taban çizgisi (build_logo.wordmark)
WORDMARK_TOP, WORDMARK_BASE = 36, 180

ELEMENT_RE = re.compile(r"<(path|rect)([^>]*)/>")
ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')

HEADER = """/* ------------------------------------------------------------------ */
/* {title:<67}*/
/*                                                                     */
/* ÜRETİLDİ: design/logo/build_ui.py. Elle düzenleme; geometri          */
/* değişince betiği çalıştır.                                           */
/* ------------------------------------------------------------------ */
"""


def jsx_elements(svg_body, indent):
    """SVG gövdesini JSX satırlarına çevirir. İmleç rengi var(--accent) olur,
    diğer renkler düşer: ebeveyndeki currentColor'dan gelsinler."""
    lines = []
    for tag, attrs in ELEMENT_RE.findall(svg_body):
        a = dict(ATTR_RE.findall(attrs))
        fill = a.pop("fill", None)
        if fill == CARET_MARK:
            a["fill"] = "var(--accent)"
        if "fill-rule" in a:
            a["fillRule"] = a.pop("fill-rule")
        props = " ".join(f'{k}="{v}"' for k, v in a.items())
        lines.append(f"{' ' * indent}<{tag} {props} />")
    return "\n".join(lines)


def logo_mark_tsx():
    """Üst çubuğun sembolü. ~28 px'te çiziliyor: okların büyük olduğu 32 px kesimi."""
    box = f"{L.O0} {L.O0} {SYMBOL_EDGE} {SYMBOL_EDGE}"
    return HEADER.format(title="Logo işareti — üst çubukta") + f"""
type LogoMarkProps = {{
  className?: string;
  /** Kenar, px. Sembol kare; viewBox çizimin dış sınırına kırpılmış. */
  size?: number;
}};

/**
 * Makinenin penceresi; iki ödeme oku imleci gösteriyor. 32 px kesimi:
 * ~28 px'te tam versiyonun okları kayboluyor. Gövde currentColor, vurgu
 * yalnız imleçte (--accent).
 */
export function LogoMark({{ className, size = 28 }}: LogoMarkProps) {{
  return (
    <svg
      className={{className}}
      width={{size}}
      height={{size}}
      viewBox="{box}"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
{jsx_elements(L.symbol_32(caret=CARET_MARK), 8)}
      </g>
    </svg>
  );
}}
"""


def wordmark_tsx():
    height = WORDMARK_BASE - WORDMARK_TOP
    box = f"0 {WORDMARK_TOP} {L.WM_W} {height}"
    return HEADER.format(title="Kelime markası — \"slot\"") + f"""
type WordmarkProps = {{
  className?: string;
  /** Yükseklik, px: l'nin tepesinden taban çizgisine. Genişlik orandan gelir. */
  height: number;
}};

/** Tek renk, currentColor. viewBox harflerin dış sınırına kırpılmış. */
export function Wordmark({{ className, height }}: WordmarkProps) {{
  return (
    <svg
      className={{className}}
      height={{height}}
      width={{(height * {L.WM_W}) / {height}}}
      viewBox="{box}"
      role="img"
      aria-label="Slot"
      focusable="false"
    >
      <g fill="currentColor">
{jsx_elements(L.WM_BODY, 8)}
      </g>
    </svg>
  );
}}
"""


def geometry_ts():
    """Arayüzün logodan ödünç aldığı ölçüler. Ok, LogoMark'taki 32 px kesiminin
    sol oku: makaradaki ok üst çubuktaki logoyla aynı görünsün."""
    length = 76  # build_logo.symbol_32 ile aynı
    half = L.half_for(length, L.ARROW_DEG)
    x, y = L.O0, L.C - half
    path = f"M{x} {L.f(y)}L{x + length} {L.C}L{x} {L.f(L.C + half)}Z"
    assert path in L.symbol_32(), "ok geometrisi build_logo.symbol_32'den ayrıştı"
    wordmark_height = WORDMARK_BASE - WORDMARK_TOP
    return HEADER.format(title="Logo ölçüleri — arayüzde yeniden kullanılanlar") + f"""
/** Ok kenarının yatayla açısı, derece (build_logo.py → ARROW_DEG). */
export const ARROW_DEG = {L.ARROW_DEG};

/** Sembolün kenarı (çerçevenin dış sınırı), logo birimiyle. */
export const SYMBOL_EDGE = {SYMBOL_EDGE};

/**
 * 32 px kesiminin sol oku, logo birimiyle: taban çerçevenin dış kenarında,
 * uç imlecin dikey ortasında. Sağdaki bunun aynası.
 */
export const ARROW = {{
  path: "{path}",
  x: {x},
  y: {L.f(y)},
  width: {length},
  height: {L.f(2 * half)},
}} as const;

/** Kelime markasının yüksekliği / sembol kenarı: lockup'taki ölçek. */
export const WORDMARK_TO_SYMBOL = {wordmark_height} / {SYMBOL_EDGE};
"""


if __name__ == "__main__":
    files = {
        "LogoMark.tsx": logo_mark_tsx(),
        "Wordmark.tsx": wordmark_tsx(),
        "logoGeometry.ts": geometry_ts(),
    }
    for name, text in files.items():
        (COMPONENTS / name).write_text(text, encoding="utf-8")
        print("src/components/" + name)
