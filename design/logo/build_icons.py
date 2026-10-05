"""Platform ikonlarının kaynaklarını üretir: design/icon/*.svg, Android vektörleri
ve üst çubuğun logosu (src/components/LogoMark.tsx).

Geometri build_logo.py'den gelir; burada yalnızca yerleşim var: sembol hangi
tuvalde, kenarı tuvalin yüzde kaçı, zemin ne. PNG'leri `npm run icons` üretir.

Çalıştır: python design/logo/build_icons.py && npm run icons
"""
import re
from pathlib import Path

import build_logo as L

ROOT = Path(__file__).resolve().parents[2]
ICON_DIR = ROOT / "design" / "icon"
DRAWABLE = ROOT / "android" / "app" / "src" / "main" / "res" / "drawable"

SYMBOL_EDGE = L.O1 - L.O0  # 256'lık tuvalde sembolün kenarı: 208

# Sembol kenarının zemin kenarına oranı. Maskelenenler için gerekçe build_logo.py'de.
TILE_EDGE = SYMBOL_EDGE * L.ICON_SCALE / 256  # ~%57: sunumdaki app ikonuyla aynı
FAVICON_EDGE = 0.72                           # 16 px'te sembol karonun çoğunu doldursun
NOTIFICATION_EDGE = 20 / 24                   # durum çubuğu: 24 dp'nin 20 dp'lik canlı alanı

TILE_RX = 56 / 256  # karo köşesi, sunumdaki app ikonuyla aynı oran
# Android 7.1 ve öncesi: kenardan 2/76 pay, launcher'ın gölgesine yer kalsın.
LEGACY_TILE = 72 / 76


def place(symbol_svg, canvas, edge):
    """Sembolü `canvas` tuvalinin ortasına, kenarı canvas·edge olacak şekilde yerleştirir."""
    k = canvas * edge / SYMBOL_EDGE
    t = canvas / 2 - L.C * k
    return f'<g transform="translate({L.f(t)} {L.f(t)}) scale({L.f(k)})">{symbol_svg}</g>'


def svg(canvas, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L.f(canvas)} {L.f(canvas)}">'
            f'{body}</svg>\n')


def colored(symbol=L.symbol_full):
    """Koyu zeminde açık sembol, vurgu yalnız imleçte."""
    return f'<g fill="{L.PAPER}">{symbol(caret=L.ACCENT)}</g>'


def tile(size, inset=0.0, shape="rounded"):
    s = size * (1 - 2 * inset)
    o = size * inset
    if shape == "circle":
        return f'<circle cx="{L.f(size / 2)}" cy="{L.f(size / 2)}" r="{L.f(s / 2)}" fill="{L.INK}"/>'
    if shape == "square":
        return f'<rect width="{L.f(size)}" height="{L.f(size)}" fill="{L.INK}"/>'
    return (f'<rect x="{L.f(o)}" y="{L.f(o)}" width="{L.f(s)}" height="{L.f(s)}" '
            f'rx="{L.f(s * TILE_RX)}" fill="{L.INK}"/>')


def sources():
    legacy_inset = (1 - LEGACY_TILE) / 2
    return {
        # Favicon ve PWA "any": köşeleri şeffaf karo.
        "slot_favicon.svg": svg(256, tile(256) + place(colored(L.symbol_16), 256, FAVICON_EDGE)),
        "slot_any.svg": svg(256, tile(256) + place(colored(), 256, TILE_EDGE)),
        # Maskable: zemin kenara kadar, sembol %40'lık güvenli dairede.
        "slot_maskable.svg": svg(256, tile(256, shape="square")
                                 + place(colored(), 256, L.MASKABLE_SYMBOL_EDGE)),
        # iOS ve Play köşeleri kendisi yuvarlar: kare zemin, karo ile aynı oran.
        "slot_ios.svg": svg(256, tile(256, shape="square") + place(colored(), 256, TILE_EDGE)),
        # Android < 8 (uyarlanabilir ikon öncesi): gölge payıyla karo ve daire.
        "slot_legacy.svg": svg(256, tile(256, legacy_inset)
                               + place(colored(), 256, TILE_EDGE * LEGACY_TILE)),
        "slot_legacy_round.svg": svg(256, tile(256, legacy_inset, "circle")
                                     + place(colored(), 256, TILE_EDGE * LEGACY_TILE)),
        # Uyarlanabilir ikon katmanları: 108 tuval, sembol 66'lık güvenli dairede.
        "slot_foreground.svg": svg(108, place(colored(), 108, L.ADAPTIVE_SYMBOL_EDGE)),
        "slot_monochrome.svg": svg(108, place(f'<g fill="#000">{L.symbol_full()}</g>',
                                              108, L.ADAPTIVE_SYMBOL_EDGE)),
        "slot_background.svg": svg(108, f'<rect width="108" height="108" fill="{L.INK}"/>'),
        # Bildirim: sistem yalnız alfa kanalını kullanır; 24 px'te okları büyük kesim.
        "slot_notification_24.svg": svg(24, place(f'<g fill="#fff">{L.symbol_32()}</g>',
                                                  24, NOTIFICATION_EDGE)),
    }


# --- Android VectorDrawable ---------------------------------------------------
PATH_RE = re.compile(r"<path([^>]*)/>")
ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')


def android_color(hex_color):
    return "#FF" + hex_color.lstrip("#").upper()


def vector(symbol_svg, canvas, edge, fill, comment):
    """Sembolün path'lerini VectorDrawable'a çevirir; renk path'te yoksa `fill`."""
    k = canvas * edge / SYMBOL_EDGE
    t = canvas / 2 - L.C * k
    paths = []
    for attrs in PATH_RE.findall(symbol_svg):
        a = dict(ATTR_RE.findall(attrs))
        fill_type = '\n            android:fillType="evenOdd"' if a.get("fill-rule") == "evenodd" else ""
        paths.append(
            f'        <path\n            android:fillColor="{android_color(a.get("fill", fill))}"'
            f'{fill_type}\n            android:pathData="{a["d"]}" />'
        )
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        f"<!--\n{comment}\n  ÜRETİLDİ: design/logo/build_icons.py. Elle düzenleme, betiği çalıştır.\n-->\n"
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        f'    android:width="{canvas}dp"\n    android:height="{canvas}dp"\n'
        f'    android:viewportWidth="{canvas}"\n    android:viewportHeight="{canvas}">\n'
        f'    <group\n        android:translateX="{L.f(t)}"\n        android:translateY="{L.f(t)}"\n'
        f'        android:scaleX="{L.f(k)}"\n        android:scaleY="{L.f(k)}">\n'
        + "\n".join(paths) + "\n    </group>\n</vector>\n"
    )


def drawables():
    adaptive = f"%{round(L.ADAPTIVE_SYMBOL_EDGE * 100)}"
    return {
        "ic_launcher_foreground.xml": vector(
            L.symbol_full(caret=L.ACCENT), 108, L.ADAPTIVE_SYMBOL_EDGE, L.PAPER,
            f"  Uyarlanabilir ikonun ön katmanı: 108 tuval, sembol kenarı {adaptive}\n"
            "  (köşeleri 66'lık güvenli dairenin içinde). Vurgu yalnız imleçte.\n"
            "  Android 12+ açılış ekranının ikonu da bu (values/styles.xml)."),
        "ic_launcher_monochrome.xml": vector(
            L.symbol_full(), 108, L.ADAPTIVE_SYMBOL_EDGE, "#000000",
            "  Temalı ikon (Android 13+): sistem yalnız alfayı kullanıp kendi rengiyle boyar.\n"
            "  Ön katmanla aynı yerleşim."),
        "ic_stat_slot.xml": vector(
            L.symbol_32(), 24, NOTIFICATION_EDGE, "#FFFFFF",
            "  Bildirim küçük ikonu (tekrar hatırlatıcısı): tek renk, sistem yalnız alfayı\n"
            "  kullanır. Okların büyük olduğu 32 px kesimi; çizgi ~2.1 dp (2'den incesi\n"
            "  24 dp'de kayboluyor). capacitor.config.ts → plugins.LocalNotifications.smallIcon."),
    }


# --- Arayüzdeki logo (üst çubuk) ------------------------------------------------
COMPONENTS = ROOT / "src" / "components"
CARET_MARK = "CARET"  # imlecin path'ini ayırt etmek için geçici renk


def logo_mark_tsx():
    """Üst çubuğun logosu. ~28 px'te çiziliyor: okların büyük olduğu 32 px kesimi."""
    lines = []
    for attrs in PATH_RE.findall(L.symbol_32(caret=CARET_MARK)):
        a = dict(ATTR_RE.findall(attrs))
        extra = ' fillRule="evenodd"' if a.get("fill-rule") == "evenodd" else ""
        if a.get("fill") == CARET_MARK:
            extra += ' fill="var(--accent)"'
        lines.append(f'        <path{extra} d="{a["d"]}" />')
    paths = "\n".join(lines)
    box = f"{L.O0} {L.O0} {SYMBOL_EDGE} {SYMBOL_EDGE}"
    return f"""/* ------------------------------------------------------------------ */
/* Logo işareti — üst çubukta                                           */
/*                                                                     */
/* ÜRETİLDİ: design/logo/build_icons.py. Elle düzenleme; geometri        */
/* değişince betiği çalıştır, ikonlarla birlikte bu da yenilenir.         */
/* ------------------------------------------------------------------ */

type LogoMarkProps = {{
  className?: string;
  /** Kenar, px. Sembol kare; viewBox çizimin dış sınırına kırpılmış. */
  size?: number;
}};

/**
 * Makinenin penceresi; iki ödeme oku imleci gösteriyor. 32 px kesimi:
 * ~28 px'te tam versiyonun okları kayboluyor. Vurgu yalnız imleçte.
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
      <g fill="var(--text)">
{paths}
      </g>
    </svg>
  );
}}
"""


if __name__ == "__main__":
    (COMPONENTS / "LogoMark.tsx").write_text(logo_mark_tsx(), encoding="utf-8")
    print("src/components/LogoMark.tsx")
    for name, text in sources().items():
        (ICON_DIR / name).write_text(text, encoding="utf-8")
        print("design/icon/" + name)
    for name, text in drawables().items():
        (DRAWABLE / name).write_text(text, encoding="utf-8")
        print("android/.../drawable/" + name)
