# Slot

Teknik mülakatlardaki teorik/kategorik soruları çalışmak için açık kaynak
web uygulaması. Slot makinesi mekaniğiyle rastgele soru gelir, kullanıcı
cevabını yazar, kavram bazlı geri bildirim alır.

## Mimari kararlar — bunları değiştirme, önce sor

- **Local-first.** Uygulama hesapsız ve backend'siz tam çalışır. Giriş
  yalnızca senkron için. Faz 1'de backend yok.
- **Değerlendirme: kelime eşleşmesi + öz-değerlendirme.** Alias kelime
  eşleşmesi ve kullanıcının öz-değerlendirmesi. Uygulama hiçbir yapay
  zekâ sağlayıcısını çağırmaz; kullanıcı isterse "Kendi yapay zekâna sor"
  ile istemi kendi aracında açar ya da kopyalar (bkz. "Yapay zekâ
  değerlendirmesi — denendi, kaldırıldı").
  Tarayıcıda embedding ile kavram eşleştirme de denendi ve çıkarıldı:
  e5-small ile alakasız çapalar 0.88, doğru kavramlar 0.88-0.91 skor
  alıyordu — Türkçede eşik koyacak kadar ayrışmıyor. Kod silinmedi,
  `domain/evaluate.ts`'te kullanılmıyor olarak duruyor.
- **Kutuyu kullanıcı belirler.** Leitner kutusu öz-değerlendirmeyle
  güncellenir, hiçbir otomatik skorla değil.
- **Kazanan animasyondan önce belirlenir.** Soru ağırlıklı çekilişle
  seçilir, makara animasyonu yalnızca sonucu gösterir. Animasyonun
  sonucu belirlemesine izin veren bir değişiklik ağırlıklandırmayı bozar.
- **Gün 04:00'da döner.** "Bugün", "yarın" ve tekrar günü yalnızca
  `domain/studyDay.ts`'ten okunur; `dueAt`, arayüzdeki "yarın / N gün
  sonra" metinleri ve hatırlatıcının ertesi gün kuralı onu kullanır.
  Aralık 24 saatle değil takvim günüyle sayılır: 24 saatte "yarın" denen
  soruların yalnızca %46'sı ertesi günün oturumunda gelmiş oluyordu,
  akşam oynayanın hatırlatması iki gün sonraya kayıyordu. Gece yarısı
  değil 04:00: 23:50'de görülen soru on dakika sonra "yarının sorusu"
  olmasın.
- **Çekilişte zamanı gelen önce gelir** (`domain/drawTiers.ts`).
  Soğutmadan sonra: zamanı gelmiş sorular, onlar varken günde en fazla
  1 yeni soru; zamanı gelmiş yoksa yeniler sınırsız; hiçbiri yoksa
  zamanına en yakın olan (kutu ağırlığı × (geçen/aralık)²). Eski
  ağırlıklarla 100 soruluk havuzda, günde 10 turda 30. günde 65 soru
  ortalama 6.5 gün gecikmeli bekliyordu; şimdi ~4 soru, ~1 gün. Bedeli
  daha yavaş tanıtım (30 günde 95 yerine 50). Yedekteki oranın alt sınırı
  0.01: toplam ağırlık hiç sıfır olmaz; 0.1'de 13 soruluk havuzda aynı
  gün tekrar günde 0.2'den 1.7'ye çıkıyordu.
- **İleri tarihli ya da bozuk kayıt zamanı gelmiş sayılır.** `lastSeenAt`
  şimdiden sonraysa (cihaz saati kaymış), okunamıyorsa ya da kutu aralık
  tablosu dışındaysa soru öne alınır: gösterilir, değerlendirilir, kaydı
  düzelir. Geri planda bekletilse kendiliğinden düzelmezdi.
- **`src/domain/` saf kalır.** React importu yok, DOM erişimi yok,
  yan etki yok. Test edilebilirliği ve ileride paylaşılabilirliği buna bağlı.
- **İçerik ve ilerleme ayrı.** Sorular repo'dan gelir ve değişir;
  ilerleme kullanıcınındır ve kalır. Tek tipte birleştirme.
- **Yeni kategori ekleme.** `CATEGORIES` (`domain/question.ts`; sıra
  seçicideki sıra), `content/labels.ts`, `content/index.ts`'te import +
  `FILES` satırı. Backend değişiklik istemez: kategori serbest metin,
  seeder `tr/*.json`'un hepsini okur. Import unutulursa sorular arayüze
  girmez ama sunucuya girer.
- **Sonradan gelen kategori mevcut kullanıcıda açık gelir**
  (`domain/categoryHydration.ts`). `knownCategories` kullanıcının gördüğü
  kategoriler: orada olmayan açılır, orada olup seçimde olmayan bilinçli
  kapatılmıştır, kapalı kalır. İçerikten kalkan bilinenlerden düşmez
  (geri döndüğünde kapatılmışsa açılmasın), `CATEGORIES`'ten kalkan düşer.
  Alanın yokluğu "eski kayıt" demek; şemaya default konmaz.
- **Kategori gizleme yalnızca frontend'de** (`HIDDEN_CATEGORIES`,
  `content/index.ts`). Açık liste, soru sayısı eşiği değil. Gizli
  kategorinin soruları yüklenir ve doğrulanır (`LOADED_QUESTIONS`) ama
  `QUESTIONS`'a, çekilişe ve seçiciye girmez. Seeder'a ASLA filtre konmaz:
  `upsertAndPrune` içerikte olmayan soruyu siliyor ve `question_progress`
  `ON DELETE CASCADE`, kullanıcıların ilerlemesi ve denemeleri kalıcı olarak
  giderdi. Sunucu gizli soruları tutmaya devam eder. Kullanıcının kayıtlı
  seçimi korunur (`categoryHydration`, "içerikten kalkan" gibi). İçerik
  testleri (`registry`, `contentFences`, `origin`) `LOADED_QUESTIONS`'la
  çalışır.
- **`LEGACY_KNOWN_CATEGORIES` dondurulmuş bir listedir.** 1.0.1'de içeriği
  olan kategoriler; alanı olmayan eski kayıt bunları görmüş sayılır. Yeni
  kategori ASLA buraya eklenmez — eklenirse mevcut kullanıcılarda kapalı
  gelir.

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · Zod · Vitest · idb-keyval
shadcn/ui bileşenleri ihtiyaç oldukça tek tek eklenir, toplu kurulmaz.

## Kod kuralları

- Okunabilirlik zekice kısaltmadan önce gelir. Bu repo'ya başkaları
  katkı verecek.
- Türkçe yorum yazılır, kod ve tip isimleri İngilizce.
- Bir dosya tek bir işi yapar. 200 satırı aşan modül bölünmeye aday.
- Zod şemaları tek kaynak; tipler `z.infer` ile türetilir, elle yazılmaz.
- Yeni bağımlılık eklemeden önce sor.
- `domain/` içindeki her saf fonksiyonun Vitest testi olur.

## Erişilebilirlik ve hareket

- Her etkileşimli öğe klavyeyle kullanılabilir olmalı.
- prefers-reduced-motion yalnızca varsayılanı belirler; kullanıcının açık
  seçimi her zaman kazanır. Dönüş animasyonunda bu, Ayarlar'daki moddur
  (aşağıda); CSS mikro geçişleri (oturma tıkı, ödeme oku, panel açılışı)
  tokens.css'te tercihe bağlı kalır.
- Animasyon atlanabilir olmalı; kullanıcı 40. soruda beklemek istemez.

## Dönüş animasyonu modları

- **Tam / Kısa / Kapalı** (`settings.animationMode`, opsiyonel). Alan
  yoksa kullanıcı seçmemiştir; etkin mod `resolveAnimationMode`'dan:
  hareket azaltma açıksa Kapalı, değilse Kısa. Seçilmemiş mod diske
  yazılmaz, sistem tercihi değişince varsayılan izler. Eski ikili
  `fastMode` okunmuyor.
- **Süreler tek yerde:** `domain/spinTiming.ts`. `spinPlanFor(mod,
  oturumdaki sıra)` tambur süre/turlarını, kolu, ses çarpanını ve hangi
  geri bildirimin çalacağını verir. Kısa: oturumun (sayfa/uygulama
  açılışı, `spinKey === 1`) ilk çekişi tam, sonrakiler tamburda ×0.35
  (455/560 ms, 1'er tur), kol ve ses ×0.6. Kapalı: tamburlar anında,
  kol oynamaz, kol sesi/titreşimi ve tıklar yok. Bileşenler süre sabiti
  tutmaz, hareket azaltmayı kendileri okumaz. Şeridin biçimi (aşma,
  easing) Drum'da, tık aralığı reelTicks'te: süre değil.
- **Sonuç geri bildirimi tek kapıdan** (`domain/resultFeedback.ts`):
  öncekinden 80 ms içinde gelen duruş ne ses ne titreşim çalar. Atlamada
  ve Kapalı'da iki tambur aynı anda durur, bir kez çalar; Tam ve Kısa'da
  iki duruş ayrı duyulur. Capacitor darbeleri süre almıyor; haptikte moda
  göre değişen darbelerin sayısı.
- **Atlama katmanı** (`SkipLayer`): dönüş sürerken ekranı kaplayan
  görünmez bir `<button>`, body'ye portal. Belge düzeyinde dinleyici
  değil: iOS WebKit etkileşimsiz öğeye dokunuşu document'a click olarak
  iletmiyor. Atlama click'te, pointerdown'da değil: aksi halde aynı
  dokunuşun click'i yeni açılan karttaki bir düğmeye düşerdi. Kaydırma
  click üretmez, sayfa kayar. Klavyenin yolu Escape.
- **Kol toparlanırken yeni çekiliş yok** (Lever `recoveringRef`): Kısa
  ve Kapalı'da dönüş kol yerine dönmeden bitebiliyor.
- **`spin` olayı spinning'e girişte bir kez** (`domain/spinStart.ts`,
  `useTurnFlow`). Mod ve atlama faz sırasını değiştirmez, yalnızca
  SETTLE'ın zamanını; `spinFlow.test.ts` her mod ve atlama için doğruluyor.
- **Bilinen sınır (iOS):** Kapalı modda sonuç sesi, kola dokunuştaki
  kilit açma çağrısından hemen sonra çalıyor. İlk kurulumda AudioContext
  henüz `running` değilse ilk sonuç sesi duyulmayabilir; sonraki
  çekişlerde sorun yok. Kuyruk kurulmadı, bilinçli.
- **Döngülü testlerde tek expect.** `reels.test.ts`'teki 3000 turluk
  test tur başına ~40 expect çağırıyordu (~120 bin); tüm paket paralel
  koşarken 5 sn zaman aşımına düşüyordu. Kurallar ihlal listesi döndürür,
  sonda tek `expect(ihlaller).toEqual([])`. Yeni özellik testlerinde de
  aynı kalıp.

## Tambur etiketleri

- **Etiket en fazla iki satır, yüz yüksekliği sabit.** Şerit satır
  cinsinden kayıyor (`drumStrip.ts`), bütün satırlar aynı boyda olmalı;
  iki satır 56 px'lik satıra sığıyor. Satır aralığı 1.3'ün altına inmez:
  1.2'de kırpılan üçüncü satırdaki "İ"nin noktası görünüyordu. Sığmayan ad
  ikinci satırın sonunda "…" ile biter.
- **"/" sonrasında kırılabilir** (`components/reelLabel.ts`). Tarayıcı "/"
  işaretinde satır kırmıyor, "IQueryable/IEnumerable" tek kelime
  sayılıyordu. Etiket metni tamburlara yalnızca bu fonksiyondan geçer.
- **Dar ekranda alan tamburlara gider** (`Machine.module.css`, 560 px
  kuralı). 360'ta 7rem'lik kol paneli ve arası makinenin iç genişliğinin
  %45'ini alıyordu, tambur başına yazıya 45 px kalıyordu. Kol paneli
  96 px, 400 px'in altında 72 px; yan iç boşluğu olmadığı için kol 400 ve
  üstünde masaüstündeki boyutunda (94 px), altında 70 px. Genişlik px ile
  yazılır: rem, Android'in yazı boyutu ayarında büyüyüp tamburların yerini
  yiyordu. 380 px ve altında tambur yazısı 12 px (`--fs-mono`).
- **Yeni konu adı 360'ta sığmalı.** Pay ince: en uzun kelimeler 12
  karakter ("Clickjacking", "yapılandırma"); 360'ta 12 px'te 86.4 px, alan
  89.5 px. İçerik eklenince `npm run scan:layout -- --reels` çalıştırılır;
  %100 yapılandırmalarda kesilme hata, %130 ve 277'de uyarı. 13 karakterlik
  bir kelime kontrolü kırmızıya düşürür; önce içerikte kısaltma denenir.
- **Tam ad soru kartında da görünür.** Makara ekran okuyucudan gizli ve
  büyük yazıda etiket hâlâ kesilebiliyor; soru kartı kategori ve konuyu
  sonuç paneliyle aynı sırada gösterir.

## Bu repo'da yapılmayacaklar

- Three.js veya WebGL. Makine CSS 3D ve SVG ile çizilir.
- localStorage'a JWT yazma.
- Soru içeriğini başka sitelerden kopyalama. İçerik özgün yazılır,
  `source` alanında türetildiği konu belirtilir. Kökeni `origin` taşır
  (`own` ya da `external`: repo, url, lisans); zorunlu ve varsayılansız.
  Dış kaynaklı soru `source`'ta "soru kaynağı: <sahip/repo> (<lisans>)"
  ile biter, repo'nun lisans metni `THIRD_PARTY_NOTICES`'ta olur; çelişkiyi
  `check:content` (çıkış 1) ve `content/origin.test.ts` reddeder. Lisans
  `EXTERNAL_LICENSES`'ta değilse önce CC BY-SA 4.0 ile uyumu değerlendirilir
  (`docs/content-audit.md`, bölüm 3).

## Derleme ve CI

- **`tsc -b` yalnızca production projelerini derler.** Kök `tsconfig.json`'ın
  references'ı `Dockerfile.frontend`'in kopyaladığı dosyalarla sınırlı:
  app ve node (yalnızca `vite.config.ts`). Betikler ve `capacitor.config.ts`
  `tsconfig.scripts.json`'da, içerik denetimi `tsconfig.content-check.json`'da;
  tiplerini `npm run typecheck` kontrol eder, CI'da çalışır. Kök references'a
  araç eklenirse imajda dosya bulunamaz: PR #58'de böyle oldu, dört deploy
  kurulmadı, CI tam checkout'ta derlediği için yeşil kaldı.
- **PR'da iki image push edilmeden derlenir** (`ci.yml`, `images` job'u).
  Testler tam checkout'ta, Dockerfile'lar tek tek sayılan dosyalarla
  çalışıyor; aradaki fark yalnızca image derlemesinde görünür. Job
  `deploy.yml`'den çağrıldığında atlanır, orada build job'u aynı işi yapıyor.
- **Bir image düşerse hiçbiri kurulmaz.** Compose ikisini tek `IMAGE_TAG`
  ile çeker; frontend derlenemezse backend ve soru seeder'ı da eski sürümde
  kalır. Canlı içeriğin bir commit'le aynı olup olmadığını
  `npm run check:live -- [revizyon]` gösterir.

## Backend (`backend/`)

- **Sadece senkron için.** Uygulama backend'siz tam çalışır
  (bkz. yukarıdaki Local-first kararı). Faz 1'de iş endpoint'i yok, sadece
  çalışan iskelet: `GET /api/health`.
- **Stack.** Spring Boot 4.x, Java 21, Maven (wrapper ile — geliştirme
  Windows'ta olduğu için Maven komutları `.\mvnw.cmd` ile çalıştırılır,
  yerel Maven kurulumuna güvenilmez). Proje Spring Initializr'dan
  kuruldu; artifactId `mulakatslot`, ana sınıf `MulakatslotApplication`.
- **Paket yapısı özelliğe göre.** `com.meteucar.mulakatslot` altında
  `config`, `auth`, `user`, `question`, `progress`, `health`. `controller/`,
  `service/`, `repository/` gibi katman klasörleri YOK — her paket kendi
  entity/repository/controller'ını (varsa) barındırır. `config` yalnızca
  çapraz kesen yapılandırmayı tutar (güvenlik zincirleri, JWT anahtarı);
  token üretimi ve uçları `auth` paketinde.
- **Actuator yok.** `/api/health` Actuator olmadan elle yazıldı.
  Spring Security adım 3'te geldi (bkz. Kimlik doğrulama); eklenirken
  açık uçlar tek tek `permitAll` ile sayıldı, varsayılan "hepsi kilitli"
  bırakılmadı.
- **`/api/health` veritabanını da yoklar.** `DatabaseProbe` `SELECT 1`
  atar (sorgu zaman aşımı 2 sn): erişilebilirse 200 `{"status":"up"}`,
  değilse 503 `{"status":"down","db":"down"}`. Hata ayrıntısı yanıtta değil
  logda, stack trace'siz (compose 15 sn'de bir yokluyor). GET ve HEAD açık:
  UptimeRobot HEAD atıyor. Hikari `connection-timeout` 2 sn: DB erişilemezken
  health ve API istekleri 30 sn yerine ~2 sn'de hata verir. Deploy'daki
  200 beklemesi böylece DB bağlantısını da doğrular; DB düşükken compose
  backend'i `unhealthy` gösterir, ona bağlı servis olmadığı için zincirleme
  etkisi yok. Testler: `HealthControllerTest` (gerçek port, çünkü MockMvc
  HEAD'de gövdeyi atmıyor), `HealthDatabaseDownTest` (kendi konteynerini
  durdurur).
- **`question.payload` ve `question_progress.attempts` JSONB kalır.**
  `keyConcepts`, `anchors`, `followUps` gibi iç içe alanlara SQL sorgusu
  atmayacağız; bu yüzden ilişkisel olarak parçalanmadılar. `category` ve
  `topic` ayrı kolon çünkü onlarla filtreleyeceğiz. Hibernate 7'de JSONB
  eşlemesi `@JdbcTypeCode(SqlTypes.JSON)` ile yapılır, elle
  serialize/deserialize etme.
- **`spring.jpa.open-in-view: false`.** Varsayılan `true` sessizce
  connection pool'u view render edilene kadar meşgul eder. Kapalı kalsın;
  gerekiyorsa servis katmanında DTO'yu transaction içinde hazırla.
- **Şemayı Flyway yönetir.** `ddl-auto: validate` — Hibernate şema
  üretmez, sadece Flyway migration'larıyla eşleşip eşleşmediğini doğrular.
  Var olan bir migration dosyasına (`V1__...` dahil) asla dokunma; yeni
  değişiklik yeni `V2__...` dosyasıyla gelir. İlk deploy'dan sonra
  uygulanmış migration'a dokunulmaz. Öncesinde düzenlenebilir.
- **Testler gerçek PostgreSQL'e karşı çalışır (Testcontainers).** H2
  KULLANILMAZ — JSONB ve UUID davranışı H2'de farklı, testler yeşil çıkıp
  canlıda patlayabilir. `TestcontainersConfiguration` (`@ServiceConnection`
  ile) ortak Postgres konteynerini sağlar; yeni entegrasyon testleri
  `@Import(TestcontainersConfiguration.class)` ile ona bağlanır — Spring
  Boot bu konteyneri test sınıfları arasında context cache üzerinden
  paylaşır, her sınıf ayrı konteyner açmaz.
- **Test `application.yml`'i ana dosyayı gölgeler.** İkisi classpath'te
  aynı adı taşıyor; testlerde yalnızca `src/test/resources/application.yml`
  yüklenir. Ana dosyayı yalnızca `MainConfigurationTest` yükler
  (`spring.config.location`, Testcontainers ile context açılışı); ana
  dosyaya eklenen ayar orada doğrulanır. Hikari `connection-timeout: 2s`
  (long bekliyor) bu yüzden testlerden geçip canlıda açılışı durdurmuştu.
  Test göreli yol kullanır, `backend/`'den çalıştırılır. Test dosyasını
  `config/` altına taşıyıp her testte ana dosyayı yüklemek Faz 1'de.
- **DB bilgileri ortam değişkeninden gelir**, `application.yml`'e
  hardcode edilmez. Yerelde `docker-compose.yml` için `.env` kullan
  (`.env.example`'dan kopyala); `.env` ve `.idea/` git'e girmez.
- **Spring Boot 4 + Jackson 3.** Jackson core/databind paketleri
  `tools.jackson.*` altında, `com.fasterxml.jackson.*` değil.
  Yalnızca anotasyonlar `com.fasterxml.jackson.annotation`'da kalır.
  `JsonProcessingException` yerine `JacksonException` (unchecked).
  Boot 3 örneklerinden kod kopyalarken paketleri kontrol et.
  Boot 4 modüler yapıda: web, test ve güvenlik otomatik
  yapılandırmaları ayrı modüllere taşındı, paket adları değişti.
  Starter adları da: `spring-boot-starter-web` yerine `-webmvc`,
  oauth2 starter'ları `spring-boot-starter-security-oauth2-client` ve
  `-security-oauth2-resource-server` (öneksiz eski adlar deprecated).
  Boot 3 örneğinden gelen her import'u gerçek bağımlılıkta doğrula.
  Özellikle: test anotasyonları (`AutoConfigureMockMvc`
  `org.springframework.boot.webmvc.test.autoconfigure`'da,
  `WebMvcTest` aynı paketde — `org.springframework.boot.test.autoconfigure.web.servlet`
  değil), Spring Security yapılandırması, Jackson.

## Kimlik doğrulama

- **İki tür token, iki ayrı yer.** Access token JWT'dir (HS256, 15 dakika,
  `iss=mulakat-slot`, `sub` kullanıcının UUID'si) ve yalnızca yanıt
  gövdesinde döner; frontend onu bellekte tutar. Refresh token 32 bayt
  SecureRandom'dur (30 gün) ve yalnızca cookie'de yaşar.
- **Access token neden cookie'de değil.** Tarayıcı cookie'yi her isteğe
  kendiliğinden ekler; başka bir sitenin tetiklediği istek de kimlik
  taşır. Authorization başlığını tarayıcı kendiliğinden eklemediği için
  bu yolda CSRF mümkün değil — `/api/**` için CSRF'i bu yüzden kapattık.
  Cookie ile çalışan tek uçlar `/api/auth/refresh` ve `/api/auth/logout`;
  onları refresh cookie'sindeki `SameSite=Strict` koruyor.
- **Refresh cookie:** HttpOnly, Secure, SameSite=Strict, Path=/api/auth.
  Secure yalnızca yerel geliştirmede `COOKIE_SECURE=false` ile kapatılır.
- **Düz refresh token asla saklanmaz.** Veritabanında yalnızca SHA-256
  özeti var. Token 32 bayt rastgele veri olduğu için yavaş bir KDF
  (bcrypt/argon2) gerekmiyor; sözlük saldırısı söz konusu değil.
- **Rotasyon ve yeniden kullanım tespiti.** Her yenilemede eski token
  iptal edilir, yenisi verilir. İptal edilmiş bir token tekrar gelirse bu
  kopyalanma işaretidir: o kullanıcının TÜM token'ları iptal edilir,
  meşru oturum da dahil — hangisinin saldırganda olduğunu bilmiyoruz.
  `RefreshTokenService.rotate` bu yüzden `noRollbackFor` ile işaretli;
  varsayılan davranışta hata transaction'ı geri alır ve iptaller kaybolurdu.
  İptal edilen satır silinmez, tespit iptal kaydının kalmasına bağlı.
- **Eşzamanlı yenileme yarış durumu.** Refresh cookie'si tarayıcının tüm
  sekmeleri arasında paylaşılıyor; iki sekme (ya da React StrictMode'un
  çift efekti) aynı anda yenileyebiliyor. Naif kurgu ya iki geçerli token
  üretiyordu ya da ikinci istek iptal edilmiş token görüp meşru kullanıcının
  tüm oturumlarını kapatıyordu. Üç parçalı çözüm:
  1. **Satır kilidi.** `rotate` token'ı
     `findForRotationByTokenHash` ile `PESSIMISTIC_WRITE` alarak okur,
     eşzamanlı rotasyonlar sıraya girer. Çıkış ve diğer okumalar kilitsiz.
  2. **İptal sebebi.** `refresh_token.revoked_reason` (`rotated`, `logout`,
     `reuse_detected`). Rotasyon normal akışın parçası, diğerleri değil.
  3. **Tolerans penceresi.** `REUSE_GRACE` = 10 saniye. Sebebi `rotated`
     olan bir iptal bu pencerede tekrar gelirse eşzamanlı istek sayılır:
     toplu iptal yok, sadece 401, log `debug`. İkinci istek tekrar
     denediğinde cookie'de birincinin yazdığı yeni token var, kayıp yok.
     Pencere dışındaki ya da sebebi `logout`/`reuse_detected` olan her
     tekrar gerçek yeniden kullanımdır: toplu iptal, 401, log `warn`.
  Frontend tarafında adım 6'da refresh çağrıları ayrıca tek uçuşa
  indirilecek (aynı anda en fazla bir istek, diğerleri onu bekler);
  buradaki sunucu tarafı önlem o olmadığında da doğru davranmak için.
- **Zaman bir bağımlılık.** `Clock` bean'i (`ClockConfig`) enjekte edilir,
  `OffsetDateTime.now()` doğrudan çağrılmaz. Tolerans penceresi saniyelerle
  ölçülüyor; testler gerçek zamanı bekleyemez.
- **Temizlik işi.** `RefreshTokenCleanupJob` günde bir, süresi dolalı 7
  günü geçmiş satırları siler. İptal edilmiş satırlar hemen silinmez —
  yeniden kullanım tespiti o kayda bakıyor.
- **Kutuyu kullanıcı belirler kararının karşılığı:** kimlik yalnızca
  senkron içindir. Uygulama hesapsız tam çalışır; `GET /api/health` ve
  `GET /api/questions` token istemez.
- **401'de yönlendirme yok.** Spring'in varsayılanı login sayfasına
  yönlendirmek; bir API'de bu fetch tarafında sessiz hataya dönüşüyor.
  Her yerde `{ "error": "unauthorized" }` dönülür
  (`JsonAuthenticationEntryPoint`).
- **İki filtre zinciri, iki oturum modeli.** `/oauth2/**` ve `/login/**`
  zincirinde session var, çünkü OAuth state/PKCE iki istek arasında
  saklanmak zorunda. Başarı anında success handler session'ı kapatır.
  Diğer her şey STATELESS. Üçüncü zincir `/api/events`'in; JWT hiç
  okumuyor (bkz. Kullanım ölçümü).
- **Geliştirmede tek origin.** Vite `/api`, `/oauth2`, `/login` yollarını
  8080'e proxy'ler ve `changeOrigin: false` bırakır: Host başlığı
  `localhost:5173` kalsın ki Spring GitHub'a gönderdiği `redirect_uri`'yi
  o adresle üretsin. Backend'de bunun karşılığı
  `server.forward-headers-strategy: framework`. Farklı portlar tarayıcı
  için iki ayrı site olurdu ve SameSite=Strict cookie gönderilmezdi.
- **E-posta alınmaz.** GitHub kapsamı `read:user`; eşleştirme `github_id`
  üzerinden yapılır çünkü kullanıcı adı değişebilir, sayısal kimlik
  değişmez. Her girişte kullanıcı adı tazelenir.
- **Kısa `JWT_SECRET` ile uygulama açılmaz.** En az 32 bayt şart;
  kontrol `JwtConfig`'te, sessizce zayıf imzaya düşmek yerine açılış durur.
- **`iss` doğrulanır.** Decoder `JwtValidators.createDefaultWithIssuer`
  ile `mulakat-slot` şartını koyar ve algoritma HS256'ya sabitlenmiştir.
  Aynı anahtarı kullanan başka bir servisin ürettiği token kabul edilmez.
- **`/error` herkese açık.** Bir uç hata verdiğinde konteyner isteği
  `/error`'a ERROR dispatch'iyle iletir ve güvenlik zinciri bunu da
  değerlendirir. Kapalı bırakılırsa herkese açık bir ucun 404'ü ya da
  500'ü 401'e dönüşür ve gerçek hata kaybolur.
- **Süresi dolmuş Bearer başlığı herkese açık uçlarda da 401 döndürür.**
  Authorization başlığı varsa doğrulama filtresi onu denemek zorunda ve
  başarısızlık yetkilendirme kurallarından önce gelir; `permitAll` devreye
  girmez. Yani `GET /api/questions` başlıksız 200, süresi dolmuş başlıkla
  401. Frontend 401 gördüğünde `/api/auth/refresh` ile yenileyip isteği
  bir kez tekrarlamalı (adım 6).
- **Bilinmeyen yollar da kimlik ister.** `anyRequest().authenticated()`
  bilinçli: token'sız bir istek olmayan bir uca gittiğinde 404 değil 401
  alır, böylece hangi uçların var olduğu sızmaz. 404'ü görmek için
  geçerli token gerekir.
- **GitHub token'ı el sıkışmadan sonra silinir.** GitHub API'si girişten
  sonra hiç çağrılmıyor; kimlik ve kullanıcı adı principal'da geliyor.
  Varsayılan `AuthenticatedPrincipalOAuth2AuthorizedClientRepository`
  kimliği doğrulanmış principal için token'ı `OAuth2AuthorizedClientService`'e
  (bellekte) yazıyor. `GithubAuthenticationSuccessHandler` bu yüzden
  `finally` içinde `removeAuthorizedClient` çağırıyor, hata olsa da token
  kalmıyor. Repository'yi değiştiren biri silmenin de nereden yapıldığına
  bakmalı; `GithubAuthenticationSuccessHandlerTest` bu bağlantıyı doğruluyor.
- **Hesap silme: `DELETE /api/me`.** Kimlik `jwt.sub`'dan gelir.
  `AppUserRepository.deleteByIdReturningCount` tek bir JPQL DELETE atar,
  ilerleme ve refresh token satırlarını DB'deki `ON DELETE CASCADE` siler
  (JPA cascade'ine güvenilmez). Yanıt her durumda 204 ve Max-Age=0 refresh
  cookie'si; kullanıcı zaten silinmişse de 204 (idempotent, ağ hatasından
  sonraki tekrar hata görmesin). Access token 15 dakika daha imza olarak
  geçerli kalır ama işe yaramaz: PUT ve merge `requireUser` (FOR UPDATE)
  ile, GET `existsById` ile 401 döner, `/api/auth/me` da 401. Kullanıcı
  hiçbir uçta yeniden oluşmaz; yalnızca GitHub ile yeniden giriş yeni bir
  hesap açar. Silme, kullanıcı satırında kilit tutan bir senkron varsa onun
  bitmesini bekler. Test: `AccountDeletionTest`.

## İlerleme senkronu

- **IndexedDB birincil, sunucu ikinci kopya.** Local-first kararının
  karşılığı: backend erişilemezken uygulama tam çalışır, senkron sessizce
  başarısız olur. `GET /api/progress`, `PUT /api/progress` (kısmi liste,
  tam değişim değil) ve `POST /api/progress/merge` (ilk girişte bir kez,
  birleşmiş tam sonucu döner).
- **box ve lastSeenAt için yeni kazanır, attempts HER ZAMAN birleşir.**
  attempts kullanıcının yazdığı cevapları tutuyor; en değerli veri o.
  "Eski kayıt" diye atılsaydı iki cihazda çalışan biri denemelerini
  kalıcı olarak kaybederdi. Birleştirme `at` alanına göre tekilleştirir,
  sıralar ve son `MAX_ATTEMPTS` tanesini tutar; `at`'i olmayan deneme
  atlanır (tekilleştirme de sıralama da ona dayanıyor). `at`,
  `Date#toISOString()` ile yazıldığı için sözlük sırası zaman sırasıdır.
- **Üç sayaç.** `applied` box+lastSeenAt yazıldı, `merged` kayıt eskiydi
  ama geçmiş birleşti, `ignored` hiçbir şey değişmedi. Üçü de normal
  sonuç, hata değil.
- **Değer ihlali kaydı atlatır, şekil ihlali 400 alır.** Tek bozuk kayıt
  tüm senkronu düşürmesin: aralık dışı `box`, bozuk tarih, 5000'i aşan
  cevap, eksik deneme alanı yalnızca o kaydı atlatır. Bilinmeyen
  `questionId` de atlanır (içerik sürümleri arasında fark olabilir), sayısı
  loglanır. `lastSeenAt` bu yüzden DTO'da `String`: Jackson ayrıştırsaydı
  bozuk bir tarih tüm isteği 400'e çevirirdi. Şimdiden 1 günden fazla ileri
  tarihler reddedilir — istemci saati yanlışsa sunucudaki doğruyu ezmesin.
  Denemede **bilinmeyen alan** ise değer değil sözleşme ihlali: tüm istek
  400 alır, hiçbir şey yazılmaz. Frontend buna takılmaz, Zod bilinmeyen
  alanları zaten atıyor.
- **Deneme tipi yalnızca API sınırında.** `ProgressAttempt` record'u
  gelen ve giden denemenin şekli; saklama, `ProgressState` ve birleştirme
  `Map` ile çalışır (`toStored`/`fromStored`). JSONB doğrudan record'a
  eşlenseydi şemaya uymayan eski bir satır okunurken hata verirdi —
  migration yapmadan canlı veriyi okunamaz kılmak olurdu. Yanıtta
  tanınmayan eski anahtarlar düşer.
- **Bilinmeyen alan `@JsonAnySetter` ile reddedilir,** sınıf seviyesinde
  `FAIL_ON_UNKNOWN_PROPERTIES` ile değil: Spring Boot bu özelliği global
  kapatıyor ve `@JsonIgnoreProperties(ignoreUnknown = false)` global ayarı
  geçersiz kılmıyor, yalnızca ona geri düşüyor. Global açmak katılığı her
  yere yayardı. `ProgressAttemptTest` bunu gevşek bir mapper'la doğruluyor.
- **Cevap en fazla 5000 karakter (UTF-16 birimi, JS `length` ile aynı).**
  Frontend'de cevap alanının `maxLength`'i ve senkron payload'u
  (`sync/syncPayload.ts`) bu sınırı uygular. `storeSchema`'ya BİLEREK
  konmadı: eski kayıtlardaki uzun cevaplar "bozuk" sayılır ve kurtarma akışı
  tetiklenirdi. Payload ayrıca NUL'ları çıkarır ve eşi olmayan
  surrogate'leri U+FFFD yapar; sunucu bunları içeren kaydı atlar, çünkü
  Postgres JSONB `\u0000`'ı reddediyor (yazma tüm senkronu 500'e
  düşürürdü) ve eşsiz surrogate geçerli UTF-8'e çevrilemiyor.
- **Cevap metni hiçbir koşulda loga yazılmaz.** `ProgressValidator` log
  yazmaz; atlanan kaydı sabit metinli bir nedenle (`Rejected`) döner,
  `ProgressSyncService` onu yalnızca `user_id`, `question_id` ve nedenle
  loglar. Bilinmeyen alan hatasının mesajında da değer yok (Spring onu WARN
  ile logluyor). `ProgressSyncTest` log çıktısını yakalayıp doğruluyor;
  yeni bir log satırı eklerken kayıttaki kullanıcı metnini koyma.
- **Yanıtta `lastSeenAt` UTC.** `toInstant().toString()` ile yazılır;
  sürücünün döndürdüğü yerel offset (`+03:00`) Zod'un `.datetime()`
  şemasından geçmez.
- **Kilit ilerleme satırında değil, `app_user` satırında.** Senkron yeni
  satır da ekliyor ve var olmayan satır kilitlenemez: iki sekme aynı
  soruyu ilk kez aynı anda gönderdiğinde satır kilidi hiçbir şeyi
  kilitlemez, ikisi de INSERT eder ve biri birincil anahtar çakışmasıyla
  düşer. `AppUserRepository.findForUpdateById` PESSIMISTIC_WRITE alır,
  kullanıcı başına senkronlar sıraya girer. "İdempotent, kilide gerek
  yok" yalnızca AYNI veri için doğruydu.
- **Karar ile yazma ayrı.** `ProgressMerger` saf: veritabanı, entity,
  repository ve Spring bilmez, yalnızca hangi durumun kazanacağına karar
  verir. `ProgressSyncService` transaction, kilit, okuma ve entity'ye
  yazmayı üstlenir. Birleştirme kuralları bu yüzden Testcontainers'sız
  test ediliyor (`ProgressMergerTest`); uçlar ve eşzamanlılık
  Testcontainers'ta kalıyor.
- **Yeni satır `entityManager.persist` ile girer.** Mevcut satırlar dirty
  checking ile güncelleniyor; `repository.save` ile karışık iki yaklaşım
  olmasın diye yeni satır da persistence context'e bırakılır, yazma anını
  flush belirler.
- **Frontend kuyruk TUTMAZ.** Hata durumunda sessiz kalınır: yerel veri
  zaten yazıldı, bir sonraki senkron `lastSeenAt` ile yakalar. Kuyruk
  tutulsaydı çevrimdışı kullanıcının kuyruğu sınırsız büyürdü.
  Zamanlayıcıyla periyodik senkron yok; üç tetik var: giriş (bir kez
  merge), RATE (tek soru) ve `visibilitychange: hidden`. Misafirde hiç
  istek atılmaz.
- **"Bir kez birleştir" güvencesi modül seviyesinde**, hook'ta değil —
  StrictMode efektleri iki kez çalıştırıyor (`authClient.bootstrap` da
  aynı sebeple orada). Yan faydası: React test kütüphanesi olmadan test
  edilebiliyor.
- **Merge sonucu yerele `{ ...local, ...merged }` yazılır.** Sunucu
  tanımadığı `questionId`'leri atlıyor; dönen listeyi olduğu gibi
  yazsaydık o sorulara ait yerel ilerleme silinirdi. Sunucunun bildiği
  her kayıt zaten yanıtta olduğu için üstte o kazanır.
- **Senkron oturuma yazılır, doğrudan diske değil.** `SYNC_PROGRESS`
  reducer eylemiyle; IndexedDB'ye yazmayı App'teki mevcut efekt zaten
  üstleniyor, doğrudan yazsaydı bir sonraki render onu bellekteki eski
  haliyle ezerdi.
- **Senkron göstergesi üst çubukta, sessiz.** `SyncIndicator`; kurallar
  saf durum makinesinde (`sync/syncIndicator.ts`, testli). Girişliyken
  hep soluk bir ikon (`--text-faint`), misafirde hiç çizilmez. Metin
  yalnızca gerektiğinde:
  - "Senkronlanıyor" (dönen ok): senkron 300 ms'yi aşarsa. Daha kısası
    hiç gösterilmez, her RATE'te titreme olmasın.
  - "Senkronlandı" (bulut-tik, 3 sn): YALNIZCA kullanıcı "Senkronlanıyor"u
    gördüyse ya da hatadan kurtulunduysa. Rutin hızlı senkronda metin çıkmaz,
    yalnızca ikon tike döner.
  - "Senkronlanamadı" (üstü çizili bulut): kalıcı, bir sonraki başarıda kalkar.
    Kısa bir yeniden deneme hata ikonunu titretmez.
  `--warn` kullanılmaz; hata ikonla ve `--text-dim` ile ayrışır — senkronun
  düşmesi arıza değil, yerel veri zaten yazıldı. Dönme animasyonu hareket
  azaltmada açıkça `animation: none`: tokens.css süreleri 1ms'ye indiriyor,
  sonsuz dönmeyi durdurmaz, hızlandırırdı. Canlı bölge (`aria-live="polite"`)
  görünür metinden ayrı ve yalnızca hataya girişte ve kurtuluşta değişir;
  "Senkronlanıyor" ve rutin başarılar okunmaz.
- **Senkron durumu snapshot, `lastSyncedAt` dahil.** `getSyncSnapshot()`
  `{ status, lastSyncedAt }` döner (aynı durum için aynı nesne),
  `useSyncSnapshot` ile okunur — App'ten prop olarak inmez. `lastSyncedAt`
  durumun parçası çünkü hızlı yanıtta syncing → idle tek render'da
  birleşebiliyor ve status önce/sonra aynı görünüyor; yeni başarı yalnızca
  bu değerin değişmesinden anlaşılıyor. Her başarıda kesin artar (aynı
  milisaniyedeki iki başarı da ayrı değer). `resetSync` onu da sıfırlar.
- **Hesap silinirken senkron askıda.** `suspendSync()` bir bayrak koyar ve
  uçuştaki istekler (`inFlightRequests`) bitince çözülür; bayrak açıkken
  `pushChanges` ve `syncAfterLogin` istek atmaz (visibilitychange de
  `pushChanges`'ten geçtiği için kapanır). `resumeSync()` yalnızca bayrağı
  kaldırır. Askıdayken `mergedUserId` kilitlenmez; askı kalkınca birleştirme
  yine çalışabilir.
- **Silme akışı `account/deleteAccount.ts`'te,** React bilmez; depo ve
  `reload` dışarıdan gelir. Sıra: askıya al ve bekle → `DELETE /api/me` →
  başarısızsa askıyı kaldır. Başarılıysa ve "bu cihazdaki verileri de sil"
  işaretliyse `storage.clear(STORE_NS)` BEKLENİR (store, ayarlar ve bozuk
  kayıt yedekleri aynı namespace'te), sonra sayfa yenilenir. Clear düşerse
  yenilenmez: yenilenseydi veri sessizce geri gelir, kullanıcı silindiğini
  sanırdı; bunun yerine "hesabın silindi ama bu cihazdaki veriler
  silinemedi" gösterilir. İşaretsizse askı kalkar; oturum anonim olduğu için
  istek gitmez, tekrar girişte yerel ilerleme yeni hesaba birleşir.
  Clear ile reload arasında diske yazan bir yol yok: yazma yalnızca store
  değişince App'teki efektten gidiyor (debounce/flush, pagehide ya da
  beforeunload yok) ve diyalog modal. Sayfa kapanışında yazan bir yol
  eklenirse bu akış yeniden düşünülmeli.
- **Diyalog AuthArea'da, oturum dallarının dışında.** Silme başarılı olunca
  durum anonime döner ve kullanıcı menüsü DOM'dan kalkar; diyalog onun
  içinde olsaydı sonucu gösteremeden kaybolurdu. Kapanınca odak
  "Giriş yap"a taşınır.

## Kullanım ölçümü (`analytics/`)

- **YAYIN ENGELLERİ.** İstemci tarafı ancak hepsi tamamlanınca yayına çıkar:
  - Gizlilik politikası (TR ve EN, `docs/gizlilik-politikasi.md` ve
    `privacy/`): güncellendi, 2a bölümü.
  - Play veri güvenliği formu: "Uygulama etkinliği → Uygulama
    işlemleri" ve "Cihaz veya diğer kimlikler" toplanıyor; paylaşılmıyor,
    aktarımda şifreli, kullanıcı kapatabiliyor.
  - Host nginx'teki `/api/events` bloğu (`access_log off`) uygulanmadan
    politika yayına alınmamalı; aksi halde "erişim kaydı tutulmaz" cümlesi
    yanlış olur. Politika sayfası frontend imajıyla birlikte kurulduğu için
    bu, dalın main'e birleşmesinden ÖNCE yapılır (`docs/deploy.md`).
  Metinlerde "anonim" değil, "hesabınla ilişkilendirilmeyen, rastgele
  kurulum kimliği" yazılır: kalıcı bir kimlik anonim değildir.
- **Hukuki dayanak: kapatma hakkı + meşru menfaat.** Bilinçli tercih:
  varsayılan açık, Ayarlar'dan kapatılır. AB'den anlamlı kullanıcı gelirse
  ilk açılış kartı açık rızaya çevrilecek.
- **Mağaza beyanı:** Play'de "Uygulama işlemleri" ve "Cihaz veya diğer
  kimlikler", App Store'da "Device ID" ve "Product Interaction"; ikisi de
  yalnızca Analytics, Not Linked, takip yok. `analytics_event` kullanıcı
  hesabıyla ya da başka bir tabloyla ilişkilendirilirse bu beyanlar
  (Apple'da "Linked to You", Play'de ilgili alanlar) güncellenmeli.
- **Hesapla hiçbir bağ yok.** `analytics_event`'te `user_id`, IP ve
  user-agent kolonu yok, `app_user`'a yabancı anahtar yok. Girişli web
  kullanıcısının olayları da bağlanmaz: `/api/events` kendi güvenlik
  zincirinde (`SecurityConfig.eventsFilterChain`) ve orada resource server
  yok, Bearer başlığı okunmaz. Controller'a principal parametresi
  eklenmez. Host nginx'te bu uçta `access_log off` ve X-Forwarded-For
  iletilmez (`docs/deploy.md`); IP backend'e de ulaşmaz.
- **Sözleşme.** Zarfta `installId`, `platform` (web/android/ios),
  `appVersion` (X.Y.Z); `events` 1–50 olay, her biri `eventId` (UUID),
  `name`, `occurredAt`, `props`. 202 `{accepted, skipped}`; zarf bozuksa
  400 `{"error":"invalid_batch"}`; sınır aşılırsa 429 + `Retry-After`,
  hiçbir şey yazılmaz.
- **Olaylar ve props tek yerde:** `EventPropsSchema`. Ad listesi V4'teki
  CHECK kısıtıyla aynı; olay eklenince yeni migration CHECK'i günceller.
  İstemci aynı şemayı kullanıyor. Cevap METNİ hiçbir olayda yok, yalnızca
  `answerLength`. `questionId` dar bir karakter kümesiyle sınırlı
  (`[A-Za-z0-9._-]{1,128}`): serbest metin bu tabloya girmesin.
- **Bilinmeyen props alanı sessizce atılır,** olay kabul edilir. İlerleme
  senkronundaki "denemede bilinmeyen alan → 400" kuralından bilerek farklı:
  orada sözleşme ihlali kullanıcı verisini bozabilir, burada yeni sürüm
  istemcinin eski sunucuya eklediği alan yüzünden ölçüm kaybolmasın.
  Eksik zorunlu alan, yanlış tip (ondalık ya da metin olarak sayı dahil),
  aralık dışı değer ise olayı atlatır.
- **Geçersiz olay batch'i düşürmez.** Atlanan olayların sayısı ve sabit
  metinli nedenleri `info` ile loglanır; installId, soru kimliği ya da
  başka bir istemci değeri loga yazılmaz (`AnalyticsEventEndpointTest`
  doğruluyor).
- **Zaman penceresi:** `occurredAt` en fazla 7 gün geçmişte (çevrimdışı
  kuyruk), en fazla 5 dakika ileride.
- **Idempotent.** `event_id` UNIQUE, `ON CONFLICT DO NOTHING`. Tekrar gelen
  olay `accepted`'a dahildir; istemci için başarılı sayılır.
- **Rate limit bellek içi** (`InstallRateLimiter`): kurulum başına 120,
  genel 6000 olay/dakika, sabit dakika penceresi. installId istemciden
  geldiği için kimlik döndüren biri kurulum sınırını atlar; IP tutmadığımız
  için tek önlem genel tavan. Yeniden başlatmada sıfırlanır; birden fazla
  instance olursa yeniden düşünülür.
- **CORS yalnızca bu uçta,** yalnızca `capacitor://localhost` ve
  `https://localhost`. Kaynak bean değil, zincire doğrudan veriliyor:
  bean olsaydı diğer zincirler ve MVC de bulabilirdi. Diğer uçlarda CORS
  izni yok (`AnalyticsCorsTest`). `Retry-After` expose edilir.
- **JPA değil JdbcClient.** IDENTITY id Hibernate'in toplu insert'ini
  kapatıyor ve uygulama bu tabloyu okumuyor; batch tek çok satırlı INSERT.
- **13 ay saklama** (`AnalyticsRetentionJob`, her gün 03:30, `occurred_at`).
  Politikaya yazılacak süre bununla aynı olmalı.
- **Analiz `docs/analytics/queries.sql`'de.** Gün uygulamadaki gibi 04:00'da
  döner (Europe/Istanbul). Leitner tamamlanma: o günkü `wasDue=true`
  `self_eval` ÷ günün ilk `app_open.dueCount`'u, tavan 1, `dueCount = 0`
  günleri hariç.
- **aliasResult'ta kırılma.** normalizeTr değişikliği (commit 5bcc44c, deploy
  tarihi: 2026-11-18) öncesindeki aliasResult değerleri karşılaştırmaya
  dahil edilmemeli: kelime içi tire ve alt çizgi o commit'ten sonra boşluk
  sayılıyor, aynı cevap daha sık "all" alıyor. Not `queries.sql`'in başında da var.

### İstemci (`src/analytics/`)

- **Şema tek yerde, backend'le birebir:** `domain/usageEvents.ts` (Zod).
  Backend'deki `EventPropsSchema` değişirse burası da değişir;
  `usageEvents.test.ts` backend testleriyle aynı sınır değerlerini dener.
- **Alanların kaynağı saf fonksiyonlar** (`domain/usageMetrics.ts`):
  - `dueCount`: çekilişin `isDue`'su ile; yalnızca içerikte bulunan ve seçili
    kategorideki sorular. Kapalı kategorinin kartı çekilişe girmiyor,
    sayılsaydı tamamlanma oranı yapay düşerdi.
  - `wasDue`: değerlendirmeden ÖNCEKİ kayıtla `isDue`; ilk kez görülen soru
    false (tekrar değil, tanıtım).
  - `box`: `nextBox` ile, reducer'ın RATE'iyle aynı (test karşılaştırıyor).
  - `aliasResult`: kullanıcının sonuç ekranında gördüğü seviye
    (`domain/conceptMatch.ts`, ScoreCard'ın alt yazısıyla ortak). Pas ya da
    boş cevap `skipped`. Metrik kullanıcının gördüğüyle kendi kararını
    karşılaştırıyor; iki yer ayrı hesaplarsa anlamını kaybeder.
- **Track çağrıları App'te:** `spin` spinKey efektinde (reducer çekilişi
  reddederse gitmez), `answer_submitted` `handleSubmit`'te, `self_eval`
  `handleRate`'te reducer'dan ÖNCE (önceki kutu ancak o an elde).
  `app_open` ve gönderim `useAnalytics`'te: açılışta bir kez (modül
  seviyesinde güvence, StrictMode), 30 dk'dan uzun arka plandan dönüşte;
  gönderim açılış, 60 sn aralık ve arka plana geçişte (`keepalive`).
- **Yerel kayıt ayrı namespace'te** (`slot-analytics`: `consent`, `install`,
  `queue`). Store bozulup kurtarma ayarları varsayılana döndürse kapatma
  tercihi kaybolurdu. Kayıt yoksa açık; kayıt var ama okunamıyorsa KAPALI.
  Hesap silmede "bu cihazdaki verileri de sil" kimliği ve kuyruğu siler,
  tercihi bırakır.
- **Kuyruğun tek kaynağı depo.** Her adım kilit içinde oku-değiştir-yaz
  (`platform/locks.ts`, Web Locks): web'de sekmeler aynı kuyruğu paylaşıyor,
  kilitsiz art arda olaylar birbirini eziyordu (test bunu yakaladı). Ağ
  isteği kilidin dışında. Kuyruktan yalnızca 202 ya da 400/413'te silinir;
  ağ hatasında aynı `eventId`'ler yeniden gider, backend ayıklar.
- **Kenar durumlar.** 7 günden eski olaylar gönderilmeden atılır (backend
  reddediyor, 1 saat pay). Gönderim başına en fazla 2 batch (backend sınırı
  dakikada 120). Cihaz saati 5 dk'dan fazla ileriyse backend olayları
  sessizce atlar; istemci bunu göremez, bilinen sınır.
- **Kapatma** kuyruğu ve kimliği siler, `generation` sayacıyla kapatmadan
  önce başlamış bir yazma da kuyruğu yeniden oluşturmaz. Yeniden açınca
  bir sonraki olayda yeni kimlik üretilir.
- **Hedef.** Web her zaman göreli `/api/events` (aynı origin, CORS yok).
  Native `VITE_API_BASE_URL`'den (`.env.production`). Native release
  build'inde olayların sunucuya ulaştığı elle doğrulanmalı. Değişken
  tanımsızsa analitik sessizce kapalıdır: anahtar ve kart da çizilmez.
- **Kimlik `platform/randomId.ts`'ten.** iOS'ta `capacitor://` güvenli bağlam
  sayılmayabilir ve `crypto.randomUUID` yalnızca orada var; yedek
  `getRandomValues` ile v4. Cihaz/reklam/hesap kimliği kullanılmaz.
- **Ölçüm uygulamayı bozmaz.** `track` senkron döner, hiçbir şey beklemez;
  dışa açık her fonksiyon hatayı yutar, geliştirmede yalnızca `console.warn`.

## Yapay zekâ değerlendirmesi — denendi, kaldırıldı

- **Ne denendi.** Sunucu tarafında sağlayıcıdan bağımsız bir
  değerlendirici (Gemini Interactions API ile): rubriğe göre kavram
  kararı, öğretici geri bildirim, devam sorusu; kullanıcı başına haftalık
  kota, hız sınırı, önbellek. Çalışan hali, testleriyle birlikte
  `experiment/ai-evaluation` dalında. Dal kalıcıdır, silinmez, main'e
  birleşmez.
- **Neden kaldırıldı.**
  1. Ücretsiz katmanda günlük sınır PROJE başına ve tüm kullanıcılar
     arasında paylaşılıyor (Flash günde 20, Flash-Lite günde 500 istek).
     Kullanıcı başına kota bununla tutarlı olamıyor: tek kullanıcı herkesin
     gününü bitirebiliyor.
  2. Ücretsiz katmanda gönderilen içerik sağlayıcı tarafından ürün
     geliştirmek için kullanılabiliyor; kullanıcının cevabını buna açmak
     onay ekranıyla bile iyi bir varsayılan değil.
  3. Kullanıcıların zaten kendi yapay zekâ araçları var.
- **Yerine: "Kendi yapay zekâna sor".** Sonuç panelinde, kavram
  çiplerinin altında ikincil bir bölüm; API çağırmaz. İstem soru,
  kullanıcının cevabı ve kriterlerden (kavram adı + ilk çapa cümlesi)
  oluşur; metni `domain/ownAiPrompt.ts` üretir (saf, testli). Model cevap
  isteme konmaz — istem kısa kalsın; isteyen yanında görüyor. Pas geçilen
  soruda bölüm yok. Arayüzde kelime "prompt" ("Promptu kopyala"), kodda
  ve yorumlarda "istem".
- **Hedefte açma.** ChatGPT, Claude, Gemini, Perplexity
  (`domain/aiTargets.ts`). Düğme aracı yeni sayfada açar, istem sorgu
  parametresiyle gider (`domain/aiHandoff.ts`); parametre yoksa (Gemini)
  ya da encode edilmiş URL 6000 karakteri aşarsa parametresiz açılır ve
  kullanıcı yapıştırır. 6000: nginx/Apache'nin 8 KB request line sınırının
  altında pay; bugünkü içerikte 600 karakterlik Türkçe cevapla en uzun URL
  ~3000. Hangi servisin parametreyi kabul ettiği değişebiliyor: her
  hedefin yanında "son elle doğrulama" notu var, emin olunmayan parametre
  yazılmaz. Marka logosu yok; eklenirse resmî marka kitlerinden,
  `AiTargetId` anahtarlı ayrı bir haritayla.
- **Kopya her durumda, sıra tek yerde.** İstem adreste gitse de panoya
  kopyalanır: servis parametreyi düşürebilir ya da girişe yönlendirip
  kaybedebilir. `platform/aiHandoff/handoff.ts`: kopya başlar (beklenmez),
  adres aynı tıklamada senkron açılır, sonra kopya beklenir — önce
  beklenseydi açılır pencere kullanıcı hareketi dışında kalırdı. Bu yüzden
  `handoff` tıklama işleyicisinden önünde `await` olmadan çağrılır.
- **Web ve native ayrı adapter** (`platform/aiHandoff/`, seçim
  `platform/index.ts`'te). Web: `writeText`, reddedince yalnızca belge
  hâlâ odaktaysa `execCommand` yedeği (yeni sekme öne geldiyse yedek ya
  çalışmaz ya da yalan söyler). Sıra `WEB_COPY_ORDER` sabitiyle
  "önce execCommand"a çevrilebilir; masaüstünde yeni sekme `writeText`'i
  düşürürse değişecek olan yalnızca o. Native: açma aynı `window.open`
  (Capacitor dış adresi sistem tarayıcısına verir, app-launcher yok);
  pano `@capacitor/clipboard`, çünkü açma uygulamayı arka plana atıyor ve
  WebView'in `writeText`'i odak ister, iOS'ta `capacitor://` güvenli bağlam
  sayılmayabilir. Paylaşım `@capacitor/share`. Eklentiler web bundle'ına
  girmez, native'de adapter oluşurken önceden yüklenir.
- **Düzen `canShare`'e göre.** Dokunmatik birincil işaretçide (mobil web)
  ve native'de önce "Paylaş" (birincil), "Promptu kopyala", sonra sade
  hedef düğmeleri; masaüstünde hedefler, altında "Promptu kopyala".
  "Promptu göster" hep açılabilir (readOnly, odakta tümü seçili); kopya
  düşerse kendiliğinden açılır. Hangi sonuçta ne söyleneceği saf
  `components/result/askOwnAiStatus.ts`'te: başarılı açılışta mesaj yok
  (kullanıcı başka sayfada, döndüğünde bayat olurdu), istem gitmediyse
  "yapıştırman yeterli", paylaşımdan vazgeçmek hata değil.
- **Geri getirmeden önce** yukarıdaki üç sebep yeniden değerlendirilir
  (ücretli katman, kendi anahtarını getirme vb.). Deney dalındaki CLAUDE.md
  sağlayıcıyla ilgili doğrulanmış bulguları (zaman aşımı, düşünme
  seviyeleri, token sınırı) içeriyor.

## Android sürümü

- **Sürümün tek kaynağı package.json.** `android/app/build.gradle`
  `versionName`'i oradan okur, `versionCode`'u türetir:
  `major*10000 + minor*100 + patch` (1.2.3 → 10203). Gradle dosyasına elle
  sürüm yazılmaz.
- **Sürüm artırma: `npm version patch|minor|major`.** package.json ve
  package-lock.json'ı günceller, commit ve `vX.Y.Z` etiketi atar (temiz
  çalışma ağacı ister; yalnızca dosyaları değiştirmek için
  `--no-git-tag-version`). Play aynı ya da daha küçük versionCode'u kabul
  etmez; her yüklemeden önce sürüm artar.
- minor ya da patch 99'u aşarsa ya da sürüm `X.Y.Z` değilse (ön sürüm
  etiketi dahil) derleme durur: 1.0.100 → 10100, 1.1.0 ile aynı kod olurdu.
- **Paket kimliği `com.meteucar.slot.app`, gerisi `com.meteucar.slot`.**
  `com.meteucar.slot` ilk Play konsolunda kilitli kaldı (yalnızca dahili
  testteydi, gerçek kullanıcı yok); uygulama başka bir hesaptan yeni
  kimlikle yayımlanıyor. Yalnızca `applicationId` değişti: namespace,
  `MainActivity`'nin paketi, `capacitor.config.ts` `appId`'si ve iOS bundle
  id'si `com.meteucar.slot`. Debug `com.meteucar.slot.app.debug` olur.
  `appId` yalnızca `cap add`'in tohumu; `cap sync` `applicationId`'ye
  dokunmaz. `android/` silinip `cap add android` yeniden çalıştırılırsa
  `applicationId` ve namespace `appId`'ye döner, `MainActivity` taşınır;
  elle geri alınır. Depo klasörü `Application Support/com.meteucar.slot`
  paket kimliği değil, uygulama deposundaki klasörün adı; değişmez
  (değişirse iOS'taki ilerleme görünmez olur).

## iOS sürümü

Kurulum ve yükleme adımları `docs/ios-release.md`'de; burada kararlar.

- **Derleme yalnızca Codemagic'te** (`codemagic.yaml`, elle tetiklenir).
  Geliştirme Windows'ta; Mac yok. Proje SPM (Capacitor 8'in varsayılanı):
  `cap add/sync ios` yalnızca dosya üretir, Windows'ta çalışır
  (`npm run ios:sync`). Capacitor 8 Xcode 26+ ister, CI ilk adımda
  doğrular.
- **Sürüm package.json'dan, build numarası TestFlight'taki son build + 1.**
  İkisi de CI'da archive'a derleme ayarı (`MARKETING_VERSION`,
  `CURRENT_PROJECT_VERSION`) olarak verilir; pbxproj'daki değerler
  kullanılmaz, elle yazılmaz. Android'in versionCode şeması burada yok:
  aynı sürümün ikinci test build'i aynı sayıyı alır ve Apple reddeder.
- **Ana ekranda "Slot", mağazada "Slot: Teknik Soru Pratiği".**
  `CFBundleDisplayName` "Slot" kalır; mağaza adı App Store Connect'te.
- **En düşük iOS 16.4.** Vite 8'in varsayılan hedefi `safari16.4`/`ios16.4`,
  Tailwind v4 de Safari 16.4+ istiyor; daha eski iOS'ta uygulama kurulur
  ama arayüz bozuk açılırdı. Düşürmek için önce `build.target` ve
  Tailwind'in desteği. Capacitor `Package.swift`'e deployment target'ın
  ana sürümünü yazar (`.v16`).
- **Yalnızca iPhone** (`TARGETED_DEVICE_FAMILY = 1`). iPad açılsa iPad
  ekran görüntüleri ve iPad çoklu görevi için her yön zorunlu olurdu.
  Yön Android'deki gibi serbest (dikey + iki yatay).
- **Gizlilik manifesti uygulama hedefinde** (`ios/App/App/PrivacyInfo.xcprivacy`).
  Capacitor çekirdeğinin manifesti boş; kullanılan eklentiler ve
  `ion-ios-filesystem` manifest getirmiyor, hepsi statik bağlandığı için
  beyan burada. Tek gerekçeli API dosya zaman damgası (`C617.1`): depo
  `Filesystem.readdir` çağırıyor, eklenti her dosyada `attributesOfItem`
  okuyor. **Yeni eklenti ya da native kod eklenince** Apple'ın "required
  reason API" listesine karşı kaynak yeniden taranır; eksik beyan yüklemeyi
  reddettirir.
- **`ITSAppUsesNonExemptEncryption = false`.** Uygulama yalnızca sistemin
  HTTPS'ini kullanıyor; kendi şifrelemesi olan bir kütüphane (SQLCipher
  vb.) gelirse bu beyan yeniden değerlendirilir.
- **Açılış ekranı storyboard, eklenti yok.** Zemin `#0b0f14`, ortada
  `LaunchIcon` (`npm run icons` üretir). Bu renk artık dört yerde:
  tokens.css `--bg`, `android/.../values/colors.xml`, capacitor.config.ts
  `backgroundColor`, `LaunchScreen.storyboard`. Şablonun beyaz zeminli
  Splash görselleri kaldırıldı.
- **Origin `capacitor://localhost`.** `server.iosScheme` "https"
  olamaz (WKWebView kendi şemasını bırakmıyor, Capacitor varsayılana
  düşüyor). Native'de depo dosya sistemi olduğu için origin ilerlemeyi
  etkilemez: `Directory.Library` → `Library/Application Support/com.meteucar.slot`;
  sistem burayı temizlemez, iCloud/cihaz yedeğine girer.
- **Pano yazımı `copyToClipboard`'dan** (`platform/index.ts`);
  `navigator.clipboard` doğrudan çağrılmaz. iOS'ta `capacitor://` güvenli
  bağlam sayılmayabilir, native'de `@capacitor/clipboard` kullanılır.
- **Bildirim kanalı yalnızca Android'de**
  (`platformFeatures.notificationChannels`). iOS eklentisi `createChannel`'ı
  reddediyor; kanal kurulmadan zamanlamaya geçilmediği için iOS'ta
  hatırlatıcı hiç kurulmuyordu. Kurmadan önce izne bakılır, izin istenmez:
  yedekten dönen açık ayar izin sorulmamış bir kurulumda bildirim kurmaz.
  Uygulama öndeyken iOS'ta hatırlatma yalnızca Bildirim Merkezi'ne düşer
  (`presentationOptions: ["list"]`).
- **Dış bağlantılar Safari'de.** `window.open` ve `target="_blank"`
  Capacitor'da `UIApplication.open`'a gider. Adres bir uygulamanın
  universal link'iyse (chatgpt.com, claude.ai) o uygulama açılabilir ve
  sorgu parametresi düşebilir; istem bu yüzden her durumda panoya da
  kopyalanıyor.
- **iOS dosyaları LF** (`.gitattributes`). `Package.swift` her sync'te LF
  ile yeniden yazılıyor; `autocrlf` CRLF çıkarsaydı içerik farkı olmadan
  değişmiş görünürdü (Android'deki gradle dosyalarında yaşanan sorun).

## Çalışma bölümü

Mimari ve yeni modüller sohbette yazılır. Claude Code mekanik işleri
yapar: kurulum, test düzeltme, tip hataları, lint, dosya taşıma,
içerik dosyalarını şemaya uydurma.
Backend işleri docs/roadmap-backend.md’deki fazlara göre yürür.
Kod yazmadan önce plan sun ve onay bekle; her adım ayrı commit olsun.
Sırlar asla repoya girmesin; yalnızca .env.example güncellensin.
VPS’e doğrudan bağlanma; sunucu değişiklikleri script ve CI üzerinden yapılsın.