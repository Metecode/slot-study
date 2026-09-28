/* ------------------------------------------------------------------ */
/* Yapay zekâ hedefleri — istemin taşınabileceği servisler             */
/*                                                                     */
/* Uygulama bu servisleri çağırmaz; yalnızca kullanıcının tarayıcısında */
/* açılacak adresi bilir (bkz. aiHandoff.ts).                           */
/* ------------------------------------------------------------------ */

/*
  Hangi servisin istemi URL parametresiyle kabul ettiği zamanla
  değişebiliyor. Her hedefin yanındaki doğrulama notu elle güncellenir;
  emin olunmayan bir parametre destekleniyor gösterilmez, queryParam
  hiç yazılmaz.

  Logo yok. İleride resmî marka kitlerinden eklenirse bu listeye alan
  eklenmez: AiTargetId anahtarlı ayrı bir harita olur, config marka
  varlıklarından bağımsız kalır.
*/

export type AiTargetId = "chatgpt" | "claude" | "gemini" | "perplexity";

export type AiTarget = {
  id: AiTargetId;
  /** Yalın marka adı; aria etiketi ve ileride logonun alt metni. */
  label: string;
  /**
   * Düğme metni. Ek uyumu yazıya değil okunuşa göre ("Claude" → "klod"
   * → "Claude'da"); kuralla üretilemediği için elle yazılır.
   */
  openLabel: string;
  /** Sorgu ve parça (? ve #) içermez; parametre buna eklenir. */
  baseUrl: string;
  /** İstemi taşıyan sorgu parametresi. Desteklenmiyorsa yok. */
  queryParam?: string;
  /** Genel eşiği (MAX_HANDOFF_URL_LENGTH) bu hedef için düşürür. */
  maxUrlLength?: number;
};

export const AI_TARGETS = [
  {
    // son elle doğrulama: yok
    // İstemi açılır açılmaz gönderebilir.
    id: "chatgpt",
    label: "ChatGPT",
    openLabel: "ChatGPT'de aç",
    baseUrl: "https://chatgpt.com/",
    queryParam: "q",
  },
  {
    // son elle doğrulama: yok — UI merge'ünden önce elle doğrulanacak.
    id: "claude",
    label: "Claude",
    openLabel: "Claude'da aç",
    baseUrl: "https://claude.ai/new",
    queryParam: "q",
  },
  {
    // son elle doğrulama: yok
    // Resmî ve kararlı bir istem parametresi bilinmiyor; kullanıcı yapıştırır.
    id: "gemini",
    label: "Gemini",
    openLabel: "Gemini'de aç",
    baseUrl: "https://gemini.google.com/app",
  },
  {
    // son elle doğrulama: yok
    // Arama motoru entegrasyonunun biçimi; aramayı hemen başlatır.
    id: "perplexity",
    label: "Perplexity",
    openLabel: "Perplexity'de aç",
    baseUrl: "https://www.perplexity.ai/search",
    queryParam: "q",
  },
] as const satisfies readonly AiTarget[];
