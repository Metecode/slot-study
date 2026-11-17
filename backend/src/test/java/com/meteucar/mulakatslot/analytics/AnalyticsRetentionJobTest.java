package com.meteucar.mulakatslot.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.auth.MutableClock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

@Import({TestcontainersConfiguration.class, AnalyticsTestClock.class})
@SpringBootTest
class AnalyticsRetentionJobTest {

    @Autowired
    private AnalyticsRetentionJob retentionJob;

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private MutableClock clock;

    private OffsetDateTime now;

    @BeforeEach
    void setUp() {
        jdbcClient.sql("DELETE FROM analytics_event").update();
        now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    @Test
    void deletesEventsOlderThanThirteenMonthsAndKeepsTheRest() {
        insert("cok-eski", now.minusMonths(13).minusDays(1));
        insert("sinirda", now.minusMonths(13).plusSeconds(1));
        insert("yeni", now.minusDays(2));

        assertThat(retentionJob.deleteExpiredEvents()).isEqualTo(1);

        List<String> remaining = jdbcClient.sql("SELECT props->>'label' FROM analytics_event")
                .query(String.class).list();
        assertThat(remaining).containsExactlyInAnyOrder("sinirda", "yeni");
    }

    @Test
    void deletesNothingWhenEverythingIsRecent() {
        insert("yeni", now.minusMonths(12));

        assertThat(retentionJob.deleteExpiredEvents()).isZero();
    }

    /** Doğrulamayı atlayıp doğrudan yazıyoruz: burada önemli olan yalnızca occurred_at. */
    private void insert(String label, OffsetDateTime occurredAt) {
        jdbcClient.sql("""
                INSERT INTO analytics_event
                    (event_id, install_id, event_name, platform, app_version, occurred_at, props)
                VALUES (:eventId, :installId, 'app_open', 'web', '1.0.0', :occurredAt,
                        jsonb_build_object('label', CAST(:label AS text)))""")
                .param("eventId", UUID.randomUUID())
                .param("installId", UUID.randomUUID())
                .param("occurredAt", occurredAt)
                .param("label", label)
                .update();
    }
}
