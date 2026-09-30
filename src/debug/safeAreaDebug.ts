/* ------------------------------------------------------------------ */
/* Güvenli alan teşhis kutusu — ?debug=safe                            */
/* ------------------------------------------------------------------ */

/*
  Masaüstü simülasyonu (src/dev/safeAreaSimulation.ts) iPhone'un ana ekran
  kipini yansıtmadı; gerçek değerler telefondan okunmalı. Bu kutu üretimde
  de çalışır ama yalnızca URL'de ?debug=safe varken yüklenir (main.tsx'te
  dinamik import, ayrı parça). Uygulamanın hiçbir davranışına dokunmaz:
  React dışında, kendi elemanlarını body'ye ekler, dokununca hepsini siler.

  Değerler yarım saniyede bir yeniden okunur — iOS inset'leri ilk karede
  0 verebiliyor, uygulama da açılışta henüz üst çubuğu çizmemiş oluyor.
*/

const REFRESH_MS = 500;

/** Görünmez ölçüm elemanı; ölçülen değer padding ya da yükseklik olarak verilir. */
function createProbe(style: string): HTMLDivElement {
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;" + style;
  document.body.appendChild(probe);
  return probe;
}

function px(value: number | undefined): string {
  return value === undefined ? "yok" : `${Math.round(value * 100) / 100}px`;
}

function rectLine(el: Element | null): string {
  if (!el) return "bulunamadı";
  const r = el.getBoundingClientRect();
  return `top ${px(r.top)} · bottom ${px(r.bottom)} · height ${px(r.height)}`;
}

function paddingLine(el: Element | null, pseudo?: string): string {
  if (!el) return "bulunamadı";
  const cs = getComputedStyle(el, pseudo);
  return `padding-top ${cs.paddingTop} · padding-bottom ${cs.paddingBottom}`;
}

function boxLine(el: Element | null): string {
  if (!el) return "bulunamadı";
  const cs = getComputedStyle(el);
  return `padding ${cs.padding} · margin ${cs.margin} · min-height ${cs.minHeight}`;
}

/** Sistem çubuğu şeritleri body'nin sözde öğeleri (index.css); rect'leri yok, stillerinden okunur. */
function stripLine(pseudo: "::before" | "::after"): string {
  const cs = getComputedStyle(document.body, pseudo);
  if (cs.content === "none") return "yok";
  return `position ${cs.position} · top ${cs.top} · bottom ${cs.bottom} · height ${cs.height} · z ${cs.zIndex} · bg ${cs.backgroundColor}`;
}

type Probes = {
  env: HTMLDivElement;
  vars: HTMLDivElement;
  vh: HTMLDivElement;
  dvh: HTMLDivElement;
};

function readLines(probes: Probes): string[] {
  const env = getComputedStyle(probes.env);
  const vars = getComputedStyle(probes.vars);
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");
  const appRoot = document.getElementById("root")?.firstElementChild ?? null;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  // iOS'un eski, standart dışı işareti; ana ekran kipini ayrıca doğrular.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;

  return [
    "— env(safe-area-inset-*)",
    `top ${env.paddingTop} · bottom ${env.paddingBottom}`,
    `left ${env.paddingLeft} · right ${env.paddingRight}`,
    "— var(--safe-*) (uygulamanın kullandığı)",
    `top ${vars.paddingTop} · bottom ${vars.paddingBottom}`,
    `left ${vars.paddingLeft} · right ${vars.paddingRight}`,
    "— viewport",
    `innerHeight ${px(window.innerHeight)}`,
    `visualViewport.height ${px(window.visualViewport?.height)}`,
    `screen.height ${px(window.screen.height)}`,
    `100vh ${px(probes.vh.getBoundingClientRect().height)}`,
    `100dvh ${px(probes.dvh.getBoundingClientRect().height)}`,
    `scrollY ${px(window.scrollY)} · dpr ${window.devicePixelRatio}`,
    // Sayfa yana taşarsa mobil tarayıcı layout viewport'u büyütür ve görsel
    // viewport onun içinde kayar (offsetTop > 0): sabit şeritler ekrandan kopar.
    `scrollWidth ${px(document.documentElement.scrollWidth)} · clientWidth ${px(document.documentElement.clientWidth)}`,
    `visualViewport.offsetTop ${px(window.visualViewport?.offsetTop)} · scale ${window.visualViewport?.scale ?? "yok"}`,
    "— display-mode",
    `standalone ${standalone ? "EVET" : "hayır"} · navigator.standalone ${String(iosStandalone)}`,
    "— TopBar (header)",
    rectLine(header),
    paddingLine(header),
    `iç: ${rectLine(header?.firstElementChild ?? null)}`,
    `iç: ${paddingLine(header?.firstElementChild ?? null)}`,
    "— Sistem çubuğu şeritleri (body::before üst, body::after alt)",
    `üst: ${stripLine("::before")}`,
    `alt: ${stripLine("::after")}`,
    "— Footer",
    rectLine(footer),
    paddingLine(footer),
    `iç: ${rectLine(footer?.firstElementChild ?? null)}`,
    `iç: ${paddingLine(footer?.firstElementChild ?? null)}`,
    "— html",
    boxLine(document.documentElement),
    "— body",
    boxLine(document.body),
    "— kök kapsayıcı (#root > ilk eleman)",
    boxLine(appRoot),
  ];
}

export function showSafeAreaDebug(): void {
  const probes: Probes = {
    env: createProbe(
      "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);",
    ),
    vars: createProbe(
      "padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);",
    ),
    vh: createProbe("height:100vh;"),
    dvh: createProbe("height:100dvh;"),
  };

  // Buton: dokunulunca ve klavyeyle (Enter/Boşluk) kapanır.
  const box = document.createElement("button");
  box.type = "button";
  box.setAttribute("aria-label", "Güvenli alan teşhis kutusu, kapatmak için dokun");
  box.style.cssText = [
    "position:fixed",
    "top:50%",
    "left:50%",
    "transform:translate(-50%,-50%)",
    "z-index:2147483647",
    "width:min(92vw,420px)",
    "max-height:80vh",
    "overflow:auto",
    "margin:0",
    "padding:10px 12px",
    "border:1px solid rgba(255,255,255,0.4)",
    "border-radius:8px",
    "background:rgba(0,0,0,0.78)",
    "color:#fff",
    "font:11px/1.45 ui-monospace,SFMono-Regular,monospace",
    "text-align:left",
    "white-space:pre-wrap",
    "word-break:break-word",
    "cursor:pointer",
  ].join(";");
  document.body.appendChild(box);

  const render = () => {
    box.textContent = [...readLines(probes), "", "(kapatmak için dokun)"].join("\n");
  };
  render();
  const timer = window.setInterval(render, REFRESH_MS);

  box.addEventListener("click", () => {
    window.clearInterval(timer);
    box.remove();
    for (const probe of Object.values(probes)) probe.remove();
  });
}
