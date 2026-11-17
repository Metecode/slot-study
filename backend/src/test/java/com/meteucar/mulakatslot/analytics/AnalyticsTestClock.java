package com.meteucar.mulakatslot.analytics;

import com.meteucar.mulakatslot.auth.MutableClock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Analitik entegrasyon testlerinin ortak saati. Testler aynı yapılandırmayı
 * kullandığı için Spring context'i (ve Postgres konteynerini) paylaşıyorlar.
 *
 * <p>Rate limit dakika penceresiyle çalışıyor; testler her başta saati bir
 * dakika ilerletip temiz bir pencereyle başlar.
 */
@TestConfiguration(proxyBeanMethods = false)
class AnalyticsTestClock {

    @Bean
    @Primary
    MutableClock analyticsClock() {
        return new MutableClock(Instant.parse("2026-11-17T12:00:00Z"), ZoneOffset.UTC);
    }
}
