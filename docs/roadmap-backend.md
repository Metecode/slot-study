# Slot Backend Yol Haritası

Nov 10, 2026 · @Mete

## Amaç ve ilkeler

Slot'u, mevcut backend'in üzerine inşa ederek gerçek kullanıcılı, ölçülmüş ve işletilen bir sistem olarak backend portfolyosuna çevirmek. Kanıtlamak istediğimiz şey stack genişliği değil; karar verme, ölçme ve işletme yetkinliği.

**İlkeler**

- **Her teknoloji bir problemle girer.** Redis, kuyruk, arama motoru ancak Slot'ta somut bir ihtiyacı çözüyorsa eklenir; gerekçesi ADR'ye yazılır.
- **İddia değil ölçüm.** "Ölçeklenir" yerine yük testi sonucu, p95 gecikme, darboğaz ve çözüm.
- **Önce operasyon, sonra özellik.** Geri yüklenemeyen yedek yedek değildir; izlenmeyen sistem gerçek kullanıcıya açılmaz.
- **Maliyet düşük kalır.** Tek Netcup VPS, ücretsiz katmanlar; aylık maliyeti artıran her şey ayrıca tartışılır.
- **Kurul koşullarıyla hizalı.** Her faz ya ürünü "kullanılan ürün"e yaklaştırır ya da operasyonu sağlamlaştırır.

**Bilinçli olarak yapılmayanlar**

- Tek VPS'te üretim Kubernetes'i (ayrı lab reposunda öğrenilir).
- Elasticsearch ve vector DB (Postgres full-text search yeterli olduğu sürece).
- Slot içinde AI/RAG (maliyet nedeniyle zaten çıkarıldı).

&#91;embedded content: yol haritası · 7 faz\]

Faz 0 diğer her şeyin ön şartı; sonraki fazlar sırayla, her biri ayrı branch ve PR ile ilerler. Faz 0 şu an ertelendi; hangi durumda geri dönüleceği aşağıda, Faz 0'ın tetik listesinde.

## Mevcut durum

Backend tamamlanmış ve canlıda; eksik olan derinlik ve kanıt.

| Alan | Bugün |
| --- | --- |
| Uygulama | Spring Boot + PostgreSQL, aynı repoda `backend/` |
| Kimlik | GitHub OAuth; access token bellekte, refresh token httpOnly cookie |
| Senkron | Soru bazında `lastSeenAt` ile ilerleme senkronu (web) |
| Deploy | Netcup VPS, GitHub Actions → ghcr.io imajı → SSH deploy |
| Yedek | Günlük yerel `pg_dump` (cron); sunucu dışı kopya yok |
| İzleme | Yok |
| İstemciler | Web + Capacitor mobil (mobil v1 hesapsız, senkron v1.1'de) |

**Açık sorular**

- Entegrasyon testi ve migration aracı (Flyway/Liquibase) şu an var mı?
- API sözleşmesi (OpenAPI) üretiliyor mu?
- Google ile giriş eklenecek mi, ne zaman?

## Faz 0 — Operasyon temeli

Sistem çökerse veri kaybetmeden ve fark ederek geri dönebilmek. Mobil yayın öncesi zaten bekleyen işler; diğer fazların ön şartı.

**Durum: ertelendi (2026-11-11).** R2 ve Grafana işi şimdilik yapılmıyor.
Yarım kalan iş `feat/backend-faz-0` branch'inde, main'e birleşmeden saklanıyor:
restic → R2 yedek imajı, supercronic ile günlük yedek, canlı compose'daki
`backup` servisi, CI'da imaj derleme, `.env.example` değişkenleri ve
`docs/backup.md`. Geri yükleme provası, Actuator, izleme, alarmlar ve JSON
log başlamadı. Faza dönülünce branch güncel main'e rebase edilir.

**Tetik listesi** — aşağıdakilerden biri olursa Faz 0'a dönülür:

- Mobil v1.1 senkronu yayına hazırlanıyor: hesaplı mobil kullanıcıların
  verisi sunucuya girmeden önce sunucu dışı yedek ve geri yükleme provası
  hazır olmalı.
- Faz 2'ye (olay toplama) başlanıyor: bitti tanımı Grafana panellerine,
  dolayısıyla izlemeye dayanıyor.
- Canlıda veri kaybı, yedekten dönme ihtiyacı ya da kullanıcıdan önce fark
  edilmeyen bir kesinti yaşanıyor.
- Sunucu taşınıyor ya da Postgres ana sürümü yükseltiliyor: geri yükleme
  yolu o işten önce denenmiş olmalı.
- Gizlilik politikasındaki yedek ve saklama cümleleri, canlıdaki yedek
  düzeniyle artık örtüşmüyor.

**Kapsam**

- [ ] `pg_dump` cron'unu sağlamlaştır: sıkıştırma, 14 günlük saklama (gizlilik politikasındaki 15 gün sınırı), hata durumunda bildirim.
- [ ] Sunucu dışı kopya: Cloudflare R2'ye şifreli yükleme (`restic`, compose içinde ayrı backup servisi).
- [ ] Geri yükleme provası: boş bir Postgres container'ına R2'deki son yedeği yükle, satır sayılarını doğrula; script olarak repoda dursun.
- [ ] Spring Boot Actuator: health, readiness, Micrometer metrikleri.
- [ ] İzleme: Grafana Cloud ücretsiz katman; VPS'te Grafana Alloy ajanı metrik ve logları gönderir (karar: 2026-11-10).
- [ ] Temel alarmlar: servis düştü, 5xx oranı arttı, disk %80, yedek 26 saattir yok.
- [ ] Yapılandırılmış log (JSON) ve istek bazında correlation id.

**Bitti tanımı:** Yedekten geri yükleme bir komutla çalışıyor ve süresi ölçülmüş (RTO/RPO README'de yazılı); servis düşünce bildirim geliyor.

**CV'ye yazılacak:** "Yedekleme, sunucu dışı kopya ve test edilmiş geri yükleme süreci; Prometheus/Grafana ile izleme ve alarm."

## Faz 1 — Test ve sözleşme disiplini

Sonraki fazlarda güvenle değişiklik yapabilmek için güvenlik ağı. Takım liderinin repoda ilk baktığı yer burası.

**Kapsam**

- [ ] Şema değişiklikleri Flyway migration'larıyla; `ddl-auto` kapalı.
- [ ] Testcontainers ile gerçek Postgres'e karşı entegrasyon testleri (auth, senkron, yetki sınırları).
- [ ] springdoc ile OpenAPI; `/v3/api-docs` CI'da artefakt olarak saklansın, frontend tipleri buradan üretilebilsin.
- [ ] Hata modeli: RFC 9457 Problem Details, tutarlı hata kodları.
- [ ] CI: test + coverage raporu + imaj build; PR'da kırmızıysa merge yok.
- [ ] Güvenlik taraması: Dependabot + OWASP dependency-check veya Trivy (imaj).

**Bitti tanımı:** `./mvnw verify` temiz makinede Docker dışında hiçbir şey gerektirmeden geçiyor; README'de CI ve coverage rozetleri var.

**Mülakat konusu:** Neden H2 değil Testcontainers; migration geri alma stratejisi; token yenilemenin test edilmesi.

## Faz 2 — Anonim metrik ve olay toplama

Kurulun ilk koşulu: aktif kullanıcı, 7/30 gün geri dönüş ve Leitner tamamlanma oranını ölçmek. Hesapsız mobil kullanıcılar dahil, kişisel veri tutmadan.

**Kapsam**

- [ ] Olay şeması: `app_open`, `spin`, `answer_submitted`, `self_assessed`, `review_completed`; her olayda istemcide üretilen rastgele cihaz kimliği (ad/e-posta yok).
- [ ] `POST /events` toplu uç: istemci olayları biriktirip toplu gönderir; çevrimdışıyken kuyrukta bekler.
- [ ] Idempotency: olay başına `eventId`, tekrar gönderimde çift kayıt yok.
- [ ] Yazma yolu: tek tabloya toplu insert, zaman bazlı partitioning (aylık) ve saklama süresi.
- [ ] Rollup: gecelik job ile günlük aktif cihaz ve cohort tabloları; dashboard bunları okur.
- [ ] Cevap kontrolü ölçümü: alias eşleşmesi ile kullanıcının öz-değerlendirmesi ne sıklıkla uyuşuyor.
- [ ] Uygulamada açık "anonim kullanım istatistiği" ayarı ve gizlilik politikasına ekleme.

**Bitti tanımı:** Grafana'da DAU, 7/30 gün retention ve Leitner tamamlanma oranı panelleri canlı veriyle çalışıyor.

**Mülakat konusu:** Partitioning, idempotent ingestion, at-least-once teslimat, KVKK açısından veri minimizasyonu.

## Faz 3 — Yük testi, performans ve ADR'ler

"100 bin kullanıcı" iddiasının dürüst versiyonu: tek VPS'in sınırını ölçmek, darboğazı bulmak, düzeltip tekrar ölçmek.

**Kapsam**

- [ ] k6 senaryoları repoda (`load/`): giriş + senkron, olay gönderimi, soru çekme; ramp-up profilleri.
- [ ] Ölçüm: RPS, p50/p95/p99, hata oranı; VPS CPU/RAM ve Postgres bağlantı havuzu Grafana'da yan yana.
- [ ] Darboğaz analizi: `EXPLAIN ANALYZE`, eksik index, N+1, HikariCP havuz boyutu, JVM bellek ayarı.
- [ ] Her iyileştirme öncesi/sonrası sayılarla `docs/perf.md`'ye.
- [ ] Arama: soru bankasında Postgres full-text search (Türkçe yapılandırma) + `pg_trgm`; Elasticsearch'e neden gerek olmadığı ölçümle gösterilir.
- [ ] ADR klasörü (`docs/adr/`): ilk kayıtlar — monorepo, Postgres FTS vs Elasticsearch, tek VPS vs K8s, token saklama modeli, local-first mimari.

**Bitti tanımı:** README'de "tek 4 vCPU VPS'te X RPS'te p95 Y ms" cümlesi, grafiği ve bulunan en az bir darboğazın hikâyesi var.

**Mülakat konusu:** Kapasite planlama, index seçimi, bağlantı havuzu, "ölçeklemeyi neden şimdi yapmadım".

## Faz 4 — Topluluk soruları, Redis ve outbox

Kurulun "kopyalanamaz varlık" önerisi: geliştiricilerin şirket/rol etiketiyle bildirdiği "bana bu soruldu" akışı. Redis ve olay mimarisi burada gerçek bir sebeple girer.

**Kapsam**

- [ ] Veri modeli: soru, şirket, rol, seviye, mülakat tarihi (ay), bildiren kullanıcı; mükerrer soruları birleştirme.
- [ ] Oylama ("bana da soruldu") ve moderasyon kuyruğu: yeni gönderi onaylanana kadar yayında değil; moderatör rolü ve yetkilendirme.
- [ ] Redis ile rate limiting (gönderi/oy başına, kullanıcı ve IP bazlı) ve popüler şirket listeleri için cache.
- [ ] Transactional outbox: onaylanan gönderi aynı transaction'da `outbox` tablosuna yazılır; poller olayı işler (bildirim, sayaç güncelleme). İhtiyaç büyürse Kafka/Redpanda'ya geçiş ADR ile.
- [ ] Spam koruması: hesap yaşı şartı, basit içerik filtreleri.
- [ ] Lisans: topluluk verisinin lisansı ve katkı koşulları ayrı dosyada (kurul notu).

**Bitti tanımı:** Bir kullanıcı soru gönderiyor, moderatör onaylıyor, soru şirket filtresiyle görünüyor; rate limit k6 ile doğrulanmış.

**Mülakat konusu:** Outbox ve dual-write problemi, rate limiting algoritmaları (token bucket, sliding window), cache invalidation, rol tabanlı yetki.

## Faz 5 — Mülakat tarihli Leitner, bildirim ve senkron

Teklifi sonuca bağlamak ("X tarihindeki mülakata 7 günlük hazırlık") ve mobil v1.1 senkronunu sağlam kurmak.

**Kapsam**

- [ ] Hazırlık planı: kullanıcı mülakat tarihini ve hedef şirket/rolü girer; sunucu Leitner aralıklarını o tarihe sıkıştıran günlük plan üretir.
- [ ] Zamanlanmış işler: ShedLock ile tek seferlik çalışan job'lar; saat dilimi (Europe/Istanbul) ve gün sınırı testleri.
- [ ] Bildirim: web push ve FCM/APNs; gönderim olayları outbox üzerinden, tekrar denemeli ve idempotent.
- [ ] Senkron v2: çevrimdışı mobil + web aynı soruyu değiştirdiğinde çakışma kuralı (alan bazlı last-write-wins veya Leitner kutusu için "en ileri ilerleme kazanır"), sürüm numarası ve delta senkron.
- [ ] Google ile giriş ve mobilde hesap silme akışı (Apple 5.1.1(v)).

**Bitti tanımı:** İki cihazda çevrimdışı yapılan çalışmalar birleştiğinde veri kaybı yok (entegrasyon testiyle); hatırlatma bildirimi doğru saatte bir kez geliyor.

**Mülakat konusu:** Çakışma çözümü, saat ve zaman dilimi tuzakları, dağıtık job kilitleme, push teslim garantileri.

## Faz 6 — Altyapı kod olarak ve K8s lab

DevOps tarafını gösterir; üretimi gereksiz karmaşıklaştırmadan.

**Slot reposunda (üretim)**

- [ ] Ansible playbook (`infra/ansible/`): kullanıcı ve SSH sertleştirme, firewall (ufw), fail2ban, Docker, nginx + TLS, Postgres, yedek cron'ları, izleme stack'i.
- [ ] Sıfır bir VPS'i tek komutla Slot çalışır hale getirme provası; süresi README'de.
- [ ] Gizli bilgiler: Ansible Vault veya SOPS; repoda düz metin sır yok.
- [ ] Sıfır kesinti deploy: iki container + nginx ile blue-green ya da health check'li rolling.

**Ayrı repo: `slot-k8s-lab` (öğrenme)**

- [ ] k3s (veya yerelde kind) üzerinde Slot backend + Postgres için Helm chart.
- [ ] Readiness/liveness, HPA, ConfigMap/Secret, Ingress.
- [ ] İsteğe bağlı: Terraform ile geçici bir bulut VM'i açıp kapatma.
- [ ] README'nin ilk paragrafı: "Üretimde neden kullanmıyorum" (tek VPS, maliyet, operasyon yükü).

**Bitti tanımı:** Yeni bir VPS'te `ansible-playbook site.yml` + geri yükleme scripti ile Slot veriyle birlikte ayağa kalkıyor.

## Repo vitrini

Takım lideri repoya 2–3 dakika bakar; bu sürede mimariyi, kararları ve kanıtı görmeli.

**README sırası**

1. Tek cümle: ne, kim için, canlı link ve mağaza linkleri.
2. Mimari diyagram (istemciler → nginx → Spring Boot → Postgres/Redis, yedek → R2, izleme).
3. Sayılar: kullanıcı/retention (izin verilen ölçüde), yük testi sonucu, RTO/RPO.
4. Öne çıkan mühendislik kararları: ADR linkleriyle 4–5 madde.
5. Çalıştırma: `docker compose up` ve test komutu.
6. Operasyon: runbook, yedek/geri yükleme, izleme ekran görüntüsü.

**Repo hijyeni**

- Anlamlı commit geçmişi (Conventional Commits), PR açıklamaları, issue'larla takip edilen fazlar (GitHub Projects).
- `docs/` altında `adr/`, `perf.md`, `runbook.md`, olursa `postmortems/`.
- Sürüm etiketleri ve CHANGELOG.

**CV maddeleri (fazlar bittikçe doldurulacak)**

- Spring Boot + PostgreSQL backend'i tek VPS'te işletiyorum; Testcontainers, Flyway, OpenAPI ve CI/CD ile.
- k6 ile yük testi; p95 gecikmeyi X ms'den Y ms'ye indiren index/havuz iyileştirmeleri.
- Transactional outbox, Redis rate limiting ve idempotent olay toplama.
- Ansible ile tekrarlanabilir altyapı, R2'ye şifreli yedek ve test edilmiş geri yükleme.

## Claude Code çalışma şekli ve ilk prompt

Kararlar bu projede sohbette alınır; kod VS Code'da Claude Code'a verilen prompt'larla, faz başına ayrı branch'te yazılır.

**Her faz için akış**

1. Fazın kapsamı ve açık soruları sohbette netleşir.
2. Claude Code'a faz prompt'u verilir; önce plan sunar, onay bekler.
3. Küçük adımlarla, her adım ayrı commit; `feat/backend-faz-N` branch'i.
4. Faz sonunda "bitti tanımı" kontrol edilir, README/ADR güncellenir, PR ile main'e alınır.

**Faz 0 başlangıç prompt'u**

```markdown
Slot reposunda backend/ altında Spring Boot + PostgreSQL uygulaması var; Netcup VPS'te docker ile çalışıyor ve günlük yerel pg_dump cron'u var.

Görev (Faz 0 — operasyon temeli), feat/backend-faz-0 branch'inde:
1. Mevcut yedek script'ini ve deploy yapısını incele, bulduklarını özetle.
2. Şu işler için adım adım bir plan sun, kod yazmadan önce onayımı bekle:
   - pg_dump'a sıkıştırma, saklama politikası (7 günlük + 4 haftalık) ve hata bildirimi
   - Cloudflare R2'ye şifreli sunucu dışı kopya (restic veya rclone; seçimini gerekçelendir)
   - Boş bir Postgres container'ına geri yükleme yapan ve satır sayılarını doğrulayan script
   - Spring Boot Actuator + Micrometer metrikleri, JSON log ve correlation id
   - VPS'e Grafana Alloy ajanı (docker compose) ile metrik ve logları Grafana Cloud ücretsiz katmana gönderme, temel alarmlar
3. Sırları repoya yazma; .env.example ile belgeleri güncelle.
Her adımı ayrı commit olarak at.
```

**Karar:** İzleme için Grafana Cloud ücretsiz katman seçildi: maliyet yok, limit aşımı faturalanmıyor, VPS çökse de alarm dışarıdan geliyor. Self-hosted Prometheus Faz 6 K8s lab'ında öğrenilecek.
