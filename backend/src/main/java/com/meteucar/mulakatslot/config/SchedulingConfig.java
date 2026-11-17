package com.meteucar.mulakatslot.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Zamanlanmış işleri açar: süresi dolmuş refresh token'larının temizliği
 * (RefreshTokenCleanupJob) ve 13 aydan eski kullanım olaylarının silinmesi
 * (AnalyticsRetentionJob).
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
