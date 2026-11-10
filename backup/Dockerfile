# Yedek imajı: pg_dump + restic + supercronic.
# Bağlam backup/ klasörü (deploy.yml ve ci.yml'deki matris).
#
# Taban postgres:16-alpine: pg_dump sunucudaki Postgres'le aynı ana sürümde
# olmalı, daha eski bir pg_dump yeni sunucudan dump almayı reddeder.
# Sunucudaki sürüm yükseltilirse (docker-compose.prod.yml) bu satır da
# aynı commit'te yükselir.
FROM postgres:16-alpine

# İkili dosyalar GitHub sürümlerinden iner ve özetleri derlemede doğrulanır.
# apk ile sürüm sabitlemek Alpine'de kırılgan: eski paket sürümleri depodan
# kalkınca derleme düşer.
# restic en az 0.17 olmalı (--stdin-from-command ve çıkış kodu 10 "repo
# yok"); 0.19, --stdin-from-command'in takılıp kalmasını da düzeltiyor.
# Sürüm yükseltirken: restic özeti sürümün SHA256SUMS dosyasından;
# supercronic yalnızca SHA1 yayımlıyor, önce onu doğrula, sonra SHA256'yı
# kendin hesapla.
# VPS amd64: diğer iki imaj da yalnızca amd64 derleniyor ve orada çalışıyor.
ARG RESTIC_VERSION=0.19.1
ARG RESTIC_SHA256=f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c
ARG SUPERCRONIC_VERSION=0.2.51
ARG SUPERCRONIC_SHA256=cc232108374e8e2b537045f2d5eaa1229f619db314c3ba6a14d38b35dc0aa123

# jq: restic'in JSON özetini okuyup tek satırlık log üretmek için.
# tzdata: cron saati Europe/Istanbul'a göre çalışsın.
RUN apk add --no-cache ca-certificates jq tzdata \
 && apk add --no-cache --virtual .fetch curl \
 && curl -fsSL -o /tmp/restic.bz2 \
      "https://github.com/restic/restic/releases/download/v${RESTIC_VERSION}/restic_${RESTIC_VERSION}_linux_amd64.bz2" \
 && echo "${RESTIC_SHA256}  /tmp/restic.bz2" | sha256sum -c - \
 && bunzip2 -c /tmp/restic.bz2 > /usr/local/bin/restic \
 && chmod 755 /usr/local/bin/restic \
 && curl -fsSL -o /usr/local/bin/supercronic \
      "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
 && echo "${SUPERCRONIC_SHA256}  /usr/local/bin/supercronic" | sha256sum -c - \
 && chmod 755 /usr/local/bin/supercronic \
 && rm /tmp/restic.bz2 \
 && apk del .fetch

ENV TZ=Europe/Istanbul

# Restic önbelleği compose'daki restic_cache volume'una bağlanır; her
# çalışmada R2'den metadata indirilmesin. Klasör imajda postgres
# kullanıcısına ait olarak var olmalı: Docker yeni bir named volume'u
# bu klasörün sahipliğiyle oluşturur, yoksa root'a ait gelir ve yazılamaz.
ENV RESTIC_CACHE_DIR=/var/cache/restic
RUN install -d -o postgres -g postgres -m 700 /var/cache/restic

COPY --chmod=755 backup.sh /usr/local/bin/backup.sh

# Postgres sunucusu bu imajda çalışmıyor; tabanın giriş noktası sunucuyu
# başlatırdı. Yedek root yetkisi istemiyor.
USER postgres
ENTRYPOINT []
CMD ["restic", "version"]
