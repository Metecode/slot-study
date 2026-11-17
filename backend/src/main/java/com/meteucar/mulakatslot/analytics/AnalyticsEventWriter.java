package com.meteucar.mulakatslot.analytics;

import com.meteucar.mulakatslot.analytics.EventValidator.AcceptedEvent;
import com.meteucar.mulakatslot.analytics.EventValidator.BatchHeader;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.StringJoiner;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Olayları tek bir çok satırlı INSERT ile yazar.
 *
 * <p>JPA değil JdbcClient: id IDENTITY olduğu için Hibernate toplu insert'i
 * kapatıp satır başına bir sorgu atardı, ve bu tabloyu uygulama hiç okumuyor;
 * entity'nin bir karşılığı yok.
 *
 * <p>Tekrar gelen eventId ON CONFLICT DO NOTHING ile sessizce geçilir: ağ
 * hatasından sonra istemci aynı batch'i yeniden gönderebilir.
 */
@Component
class AnalyticsEventWriter {

    private final JdbcClient jdbcClient;
    private final JsonMapper jsonMapper;

    AnalyticsEventWriter(JdbcClient jdbcClient, JsonMapper jsonMapper) {
        this.jdbcClient = jdbcClient;
        this.jsonMapper = jsonMapper;
    }

    /** @return gerçekten eklenen satır sayısı (tekrarlar hariç) */
    int insert(BatchHeader header, List<AcceptedEvent> events, Instant receivedAt) {
        if (events.isEmpty()) {
            return 0;
        }

        // Olay sayısı en fazla 50 (EventValidator.MAX_EVENTS_PER_BATCH);
        // parametre sayısı Postgres'in sınırının çok altında.
        StringJoiner rows = new StringJoiner(", ");
        for (int i = 0; i < events.size(); i++) {
            rows.add("(:eventId" + i + ", :installId, :name" + i + ", :platform, :appVersion, :occurredAt" + i
                    + ", :receivedAt, CAST(:props" + i + " AS jsonb))");
        }
        String sql = "INSERT INTO analytics_event "
                + "(event_id, install_id, event_name, platform, app_version, occurred_at, received_at, props) "
                + "VALUES " + rows
                + " ON CONFLICT (event_id) DO NOTHING";

        JdbcClient.StatementSpec statement = jdbcClient.sql(sql)
                .param("installId", header.installId())
                .param("platform", header.platform())
                .param("appVersion", header.appVersion())
                .param("receivedAt", OffsetDateTime.ofInstant(receivedAt, ZoneOffset.UTC));
        for (int i = 0; i < events.size(); i++) {
            AcceptedEvent event = events.get(i);
            statement = statement
                    .param("eventId" + i, event.eventId())
                    .param("name" + i, event.name())
                    .param("occurredAt" + i, OffsetDateTime.ofInstant(event.occurredAt(), ZoneOffset.UTC))
                    .param("props" + i, jsonMapper.writeValueAsString(event.props()));
        }
        return statement.update();
    }
}
