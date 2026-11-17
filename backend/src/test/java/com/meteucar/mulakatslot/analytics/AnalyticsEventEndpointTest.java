package com.meteucar.mulakatslot.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.auth.AccessTokenService;
import com.meteucar.mulakatslot.auth.MutableClock;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

/**
 * POST /api/events uçtan uca: güvenlik zinciri, batch davranışı, JSONB
 * yazımı, tekrar gönderim ve sınır. Kuralların ayrıntısı EventValidatorTest
 * ve InstallRateLimiterTest'te.
 */
@Import({TestcontainersConfiguration.class, AnalyticsTestClock.class})
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class AnalyticsEventEndpointTest {

    /** Loga ulaşmaması gereken soru kimliği. */
    private static final String SECRET_QUESTION = "gizli-soru-kimligi";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JsonMapper jsonMapper;

    @Autowired
    private JdbcClient jdbcClient;

    @Autowired
    private MutableClock clock;

    @Autowired
    private AccessTokenService accessTokenService;

    @Autowired
    private AppUserRepository appUserRepository;

    private String installId;

    @BeforeEach
    void setUp() {
        jdbcClient.sql("DELETE FROM analytics_event").update();
        // Yeni dakika: rate limit penceresi temiz başlar.
        clock.advance(Duration.ofMinutes(1));
        installId = UUID.randomUUID().toString();
    }

    @Test
    void acceptsBatchWithoutAuthenticationAndStoresEveryColumn() throws Exception {
        Map<String, Object> props = selfEvalProps(SECRET_QUESTION);
        props.put("extra", "atılmalı");
        var event = event("self_eval", props);

        send(batch(List.of(event)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.accepted").value(1))
                .andExpect(jsonPath("$.skipped").value(0));

        Map<String, Object> row = jdbcClient.sql("""
                SELECT event_id::text, install_id::text, event_name, platform, app_version,
                       occurred_at = :now AS occurred_ok, received_at = :now AS received_ok, props::text
                FROM analytics_event""")
                .param("now", OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC))
                .query().singleRow();
        assertThat(row).containsEntry("event_id", event.get("eventId"))
                .containsEntry("install_id", installId)
                .containsEntry("event_name", "self_eval")
                .containsEntry("platform", "android")
                .containsEntry("app_version", "1.2.0")
                .containsEntry("occurred_ok", true)
                .containsEntry("received_ok", true);
        Map<?, ?> storedProps = jsonMapper.readValue((String) row.get("props"), Map.class);
        assertThat(storedProps).isEqualTo(Map.of(
                "questionId", SECRET_QUESTION, "aliasResult", "partial", "result", "knew",
                "box", 3, "wasDue", true));
    }

    /**
     * Girişli web istemcisi Bearer başlığı gönderse bile olay hesaba
     * bağlanmaz: zincir JWT okumuyor, geçersiz başlık da 401'e dönmüyor.
     */
    @Test
    void ignoresAuthorizationHeader() throws Exception {
        AppUser user = appUserRepository.save(new AppUser("gh-analytics-" + UUID.randomUUID(), "metecode"));
        String body = batch(List.of(event("app_open", Map.of("dueCount", 2))));

        mockMvc.perform(post("/api/events").contentType(MediaType.APPLICATION_JSON).content(body)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessTokenService.issue(user.getId())))
                .andExpect(status().isAccepted());
        String second = batch(List.of(event("app_open", Map.of("dueCount", 2))));
        mockMvc.perform(post("/api/events").contentType(MediaType.APPLICATION_JSON).content(second)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer bu-bir-jwt-degil"))
                .andExpect(status().isAccepted());

        assertThat(count()).isEqualTo(2);
    }

    @Test
    void tableHasNoColumnThatCouldIdentifyAnAccount() {
        List<String> columns = jdbcClient.sql("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'analytics_event'""").query(String.class).list();

        assertThat(columns).containsExactlyInAnyOrder("id", "event_id", "install_id", "event_name",
                "platform", "app_version", "occurred_at", "received_at", "props");
    }

    @Test
    void skipsInvalidEventsAndLogsOnlyCounts(CapturedOutput output) throws Exception {
        var events = List.of(
                event("app_open", Map.of("dueCount", 5)),
                event("leitner_review_done", Map.of("box", 2)),
                event("spin", Map.of("categoryCount", "3")),
                event("answer_submitted", Map.of("questionId", SECRET_QUESTION, "answerLength", 9999)));

        send(batch(events))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.accepted").value(1))
                .andExpect(jsonPath("$.skipped").value(3));

        assertThat(count()).isEqualTo(1);
        assertThat(output).contains("4 olaydan 3 tanesi atlandı")
                .doesNotContain(installId)
                .doesNotContain(SECRET_QUESTION);
    }

    @Test
    void duplicateEventIdIsAcceptedButStoredOnce() throws Exception {
        String body = batch(List.of(event("app_open", Map.of("dueCount", 1))));

        send(body).andExpect(status().isAccepted()).andExpect(jsonPath("$.accepted").value(1));
        send(body).andExpect(status().isAccepted()).andExpect(jsonPath("$.accepted").value(1));

        assertThat(count()).isEqualTo(1);
    }

    @Test
    void duplicateWithinOneBatchIsStoredOnce() throws Exception {
        var event = event("app_open", Map.of("dueCount", 1));

        send(batch(List.of(event, event))).andExpect(status().isAccepted())
                .andExpect(jsonPath("$.accepted").value(2));

        assertThat(count()).isEqualTo(1);
    }

    @Test
    void rejectsBatchOfFiftyOneWithoutWriting() throws Exception {
        send(batch(spins(51)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_batch"));

        assertThat(count()).isZero();
    }

    @Test
    void acceptsBatchOfFifty() throws Exception {
        send(batch(spins(50))).andExpect(status().isAccepted()).andExpect(jsonPath("$.accepted").value(50));

        assertThat(count()).isEqualTo(50);
    }

    @Test
    void rejectsBadEnvelope() throws Exception {
        Map<String, Object> body = envelope(spins(1));
        body.put("platform", "desktop");

        send(jsonMapper.writeValueAsString(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_batch"));
        assertThat(count()).isZero();
    }

    @Test
    void rejectsMalformedJson() throws Exception {
        send("{\"installId\": ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("invalid_batch"));
    }

    @Test
    void rateLimitRejectsWholeBatchWithRetryAfter() throws Exception {
        send(batch(spins(50))).andExpect(status().isAccepted());
        send(batch(spins(50))).andExpect(status().isAccepted());
        send(batch(spins(20))).andExpect(status().isAccepted());

        send(batch(spins(1)))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.error").value("rate_limited"));
        assertThat(count()).isEqualTo(120);

        clock.advance(Duration.ofMinutes(1));
        send(batch(spins(1))).andExpect(status().isAccepted());
    }

    @Test
    void getIsNotAllowed() throws Exception {
        mockMvc.perform(get("/api/events")).andExpect(status().isMethodNotAllowed());
    }

    private ResultActions send(String body) throws Exception {
        return mockMvc.perform(post("/api/events").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private long count() {
        return jdbcClient.sql("SELECT count(*) FROM analytics_event").query(Long.class).single();
    }

    private List<Map<String, Object>> spins(int n) {
        List<Map<String, Object>> events = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            events.add(event("spin", Map.of("categoryCount", 3)));
        }
        return events;
    }

    private Map<String, Object> event(String name, Map<String, Object> props) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventId", UUID.randomUUID().toString());
        event.put("name", name);
        event.put("occurredAt", clock.instant().toString());
        event.put("props", props);
        return event;
    }

    private static Map<String, Object> selfEvalProps(String questionId) {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("questionId", questionId);
        props.put("aliasResult", "partial");
        props.put("result", "knew");
        props.put("box", 3);
        props.put("wasDue", true);
        return props;
    }

    private Map<String, Object> envelope(List<Map<String, Object>> events) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("installId", installId);
        body.put("platform", "android");
        body.put("appVersion", "1.2.0");
        body.put("events", events);
        return body;
    }

    private String batch(List<Map<String, Object>> events) {
        return jsonMapper.writeValueAsString(envelope(events));
    }
}
