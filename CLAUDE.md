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
- `prefers-reduced-motion` her animasyonda kontrol edilir.
- Animasyon atlanabilir olmalı; kullanıcı 40. soruda beklemek istemez.

## Bu repo'da yapılmayacaklar

- Three.js veya WebGL. Makine CSS 3D ve SVG ile çizilir.
- localStorage'a JWT yazma.
- Soru içeriğini başka sitelerden kopyalama. İçerik özgün yazılır,
  `source` alanında türetildiği konu belirtilir.

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
  Diğer her şey STATELESS.
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

## Çalışma bölümü

Mimari ve yeni modüller sohbette yazılır. Claude Code mekanik işleri
yapar: kurulum, test düzeltme, tip hataları, lint, dosya taşıma,
içerik dosyalarını şemaya uydurma.
