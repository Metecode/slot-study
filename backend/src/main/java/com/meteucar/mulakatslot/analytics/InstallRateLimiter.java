package com.meteucar.mulakatslot.analytics;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * /api/events için bellek içi, sabit dakika pencereli sınır.
 *
 * <p>İki sınır var. Kurulum başına sınır sıradan bir istemcinin hatalı
 * döngüsünü durdurur. Ama installId istemciden geliyor: her istekte yeni
 * kimlik üreten biri onu atlar. IP tutmadığımız için buna karşı tek önlem
 * genel tavan; aşılırsa herkes kısa süre 429 alır, istemciler kuyruğu tutup
 * sonra tekrar dener.
 *
 * <p>Dakika değişince bütün sayaçlar sıfırlanır: bellekte yalnızca o dakika
 * istek atmış kurulumlar durur, ayrı bir temizlik gerekmez. Sayaçlar yeniden
 * başlatmada sıfırlanır; tek instance için yeterli.
 *
 * <p>Sayılan, batch'teki olay sayısıdır (geçersizler dahil): sınır sunucunun
 * işlediği yükü korur.
 */
@Component
public class InstallRateLimiter {

    static final int DEFAULT_PER_INSTALL_PER_MINUTE = 120;
    static final int DEFAULT_GLOBAL_PER_MINUTE = 6000;

    private final Clock clock;
    private final int perInstallLimit;
    private final int globalLimit;

    private final Map<UUID, Integer> usedByInstall = new HashMap<>();
    private long currentMinute = Long.MIN_VALUE;
    private int usedGlobally;

    /** @param retryAfterSeconds izin verildiyse 0 */
    record Decision(boolean allowed, long retryAfterSeconds) {
    }

    @Autowired
    public InstallRateLimiter(Clock clock) {
        this(clock, DEFAULT_PER_INSTALL_PER_MINUTE, DEFAULT_GLOBAL_PER_MINUTE);
    }

    InstallRateLimiter(Clock clock, int perInstallLimit, int globalLimit) {
        this.clock = clock;
        this.perInstallLimit = perInstallLimit;
        this.globalLimit = globalLimit;
    }

    /**
     * Hepsi ya da hiçbiri: batch sığıyorsa olay sayısı iki sayaçtan da düşülür,
     * sığmıyorsa hiçbir şey düşülmez.
     *
     * <p>synchronized yeterli: kritik bölge birkaç map işlemi, ve iki sayacın
     * birlikte kontrol edilip düşülmesi gerekiyor.
     */
    synchronized Decision tryAcquire(UUID installId, int eventCount) {
        Instant now = clock.instant();
        long minute = now.getEpochSecond() / 60;
        if (minute != currentMinute) {
            currentMinute = minute;
            usedByInstall.clear();
            usedGlobally = 0;
        }

        int usedByThisInstall = usedByInstall.getOrDefault(installId, 0);
        if (usedByThisInstall + eventCount > perInstallLimit || usedGlobally + eventCount > globalLimit) {
            return new Decision(false, secondsUntilNextMinute(now));
        }
        usedByInstall.put(installId, usedByThisInstall + eventCount);
        usedGlobally += eventCount;
        return new Decision(true, 0);
    }

    /** Retry-After en az 1 sn: 0, istemcide hemen tekrar dene diye okunur. */
    private static long secondsUntilNextMinute(Instant now) {
        long remaining = 60 - (now.getEpochSecond() % 60);
        return Math.max(1, remaining);
    }

    /** Test için: bu dakika bellekte tutulan kurulum sayısı. */
    synchronized int trackedInstallCount() {
        return usedByInstall.size();
    }
}
