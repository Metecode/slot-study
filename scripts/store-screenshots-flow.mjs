/* ------------------------------------------------------------------ */
/* Mağaza ekran görüntülerinin akışı — her ekran için ne oynatılır,      */
/* sayfa nereye kaydırılır. Tarayıcı ve dosya işleri store-screenshots. */
/* ------------------------------------------------------------------ */

/** Kodsuz soru: kısa, makine ve kart aynı ekrana sığıyor. */
const PLAIN = {
  id: "react-usememo-vs-usecallback",
  // Cevap alanı büyümüyor; alana sığmayan metin içeride kayıp ilk satırı
  // keserdi. Beşinci satır kısa kalsın, sağ alttaki sayaca değmesin.
  answer:
    "useMemo bir değeri, useCallback ise fonksiyonun kendisini saklar. " +
    "Bağımlılıklar değişene kadar referans aynı kalır.",
};

/** Kodlu soru: model cevapta SQL bloğu var. */
const CODE = {
  id: "sql-window-running-total",
  answer:
    "GROUP BY yerine pencere fonksiyonu kullanırım: SUM(amount) OVER (ORDER BY transaction_date). " +
    "OVER içindeki sıralama sayesinde her satırda o satıra kadar olan işlemlerin toplamı gelir, " +
    "yani bakiye satır satır birikir. Birden fazla müşteri varsa PARTITION BY ile müşteri bazında " +
    "ayırırım.",
};

/** Kartlar arası boşluk kadar pay; kenara yapışık kesilmesin. */
const EDGE_GAP = 16;

export const SCREENS = [
  {
    id: "01-home",
    run: async (page) => {
      await leverReady(page);
    },
  },
  {
    id: "02-question",
    run: async (page, env) => {
      await pull(page, env, PLAIN.id);
      await alignBottom(page, env, questionCard(page));
    },
  },
  {
    id: "03-answer",
    run: async (page, env) => {
      await pull(page, env, PLAIN.id);
      await answerBox(page).fill(PLAIN.answer);
      await answerBox(page).blur();
      await alignBottom(page, env, questionCard(page));
    },
  },
  /*
    Değerlendirme 640 yüksekliğe tek karede sığmıyor (kavram çipleri, kendi
    yapay zekâna sor, model cevap, öz-değerlendirme alt alta ~2000 px);
    üç kareye bölünür.
  */
  {
    id: "04-concepts",
    run: async (page, env) => {
      await submit(page, env, CODE);
      // Soru kartı ve altında skor ile kavram çipleri.
      await alignTop(page, env, resultCard(page, page.getByRole("heading", { level: 2 })));
    },
  },
  {
    id: "05-model-answer",
    run: async (page, env) => {
      await submit(page, env, CODE);
      await alignTop(page, env, resultCard(page, page.getByRole("heading", { name: "Model cevap" })));
    },
  },
  {
    id: "06-self-rating",
    run: async (page, env) => {
      await submit(page, env, CODE);
      // Öz-değerlendirme, devam soruları ve sonraki tekrar satırı.
      await alignTop(page, env, resultCard(page, page.getByRole("heading", { name: "Bu soruyu ne kadar biliyordun?" })));
    },
  },
  {
    id: "07-settings",
    run: async (page) => {
      await leverReady(page);
      await page.getByRole("button", { name: "Ayarlar" }).click();
    },
  },
];

const questionCard = (page) => page.locator("section").filter({ has: answerBox(page) });
const answerBox = (page) => page.getByRole("textbox", { name: "Cevabın" });
/** Sonuç ekranında verilen başlığı içeren kart. */
const resultCard = (page, heading) => page.locator('[data-state="enter"] section').filter({ has: heading });

async function leverReady(page) {
  await page.getByRole("button", { name: "Kolu çek" }).waitFor();
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Kolu çek"]').disabled);
}

/*
  Soru seçimini sabitlemek: taze bir oturumda ilerleme yok, her sorunun
  ağırlığı eşit ve havuz içerik sırasında (bkz. domain/draw.ts). Çekiliş
  Math.random'dan tek sayı alıyor; (i + 0.5) / N i. soruyu seçer. Bu
  varsayım bozulursa ekrandaki soru beklenenle tutmaz ve betik durur.
  Aynı varsayım scan-layout.mjs'te de var.
*/
async function pull(page, { questions }, id) {
  const index = questions.findIndex((q) => q.id === id);
  if (index === -1) throw new Error(`${id} içerikte yok.`);

  await leverReady(page);
  await page.evaluate((value) => (window.__storeRandom = value), (index + 0.5) / questions.length);
  await page.getByRole("button", { name: "Kolu çek" }).click();
  await answerBox(page).waitFor();
  await page.evaluate(() => delete window.__storeRandom);

  const shown = await questionCard(page).getByRole("heading", { level: 2 }).textContent();
  if (shown?.trim() !== questions[index].prompt.trim()) {
    throw new Error(`${id} beklenirken başka bir soru açıldı; çekiliş varsayımı bozulmuş (bkz. pull).`);
  }
}

async function submit(page, env, { id, answer }) {
  await pull(page, env, id);
  await answerBox(page).fill(answer);
  await page.getByRole("button", { name: "Gönder" }).click();
  await page.getByRole("heading", { name: "Model cevap" }).waitFor();
}

/** Öğenin üstü, durum çubuğunun altında bir boşluk kalacak şekilde kaydırır. */
async function alignTop(page, { safeArea }, locator) {
  const box = await pageBox(locator);
  await scrollTo(page, box.top - safeArea.top - EDGE_GAP);
}

/** Öğenin altı, gezinme çubuğunun üstünde bir boşluk kalacak şekilde kaydırır. */
async function alignBottom(page, { safeArea, viewport }, locator) {
  const box = await pageBox(locator);
  await scrollTo(page, box.bottom - (viewport.height - safeArea.bottom - EDGE_GAP));
}

/** Sayfa koordinatında kutu; kaydırmadan bağımsız. */
function pageBox(locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
  });
}

async function scrollTo(page, y) {
  await page.evaluate((top) => window.scrollTo({ top: Math.max(0, top), behavior: "instant" }), y);
}
