# İçerik denetimi — yayın öncesi kalite ve lisans

Tarih: 2026-11-18 · Revizyon: `16b5054` (main) · Kapsam: `src/content/tr/*.json`, 313 soru

Bu rapor karar içindir: içerikte hiçbir değişiklik yapılmadı. Ölçümler tek
seferlik bir betikle yapıldı. Betik repo'ya girmedi; `evaluateLexical`
(`domain/evaluate.ts`) ve `conceptMatchLevel` (`domain/conceptMatch.ts`)
fonksiyonlarını doğrudan kullanıyor. Bunlara ek olarak `npm run check:content`
çıktısı ve git geçmişi incelendi.

---

## 0. Özet

### 0.1 Yayından çekilecekler

| Soru | Gerekçe |
|---|---|
| `sql-transaction-dirty-read` | `sql-isolation-levels`'ın alt kümesi: aynı topic, ve onun örnek cevabı bu sorunun 3 kavramının 3'ünü de tutuyor. Mülakat kökenli soru metni (bkz. 0.4). İsterse zorluk 2 basamağı olarak kalabilir, ama o zaman soru metni yeniden yazılmalı. |

Kalite gerekçesiyle başka çekilecek soru yok. Boş ya da kısa cevap, kavramı
eksik soru, yinelenen soru ya da gerçek dil karışıklığı bulunmadı (bölüm 4).

### 0.2 Düzeltilecekler

| Soru | Ne | Gerekçe |
|---|---|---|
| `docker-depends-on-healthcheck` | alias | Aynı anlamda ama farklı yazılmış makul bir cevap 5 kavramın 0'ını tutuyor (4.c). Eklenecek alias önerileri: "health check", "service healthy", "hazır olana", "sağlıklı olana", "tekrar dene", "başlama sıra". |
| 102 soru, 132 kavram (Ek A) | alias / normalizasyon | Alias yalnızca tireli, alt çizgili ya da bitişik yazılmış ("read-only", "service_healthy", "client-side"); cevapta boşlukla yazılırsa kavram kaçıyor. Önerim içeriği tek tek düzeltmek değil, `normalizeTr`'de `-` ve `_`'yi iki tarafta da boşluğa çevirmek (4.c). Bu bir domain değişikliği, ayrı karar. |
| `sql-locking-lost-update` | soru metni | 251 karakter; cevabı ("Pessimistic"/"Optimistic") ve bağlamı ("Banka hesabında") soruda veriyor. Mülakat kökenli. |
| `cybersecurity-jwt-xss` | soru metni | 237 karakter; iki soru tek cümlede. "XSS (Cross-Site Scripting)" açılımı gereksiz. Mülakat kökenli. |
| `dotnet-di-lifetimes` | soru metni | 228 karakter, iki ayrı soru (yaşam süreleri + DbContext varsayılanı). Mülakat kökenli. |
| `dotnet-iqueryable-ienumerable` | soru metni | 180 karakter, sorunun içinde açıklama var ("SQL sorguları ve bellek tüketimi açısından"). Mülakat kökenli. |
| 16 mülakat kökenli soru (0.4) | soru metni | Kaynağı belirsiz metin; yeniden yazılmalı. |

Soru dışında bir düzeltme de gerekiyor: uygulama içinde içerik lisansı ve
üçüncü taraf bildirimi görünmüyor. Footer yalnızca "Açık kaynak · MIT"
diyor. Ayrıntı ve öneri bölüm 5'te.

### 0.3 Kabul edilebilir küçük notlar

| Soru | Not |
|---|---|
| `java-spring-data-access-exception` ↔ `sql-exception` | Çapraz isabet 0.8. Farklı açılar (Spring çevirisi / DB hatası); kategori farklı, kalabilir. |
| `java-spring-transaction-isolation` ↔ `sql-isolation-levels` | Çapraz isabet 0.6. Spring ayarı / SQL seviyeleri; kalabilir. |
| `java-jpa-lazy-vs-eager` ↔ `sql-n-plus-one` | Çapraz isabet 0.6. Doğal komşular; kalabilir. |
| `sql-many-to-many-employee-project` (154), `sql-window-running-total` (151) | Uzun ama uygulamalı senaryo soruları, uzunluk bağlamdan geliyor. Mülakat kökenli oldukları için 0.4'te yeniden yazılacaklar. |
| En uzun 15 örnek cevap (1050–1197 karakter, 4.a) | `check:content` biçim kuralından (2–5 cümle) geçiyor. Kartta en uzun bunlar; kısaltma isteğe bağlı. |
| En kısa örnek cevaplar (210–300 karakter) | Hepsi sudheerj kökenli zorluk 1 React temelleri. Bu seviye için yeterli. |
| `cybersecurity-ssti` | `source`'ta PortSwigger (tüm hakları saklı) var. Yalnızca başvuruldu, metin türetilmedi. İstenirse referans OWASP WSTG'ye indirilebilir. |
| `react-fiber` | `source`'ta `acdlite/react-fiber-architecture` var; repoda lisans dosyası yok. Yalnızca başvuru, sorun değil. |
| 161 soruda iki soru işareti | "X nedir? Ne zaman kullanılır?" kalıbı; kısa teori sorusu formatına uyuyor. |
| Dil denetiminin 7 adayı | Hepsi yanlış pozitif: SQL anahtar kelimeleri, RFC'deki "SHOULD NOT", terim adları. |

### 0.4 Yeniden yaz ya da çek

Tüm hakları saklı bir kaynaktan **metin türetilmiş** soru yok. Bütün
"tüm hakları saklı" ve "lisansı belirsiz" kaynaklar yalnızca başvuru olarak
geçiyor (bölüm 3).

Kaynağı belirsiz metin olarak tek grup var: **soru metni gerçek bir
mülakattan gelen 16 soru.** Git geçmişinde bunların `source` alanı
"Vakıfbank teknik mülakatı, Eylül 2026", "Banka teknik mülakatları genel
derlemesi", "Banka Güvenlik Mühendisliği Mülakatı, Eylül 2026", "Kıdemli
.NET Mülakatı, Ekim 2026" ya da "Frontend mülakat notları" idi. Hepsi
`039eb15` ve öncesinde "Kendi derleme — <birincil belge>"ye çevrildi.
Cevaplar kendi yazımın; soru metninin bir kısmı mülakatçının cümlesi gibi
duruyor ("Finansal bir sistemde 'Dirty Read'…", "Banka hesabında hangisini
tercih edersin?").

Kısa bir sorunun telif koruması zayıf. Asıl riskler başka:

- Mülakat içeriği bir gizlilik sözleşmesi kapsamında olabilir.
- Şirket adı herkese açık git geçmişinde duruyor. Geçmişi yeniden yazmak bu
  raporun kapsamı dışında; ayrı bir karar.

| Soru | Eski kaynak | Öneri |
|---|---|---|
| `sql-exception` | Vakıfbank | Yeniden yaz |
| `sql-exception-handling-db` | Vakıfbank | Yeniden yaz |
| `sql-find-slow-queries` | Vakıfbank | Yeniden yaz |
| `sql-slow-query-explain` | Vakıfbank | Yeniden yaz |
| `sql-index-types` | Vakıfbank | Yeniden yaz |
| `sql-many-to-many-employee-project` | Vakıfbank | Yeniden yaz |
| `docker-container-communication` | Vakıfbank | Yeniden yaz |
| `react-virtual-dom` | Vakıfbank | Yeniden yaz |
| `sql-locking-lost-update` | Banka genel derlemesi | Yeniden yaz ve kısalt (0.2) |
| `sql-transaction-dirty-read` | Banka genel derlemesi | Çek (0.1) ya da yeniden yaz |
| `sql-window-running-total` | Banka genel derlemesi | Yeniden yaz |
| `cybersecurity-jwt-xss` | Banka güvenlik mülakatı | Yeniden yaz ve kısalt (0.2) |
| `dotnet-di-lifetimes` | Kıdemli .NET mülakatı | Yeniden yaz ve kısalt (0.2) |
| `dotnet-iqueryable-ienumerable` | Kıdemli .NET mülakatı | Yeniden yaz ve kısalt (0.2) |
| `javascript-null-vs-undefined` | Frontend mülakat notları | Metin genel ("null ile undefined farkı"); yeniden yazmak yeterli |
| `react-props-children` | Frontend mülakat notları | Aynı |

"Yeniden yaz" şu demek: soru metni aynı kavramı soracak ama kendi cümlenle,
şirket ya da sektör bağlamı olmadan.

### 0.5 Kategori yeterliliği (15 sorunun altı)

| Kategori | Soru | Öneri |
|---|---|---|
| dotnet | 2 | **Yayında gizle ya da tamamla.** İki sorunun ikisi de mülakat kökenli ve 0.2'de düzeltilecekler listesinde. 2 soruluk bir kategori seçildiğinde aynı iki soru dönüp duruyor. Gizleme yolu: `content/index.ts`'teki `FILES`'tan dotnet satırını çıkarmak (CLAUDE.md "Yeni kategori ekleme" notuna göre sunucu içeriği yine alır). Tamamlama yolu: en az 13 yeni soru. |

Diğer kategorilerin hepsi 21 ve üstünde.

---

## 1. Kategori sayıları ve kaynak dağılımı

| Kategori | Soru | Kendi | Dış (sudheerj, MIT) | Mülakat kökenli soru metni | Zorluk 1 / 2 / 3 | applied |
|---|---|---|---|---|---|---|
| java | 81 | 81 | 0 | 0 | 30 / 35 / 16 | 1 |
| react | 46 | 2 | 44 | 2 | 16 / 23 / 7 | 1 |
| javascript | 45 | 45 | 0 | 1 | 15 / 23 / 7 | 0 |
| cybersecurity | 44 | 44 | 0 | 1 | 8 / 27 / 9 | 3 |
| web | 42 | 42 | 0 | 0 | 10 / 24 / 8 | 0 |
| sql | 32 | 32 | 0 | 9 | 6 / 19 / 7 | 11 |
| docker | 21 | 21 | 0 | 1 | 8 / 12 / 1 | 10 |
| dotnet | 2 | 2 | 0 | 2 | 0 / 2 / 0 | 1 |
| **toplam** | **313** | **269** | **44** | **16** | 93 / 165 / 55 | 27 |

"Kendi": soru ve cevap kendi yazımın; `source` birincil belgeleri listeliyor.
"Mülakat kökenli" sütunu "Kendi"nin alt kümesi: cevap kendi yazımın, soru
metni bir mülakattan.

---

## 2. Kaynak takibi

### 2.1 Bugünkü durum

Kaynak **ayırt edilebiliyor ama yalnızca metni ayrıştırarak.** Yapısal bir
alan yok.

- Her sorunun `source`'u `Kendi derleme — <belge: bölüm>; <belge: bölüm>`
  biçiminde. `check:content` bu öneki denetliyor.
- Dış kaynaklı 44 soruda sona `; soru kaynağı: sudheerj/reactjs-interview-questions (MIT)`
  ekleniyor. Bu sorular için MIT bildirimi `src/content/THIRD_PARTY_NOTICES`'ta.
- Mülakat kökeni artık `source`'ta görünmüyor; yalnızca git geçmişinde
  (`039eb15` öncesi) var.
- `src/content/raw/` git'te değil (`.gitignore`). İçinde import taslakları
  var:
  - `react.md` sudheerj'in İngilizce orijinallerini (`orig:` satırlarıyla) içeriyor.
  - `react-import.json`'da 46 sudheerj kaydı var. 44'ü içerikte; `react-children-prop`
    ve `react-avantajlari` içeriğe girmemiş.
  - `docker-`, `java-`, `sql-import.json` "Kendi derleme"; `sql-import`'taki
    4 kayıt "Vakıfbank".

### 2.2 Öneri: `origin` alanı

Onaylanan biçim. `source` referans listesi olarak kalıyor.

```ts
// domain/question.ts
const originSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("own") }),
  z.object({
    kind: z.literal("external"),
    repo: z.string().min(1),          // "sudheerj/reactjs-interview-questions"
    url: z.string().url(),
    license: z.enum(["MIT", "CC-BY-4.0", "CC-BY-SA-4.0", "Apache-2.0"]),
  }),
]);
// questionSchema içinde:
origin: originSchema,
reviewed: z.boolean(),
```

- **İki alan da zorunlu, default yok.** Default `own` olsaydı dış kaynaklı
  bir soru alan unutularak "kendi" görünürdü. Default `reviewed: false`
  olsaydı yeni soru sessizce yayından düşerdi. Zorunlu olunca unutmak şema
  hatası verir.
- **`license` kapalı bir liste.** Listede olmayan bir lisans önce bu raporun
  3. bölümündeki uyum kontrolünden geçmeli; enum'a ekleme o kararın izi
  olur.
- **İçerik denetimi:** `external` olan her `repo`'nun `THIRD_PARTY_NOTICES`'ta
  bir bölümü olmalı. Bunu `contentFences.test.ts`'e eklemek bir test satırı.
- **Backend:** `ContentQuestionDto`'ya iki alan eklenmezse Jackson onları
  sessizce atar (Boot unknown property'leri global olarak yok sayıyor) ve
  payload'a girmezler. Payload'da gerekmiyorlarsa bu davranış yeterli; yine
  de seeder testiyle doğrulanmalı.
- `merge-questions` ve `raw/*-import.json` biçimi iki alanı taşımalı.

### 2.3 Mevcut soruları işaretleme

| Sinyal | Ne veriyor | Güven |
|---|---|---|
| `source`'ta `soru kaynağı: sudheerj/…` | 44 soru → `external`, MIT | Yüksek. `raw/react.md` orijinalleri ve `8bd5a77` commit'i ("44 yeni React sorusu") doğruluyor. |
| Geri kalan 269 soru | `own` | Yüksek. Hepsi `Kendi derleme`; import taslaklarında dış kaynak işareti yok. |
| Git geçmişindeki eski `source` (`git log -S "mülakat"`) | 16 mülakat kökenli soru | Yüksek. `own` kalır, `reviewed: false` ile başlar, soru metni yeniden yazılınca `true` olur. |
| `raw/react-import.json` id'leri ↔ içerik | sudheerj kümesinin sınırı | 46 aday, 44 içerikte. Eksik iki id içerikte yok, işaretlenecek bir şey yok. |
| İçerik benzerliği (`raw/react.md` İngilizce ↔ TR cevap) | Çeviri yakınlığı | Gerekmedi. Kaynak işareti zaten tam; benzerlik yalnızca işaretsiz bir dış soru aranırken anlamlı olurdu. |

Önerilen ilk işaretleme tek bir mekanik commit: 44 soru `external`, 269 soru
`own`. `reviewed` için iki seçenek var:

- **(A)** 0.2 ve 0.4'teki sorular hariç hepsi `true`, onlar `false`.
- **(B)** Hepsi `false`, tek tek gözden geçirilerek açılır.

(A) bu raporu inceleme kaydı olarak kullanır. (B) daha güvenli ama yayında
313 sorunun hepsini inceleme bitene kadar gizler.

### 2.4 `reviewed` filtresi — plan (uygulanmadı)

- **Yalnızca frontend'de, `content/index.ts`'te.** `loadQuestions` tüm
  dosyaları doğrular, `QUESTIONS` yalnızca `reviewed: true` olanları dışa
  verir. Doğrulama hepsinde çalışmaya devam eder: inceleme bekleyen bozuk
  bir soru da CI'ı düşürür.
- **Seeder'a KONMAMALI.** `QuestionSeeder.upsertAndPrune` içerikte olmayan
  soruları siliyor ve `question_progress.question_id` `ON DELETE CASCADE`
  (V1). Seeder `reviewed: false` soruları atlarsa, o soruları daha önce
  görmüş kullanıcıların sunucudaki ilerlemesi ve **denemeleri** kalıcı
  olarak silinir. Seeder hepsini yüklemeye devam etmeli; gerekiyorsa
  `GET /api/questions` yanıtı filtrelenir.
- **Yerel ilerleme etkilenmez.** Gizlenen sorunun kaydı IndexedDB'de kalır,
  `dueCount` ve çekiliş yalnızca içerikteki soruları sayar. Soru geri
  açılınca kayıt kaldığı yerden devam eder. Merge'deki `{ ...local, ...merged }`
  kuralı da onu korur.
- **Kategori çipi:** `AVAILABLE_CATEGORIES` filtrelenmiş listeden türetilir.
  Tüm soruları incelemede olan kategori seçicide görünmez. Kategori
  hidrasyonundaki "içerikten kalkan bilinenlerden düşmez" kuralı sayesinde
  kategori geri gelince kullanıcının kapatma tercihi korunur.
- **Geliştirmede hepsi görünsün** (`import.meta.env.DEV` ya da bir
  `VITE_SHOW_UNREVIEWED`). Aksi halde düzeltilen soru yerelde denenemez.
- **Araçlar:** `check:content` ve `scan:layout -- --reels` bütün içeriği
  ölçmeye devam etmeli.
- **Test:** filtrelenmiş liste, filtreden bağımsız id tekilliği, dev bayrağı.

---

## 3. Lisans tablosu

### 3.1 Yöntem ve sınır

"Metin türetildi": soru ya da cevap metni kaynaktaki metnin çevirisi ya da
uyarlaması. "Yalnızca başvuruldu": kaynak bilgi için okundu, metin kendi
cümlelerinle yazıldı. Fikir ve olgu telife konu değil, ifade konu.

Sınıflandırmanın kanıtı:

- **sudheerj (44 soru), metin türetildi.** `raw/react.md` İngilizce
  orijinalleri içeriyor ve TR cevaplar onların uyarlaması (örneğin
  `react-nedir`). Cevaplar sonradan react.dev'e göre büyük ölçüde yeniden
  yazıldı (`039eb15`); soru metinleri hâlâ orijinalin çevirisi.
- **Geri kalan bütün kaynaklar, yalnızca başvuruldu.** Bütün cevaplar
  2–5 cümlelik Türkçe düzyazı (`check:content` biçim kuralı) ve `source`
  belgelerin okunarak yazıldığını söylüyor (`039eb15`).
- **Sınır:** bu denetimde cevaplar kaynak metinlerle satır satır
  karşılaştırılmadı. Türkçe metin İngilizce kaynağın birebir kopyası
  olamaz, ama yakın bir çeviri de türetmedir. Aşağıda ⚠ işaretli
  kaynaklara başvuran sorularda yakın çeviri olup olmadığına bakılması
  önerilir.

### 3.2 Tablo

"Atıf" sütunu her soru-kaynak çifti için bir sayılıyor; birden fazla
kaynağa başvuran soru birden çok kez sayılır, sayılar yaklaşık.

| Kaynak | Lisans | Atıf yükümlülüğü | ShareAlike | Metin türetildi | Yalnızca başvuruldu | CC BY-SA 4.0 içeriğe uyum |
|---|---|---|---|---|---|---|
| sudheerj/reactjs-interview-questions | MIT | Telif ve izin metni kopyalarda bulunmalı | Yok | **44 soru** | — | Uyumlu: MIT alt lisanslamaya izin veriyor. MIT bildirimi her dağıtımda kalmalı (bölüm 5). |
| OWASP (Cheat Sheet Series, WSTG, Top 10, ASVS, API Top 10) | CC BY-SA 4.0 | Ad, lisans bağlantısı, değişiklik notu | **Var** | — | ~58 | Aynı lisans. |
| MDN Web Docs | Metin CC BY-SA 2.5, kod örnekleri CC0 | "Mozilla Contributors", lisans bağlantısı | **Var** | — | ~48 | Uyumlu, bkz. 3.3. |
| react.dev, legacy.reactjs.org | CC BY 4.0 | Ad, lisans bağlantısı, değişiklik notu | Yok | — | ~55 | Uyumlu (BY → BY-SA). |
| Microsoft Learn (.NET, EF Core, SQL Server) | CC BY 4.0 (belge), MIT (kod) | Atıf | Yok | — | ~9 | Uyumlu. |
| WHATWG (HTML, Fetch, DOM) | CC BY 4.0 | Atıf | Yok | — | ~9 | Uyumlu. |
| TypeScript Handbook, TSConfig Reference | CC BY 4.0 (doğrulanmalı) | Atıf | Yok | — | ~19 | Uyumlu, lisans doğrulanırsa. |
| Docker Docs ve release notes | Apache 2.0 | Lisans + NOTICE, değişiklik bildirimi | Yok | — | ~23 | Uyumlu. |
| Spring Framework / Boot / Security / Data, Spring Javadoc | Apache 2.0 | Aynı | Yok | — | ~31 | Uyumlu. |
| Node.js, webpack, Vite, TanStack belgeleri | MIT | Telif bildirimi | Yok | — | ~8 | Uyumlu. |
| PostgreSQL 18 Docs | PostgreSQL License (BSD benzeri) | Telif bildirimi | Yok | — | ~35 | Uyumlu. |
| NIST SP 800-63B-4, FIPS 186-5 | ABD kamu malı | Yasal yükümlülük yok, iyi uygulama | Yok | — | 7 | Uyumlu. |
| IETF RFC'ler ve taslaklar | IETF Trust Legal Provisions (BCP 78); kod bileşenleri Revised BSD | Alıntıda atıf | — | — | ~82 | Başvuru serbest. ⚠ IETF dışı türev metin (çeviri dahil) izin gerektirir; metin türetilmemeli. |
| Jakarta Persistence 3.1 spesifikasyonu ve Javadoc | Eclipse Foundation Specification License | Bildirim | Yok | — | ~7 | Başvuru serbest. |
| Hibernate ORM belgeleri | Doğrulanmalı | — | — | — | 7 | ⚠ Lisansı belirsiz; yalnızca başvuru. |
| ECMA-262 | Ecma International telifi, kendi lisansı (doğrulanmalı) | — | — | — | 6 (`javascript-null-vs-undefined`, `-equality-coercion`, `-truthy-falsy`, `-promise-states`, `-promise-combinators`, `-strict-mode`) | ⚠ Yalnızca başvuru. |
| Java SE 21 belgeleri, JLS, JVMS, HotSpot kılavuzları, JDK araçları | Oracle telifi; JLS/JVMS spesifikasyon lisansı, kılavuzlar tüm hakları saklı | — | — | — | ~50 | ⚠ Metin türetilmemeli; yalnızca başvuru. |
| JEP'ler (openjdk.org) | Lisansı belirsiz | — | — | — | 9 | ⚠ Yalnızca başvuru. |
| MySQL 8.4 Reference Manual | Oracle, tüm hakları saklı; kopyalama ve türetme kısıtlı | — | — | — | 6 (`sql-transaction-dirty-read`, `sql-find-slow-queries`, `sql-isolation-levels`, `sql-index-not-used`, `sql-clustered-index`, `sql-delete-truncate-drop`) | ⚠ Yalnızca başvuru. |
| PortSwigger Web Security Academy | Tüm hakları saklı | — | — | — | 1 (`cybersecurity-ssti`) | ⚠ Yalnızca başvuru. |
| W3C (WebAuthn) | W3C Document License; değiştirilmiş türev yasak | — | — | — | 1 (`cybersecurity-passkeys`) | ⚠ Yalnızca başvuru. |
| FIDO Alliance | Telifli, doğrulanmalı | — | — | — | 1 (`cybersecurity-passkeys`) | ⚠ Yalnızca başvuru. |
| OpenID Connect Core 1.0 | OpenID Foundation telifi, doğrulanmalı | — | — | — | 1 (`cybersecurity-oauth-vs-oidc`) | ⚠ Yalnızca başvuru. |
| GNU Bash Reference Manual | GFDL 1.3 | — | Var (GFDL) | — | 1 (`docker-debug-container`) | ⚠ **CC BY-SA 4.0 ile uyumsuz**: GFDL'den metin türetilseydi CC BY-SA altında dağıtılamazdı. Başvuru sorun değil. |
| musl libc FAQ | Doğrulanmalı | — | — | — | 1 (`docker-image-size`) | ⚠ Yalnızca başvuru. |
| hstspreload.org | Belirsiz | — | — | — | 1 (`web-hsts`) | ⚠ Yalnızca başvuru. |
| `acdlite/react-fiber-architecture` | **Lisans dosyası yok** (tüm hakları saklı sayılır) | — | — | — | 1 (`react-fiber`) | ⚠ Lisanssız; yalnızca başvuru. |
| Kitap ve makaleler: Effective Java, Java Concurrency in Practice, Saltzer & Schroeder (1975), Fowler (IoC/DI, Richardson Maturity), R. C. Martin (SOLID, DIP), Meyer (OCP), Liskov, Fielding (2000) | Tüm hakları saklı | — | — | — | ~17 (`java-oop-principles`, `java-immutable-class`, `java-generics-wildcards`, `java-deadlock`, `cybersecurity-least-privilege`, `java-dip-vs-di`, `web-hateoas`, `java-solid`, `java-open-closed`, `java-liskov`, `web-rest-constraints`, `web-rest-stateless`) | ⚠ Fikir düzeyinde başvuru; yaygın kavramlar. |
| Gerçek mülakatlar (16 soru, 0.4) | Lisans yok | — | — | **Soru metni** | — | ⚠ Bkz. 0.4: yeniden yaz ya da çek. |

**Özet:** Uyumsuz ya da lisanssız bir kaynaktan metin türetilmiş soru
bulunmadı. Metin türetilen tek dış kaynak MIT, ve CC BY-SA 4.0 ile uyumlu.
⚠ işaretliler bugün sorun değil; ileride bu kaynaklardan **çeviri ya da
uyarlama** yapılırsa sorun olur.

### 3.3 CC BY-SA 2.5 (MDN) ile CC BY-SA 4.0

CC BY-SA 2.5 §4(b), uyarlamanın "bu lisansın aynı lisans öğelerini taşıyan
sonraki bir sürümü" ile dağıtılmasına izin veriyor. MDN metninden türetilen
bir içerik bu yüzden CC BY-SA 4.0 altında dağıtılabilir. Atıf yükümlülüğü
(ad: "Mozilla Contributors", kaynak sayfa, lisans) türetmede geçerli kalır.
Bugün MDN yalnızca başvuru olarak geçtiği için yükümlülük doğmuyor.

---

## 4. Otomatik kalite kontrolleri

### a. Boş ya da çok kısa örnek cevaplar — **bulgu yok**

Markdown'sız uzunluk dağılımı: en kısa 210, %5'lik dilim 300, medyan 781,
%95'lik dilim 1066, en uzun 1197 karakter. Şemanın alt sınırı 20.

- En kısa 15 cevabın hepsi zorluk 1 sudheerj React sorusu: `react-state`
  (210), `react-props` (225), `react-ozellikleri`, `react-synthetic-event`,
  `react-fragment`, `react-innerhtml`, `react-html-vs-react-event`,
  `react-lifting-state-up`, `react-uncontrolled-component`, `react-jsx`,
  `react-state-vs-props`, `react-element-vs-component`,
  `react-prop-drilling`, `react-reconciliation`, `react-fiber` (298). Bu
  seviye için yeterliler.
- En uzun 15 cevap (1072–1197): `web-cors-preflight`,
  `cybersecurity-password-policy`, `cybersecurity-xss-output-encoding`,
  `cybersecurity-mfa-phishing`, `cybersecurity-auth-code-pkce`,
  `javascript-ts-enum-vs-literal-union`, `cybersecurity-csp-nonce-hash`,
  `web-websocket`, `cybersecurity-oauth-vs-oidc`, `java-virtual-threads`,
  `javascript-ts-tsconfig-strict`, `javascript-gc-and-leaks`,
  `cybersecurity-dependency-scanning`, `web-tls13-handshake`,
  `cybersecurity-jwt-xss`. "Kart içinde okunacak" sınırına en yakın
  olanlar; kısaltma isteğe bağlı.

### b. Kavram listesi boş ya da tek kavramlı — **bulgu yok (şema gereği)**

`keyConceptSchema` her kavramda en az 1 alias, `questionSchema` 3–6 kavram
istiyor; boş ya da tek kavramlı soru yüklenemez. Dağılım: 3 kavram 15 soru,
4 kavram 135, 5 kavram 163. `check:content` ayrıca kavram başına 2–6 alias
istiyor; tek alias'lı kavram yok.

### c. Alias kalitesi

**Örnek cevap kendi alias'larıyla:** 313 sorunun 313'ü `all`. Ölçüm hem ham
markdown'la hem markdown temizlenmiş haliyle yapıldı. Temizlenmiş halde
yalnızca `react-innerhtml` `some` verdi; o da ölçüm hatası, temizlik `__html`
alias'ındaki alt çizgileri kalın işareti sanıp siliyordu.

**Bu kontrol `check:content`'te zaten var.** `rules.ts` → `conceptWarnings`,
"model cevap tutmuyor: …" uyarısını veriyor; bugün 0 uyarı. Doğal cevap
denemesi (`probes/`) de var: 1400 kavramdan 1277'si tutuluyor; docker 92/92.

**Örnek vaka: `docker-depends-on-healthcheck`.** Örnek cevap ve probe 5/5
tutuyor, ama aynı anlamda farklı yazılmış bir cevap tutmuyor:

> depends_on sadece container'ın başlamasını bekler, veritabanı hazır olana
> kadar beklemez. Çözüm health check eklemek ve condition service healthy
> kullanmak, uygulama da tekrar denemeli.

`evaluateLexical` → **0/5, `none`**. Kavram kavram nedeni:

| Kavram | Cevapta | Alias'larda |
|---|---|---|
| `sadece-sira` | "başlamasını bekler" | yalnızca "başlatma sıra", "sadece sıra", "yalnızca sıra", "başlatıldıktan" |
| `hazir-degil` | "hazır olana kadar" | "hazır olduğu", "hazır olmayabilir", "hazır değil", "bağlantı kabul", "ready" |
| `healthcheck` | "health check" (boşluklu) | "healthcheck", "pg_isready", "sağlık kontrol" |
| `service-healthy` | "service healthy", "condition" (iki noktasız) | "service_healthy", "condition:", "sağlıklı" |
| `dayaniklilik` | "tekrar denemeli" | "yeniden dene", "retry", "yeniden bağlan", "dayanıklı" |

Sorun "alias yanlış" değil, "alias dar". Örnek cevap ve probe aynı kişinin
kalemi olduğu için alias'lara yakın duruyor; self-check bu darlığı göremez.

**Sistematik kısmı: yazım ayırıcıları.** Bir kavramın her alias'ı tireli,
alt çizgili ya da camelCase ise ve boşluklu yazım kavramı tutmuyorsa
kırılgan sayıldı. CLI bayrakları (`-p`, `-a`) hariç tutuldu. Sonuç: **102
sorunun 132 kavramı.** Kategori başına soru sayısı: web 24, java 20,
cybersecurity 19, react 14, sql 11, docker 9, javascript 3, dotnet 2. Tam
liste Ek A'da.

Önerim bunları içerikte tek tek düzeltmek değil. `normalizeTr`'de `-` ve
`_` iki tarafta da boşluğa çevrilirse 132 kavramın hepsi çözülür. Bedelleri:

- Bu, ScoreCard'ın ve `aliasResult` metriğinin gördüğü sonucu değiştiren
  bir domain değişikliği.
- `check:content`'in sık kelime ve alt dize sayımları kayar; `--base main`
  ile karşılaştırılmalı.
- "readonly" gibi bitişik yazımları yine yakalamaz.

### d. Yinelenen ya da çok benzer sorular — **gerçek yineleme yok**

Bütün çiftlerde (48.828) üç ölçü hesaplandı: soru metni Jaccard (≥ 0.4),
örnek cevap Jaccard (≥ 0.3), ve çapraz isabet (≥ 0.6). Çapraz isabet,
birinin örnek cevabının diğerinin kavramlarını tutma oranının küçüğü. 17
aday çıktı; elle bakıldı.

- **Alt küme:** `sql-transaction-dirty-read` ⊂ `sql-isolation-levels`
  (çapraz isabet 1.0, aynı topic). Bkz. 0.1.
- **Komşu açılar, kalabilir:** `java-spring-data-access-exception` ↔
  `sql-exception` (0.8), `java-spring-transaction-isolation` ↔
  `sql-isolation-levels` (0.6), `java-jpa-lazy-vs-eager` ↔ `sql-n-plus-one`
  (0.6).
- **Yanlış pozitif (12):** "X nedir?" kalıbının ortak kelimeleri. Örnekler:
  `react-nedir` ↔ `react-state`, `react-hook` ↔ `react-custom-hook`,
  `cybersecurity-command-injection` ↔ `sql-injection`.

`check:content`'in "yarı isabet çiftleri" (36 çift) bu ölçünün daha geniş
hali; orada gerekçesi yazılan kardeş çiftler bu raporda yineleme sayılmadı.

### e. Dil tutarsızlığı — **bulgu yok**

Kod blokları ve satır içi kod dışında, en az 4 kelimelik ve en az 2 İngilizce
işlev kelimesi (%15+) içeren cümleler arandı. Arama `prompt`, `modelAnswer`,
`followUps` ve kavram `label`'larında yapıldı. 7 aday çıktı, hepsi yanlış
pozitif: RFC alıntısı "SHOULD NOT" (`cybersecurity-implicit-flow`), SQL
sırası "FROM, WHERE, GROUP BY…" (`sql-where-vs-having`), terim adları
(`java-pass-by-value`, `javascript-this-binding`, ve
`javascript-generator-iterator`, `sql-subquery-vs-join`,
`web-conditional-request` label'ları). İngilizce teknik terimlerin Türkçe
cümle içinde kullanımı tutarlı.

### f. Çok uzun sorular

Soru metni dağılımı: medyan 71, %90'lık dilim 104, %95'lik dilim 117, en
uzun 251 karakter. Eşik 150 (yaklaşık %98'lik dilim):

| Soru | Karakter | Değerlendirme |
|---|---|---|
| `sql-locking-lost-update` | 251 | Düzelt (0.2) |
| `cybersecurity-jwt-xss` | 237 | Düzelt (0.2) |
| `dotnet-di-lifetimes` | 228 | Düzelt (0.2) |
| `dotnet-iqueryable-ienumerable` | 180 | Düzelt (0.2) |
| `sql-many-to-many-employee-project` | 154 | Senaryo; kabul (0.3) |
| `sql-window-running-total` | 151 | Senaryo; kabul (0.3) |

Eşiği aşan 6 sorunun 6'sı da mülakat kökenli. Uzunluk, mülakatçının
cümlesinin olduğu gibi alınmasından geliyor.

Diğer gözlemler:

- 161 soruda iki soru işareti var ("nedir? ne zaman?" kalıbı); format bu.
- 4 soru işaretli iki soru (`java-generics-wildcards`,
  `javascript-optional-chaining-nullish`) operatör adlarından (`?`, `?.`,
  `??`) geliyor.
- Hiçbir soru metninde kod bloğu ya da satır sonu yok.

---

## 5. Atıf önerisi

### 5.1 Bugünkü açık

- Repoda her şey yerinde: `src/content/LICENSE`, `THIRD_PARTY_NOTICES`,
  README'nin "Lisans" bölümü.
- **Uygulamada hiçbiri yok.** Web, Android ve iOS paketleri soru
  JSON'larını içeriyor, yani 44 MIT kökenli sorunun "önemli bir kısmının
  kopyası" dağıtılıyor. MIT'in tek şartı bildirimin bu kopyalarda
  bulunması.
- Footer "Açık kaynak · MIT" diyor; içerik CC BY-SA 4.0 ise hiç anılmıyor.
- `REPO_URL` `Metecode/interview-prep-slots`'u gösteriyor, remote
  `Metecode/slot-study`. GitHub muhtemelen yönlendiriyor, ama bağlantı
  güncellenmeli.

### 5.2 Uygulamada

1. **Footer:** "Kod MIT · İçerik CC BY-SA 4.0 · Lisanslar". "Lisanslar"
   bir sayfaya ya da diyaloğa gider.
2. **Lisanslar sayfası** (`privacy/` gibi statik ya da uygulama içi
   diyalog). İçinde:
   - Kod lisansı (MIT, tam metin).
   - İçerik lisansı (CC BY-SA 4.0, legalcode bağlantısı, telif satırı).
   - "Üçüncü taraf içerik": sudheerj/reactjs-interview-questions — hangi
     soruların ondan türetildiği ("React kategorisindeki 44 soru"), bağlantı,
     **MIT bildiriminin tam metni**.
   - Kaynak tek yerden üretilmeli: `THIRD_PARTY_NOTICES` build sırasında
     `?raw` import'la okunur, elle kopyalanmaz.
3. **Soru kartında ya da sonuç panelinde,** `origin.kind === "external"`
   ise küçük bir satır: "Soru kaynağı: sudheerj/reactjs-interview-questions
   (MIT)". Bağlantı lisanslar sayfasına. MIT bunu şart koşmuyor; ama hangi
   sorunun dış kaynaklı olduğunu kullanıcıya dürüstçe söyler ve `origin`
   alanının görünür karşılığıdır.
4. **Mağaza açıklamaları:** "Soruların bir kısmı MIT lisanslı açık kaynak
   derlemelerden uyarlanmıştır" cümlesi isteğe bağlı. Asıl yükümlülük
   uygulama içi bildirim.

### 5.3 Repoda: `ATTRIBUTION.md`

`THIRD_PARTY_NOTICES` kalır: lisans metinleri, makine dostu, değişmez.
`ATTRIBUTION.md` insanlar için:

- Kod ve içerik lisanslarının hangi dizinlere uygulandığı (README'deki
  bölümün genişletilmiş hali).
- **Dış kaynak tablosu:** `origin.kind = external` olan her repo için ad,
  URL, lisans, soru sayısı, türetme biçimi ("soru metni çeviri, cevap
  react.dev'e göre yeniden yazıldı"). Tablo `origin` alanından bir betikle
  üretilebilir; elle tutulursa sayı kayar.
- **Başvurulan kaynaklar:** OWASP (CC BY-SA 4.0), MDN (CC BY-SA 2.5),
  react.dev (CC BY 4.0) gibi kaynakların adı ve lisansı. Bunlara bugün
  yasal atıf borcu yok (metin türetilmedi). Gelecekte türetme yapılırsa
  hangi lisansın uygulanacağını katkıcılara söyler.
- **Katkı kuralı:** dış kaynaktan soru eklerken `origin` doldurulur,
  lisans 2.2'deki enum'da değilse önce uyum kontrolü yapılır. ⚠ işaretli
  kaynaklardan (bölüm 3.2) çeviri ve uyarlama yapılmaz.
- `src/content/LICENSE`'a bir cümle: "React kategorisindeki 44 soru MIT
  lisanslı bir eserden türetilmiştir; o kısımlarda MIT bildirimi de
  geçerlidir (`THIRD_PARTY_NOTICES`)." Bugünkü metin bütün dizini
  yalnızca senin telifin olarak sunuyor.

---

## 6. `check:content`'e eklenmesi önerilenler (uygulanmadı)

- **(c) "örnek cevap kendi alias'larıyla `all`" kontrolü zaten var**
  (`rules.ts`); ekleme gerekmiyor.
- **Ayırıcı kırılganlığı uyarısı:** bir kavramın bütün alias'ları `-`, `_`
  ya da camelCase içeriyorsa ve boşluklu varyant tutmuyorsa uyarı ver.
  `normalizeTr` değişirse bu kontrol gereksizleşir; o yüzden önce o karar.
- **`origin` ve `reviewed` gelince:** `external` olan her repo
  `THIRD_PARTY_NOTICES`'ta olmalı; özet tabloya kategori başına
  `reviewed` sayısı eklenmeli.
- **Soru uzunluğu:** 150 karakteri aşan soru için biçim uyarısı (bugün 6).

---

## Ek A — Ayırıcı kırılganlığı olan kavramlar (102 soru, 132 kavram)

Biçim: `soru`: kavram (kaçan boşluklu yazım).

<details>
<summary>Listeyi aç</summary>

- `cybersecurity-jwt-xss`: bellekte-access-token (in memory); csrf-tradeoff (cross site request forgery)
- `cybersecurity-broken-access-control`: istemcide-gizlemek (client side)
- `cybersecurity-idor`: sorguyu-kapsamla (user id, owner id)
- `cybersecurity-mass-assignment`: alan-allowlist (allow list)
- `cybersecurity-file-upload`: uzantiya-guvenme (content type)
- `cybersecurity-second-order-sqli`: procedure-dinamik (sp executesql)
- `cybersecurity-ssti`: sandbox (logic less)
- `cybersecurity-xxe`: dtd-kapat (disallow doctype)
- `cybersecurity-xss-output-encoding`: framework-kacis-kapisi (auto escap, v html)
- `cybersecurity-csp`: izinli-kaynaklar (script src, default src)
- `cybersecurity-csp-nonce-hash`: icerik-ozeti (sha 256)
- `cybersecurity-hash-vs-encryption`: encryption-iki-yonlu (two way)
- `cybersecurity-mfa-phishing`: farkli-faktorler (two factor)
- `cybersecurity-passkeys`: senkron-aal2 (device bound)
- `cybersecurity-credential-stuffing`: mfa (multi factor)
- `cybersecurity-oauth-vs-oidc`: claim-dogrulama (client id)
- `cybersecurity-auth-code-pkce`: s256 (sha 256 ozeti)
- `cybersecurity-leaked-secret`: kisa-omurlu (short lived)
- `cybersecurity-secure-logging`: log-koruma (read only)
- `docker-container-communication`: shared-user-network (user defined bridge)
- `docker-image-vs-container`: image-sablon (read only template, read only'dir)
- `docker-compose`: yaml (docker compose.yml)
- `docker-depends-on-healthcheck`: healthcheck (pg isready); service-healthy (service healthy)
- `docker-env-secrets`: dockerfile-yok (env db password); env-runtime (env file)
- `docker-image-size`: dockerignore (node modules)
- `docker-restart-policy`: on-failure (on failure); always-unless (unless stopped)
- `docker-non-root`: least-privilege (read only, cap drop)
- `docker-network-drivers`: kullanici-tanimli (user defined)
- `dotnet-di-lifetimes`: dbcontext-scoped-transaction (thread safety, thread safe olma)
- `dotnet-iqueryable-ienumerable`: ienumerable-in-memory (client side)
- `java-string-immutable`: sebepler (thread safe yap)
- `java-stringbuilder`: buffer-sync (stringbuffer thread safe, thread safe ama)
- `java-hashmap-internals`: liste-agac (kirmizi siyah, red black)
- `java-memory-gc`: nesiller (garbage first)
- `java-synchronized-volatile`: race (oku artir yaz); gorunurluk (happens before); atomic (compare and swap)
- `java-concurrenthashmap`: ince-taneli (fine grained, compare and swap); atomik (check then act)
- `java-stream-api`: lazy (short circuit)
- `java-bytecode-jit`: profil-warmup (warm up)
- `java-gc-stop-the-world`: zgc-eszamanli (sub millisecond); denge (trade off)
- `java-dip-vs-di`: soyutlama (high level)
- `java-map-implementations`: sirali-agac (kirmizi siyah, red black)
- `java-threadlocal`: kendi-kopyasi (per thread)
- `java-stream-map-flatmap`: bire-bir (one to one); sifir-cok (one to many)
- `java-spring-prototype-in-singleton`: scoped-proxy (target class)
- `java-spring-aop-proxy-types`: boot-varsayilan (proxy target class)
- `java-spring-rollback-rules`: rollbackfor (all exceptions)
- `java-spring-self-invocation`: cozum (self injection)
- `java-jpa-lazy-initialization-exception`: gizleyen (enable lazy load no trans, no trans); osiv (open in view=false)
- `java-jpa-eager-n-plus-one`: dogrusu (batch fetch size)
- `java-jpa-locking`: for-update (pessimistic write)
- `javascript-event-loop`: single-thread (run to completion)
- `javascript-symbol`: well-known (well known)
- `javascript-ts-conditional-types`: if-else (if else)
- `react-nedir`: component (component based)
- `react-ozellikleri`: component (component based)
- `react-state`: rerender (re render)
- `react-props`: readonly (read only)
- `react-state-vs-props`: props-readonly (read only)
- `react-shadow-dom-vs-virtual-dom`: virtual-bellek (in memory)
- `react-innerhtml`: xss (cross site)
- `react-memo`: hoc (higher order)
- `react-hook-kurallari`: eslint (rules of hooks)
- `react-error-boundary`: class (react error boundary)
- `react-code-splitting`: sellale-prefetch (gidis donus)
- `react-windowing`: kutuphane (react window, react virtualized)
- `react-batching`: tek-render (tek bir re render, tek re render)
- `react-usetransition-vs-usedeferredvalue`: oncelik (non urgent)
- `sql-index-types`: gin-multivalue (full text)
- `sql-many-to-many-employee-project`: reverse-direction-index (project id uzerine, project id index)
- `sql-transaction-dirty-read`: non-repeatable-read-gap (non repeatable)
- `sql-find-slow-queries`: pg-stat-statements (pg stat statements); slow-log (log min duration); pg-stat-activity (pg stat activity)
- `sql-exception-handling-db`: hata-turu (unique violation, division by zero)
- `sql-deadlock`: kisa-transaction (lock timeout)
- `sql-acid`: durability (write ahead)
- `sql-isolation-levels`: non-repeatable (non repeatable)
- `sql-composite-index-order`: ilk-kolon-yok (created at tek basina, sadece created at, yalnizca created at); siralama (order by created at)
- `sql-n-plus-one`: tespit (show sql)
- `sql-procedure-vs-function`: eksi (lock in)
- `web-safe-idempotent`: salt-okuma (read only)
- `web-head-options`: head-kullanim (content length); preflight (cross origin)
- `web-redirect-codes`: see-other (post redirect get)
- `web-409-vs-412`: kosul (if match, if unmodified since)
- `web-429`: backoff (back off)
- `web-401-www-authenticate`: bearer (invalid token)
- `web-content-negotiation`: accept-ailesi (accept language, accept encoding, accept charset)
- `web-content-encoding-chunked`: hop-by-hop (hop by hop); boyut-bilinmeden (content length); h2-frame (end stream)
- `web-no-cache-vs-no-store`: kosullu-304 (if none match)
- `web-vary`: accept-encoding (accept encoding, accept language); isabet (user agent)
- `web-rest-stateless`: her-istek (self contained)
- `web-dns-resolution`: kok-tld (top level)
- `web-url-to-page`: baglanti (three way)
- `web-http3-quic`: migration (wi fi); kesif-geri-donus (alt svc)
- `web-hsts`: yalnizca-https (strict transport security, max age); https-e-cevirme (click through); ssl-stripping (man in the middle)
- `web-samesite`: strict (hicbir cross site); lax (top level); none-secure (cross site istek)
- `web-cookie-domain-path`: alt-alanlar (sub domain)
- `web-session-vs-token`: imzali-token (self contained); kisa-omur (short lived)
- `web-same-origin-policy`: cors-istisna (access control)
- `web-cors-preflight`: simple-kosullar (form urlencoded, multipart/form data); options-on-kontrol (access control request method, access control request headers); izin (access control allow methods, access control allow headers, allow methods); max-age (access control max age, max age)
- `web-cors-credentials`: allow-credentials (allow credentials, access control allow credentials)
- `web-cors-not-protection`: tarayici-disi (server to server); csrf (cross site request forgery)
- `web-sse`: event-stream (text/event stream, event stream); tek-yonlu (one way); yeniden-baglanma (last event id)
- `web-websocket`: upgrade (sec websocket key, sec websocket accept); kalici-kanal (istek cevap, istek yanit dongusu)

</details>
