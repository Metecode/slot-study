package com.meteucar.mulakatslot.analytics;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 13 aydan eski kullanım olaylarını siler.
 *
 * <p>13 ay: yıllık karşılaştırma (bu ay ile geçen yılın aynı ayı) için
 * gereken en kısa süre. Gizlilik politikasındaki süre bununla aynı olmalı.
 *
 * <p>occurred_at'e göre: doğrulama onu en fazla 7 gün geriye kabul ettiği
 * için received_at'ten sapması küçük. Silme günlük bir tam tarama; bu hacimde
 * sorun değil, büyürse aylık partition'a geçilir (yol haritası, Faz 2).
 */
@Component
public class AnalyticsRetentionJob {

    static final int RETENTION_MONTHS = 13;

    private static final Logger log = LoggerFactory.getLogger(AnalyticsRetentionJob.class);

    private final JdbcClient jdbcClient;
    private final Clock clock;

    public AnalyticsRetentionJob(JdbcClient jdbcClient, Clock clock) {
        this.jdbcClient = jdbcClient;
        this.clock = clock;
    }

    /** Günde bir; refresh token temizliğinden (03:00) yarım saat sonra. */
    @Scheduled(cron = "0 30 3 * * *")
    public int deleteExpiredEvents() {
        OffsetDateTime cutoff = OffsetDateTime.now(clock.withZone(ZoneOffset.UTC)).minusMonths(RETENTION_MONTHS);
        int deleted = jdbcClient.sql("DELETE FROM analytics_event WHERE occurred_at < :cutoff")
                .param("cutoff", cutoff)
                .update();
        if (deleted > 0) {
            log.info("Saklama: {} tarihinden eski {} kullanım olayı silindi", cutoff, deleted);
        }
        return deleted;
    }
}
