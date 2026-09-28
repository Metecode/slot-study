import { describe, expect, it } from "vitest";

import { parseInline, parseModelAnswer } from "../domain/modelAnswer";
import type { Question } from "../domain/question";
import { QUESTIONS } from "./index";

/* ------------------------------------------------------------------ */
/* Kayıp kod çiti taraması                                             */
/*                                                                     */
/* Bir kod bloğunun ``` çiti tek backtick'e düşünce ayrıştırıcı onu     */
/* satır içi koda çeviriyor ve ekranda "sql SELECT ..." diye akan bir   */
/* satır çıkıyor. Şema bunu yakalayamaz: metin hâlâ geçerli Markdown.   */
/*                                                                     */
/* Tarama uygulamanın kendi ayrıştırıcısıyla yapılır: doğru çitlenmiş   */
/* kod blokları ayıklanır, belirtiler yalnızca ekranda düz metin ya da   */
/* satır içi kod olarak kalan parçalarda aranır. Düz bir regex doğru    */
/* ``` çitlerini de yakalıyordu.                                        */
/* ------------------------------------------------------------------ */

/** Çit açılışında görülebilecek dil adları. */
const FENCE_LANGS = [
  "sql", "psql", "plpgsql", "csharp", "cs", "js", "javascript", "ts", "typescript",
  "jsx", "tsx", "bash", "sh", "shell", "zsh", "console", "powershell", "ps1",
  "json", "jsonc", "yaml", "yml", "dockerfile", "docker", "html", "xml", "css",
  "scss", "python", "py", "java", "kotlin", "go", "http", "ini", "toml",
  "graphql", "diff", "text", "plaintext", "nginx", "env",
];

/*
  Satır içi kodda dil adından sonra kod gelmesi yalnızca komut OLMAYAN
  dillerde belirti: `docker run -p 80:80 nginx`, `bash deploy.sh`,
  `go test ./...` meşru satır içi komutlar.
*/
const COMMAND_LANGS = new Set([
  "bash", "sh", "zsh", "console", "powershell", "docker", "python", "py",
  "java", "go", "http", "diff", "text", "env",
]);
const DECLARATIVE_LANGS = FENCE_LANGS.filter((lang) => !COMMAND_LANGS.has(lang));

const alt = (langs: readonly string[]) => langs.join("|");
/** Büyük/küçük harf duyarlı: "SQL injection ..." diye başlayan düzyazı eşleşmesin. */
const PARAGRAPH_STARTS_WITH_LANG = new RegExp(`^(${alt(FENCE_LANGS)})\\s+\\S`);
const INLINE_STARTS_WITH_LANG = new RegExp(`^(${alt(DECLARATIVE_LANGS)})\\s+\\S`);
const BARE_LANG_LINE = new RegExp(`^(${alt(FENCE_LANGS)})\\s*$`, "m");
/** Bir ya da iki backtick'e düşmüş çit satırı: "`sql", "``", "`". */
const SHORT_FENCE_LINE = /^`{1,2}[a-z0-9+#-]*[ \t]*$/m;

type Finding = { field: string; symptom: string; excerpt: string };

/** Ekranda düz metin olarak kalan parçalar: kod blokları ayıklanmış halde. */
function textParts(markdown: string): string[] {
  return parseModelAnswer(markdown).flatMap((block) => {
    if (block.kind === "code") return [];
    return [block.kind === "note" ? `${block.lead}: ${block.body}` : block.text];
  });
}

function scanText(field: string, markdown: string): Finding[] {
  const findings: Finding[] = [];
  const report = (symptom: string, excerpt: string) =>
    findings.push({ field, symptom, excerpt: excerpt.replace(/\s+/g, " ").slice(0, 60) });

  for (const text of textParts(markdown)) {
    if (text.includes("```")) report("ayrışmamış ``` çiti", text);
    if (SHORT_FENCE_LINE.test(text)) report("kısa çit satırı", text);
    if (BARE_LANG_LINE.test(text)) report("yalnız dil adı olan satır", text);
    if (PARAGRAPH_STARTS_WITH_LANG.test(text)) report("dil adıyla başlayan paragraf", text);

    for (const token of parseInline(text)) {
      if (token.kind !== "code") continue;
      if (token.text.includes("\n")) report("satır sonu içeren satır içi kod", token.text);
      else if (INLINE_STARTS_WITH_LANG.test(token.text)) {
        report("dil adıyla başlayan satır içi kod", token.text);
      }
    }
  }
  return findings;
}

/*
  Yalnızca kullanıcının okuduğu düzyazı alanları. Alias, çapa, etiket ve
  kategori eşleştirme verisi: "javascript", "js erişimi", "docker network
  create ile..." orada meşru ve dil adıyla başlama kuralını boşuna tetikliyor.
  prompt ve followUps Markdown olarak çizilmiyor, ama çit artığı orada da
  ekranda çıplak backtick olarak kalır.
*/
function displayedText(question: Question): Array<[string, string]> {
  return [
    [`${question.id}.prompt`, question.prompt],
    [`${question.id}.modelAnswer`, question.modelAnswer],
    ...(question.followUps ?? []).map(
      (text, i): [string, string] => [`${question.id}.followUps[${i}]`, text],
    ),
  ];
}

function findLostFences(questions: readonly Question[]): Finding[] {
  return questions.flatMap((question) =>
    displayedText(question).flatMap(([field, text]) => scanText(field, text)),
  );
}

const symptoms = (markdown: string) => scanText("t", markdown).map((f) => f.symptom);

describe("kayıp kod çiti algılayıcısı", () => {
  it("tek backtick'e düşmüş çiti yakalar", () => {
    const markdown = "Giriş.\n\n`sql\nSELECT 1\nFROM t;\n`\nDevamı.";
    expect(symptoms(markdown)).toEqual(
      expect.arrayContaining(["kısa çit satırı", "satır sonu içeren satır içi kod"]),
    );
  });

  it("backtick'leri tamamen kaybolmuş çiti yakalar", () => {
    expect(symptoms("Giriş.\n\nsql\nSELECT 1;")).toContain("yalnız dil adı olan satır");
    expect(symptoms("Giriş.\n\nsql SELECT 1 FROM t;")).toContain("dil adıyla başlayan paragraf");
  });

  it("tek satıra çökmüş çiti satır içi kodda yakalar", () => {
    expect(symptoms("Şöyle: `sql SELECT 1 FROM t`")).toContain("dil adıyla başlayan satır içi kod");
  });

  it("kapanmamış ya da satır ortasındaki çiti yakalar", () => {
    expect(symptoms("Giriş.\n\n```sql\nSELECT 1;")).toContain("ayrışmamış ``` çiti");
    expect(symptoms("Şöyle ```sql SELECT 1``` yazılır.")).toContain("ayrışmamış ``` çiti");
  });

  it("doğru çitlenmiş bloğu ve olağan düzyazıyı işaretlemez", () => {
    const markdown = [
      "SQL injection, girdinin sorguya karışmasıdır.",
      "```sql\nSELECT 1;\n```",
      "`docker run -p 80:80 nginx` ile açılır; `json` dosyası, `useEffect` ve `ORDER BY id` gibi.",
      "Sık atlanan nokta: `bash deploy.sh` komut olarak geçer.",
    ].join("\n\n");
    expect(symptoms(markdown)).toEqual([]);
  });
});

describe("içerik", () => {
  it("hiçbir metin alanında kayıp kod çiti belirtisi yok", () => {
    expect(findLostFences(QUESTIONS)).toEqual([]);
  });
});
