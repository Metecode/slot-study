"""Logo sunum sayfasını (presentation.html) üretir. Önce build_logo.py çalışmış olmalı.

Çalıştır: python design/logo/build_presentation.py
"""
from pathlib import Path

import build_logo as L

OUT = Path(__file__).parent


def inline(body, w=256, h=256, cls="", label="Slot"):
    return (f'<svg class="{cls}" viewBox="0 0 {w} {h}" role="img" aria-label="{label}">'
            f'<g fill="currentColor">{body}</g></svg>')


def app_icon(cls="", theme="light", symbol=L.symbol_full):
    return (f'<svg class="{cls}" viewBox="0 0 256 256" role="img" aria-label="Slot uygulama ikonu">'
            f'{L.app_icon(theme, symbol=symbol)}</svg>')


lockup_body, lockup_w = L.lockup()
LOCKUP = inline(lockup_body, w=lockup_w, cls="lockup")
SYMBOL = inline(L.symbol_full(), cls="sym")

# Splash: parçalar ayrı sınıflarla — oklar bir kez kayarak gelir, imleç yanıp söner.
_half = L.half_for(56, L.ARROW_DEG)
_full = L.framed_with_arrows(length=56, half=_half, gap=8)
# framed_with_arrows: önce iki çerçeve parçası, sonra sol ve sağ ok
_paths = _full.replace("/><", "/>|<").split("|")
_frame, _arr_l, _arr_r = "".join(_paths[:2]), _paths[2], _paths[3]
SPLASH = (
    '<svg class="splash-mark" viewBox="0 0 256 256" aria-hidden="true"><g fill="currentColor">'
    f'{_frame}<g class="arr-l">{_arr_l}</g><g class="arr-r">{_arr_r}</g>'
    f'<g class="caret">{L.cursor(fill=L.ACCENT)}</g></g></svg>'
)


def ladder():
    cells = []
    for px, body in ((128, L.symbol_full()), (64, L.symbol_full()),
                     (32, L.symbol_32()), (16, L.symbol_16())):
        cells.append(f'<figure><div class="px" style="--s:{px}px">{inline(body)}</div>'
                     f'<figcaption>{px} px</figcaption></figure>')
    return "".join(cells)


def icon_ladder(theme):
    cells = []
    for px, sym in ((128, L.symbol_full), (54, L.symbol_full), (32, L.symbol_32)):
        cells.append(f'<figure><div class="px" style="--s:{px}px">{app_icon(theme=theme, symbol=sym)}</div>'
                     f'<figcaption>{px} px</figcaption></figure>')
    return "".join(cells)


# Ana ekrandaki diğer uygulamalar: marka değil, sade jenerik ikonlar.
GENERIC = [
    ("Takvim", "#e5484d", '<rect x="70" y="80" width="116" height="100" rx="14" fill="#fff"/><rect x="70" y="80" width="116" height="28" rx="14" fill="#ffd6d6"/>'),
    ("Notlar", "#f5b83d", '<rect x="74" y="66" width="108" height="124" rx="12" fill="#fff"/><rect x="92" y="96" width="72" height="10" rx="5" fill="#f5b83d"/><rect x="92" y="120" width="56" height="10" rx="5" fill="#f5b83d"/>'),
    ("Harita", "#3aa76d", '<circle cx="128" cy="116" r="38" fill="#fff"/><circle cx="128" cy="116" r="14" fill="#3aa76d"/><path d="M104 140L128 186L152 140Z" fill="#fff"/>'),
    ("Müzik", "#7c5cff", '<circle cx="104" cy="164" r="22" fill="#fff"/><rect x="118" y="72" width="12" height="94" fill="#fff"/><rect x="118" y="72" width="52" height="16" rx="6" fill="#fff"/>'),
    ("Fotoğraf", "#ff8a3d", '<circle cx="128" cy="128" r="48" fill="none" stroke="#fff" stroke-width="16"/><circle cx="128" cy="128" r="14" fill="#fff"/>'),
    ("Hava", "#2f8fe8", '<circle cx="112" cy="112" r="30" fill="#ffe27a"/><rect x="92" y="126" width="96" height="44" rx="22" fill="#fff"/>'),
    ("Saat", "#1f2328", '<circle cx="128" cy="128" r="56" fill="none" stroke="#fff" stroke-width="12"/><path d="M128 92V128H156" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/>'),
    ("Kod", "#24324a", '<path d="M108 92L74 128L108 164M148 92L182 128L148 164" fill="none" stroke="#9fb7d9" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>'),
    ("Posta", "#4c8dff", '<rect x="68" y="88" width="120" height="84" rx="12" fill="#fff"/><path d="M72 94L128 136L184 94" fill="none" stroke="#4c8dff" stroke-width="10"/>'),
    ("Ayarlar", "#8b95a1", '<circle cx="128" cy="128" r="44" fill="none" stroke="#fff" stroke-width="18" stroke-dasharray="17 9"/><circle cx="128" cy="128" r="16" fill="#fff"/>'),
    ("Kitaplar", "#c2410c", '<rect x="80" y="70" width="96" height="116" rx="10" fill="#fff"/><rect x="80" y="70" width="18" height="116" fill="#ffd0b0"/>'),
]


def home_screen():
    icons = [f'<div class="app"><svg viewBox="0 0 256 256" aria-hidden="true"><rect width="256" height="256" rx="56" fill="{c}"/>{g}</svg><span>{n}</span></div>'
             for n, c, g in GENERIC]
    icons.insert(5, f'<div class="app slot">{app_icon()}<span>Slot</span></div>')
    dock = "".join(f'<svg viewBox="0 0 256 256" aria-hidden="true"><rect width="256" height="256" rx="56" fill="{c}"/>{g}</svg>'
                   for _, c, g in GENERIC[7:11])
    return (f'<div class="phone"><div class="screen"><div class="status"><span>09:41</span><span>●●● ▮</span></div>'
            f'<div class="grid">{"".join(icons)}</div><div class="dock">{dock}</div></div></div>')


HTML = f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Slot logo</title>
<style>
  :root {{
    --light: #f5f5f2; --ink: #0b0f14; --dark: #0b0f14; --paper: #e6edf3; --accent: #22d3ee;
    --muted: #6b7480; --line: #dcdcd6;
  }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; background: var(--light); color: var(--ink);
         font: 15px/1.5 "Segoe UI", system-ui, sans-serif; }}
  main {{ max-width: 1120px; margin: 0 auto; padding: 48px 16px 80px; }}
  h1 {{ font-size: 28px; margin: 0 0 4px; }}
  h2 {{ font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted);
        margin: 56px 0 16px; font-weight: 600; }}
  p.lead {{ color: var(--muted); margin: 0; max-width: 680px; }}
  .pair {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
  .panel {{ border-radius: 16px; min-height: 260px; display: grid; place-items: center; padding: 40px 24px;
           position: relative; }}
  .panel.light {{ background: #fff; color: var(--ink); border: 1px solid var(--line); }}
  .panel.dark {{ background: var(--dark); color: var(--paper); }}
  .panel small {{ position: absolute; left: 16px; bottom: 12px; font-size: 12px; opacity: .55; }}
  .lockup {{ width: min(100%, 420px); height: auto; }}
  .sym, .panel > svg {{ width: 160px; height: 160px; }}
  .quad {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }}
  .quad .panel {{ min-height: 220px; }}
  .ladder {{ display: flex; gap: 40px; align-items: flex-end; flex-wrap: wrap; }}
  .ladder figure {{ margin: 0; text-align: center; }}
  .ladder .px {{ width: var(--s); height: var(--s); }}
  .ladder .px svg {{ width: 100%; height: 100%; display: block; }}
  .ladder figcaption {{ font-size: 12px; color: var(--muted); margin-top: 8px; }}
  .ladder-wrap {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
  .ladder-wrap .panel {{ min-height: 0; place-items: end start; padding: 32px; }}

  /* telefon */
  .stage {{ display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: center; }}
  .phone {{ width: 300px; margin: 0 auto; padding: 12px; border-radius: 44px; background: #15181d;
           box-shadow: 0 30px 60px -20px rgba(0,0,0,.35); }}
  .screen {{ position: relative; border-radius: 34px; height: 600px; overflow: hidden; padding: 14px 18px;
            background: linear-gradient(160deg, #3d5a80 0%, #98c1d9 55%, #e0b1a6 100%); color: #fff; }}
  .status {{ display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; padding: 2px 8px 18px; }}
  .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px 12px; }}
  .app {{ display: flex; flex-direction: column; align-items: center; gap: 5px; }}
  .app svg {{ width: 54px; height: 54px; display: block; }}
  .app span {{ font-size: 11px; text-shadow: 0 1px 2px rgba(0,0,0,.35); }}
  .dock {{ position: absolute; left: 12px; right: 12px; bottom: 12px; display: flex; justify-content: space-around;
          padding: 12px; border-radius: 26px; background: rgba(255,255,255,.28); }}
  .dock svg {{ width: 54px; height: 54px; }}

  /* splash */
  .splash {{ width: 300px; height: 624px; margin: 0 auto; border-radius: 44px; background: var(--dark);
            color: var(--paper); display: grid; place-items: center; position: relative; overflow: hidden;
            border: 12px solid #15181d; }}
  .splash-mark {{ width: 120px; height: 120px; }}
  .splash .replay {{ position: absolute; bottom: 28px; font: inherit; font-size: 13px; color: var(--paper);
                    background: transparent; border: 1px solid #2a3442; border-radius: 999px; padding: 6px 14px;
                    cursor: pointer; }}
  .splash .replay:focus-visible {{ outline: 2px solid var(--paper); outline-offset: 2px; }}
  .play .arr-l {{ animation: in-l .5s cubic-bezier(.2,.8,.2,1) both; }}
  .play .arr-r {{ animation: in-r .5s cubic-bezier(.2,.8,.2,1) both; }}
  .play .caret {{ animation: blink 1s steps(1) .5s infinite; }}
  @keyframes in-l {{ from {{ transform: translateX(-40px); opacity: 0; }} }}
  @keyframes in-r {{ from {{ transform: translateX(40px); opacity: 0; }} }}
  @keyframes blink {{ 50% {{ opacity: 0; }} }}
  @media (prefers-reduced-motion: reduce) {{
    .play .arr-l, .play .arr-r, .play .caret {{ animation: none; }}
  }}
  .note {{ color: var(--muted); font-size: 14px; }}
  .note b {{ color: var(--ink); }}
  ul.rules {{ margin: 0; padding-left: 18px; }}
  ul.rules li {{ margin: 4px 0; }}

  @media (max-width: 760px) {{
    .pair, .stage, .ladder-wrap {{ grid-template-columns: 1fr; }}
    .quad {{ grid-template-columns: 1fr 1fr; }}
  }}
</style>
</head>
<body>
<main>
  <h1>Slot — Ödeme çizgisi</h1>
  <p class="lead">Makinenin penceresi; iki ödeme oku kazananı değil, senin cevap imlecini gösteriyor.</p>

  <h2>Yatay logo · açık ve koyu</h2>
  <div class="pair">
    <div class="panel light">{LOCKUP}<small>#0b0f14 · beyaz zemin</small></div>
    <div class="panel dark">{LOCKUP}<small>#e6edf3 · #0b0f14 zemin</small></div>
  </div>

  <h2>Çizgi ve dolu</h2>
  <div class="quad">
    <div class="panel light">{SYMBOL}<small>Çizgi</small></div>
    <div class="panel light">{app_icon(cls="sym")}<small>Dolu · uygulama ikonu</small></div>
    <div class="panel dark">{SYMBOL}<small>Çizgi</small></div>
    <div class="panel dark">{app_icon(cls="sym", theme="dark")}<small>Dolu · koyu zemin varyantı</small></div>
  </div>

  <h2>Boyut kesimleri (gerçek piksel)</h2>
  <div class="ladder-wrap">
    <div class="panel light"><div class="ladder">{ladder()}</div></div>
    <div class="panel dark"><div class="ladder">{ladder()}</div></div>
  </div>
  <div class="ladder-wrap" style="margin-top:16px">
    <div class="panel light"><div class="ladder">{icon_ladder("light")}</div></div>
    <div class="panel dark"><div class="ladder">{icon_ladder("dark")}</div></div>
  </div>
  <p class="note">≥64 px tam versiyon · 32 px: oklar ~%35 büyük, çerçeve kesimi 12 · 16 px: oksuz, çizgi 22 → 28. Uygulama ikonu 32 px'te 32 px kesimini kullanır.</p>

  <h2>Ana ekran ve açılış ekranı</h2>
  <div class="stage">
    {home_screen()}
    <div class="splash play" id="splash">{SPLASH}
      <button class="replay" type="button" onclick="var s=document.getElementById('splash');s.classList.remove('play');void s.offsetWidth;s.classList.add('play')">Tekrar oynat</button>
    </div>
  </div>

  <h2>Kurgu</h2>
  <ul class="rules note">
    <li><b>Tek kalınlık:</b> çerçeve stroke'u = imleç genişliği = harf gövdesi (22 birim).</li>
    <li><b>Köşe kuralı:</b> her köşe yarıçapı parçanın genişliğinin ~%27'si — çerçeve 56/208, imleç 6/22, “o” 28/104; iç köşe = dış − kalınlık.</li>
    <li><b>Oklar:</b> tabanı çerçevenin dış kenarında, kenarları tam 20°; çerçeve okun etrafında 8 birim kesilir, ok ona gömülmez. Uçlar imlecin dikey merkezinde.</li>
    <li><b>Lockup:</b> ikon ile kelime arası = imleç yüksekliğinin yarısı (44 birim).</li>
    <li><b>Uygulama ikonu:</b> ayrı çizim değil; aynı sembol %70 ölçekte #0b0f14 karo üzerinde. Vurgu rengi (#22d3ee) yalnız imleçte; koyu zeminde karo #e6edf3, imleç #0e7490.</li>
    <li><b>Açılış:</b> oklar bir kez kayarak gelir, imleç 1 sn aralıkla yanıp söner; hareket azaltmada animasyon yok.</li>
  </ul>
</main>
</body>
</html>
"""

if __name__ == "__main__":
    (OUT / "presentation.html").write_text(HTML, encoding="utf-8")
    print("wrote presentation.html")
