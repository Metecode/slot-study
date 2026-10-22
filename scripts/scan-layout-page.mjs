/* ------------------------------------------------------------------ */
/* Yerleşim taraması — sayfanın içinde çalışan ölçüm fonksiyonları      */
/*                                                                     */
/* Playwright bunları page.evaluate ile metin olarak sayfaya taşır:     */
/* her fonksiyon kendi içinde bağımsız olmalı, dışarıdaki hiçbir adı    */
/* kullanamaz. Çağıran: scripts/scan-layout.mjs.                        */
/* ------------------------------------------------------------------ */

/**
 * Android'in yazı boyutu ayarını (WebView textZoom) taklit eder: yazı
 * boyutları çarpılır, px cinsinden düzen ölçüleri olduğu gibi kalır.
 * Hesaplanmış boyutlar önce topluca okunur, sonra yazılır; okurken yazılsaydı
 * em ile boyutlanan çocuklar ebeveynin yeni boyutunu görüp çarpanı katlardı.
 */
export function scaleFonts(factor) {
  const elements = [document.documentElement, document.body, ...document.body.querySelectorAll("*")];
  const sizes = elements.map((el) => parseFloat(getComputedStyle(el).fontSize));
  // Önceki satır içi değerler saklanır: restoreFonts aynı sayfada geri alır.
  window.__scanFonts = elements.map((el) => [
    el,
    el.style.getPropertyValue("font-size"),
    el.style.getPropertyPriority("font-size"),
  ]);
  elements.forEach((el, i) => el.style.setProperty("font-size", `${sizes[i] * factor}px`, "important"));
}

/**
 * scaleFonts'u geri alır. Aynı sayfada bir sonraki ekran yeniden
 * ölçeklenmeden önce gerekli: büyütülmüş bir atadan boyut miras alan yeni
 * öğe çarpanı ikinci kez alırdı.
 */
export function restoreFonts() {
  for (const [el, value, priority] of window.__scanFonts ?? []) {
    if (value) el.style.setProperty("font-size", value, priority);
    else el.style.removeProperty("font-size");
  }
  delete window.__scanFonts;
}

/**
 * Sayfa yatay taşıyor mu, taşıyorsa genişlik nerede doğuyor ve onu ne itiyor?
 *
 * Taşan en dış öğe, ebeveyni taşmayan öğedir: genişlik tam o sınırda doğar.
 * Onu neyin ittiğini bulmak için o öğelerin min-width'i geçici olarak 0'a
 * çekilir (flex/grid çocuğunun min-width: auto'su en sık sebep) ve yeniden
 * ölçülür: kendi içinde kaymaya başlayan kutu ya da kutusundan dışarı çıkan
 * kırılamaz metin, genişliği isteyen içeriktir. Ölçümden sonra stil geri alınır.
 */
export function measureOverflow() {
  const root = document.documentElement;

  const describe = (el) => {
    // CSS modülü adlarındaki özet ekini at: _codeBody_9j2h4_149 → codeBody
    const classes = [...el.classList].map((name) => name.replace(/^_(.+)_[a-z0-9]+_\d+$/i, "$1"));
    return [el.tagName.toLowerCase(), ...classes].join(".");
  };
  const pathOf = (el, depth) => {
    const parts = [];
    for (let node = el; node && node !== document.body; node = node.parentElement) parts.unshift(describe(node));
    return parts.slice(-depth).join(" > ");
  };
  const clipsX = (el) => getComputedStyle(el).overflowX !== "visible";
  const isBlock = (el) => !/^(inline|contents)/.test(getComputedStyle(el).display);

  /** Kendi içinde kaydırılan ya da kırpılan bir atası varsa sayfayı taşırmaz. */
  const clippedByAncestor = (el, limit) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      if (clipsX(node) && node.getBoundingClientRect().right <= limit) return true;
    }
    return false;
  };

  function snapshot() {
    const limit = root.clientWidth + 0.5;
    const all = [...document.body.querySelectorAll("*")];
    const over = new Set(
      all.filter((el) => {
        const rect = el.getBoundingClientRect();
        return (rect.width > 0 || rect.height > 0) && rect.right > limit && !clippedByAncestor(el, limit);
      }),
    );
    const outermost = [...over].filter((el) => !over.has(el.parentElement));

    const scrolling = all.filter(
      (el) => /auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1,
    );

    // Kutusunun içerik kenarını aşan metin. Kırpan ya da kaydıran bir atası
    // varsa (kod bloğu, ekran okuyucu metni) sayfayı itemez, sayılmaz.
    const sticking = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const text = walker.currentNode;
      if (!text.textContent.trim()) continue;
      let block = text.parentElement;
      while (!isBlock(block)) block = block.parentElement;
      const style = getComputedStyle(block);
      const contentRight =
        block.getBoundingClientRect().right - parseFloat(style.paddingRight) - parseFloat(style.borderRightWidth);
      let clipped = false;
      for (let node = text.parentElement; node && node !== document.body; node = node.parentElement) {
        if (clipsX(node)) clipped = true;
      }
      if (clipped) continue;
      range.selectNodeContents(text);
      const worst = Math.max(...[...range.getClientRects()].map((rect) => rect.right));
      if (worst > contentRight + 1) {
        const snippet = text.textContent.replace(/\s+/g, " ").trim().slice(0, 60);
        sticking.push(`${pathOf(text.parentElement, 2)} "${snippet}" (+${Math.round(worst - contentRight)}px)`);
      }
    }

    return { overflow: root.scrollWidth - root.clientWidth, outermost, scrolling, sticking };
  }

  const before = snapshot();
  const result = {
    viewport: root.clientWidth,
    scrollWidth: root.scrollWidth,
    overflow: before.overflow,
    culprits: before.outermost.map((el) => {
      const parent = getComputedStyle(el.parentElement);
      const columns = parent.display.includes("grid") ? `, sütunlar ${parent.gridTemplateColumns}` : "";
      return `${pathOf(el, 3)} (ebeveyn ${parent.display}${columns}; min-width ${getComputedStyle(el).minWidth})`;
    }),
  };
  if (before.overflow <= 0) return result;

  const saved = before.outermost.map((el) => [
    el,
    el.style.getPropertyValue("min-width"),
    el.style.getPropertyPriority("min-width"),
  ]);
  for (const [el] of saved) el.style.setProperty("min-width", "0", "important");
  const relaxed = snapshot();
  // Boyutlar stil geri alınmadan okunur; sonra kutular eski genişliğine döner.
  result.relaxed = {
    overflow: relaxed.overflow,
    // Yalnızca gevşetince kaymaya başlayanlar; zaten kayanlar sebep değil.
    scrolling: relaxed.scrolling
      .filter((el) => !before.scrolling.includes(el))
      .map((el) => `${pathOf(el, 2)} (${el.clientWidth}/${el.scrollWidth}px)`),
    sticking: relaxed.sticking,
  };
  for (const [el, value, priority] of saved) {
    if (value) el.style.setProperty("min-width", value, priority);
    else el.style.removeProperty("min-width");
  }
  return result;
}

/**
 * Tambur etiketleri kutusuna sığıyor mu? Etiket kendi kutusunda "…" ile
 * kırpıldığı için sayfa taşmaz, measureOverflow bunu görmez. Her ad sırayla
 * tamburun ortadaki yüzüne yazılır: kategoriler soldakine, konular
 * sağdakine. Yatayda taşan (kırılamayan kelime) ya da maxLines'tan fazla
 * satır tutan ad kesik sayılır. Ölçümden sonra yüzün metni geri yazılır.
 */
export async function measureReelLabels({ categories, topics, maxLines }) {
  const windows = [...document.querySelectorAll('[data-rows] [class*="window"]')];

  async function check(win, texts) {
    const label = win.querySelector('[class*="mid"] [class*="label"]');
    const face = label.parentElement;
    const original = label.textContent;

    // Türkçe harfler ayrı bir font dosyasında; ölçmeden önce yüklensin.
    label.textContent = texts.join(" ");
    await document.fonts.ready;

    const cut = [];
    for (const text of texts) {
      label.textContent = text;
      const style = getComputedStyle(label);
      const lineHeight = parseFloat(style.lineHeight);
      const lines =
        style.whiteSpace === "nowrap" || !(lineHeight > 0) ? 1 : Math.round(label.scrollHeight / lineHeight);
      const overflow = label.scrollWidth - label.clientWidth;
      if (overflow > 0.5 || lines > maxLines) cut.push({ text, lines, overflow: Math.round(overflow) });
    }
    label.textContent = original;

    const faceStyle = getComputedStyle(face);
    const space = face.clientWidth - parseFloat(faceStyle.paddingLeft) - parseFloat(faceStyle.paddingRight);
    return { space: Math.round(space * 10) / 10, fontSize: parseFloat(getComputedStyle(label).fontSize), cut };
  }

  return { categories: await check(windows[0], categories), topics: await check(windows[1], topics) };
}
