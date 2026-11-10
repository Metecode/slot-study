#!/usr/bin/env bash
# Günlük veritabanı yedeği: pg_dump → restic → Cloudflare R2.
# Mimari ve kararlar: docs/backup.md.
#
# stdout'a yalnızca tek bir JSON satırı yazılır (çalışmanın sonucu); restic
# ve pg_dump'ın mesajları stderr'e gider. 0.5'teki "yedek 26 saattir yok"
# alarmı bu satırdaki event=backup, status=success'e bağlanacak.
#
# Ortam:
#   PGHOST, PGDATABASE, PGUSER, PGPASSWORD   pg_dump'ın bağlantısı
#   RESTIC_REPOSITORY, RESTIC_PASSWORD       restic repo'su ve şifresi
#   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY R2 (yerel dosya repo'sunda gerekmez)
#   BACKUP_FORCE_CHECK=1                     bütünlük kontrolünü pazar beklemeden yap
set -euo pipefail

# Snapshot'ların host alanı; forget gruplaması ve kilitlerin sahibi buna
# bakar. Compose'daki hostname ile aynı.
readonly SNAPSHOT_HOST=slot-backup
# 14 gün: gizlilik politikası yedekleri en fazla 15 gün tutacağımızı söylüyor.
readonly KEEP_WITHIN=14d
# Prune veya check başka bir çalışmanın kilidini görürse bu kadar bekler.
readonly LOCK_WAIT=5m

stage=start
snapshot_id=""
dump_bytes=""
added_bytes=""
check_result=skipped
restic_version=""

now_ms() {
    # busybox date milisaniye vermiyor; bash 5'in EPOCHREALTIME'ı veriyor.
    local t=${EPOCHREALTIME/[.,]/}
    echo $((t / 1000))
}
readonly started_ms=$(now_ms)

# Sonuç satırı. Boş değerler JSON'da null olur.
emit_result() {
    local status=$1 exit_code=$2
    jq -cn \
        --arg time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        --arg status "$status" \
        --arg stage "$stage" \
        --argjson exit_code "$exit_code" \
        --argjson duration_ms "$(($(now_ms) - started_ms))" \
        --arg snapshot_id "$snapshot_id" \
        --arg dump_bytes "$dump_bytes" \
        --arg added_bytes "$added_bytes" \
        --arg check "$check_result" \
        --arg restic_version "$restic_version" \
        'def nullable: if . == "" then null else . end;
         def number: if . == "" then null else tonumber end;
         {
           time: $time,
           event: "backup",
           status: $status,
           stage: $stage,
           exit_code: $exit_code,
           duration_ms: $duration_ms,
           snapshot_id: ($snapshot_id | nullable),
           dump_bytes: ($dump_bytes | number),
           added_bytes: ($added_bytes | number),
           check: $check,
           restic_version: ($restic_version | nullable)
         }'
}

on_exit() {
    local code=$?
    if [ "$code" -eq 0 ]; then
        emit_result success 0
    else
        [ "$stage" = check ] && check_result=failed
        emit_result failure "$code"
    fi
    exit "$code"
}
trap on_exit EXIT

stage=config
for name in PGHOST PGDATABASE PGUSER PGPASSWORD RESTIC_REPOSITORY RESTIC_PASSWORD; do
    if [ -z "${!name:-}" ]; then
        echo "Eksik ortam değişkeni: $name" >&2
        exit 2
    fi
done
# "restic 0.19.1 compiled with ..." → "0.19.1"
restic_version=$(restic version | awk '{print $2}')

# Repo yoksa bir kez oluşturulur. Yalnızca çıkış kodu 10 ("repo yok")
# init'e götürür: yanlış parola (12) ya da ağ hatasında init denenmez,
# hata olduğu gibi yükselir.
stage=init
if restic cat config >/dev/null 2>/tmp/restic-cat-config.err; then
    :
else
    rc=$?
    if [ "$rc" -ne 10 ]; then
        cat /tmp/restic-cat-config.err >&2
        exit "$rc"
    fi
    echo "Restic repo'su bulunamadı, oluşturuluyor." >&2
    restic init >&2
fi

# Dump diske yazılmadan restic'e akar. pg_dump sıfırdan farklı dönerse
# restic snapshot oluşturmaz ve hata verir: yarım dump başarılı sayılmaz.
# Düz SQL: restic kendisi sıkıştırıyor (zstd) ve günler arasında tekrar eden
# bölümleri tekilleştiriyor; pg_dump'ın kendi sıkıştırması ikisini de bozardı.
# --no-owner/--no-privileges: dump, rolleri farklı boş bir Postgres'e
# (geri yükleme provası) sorunsuz yüklensin.
stage=backup
summary=$(restic backup --json --quiet --retry-lock "$LOCK_WAIT" \
    --host "$SNAPSHOT_HOST" --tag postgres \
    --stdin-filename slot.sql \
    --stdin-from-command -- pg_dump --no-owner --no-privileges \
    | jq -c 'select(.message_type == "summary")')
snapshot_id=$(jq -r '.snapshot_id // empty' <<<"$summary")
dump_bytes=$(jq -r '.total_bytes_processed // empty' <<<"$summary")
added_bytes=$(jq -r '.data_added // empty' <<<"$summary")
if [ -z "$snapshot_id" ]; then
    echo "restic özetinde snapshot_id yok" >&2
    exit 1
fi

# Saklama. Host filtresi bilerek yok: elle başka yerden alınmış bir
# snapshot da 14 günü geçince silinsin.
# --max-unused 0: varsayılan (%5) kullanılmayan veriyi paketlerde bırakır;
# silinmiş bir hesabın satırları 15 günden uzun yaşayabilirdi.
stage=forget
restic forget --quiet --retry-lock "$LOCK_WAIT" \
    --keep-within "$KEEP_WITHIN" --prune --max-unused 0 >&2

# Haftalık bütünlük kontrolü: pazar günü (Europe/Istanbul) verinin
# rastgele %5'i R2'den indirilip okunur.
if [ "$(date +%u)" = 7 ] || [ "${BACKUP_FORCE_CHECK:-}" = 1 ]; then
    stage=check
    restic check --quiet --retry-lock "$LOCK_WAIT" --read-data-subset=5% >&2
    check_result=ok
fi

stage=done
