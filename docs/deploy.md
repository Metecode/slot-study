# Canlıya çıkış

Canlı adres: https://slot.meteucar.com

```
internet ──443──> host nginx (TLS)
                    ├─ /api/, /oauth2/, /login/ ──> 127.0.0.1:8082  backend  (konteyner 8080)
                    └─ /                         ──> 127.0.0.1:8081  frontend (konteyner 80)
                                                     backend ──> postgres (port açmaz)
```

- Image'lar GitHub Actions'ta derlenir, `ghcr.io/metecode/slot-frontend` ve
  `ghcr.io/metecode/slot-backend` olarak itilir. Etiket her zaman commit
  SHA'sıdır; `latest` kullanılmaz.
- Sunucuda build yapılmaz. `/opt/mulakat` altında yalnızca
  `docker-compose.prod.yml`, `.env` ve `deploy-history.txt` durur.
- Konteyner portları yalnızca `127.0.0.1`'e bağlıdır. Docker kendi iptables
  kurallarını yazdığı için `0.0.0.0`'a bağlanan port UFW'yi atlar; compose
  dosyasındaki port satırlarını değiştirirken buna dikkat et.

## Akış

| Tetik | Workflow | Ne yapar |
|---|---|---|
| PR (kod değişikliği) | `ci.yml` | Frontend: lint, typecheck, test, build. Backend: `./mvnw verify` (Testcontainers ile gerçek Postgres). |
| `main`'e push | `deploy.yml` | Testler → iki image'ı derle, ghcr.io'ya it → compose dosyasını scp ile kopyala → SSH ile `pull` + `up -d` → `/api/health` 200 dönene kadar 3 dk bekle. |

Testler geçmezse `build` ve `deploy` job'ları hiç çalışmaz. Yalnızca
`docs/` ya da `.md` değişen push'lar deploy tetiklemez.

`ci.yml` yalnızca ilgili yollar değişince çalışır. Branch protection'da
bu job'lar zorunlu kontrol yapılırsa, yalnızca doküman değiştiren bir PR
kontrolün gelmesini sonsuza kadar bekler; zorunlu yapmadan önce bunu
hesaba kat.

## GitHub secrets

Repo → Settings → Secrets and variables → Actions. Deploy job'u
`production` ortamında çalışır; secret'ları oraya da koyabilirsin, o zaman
ortama onay kuralı eklemek mümkün olur.

| Secret | İçerik |
|---|---|
| `VPS_HOST` | Sunucunun adresi (IP ya da alan adı). |
| `VPS_USER` | Deploy kullanıcısı. `docker` grubunda olmalı ve `/opt/mulakat`'a yazabilmeli. |
| `VPS_SSH_KEY` | Deploy kullanıcısına giriş yapan özel anahtarın tamamı (`-----BEGIN ...` satırları dahil). Yalnızca bu iş için üretilmiş, parolasız bir anahtar olsun. |
| `VPS_KNOWN_HOSTS` | Sunucunun host anahtarı satırları. Aşağıdaki gibi üretilir. |

`GITHUB_TOKEN` otomatik gelir, eklenmez. Image'ları itmek ve sunucunun
çekmesi için o kullanılır; sunucuda `docker login` sadece çekme süresince
açık kalır, ardından `docker logout` yapılır.

### VPS_KNOWN_HOSTS nasıl üretilir

`ssh-keyscan` çıktısına körü körüne güvenme — ağda biri araya girmişse
onun anahtarını sabitlemiş olursun. Önce parmak izini sunucunun kendisinde
(konsol ya da zaten güvendiğin bir oturum) al:

```sh
# sunucuda
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Sonra kendi makinende tara ve parmak izlerini karşılaştır:

```sh
ssh-keyscan -t ed25519 <VPS_HOST> > known_hosts.tmp
ssh-keygen -lf known_hosts.tmp
```

Eşleşiyorsa `known_hosts.tmp` içeriğini `VPS_KNOWN_HOSTS` secret'ına yapıştır.
SSH 22 dışında bir portta çalışıyorsa satır `[host]:port` biçiminde olmalı ve
workflow'a port eklenmesi gerekir.

Workflow `StrictHostKeyChecking=yes` ile bağlanır; sunucunun anahtarı
değişirse (yeniden kurulum gibi) deploy durur. Bu beklenen davranış: secret'ı
yeni parmak iziyle güncelle.

## İlk kurulum

Sunucu hazır sayılıyor: Debian 13, host nginx + TLS, Docker, deploy
kullanıcısı, `/opt/mulakat`. Kalan adımlar:

1. **GitHub OAuth uygulaması** (canlı için ayrı bir tane):
   - Homepage URL: `https://slot.meteucar.com`
   - Authorization callback URL: `https://slot.meteucar.com/login/oauth2/code/github`
2. **`/opt/mulakat/.env`** — `.env.example`'daki anahtarlar, canlı değerlerle:
   ```sh
   DB_NAME=mulakat_slot
   DB_USERNAME=mulakat_slot
   DB_PASSWORD=<openssl rand -base64 32>
   GITHUB_CLIENT_ID=<canlı OAuth uygulaması>
   GITHUB_CLIENT_SECRET=<canlı OAuth uygulaması>
   JWT_SECRET=<openssl rand -base64 48>
   APP_BASE_URL=https://slot.meteucar.com
   COOKIE_SECURE=true
   ```
   `DB_URL` yazılmaz; compose onu `postgres` servis adından üretir.
   Dosya yalnızca deploy kullanıcısı okuyabilsin: `chmod 600 .env`.
3. **Host nginx** backend'e giden bloklarda şu başlıkları iletmeli; Spring
   GitHub'a gönderdiği `redirect_uri`'yi bunlardan üretir
   (`server.forward-headers-strategy: framework`):
   ```nginx
   proxy_set_header Host              $host;
   proxy_set_header X-Forwarded-Proto $scheme;
   proxy_set_header X-Forwarded-Host  $host;
   proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
   ```
   Eksikse GitHub girişi `http://` ya da `127.0.0.1:8082` adresine dönmeye
   çalışır ve "redirect_uri mismatch" hatası verir.
4. **Secrets**'ı ekle (yukarıdaki tablo).
5. `main`'e push et ya da Actions → Deploy → "Re-run all jobs". İlk
   çalıştırmada Postgres volume'u oluşur, Flyway şemayı kurar, backend
   soruları yükler.
6. Doğrula:
   ```sh
   curl -i https://slot.meteucar.com/api/health
   ssh <VPS_USER>@<VPS_HOST> 'cd /opt/mulakat && docker compose -f docker-compose.prod.yml ps'
   ```
   `docker compose ps` çıktısında üç servis de `healthy` olmalı. Dışarıdan
   8081/8082'ye erişilemediğini de kontrol et:
   `curl -m 5 http://<VPS_HOST>:8082/api/health` zaman aşımına uğramalı.

## Geri alma

Her `up -d` sonrası SHA `deploy-history.txt`'nin sonuna eklenir. Son satır
şu an çalışan (ya da son denenen) sürüm, bir üstü ondan öncekidir. Hangi
SHA'ya döneceğini buradan bul:

```sh
tail -n 5 /opt/mulakat/deploy-history.txt   # en alttaki en yeni
```

### Yöntem 1 — Actions'ta önceki deploy'u yeniden çalıştır (önerilen)

1. GitHub → Actions → **Deploy** workflow'u.
2. Dönmek istediğin SHA'nın son **başarılı** çalıştırmasını aç.
3. Sağ üstte **Re-run jobs** → yalnızca **Sunucuya kur** job'ını seç
   ("Re-run all jobs" değil — o testleri ve image derlemesini boşuna
   tekrarlar).

Job o commit'in SHA'sıyla ve o commit'teki `docker-compose.prod.yml` ile
çalışır, taze bir `GITHUB_TOKEN` alır; image'lar ghcr.io'da durduğu için
sunucuda ne kadar eski olursa olsun çekilebilir. Sağlık kontrolü de yine
koşar ve SHA `deploy-history.txt`'ye yazılır. Sunucuda elle token
gerekmez.

GitHub bir çalıştırmayı yalnızca ilk çalıştığı tarihten sonraki 30 gün
içinde yeniden çalıştırmaya izin verir. Daha eski bir sürüm için
Yöntem 2'yi kullan.

### Yöntem 2 — sunucuda elle (image 7 gün içinde sunucudaysa)

Sunucudaki image'lar 7 günden eskiyse `docker image prune` ile silinir.
Hâlâ duruyorsa çekmeye gerek yok, doğrudan başlatılır:

```sh
cd /opt/mulakat
docker image ls 'ghcr.io/metecode/slot-*'    # eski SHA'nın etiketi listede mi?

PREV=<eski-sha>
IMAGE_TAG=$PREV docker compose -f docker-compose.prod.yml up -d
echo "$PREV" >> deploy-history.txt           # geri alma da geçmişe yazılır

curl -i https://slot.meteucar.com/api/health
```

**Image sunucuda yoksa elle pull token gerekir.** ghcr.io paketleri
private; deploy job'unun token'ı job bitince geçersiz olur ve sunucuda
kayıtlı bir kimlik bilgisi bırakılmaz. Bu durumda `up -d` image'ı
çekmeye çalışır ve yetki hatasıyla düşer. Elle çekmek için:

1. GitHub → Settings → Developer settings → Personal access tokens
   (classic) → yalnızca `read:packages` kapsamlı, kısa süreli bir token üret.
2. Sunucuda:
   ```sh
   docker login ghcr.io -u <github-kullanıcısı>   # parola olarak token
   IMAGE_TAG=$PREV docker compose -f docker-compose.prod.yml pull
   docker logout ghcr.io
   IMAGE_TAG=$PREV docker compose -f docker-compose.prod.yml up -d
   ```
3. İş bitince token'ı GitHub'dan sil.

Bu yolda sunucudaki `docker-compose.prod.yml` son deploy'un sürümüdür, eski
commit'inki değil. Compose dosyası iki sürüm arasında değiştiyse Yöntem 1'i
tercih et.

### Dikkat

- Geri alma yalnızca kodu geri alır, **veritabanını değil**. Flyway
  migration'ları ileri yönlüdür. Eski sürüm, yeni sürümün eklediği tablo ve
  kolonları görmezden gelir (Flyway gelecekteki migration'ları varsayılan
  olarak yok sayar), ama bir migration kolon silmiş ya da yeniden
  adlandırmışsa eski sürüm `ddl-auto: validate`'te açılmaz. Böyle bir
  migration'ı canlıya çıkarmadan önce geri dönüş yolunu düşün.
- Geri aldıktan sonra `main`'e yapılan ilk push tekrar en yeni sürümü kurar.
  Hatalı commit'i `git revert` ile düzeltip push etmek kalıcı çözümdür.
