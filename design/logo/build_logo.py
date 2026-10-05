"""Slot logosunun tüm SVG'lerini tek geometriden üretir.

Kural: her köşe yarıçapı, ait olduğu parçanın genişliğinin ~%27'si
(çerçeve 56/208, imleç 6/22, "o" 28/104). Çerçeve ve imleç aynı kalınlıkta (22).
Çalıştır: python design/logo/build_logo.py
"""
import math
from pathlib import Path

OUT = Path(__file__).parent
C = 128  # dikey merkez; okların ucu ve imlecin ortası burada

# --- renkler: uygulamanın token'larıyla aynı (src/styles/tokens.css) ---------
INK = "#0b0f14"         # --bg; logonun tek koyu rengi
PAPER = "#e6edf3"       # --text; koyu zeminde logo, koyu varyantta karo
ACCENT = "#22d3ee"      # --accent; yalnız imleçte
ACCENT_DIM = "#0e7490"  # --accent-dim; açık karoda imleç (#e6edf3 üzerinde ~4.6:1)

ARROW_DEG = 20  # ok kenarı açısı; 15° büyük boyutta iğne gibi duruyordu

# --- çerçeve: dış 24..232 r56, iç 46..210 r34 (paralel ofset) ---------------
O0, O1, OR = 24, 232, 56
I0, I1, IR = 46, 210, 34


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def rounded_rect(x, y, w, h, r):
    """Yuvarlatılmış dikdörtgenin path verisi. <rect> yerine path: Android
    VectorDrawable yalnızca path tanıyor (build_icons.py çeviriyor)."""
    return (f"M{f(x + r)} {f(y)}H{f(x + w - r)}A{r} {r} 0 0 1 {f(x + w)} {f(y + r)}"
            f"V{f(y + h - r)}A{r} {r} 0 0 1 {f(x + w - r)} {f(y + h)}H{f(x + r)}"
            f"A{r} {r} 0 0 1 {f(x)} {f(y + h - r)}V{f(y + r)}A{r} {r} 0 0 1 {f(x + r)} {f(y)}Z")


def cursor(width=22, height=88, r=6, fill=None):
    paint = f' fill="{fill}"' if fill else ""
    return f'<path{paint} d="{rounded_rect(C - width / 2, C - height / 2, width, height, r)}"/>'


def frame_ring(o0=O0, o1=O1, orad=OR, i0=I0, i1=I1, irad=IR):
    return (
        f'<path fill-rule="evenodd" d="M{o0+orad} {o0}H{o1-orad}A{orad} {orad} 0 0 1 {o1} {o0+orad}'
        f'V{o1-orad}A{orad} {orad} 0 0 1 {o1-orad} {o1}H{o0+orad}A{orad} {orad} 0 0 1 {o0} {o1-orad}'
        f'V{o0+orad}A{orad} {orad} 0 0 1 {o0+orad} {o0}Z'
        f'M{i0+irad} {i0}A{irad} {irad} 0 0 0 {i0} {i0+irad}V{i1-irad}A{irad} {irad} 0 0 0 {i0+irad} {i1}'
        f'H{i1-irad}A{irad} {irad} 0 0 0 {i1} {i1-irad}V{i0+irad}A{irad} {irad} 0 0 0 {i1-irad} {i0}Z"/>'
    )


def half_for(length, degrees):
    # ok kenarı tam bir açıda dursun; yükseklik açıdan türetilir
    return length * math.tan(math.radians(degrees))


def framed_with_arrows(length, half, gap):
    """Çerçeve, okların geçtiği yerde `gap` kadar kesilir: üst ve alt iki parça.

    Ok tabanı çerçevenin dış kenarında (x=24), ucu pencerenin içinde (x=24+length),
    ucu imlecin dikey merkezinde.
    """
    # okun üst kenarının `gap` kadar dışarı ötelenmiş doğrusu: y(x)
    shift = gap * math.hypot(length, half) / length
    def y_cut(x):
        return (C - half) + (half / length) * (x - O0) - shift

    yo, yi = y_cut(O0), y_cut(I0)  # dış ve iç kenarda kesim yüksekliği
    assert yo > O0 + OR and yi > I0 + IR, "kesim düz kenarın dışına taştı"

    def piece(flip):
        # flip=False üst parça, True alt parça (y -> 256-y)
        def Y(y):
            return f(256 - y if flip else y)
        s = "0" if flip else "1"   # dış yay yönü aynada ters döner
        si = "1" if flip else "0"
        return (
            f'<path d="M{O0} {Y(yo)}V{Y(O0+OR)}A{OR} {OR} 0 0 {s} {O0+OR} {Y(O0)}'
            f'H{O1-OR}A{OR} {OR} 0 0 {s} {O1} {Y(O0+OR)}V{Y(yo)}'
            f'L{I1} {Y(yi)}V{Y(I0+IR)}A{IR} {IR} 0 0 {si} {I1-IR} {Y(I0)}'
            f'H{I0+IR}A{IR} {IR} 0 0 {si} {I0} {Y(I0+IR)}V{Y(yi)}Z"/>'
        )

    tip_l = O0 + length
    tip_r = O1 - length
    arrows = (
        f'<path d="M{O0} {f(C-half)}L{tip_l} {C}L{O0} {f(C+half)}Z"/>'
        f'<path d="M{O1} {f(C-half)}L{tip_r} {C}L{O1} {f(C+half)}Z"/>'
    )
    return piece(False) + piece(True) + arrows


def svg(body, w=256, h=256, fill=INK, title="Slot"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img">'
        f'<title>{title}</title><g fill="{fill}">{body}</g></svg>\n'
    )


# --- sembol varyantları -----------------------------------------------------
# caret: imleç rengi; None ise sembolün geri kalanıyla aynı renk
def symbol_full(caret=None):          # 64 px ve üstü
    return framed_with_arrows(length=56, half=half_for(56, ARROW_DEG), gap=8) + cursor(fill=caret)


def symbol_32(caret=None):            # oklar ~%35 büyük, kesim boşluğu da büyük
    return framed_with_arrows(length=76, half=half_for(76, ARROW_DEG), gap=12) + cursor(fill=caret)


def symbol_16(caret=None):            # oksuz; çizgiler kalınlaştırıldı (16 px'te 22 → 1.4 px kalırdı)
    return frame_ring(i0=52, i1=204, irad=28) + cursor(width=28, height=96, r=8, fill=caret)


# --- app ikonu: karo üzerinde aynı sembol, %70 ölçek ---------------------------
# Ayrı bir çizim değil: okların çerçeveyi kestiği geometri ikonda da korunur.
ICON_SCALE = 0.7

# Maskelenen ikonlarda sembol kenarı (karo kenarına oranı). Merkezden en uzak nokta
# köşe yayında: √2·(s/2 − r) + r ≈ 0.595·s (r = 0.27·s). Güvenli daireye sığdırılır:
#   Android adaptif: 108 dp katman, 66 dp güvenli daire → 0.595·s ≤ 33 → s ≤ %51
#   PWA maskable:    güvenli daire yarıçapı %40      → 0.595·s ≤ 0.40 → s ≤ %67
# Not: bunlar sembolün kenarı; ICON_SCALE ise 256'lık kanvasın ölçeği (kenar 208·k).
ADAPTIVE_SYMBOL_EDGE = 0.51
MASKABLE_SYMBOL_EDGE = 0.67
ICON_THEMES = {
    "light": dict(tile=INK, fg=PAPER, caret=ACCENT),     # varsayılan: koyu karo
    "dark": dict(tile=PAPER, fg=INK, caret=ACCENT_DIM),      # koyu zeminde ters
}


def app_icon(theme="light", tile_rx=56, symbol=symbol_full):
    t = ICON_THEMES[theme]
    k = ICON_SCALE
    return (
        f'<rect width="256" height="256" rx="{tile_rx}" fill="{t["tile"]}"/>'
        f'<g fill="{t["fg"]}" transform="translate({f(C - C * k)} {f(C - C * k)}) scale({k})">'
        f'{symbol(caret=t["caret"])}</g>'
    )


# --- kelime markası: x-yüksekliği 104 (76..180), stroke 22 -------------------
def wordmark(x0=0):
    def s(x):
        W = 88
        return (
            f'<path d="M{x+28} 76H{x+W-6}A6 6 0 0 1 {x+W} 82V92A6 6 0 0 1 {x+W-6} 98H{x+28}'
            f'A6 6 0 0 0 {x+22} 104V111A6 6 0 0 0 {x+28} 117H{x+W-28}A28 28 0 0 1 {x+W} 145'
            f'V152A28 28 0 0 1 {x+W-28} 180H{x+6}A6 6 0 0 1 {x} 174V164A6 6 0 0 1 {x+6} 158'
            f'H{x+W-28}A6 6 0 0 0 {x+W-22} 152V145A6 6 0 0 0 {x+W-28} 139H{x+28}'
            f'A28 28 0 0 1 {x} 111V104A28 28 0 0 1 {x+28} 76Z"/>'
        ), x + W

    def l(x):
        return f'<rect x="{x}" y="36" width="22" height="144" rx="6"/>', x + 22

    def o(x):
        return (
            f'<path fill-rule="evenodd" d="M{x+28} 76H{x+76}A28 28 0 0 1 {x+104} 104V152'
            f'A28 28 0 0 1 {x+76} 180H{x+28}A28 28 0 0 1 {x} 152V104A28 28 0 0 1 {x+28} 76Z'
            f'M{x+28} 98A6 6 0 0 0 {x+22} 104V152A6 6 0 0 0 {x+28} 158H{x+76}'
            f'A6 6 0 0 0 {x+82} 152V104A6 6 0 0 0 {x+76} 98Z"/>'
        ), x + 104

    def t(x):  # x = sol çıkıntının başı; gövde x+22
        g = x + 22
        return (
            f'<path d="M{g} 58A6 6 0 0 1 {g+6} 52H{g+16}A6 6 0 0 1 {g+22} 58V152'
            f'A6 6 0 0 0 {g+28} 158H{g+44}A6 6 0 0 1 {g+50} 164V174A6 6 0 0 1 {g+44} 180'
            f'H{g+28}A28 28 0 0 1 {g} 152Z"/>'
            f'<rect x="{x}" y="76" width="66" height="22" rx="6"/>'
        ), g + 50

    parts, x = [], x0
    for fn, gap in ((s, 18), (l, 18), (o, 14), (t, 0)):
        p, x = fn(x)
        parts.append(p)
        x += gap
    return "".join(parts), x - x0


WM_BODY, WM_W = wordmark()
GAP = 88 // 2  # ikon–kelime arası = imleç yüksekliğinin yarısı


def lockup():
    wx = O1 + GAP
    body, _ = wordmark(wx)
    return symbol_full() + body, wx + WM_W + O0


def icon_svg(theme, symbol=symbol_full):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img">'
            f'<title>Slot</title>{app_icon(theme, symbol=symbol)}</svg>\n')


if __name__ == "__main__":
    files = {
        "slot-symbol.svg": svg(symbol_full()),
        "slot-symbol-32.svg": svg(symbol_32()),
        "slot-symbol-16.svg": svg(symbol_16()),
        "slot-symbol-accent.svg": svg(symbol_full(caret=ACCENT_DIM)),
        "slot-app-icon.svg": icon_svg("light"),
        "slot-app-icon-dark.svg": icon_svg("dark"),
        "slot-app-icon-32.svg": icon_svg("light", symbol=symbol_32),
        "slot-wordmark.svg": svg(f'<g transform="translate(24 0)">{WM_BODY}</g>', w=WM_W + 48),
    }
    lk, lw = lockup()
    files["slot-lockup.svg"] = svg(lk, w=lw)
    for name, text in files.items():
        (OUT / name).write_text(text, encoding="utf-8")
        print("wrote", name)
