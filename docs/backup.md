# Veritabanı yedeği

Canlı Postgres her gece Cloudflare R2'ye şifreli olarak yedeklenir. Yerel
dump tutulmaz; tek yedek yolu R2. Kararların gerekçeleri CLAUDE.md'nin
"Yedek" bölümünde.

```
backup konteyneri (supercronic, her gün 03:30 Europe/Istanbul)
  └─ backup.sh
       ├─ restic cat config ─ repo yoksa (çıkış 10) → restic init
       ├─ restic backup --stdin-from-command -- pg_dump ──> postgres (iç ağ)
       │      └─ şifreli, sıkıştırılmış ve tekilleştirilmiş paketler ──> R2: slot-backups
       ├─ restic forget --keep-within 14d --prune --max-unused 0
       ├─ pazar: restic check --read-data-subset=5%
       └─ stdout: tek JSON satırı (event=backup)
```

| Parça | Yer |
|---|---|
| İmaj | `backup/Dockerfile` → `ghcr.io/metecode/slot-backup:<sha>`, diğer image'larla aynı deploy'da |
| Script | `backup/backup.sh` |
| Zamanlama | `backup/crontab` |
| Servis | `docker-compose.prod.yml` → `backup` |
| Yerel deneme | `backup/docker-compose.test.yml` |

- **RPO:** en fazla ~24 saat (gece yedeği arasında yazılan ilerleme). Yedek
  bir gece düşerse 48 saat.
- **RTO:** 0.3'teki geri yükleme provasıyla ölçülüp buraya yazılacak.

## Sırlar

Hepsi yalnızca sunucudaki `/opt/mulakat/.env`'de (`chmod 600`). Repoda
yalnızca `.env.example`'daki boş anahtarlar var.

| Değişken | İçerik |
|---|---|
| `RESTIC_REPOSITORY` | `s3:https://<account_id>.r2.cloudflarestorage.com/slot-backups` |
| `RESTIC_PASSWORD` | Repo şifresi. **Parola yöneticisinde de durmalı.** Sunucuyla birlikte kaybolursa R2'deki yedekler okunamaz, kurtarma yolu yok. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Yalnızca `slot-backups` bucket'ına **Object Read & Write** yetkili R2 API token'ı. Prune nesne sildiği için yazma yetkisi silmeyi de kapsamalı (R2'de kapsıyor). |

Bu dört değişken `.env`'de yoksa `docker compose up` durur ve deploy düşer.
Bu bilinçli: boş geçselerdi yedek her gece sessizce başarısız olurdu.

Backup konteyneri `env_file` kullanmaz; DB değişkenleri (`DB_NAME`,
`DB_USERNAME`, `DB_PASSWORD`) `PG*` adlarıyla, restic değişkenleri olduğu
gibi tek tek verilir. JWT ve GitHub sırları bu konteynere girmez.

İlk çalışmada restic bölge hatası verirse `.env`'e `AWS_DEFAULT_REGION=auto`
eklenir ve compose'daki `backup.environment`'a aynı satır yazılır.

## Sonuç satırı

Her çalışma stdout'a tek satır yazar; restic ve pg_dump mesajları stderr'e
gider.

```json
{"time":"2026-11-10T00:30:04Z","event":"backup","status":"success","stage":"done","exit_code":0,"duration_ms":4344,"snapshot_id":"c575c4b5…","dump_bytes":190019,"added_bytes":190325,"check":"skipped","restic_version":"0.19.1"}
```

| Alan | Anlam |
|---|---|
| `status` | `success` ya da `failure` |
| `stage` | Başarıda `done`; hatada düştüğü adım: `config` (eksik değişken), `init`, `backup`, `forget`, `check` |
| `exit_code` | Script'in çıkış kodu. Restic'in kodları korunur: 10 repo yok, 11 kilit alınamadı, 12 yanlış parola |
| `dump_bytes` | pg_dump çıktısının boyutu (restic `total_bytes_processed`) |
| `added_bytes` | Repo'ya eklenen yeni veri, sıkıştırmadan önce (restic `data_added`) |
| `check` | `skipped`, `ok` ya da `failed`. Kontrol pazar günleri çalışır. Kontrol düşerse snapshot alınmış olsa bile `status=failure` |

`added_bytes` küçük veritabanında her gün `dump_bytes`'a yakın çıkar: pg_dump
16.10'dan beri her dump'a rastgele bir `\restrict` anahtarı yazıyor ve dump
tek parça olduğu için tekilleştirilecek bir şey kalmıyor. Veritabanı büyüdükçe
yalnızca değişen parçalar eklenir.

0.5'te "yedek 26 saattir yok" alarmı `event=backup`, `status=success`
satırının yokluğuna bağlanacak. O güne kadar bildirim yok; durum loglardan
okunur.

## Sunucuda komutlar

Compose dosyası `IMAGE_TAG` istiyor; çalışan sürüm `deploy-history.txt`'nin
son satırı:

```sh
cd /opt/mulakat
dc() { IMAGE_TAG=$(tail -n1 deploy-history.txt) docker compose -f docker-compose.prod.yml "$@"; }
```

```sh
# Son çalışmaların sonuçları
dc logs backup | grep '"event":"backup"' | tail -n 5

# Elle yedek (çıktı terminale gelir, konteyner loguna düşmez)
dc exec backup backup.sh

# Bütünlük kontrolünü pazarı beklemeden yap
dc exec -e BACKUP_FORCE_CHECK=1 backup backup.sh

# Snapshot'lar ve repo boyutu
dc exec backup restic snapshots
dc exec backup restic stats --mode raw-data
```

Elle tetiklenen çalışmanın JSON satırı yalnızca terminale yazılır;
`dc logs`'ta ve 0.5'ten sonra Grafana'da görünmez.

## Acil geri yükleme (elle)

0.3'te bu adımlar repoda bir script olacak ve haftalık prova edilecek. O
zamana kadar canlı veritabanını en son snapshot'tan geri yüklemek için:

```sh
cd /opt/mulakat
dc stop backend                       # bağlantılar kapanmazsa dropdb düşer
dc exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
dc exec -T backup restic dump latest /slot.sql \
  | dc exec -T postgres sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
dc start backend
```

Belirli bir snapshot için `latest` yerine `restic snapshots`'taki kimlik
yazılır. Dump `flyway_schema_history`'yi de içerir; backend açılınca Flyway
yalnızca dump'tan sonraki migration'ları uygular.

## Eski cron'u kaldırma

Yeni yedek doğrulanana kadar sunucudaki eski `pg_dump` cron'u yerinde kalır.
Kaldırmadan önce:

1. `dc logs backup` en az iki gece üst üste `"status":"success"` göstermeli.
2. `dc exec backup restic snapshots` o geceleri listelemeli.
3. Bir snapshot'ın açıldığı görülmeli: `dc exec -T backup restic dump latest /slot.sql | head`
   ya da 0.3'teki prova.

Sonra:

1. Cron satırını bul ve sil: `crontab -e`, `sudo crontab -e` ya da
   `/etc/cron.d/` altındaki dosya. Hangisi olduğu
   `crontab -l; sudo crontab -l; ls /etc/cron.d /etc/cron.daily` ile görülür.
2. Eski dump dizinini sil. Gizlilik politikası yedekleri en fazla 15 gün
   tutacağımızı söylüyor; yerel dump'lar da buna dahil.
3. Kalan script dosyasını sil.

## Yerelde deneme

`backup/docker-compose.test.yml` geçici bir Postgres (5000 satırlık `demo`
tablosu) ve R2 yerine yerel dosya repo'su kurar. Sırlar sahte ve yalnızca o
dosyada. MinIO kullanılmıyor, çünkü hazır imajı artık yayımlanmıyor. S3/R2
yolunu canlıdaki ilk çalışma doğrular.

Git Bash'te önce `export MSYS_NO_PATHCONV=1` yapılmalı. Yapılmazsa
`/slot.sql` gibi argümanlar Windows yoluna çevrilir ve `restic dump` boş
döner.

```sh
C="docker compose -f backup/docker-compose.test.yml"

$C run --rm backup backup.sh                        # status=success, check=skipped
$C run --rm -e BACKUP_FORCE_CHECK=1 backup backup.sh  # check=ok
$C run --rm -e PGPASSWORD=yanlis backup backup.sh   # status=failure, stage=backup, snapshot yok
$C run --rm backup restic snapshots
$C run --rm -T backup restic dump latest /slot.sql | grep -cE '^[0-9]+'$'\t'   # 5000

$C up -d backup && $C logs -f backup                # supercronic'in açılışı
$C down -v                                          # her şeyi sil
```
