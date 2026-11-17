package com.meteucar.mulakatslot.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.analytics.EventValidator.InvalidBatch;
import com.meteucar.mulakatslot.analytics.EventValidator.Rejected;
import com.meteucar.mulakatslot.analytics.EventValidator.Valid;
import com.meteucar.mulakatslot.analytics.EventValidator.ValidBatch;
import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Saf doğrulama kuralları; veritabanı ve Spring gerekmez. */
class EventValidatorTest {

    private static final Instant NOW = Instant.parse("2026-11-17T12:00:00Z");
    private static final String INSTALL = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
    private static final String EVENT_ID = "0b1c2d3e-4f50-4617-8293-a4b5c6d7e8f9";

    private static Map<String, Object> selfEvalProps() {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("questionId", "java-equals-hashcode");
        props.put("aliasResult", "partial");
        props.put("result", "knew");
        props.put("box", 3);
        props.put("wasDue", true);
        return props;
    }

    private static EventRequest event(String name, Object props) {
        return new EventRequest(EVENT_ID, name, NOW.toString(), props);
    }

    private static EventRequest eventAt(Instant occurredAt) {
        return new EventRequest(EVENT_ID, "app_open", occurredAt.toString(), Map.of("dueCount", 4));
    }

    private static EventValidator.EventResult validate(EventRequest event) {
        return EventValidator.validateEvent(event, NOW);
    }


    private EventBatchRequest batch(String installId, String platform, String version, int eventCount) {
        List<EventRequest> events = Collections.nCopies(eventCount, eventAt(NOW));
        return new EventBatchRequest(installId, platform, version, events);
    }

    @Test
    void acceptsValidEnvelope() {
        var result = EventValidator.validateBatch(batch(INSTALL, "android", "1.2.0", 50));

        assertThat(result).isInstanceOfSatisfying(ValidBatch.class, valid -> {
            assertThat(valid.header().installId()).isEqualTo(UUID.fromString(INSTALL));
            assertThat(valid.header().platform()).isEqualTo("android");
            assertThat(valid.header().appVersion()).isEqualTo("1.2.0");
        });
    }

    @Test
    void rejectsMoreThanFiftyEvents() {
        assertThat(EventValidator.validateBatch(batch(INSTALL, "web", "1.0.0", 51)))
                .isInstanceOf(InvalidBatch.class);
    }

    @Test
    void rejectsEmptyAndMissingEvents() {
        assertThat(EventValidator.validateBatch(batch(INSTALL, "web", "1.0.0", 0)))
                .isInstanceOf(InvalidBatch.class);
        assertThat(EventValidator.validateBatch(new EventBatchRequest(INSTALL, "web", "1.0.0", null)))
                .isInstanceOf(InvalidBatch.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "nope", "1-1-1-1-1", "6f1c2a3b4d5e4f608a7b9c0d1e2f3a4b"})
    void rejectsNonCanonicalInstallId(String installId) {
        assertThat(EventValidator.validateBatch(batch(installId, "web", "1.0.0", 1)))
                .isInstanceOf(InvalidBatch.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "desktop", "Web"})
    void rejectsUnknownPlatform(String platform) {
        assertThat(EventValidator.validateBatch(batch(INSTALL, platform, "1.0.0", 1)))
                .isInstanceOf(InvalidBatch.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "1.0", "1.0.0-beta", "v1.0.0", "12345.0.0"})
    void rejectsMalformedAppVersion(String version) {
        assertThat(EventValidator.validateBatch(batch(INSTALL, "ios", version, 1)))
                .isInstanceOf(InvalidBatch.class);
    }

    @Test
    void rejectsMissingFields() {
        assertThat(EventValidator.validateBatch(null)).isInstanceOf(InvalidBatch.class);
        assertThat(EventValidator.validateBatch(batch(null, "web", "1.0.0", 1))).isInstanceOf(InvalidBatch.class);
        assertThat(EventValidator.validateBatch(batch(INSTALL, null, "1.0.0", 1))).isInstanceOf(InvalidBatch.class);
        assertThat(EventValidator.validateBatch(batch(INSTALL, "web", null, 1))).isInstanceOf(InvalidBatch.class);
    }


    @Test
    void whitelistHasExactlyFourEvents() {
        // V4 migration'ındaki CHECK kısıtıyla aynı liste.
        assertThat(EventPropsSchema.eventNames())
                .containsExactlyInAnyOrder("app_open", "spin", "answer_submitted", "self_eval");
    }

    @ParameterizedTest
    @ValueSource(strings = {"leitner_review_done", "APP_OPEN", "page_view", ""})
    void rejectsUnknownName(String name) {
        assertThat(validate(event(name, Map.of()))).isInstanceOf(Rejected.class);
    }

    @Test
    void rejectsMissingName() {
        assertThat(validate(event(null, Map.of()))).isInstanceOf(Rejected.class);
    }

    @Test
    void acceptsEveryKnownEventWithValidProps() {
        assertThat(validate(event("app_open", Map.of("dueCount", 0)))).isInstanceOf(Valid.class);
        assertThat(validate(event("spin", Map.of("categoryCount", 1)))).isInstanceOf(Valid.class);
        assertThat(validate(event("answer_submitted",
                Map.of("questionId", "sql-index", "answerLength", 0)))).isInstanceOf(Valid.class);
        assertThat(validate(event("self_eval", selfEvalProps()))).isInstanceOf(Valid.class);
    }


    @Test
    void acceptsBoundaries() {
        assertThat(validate(eventAt(NOW.minus(Duration.ofDays(7))))).isInstanceOf(Valid.class);
        assertThat(validate(eventAt(NOW.plus(Duration.ofMinutes(5))))).isInstanceOf(Valid.class);
    }

    @Test
    void rejectsJustOutsideBoundaries() {
        assertThat(validate(eventAt(NOW.minus(Duration.ofDays(7)).minusSeconds(1)))).isInstanceOf(Rejected.class);
        assertThat(validate(eventAt(NOW.plus(Duration.ofMinutes(5)).plusSeconds(1)))).isInstanceOf(Rejected.class);
    }

    @Test
    void acceptsOffsetAndKeepsInstant() {
        var event = new EventRequest(EVENT_ID, "app_open", "2026-11-17T15:00:00+03:00", Map.of("dueCount", 1));

        assertThat(validate(event)).isInstanceOfSatisfying(Valid.class,
                valid -> assertThat(valid.event().occurredAt()).isEqualTo(NOW));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "dün", "2026-11-17", "2026-11-17T12:00:00"})
    void rejectsUnparseableTimestamp(String occurredAt) {
        var event = new EventRequest(EVENT_ID, "app_open", occurredAt, Map.of("dueCount", 1));
        assertThat(validate(event)).isInstanceOf(Rejected.class);
    }


    @ParameterizedTest
    @ValueSource(strings = {"", "abc", "1-1-1-1-1"})
    void rejectsInvalidEventId(String eventId) {
        var event = new EventRequest(eventId, "app_open", NOW.toString(), Map.of("dueCount", 1));
        assertThat(validate(event)).isInstanceOf(Rejected.class);
    }

    @Test
    void rejectsNullEvent() {
        assertThat(validate(null)).isInstanceOf(Rejected.class);
    }


    @Test
    void dropsUnknownFieldsAndKeepsEvent() {
        Map<String, Object> props = selfEvalProps();
        props.put("answer", "cevap metni buraya girmemeli");
        props.put("extra", 1);

        assertThat(validate(event("self_eval", props))).isInstanceOfSatisfying(Valid.class,
                valid -> assertThat(valid.event().props())
                        .containsOnlyKeys("questionId", "aliasResult", "result", "box", "wasDue"));
    }

    @Test
    void rejectsMissingRequiredField() {
        Map<String, Object> props = selfEvalProps();
        props.remove("wasDue");
        assertThat(validate(event("self_eval", props))).isInstanceOf(Rejected.class);
        assertThat(validate(event("app_open", Map.of()))).isInstanceOf(Rejected.class);
    }

    @Test
    void rejectsNullValue() {
        Map<String, Object> props = new HashMap<>(selfEvalProps());
        props.put("box", null);
        assertThat(validate(event("self_eval", props))).isInstanceOf(Rejected.class);
    }

    @Test
    void rejectsNonObjectProps() {
        assertThat(validate(event("spin", List.of(1)))).isInstanceOf(Rejected.class);
        assertThat(validate(event("spin", "categoryCount=3"))).isInstanceOf(Rejected.class);
        assertThat(validate(event("spin", null))).isInstanceOf(Rejected.class);
    }

    @Test
    void rejectsWrongIntegerTypes() {
        assertThat(validate(event("spin", Map.of("categoryCount", 3.0)))).isInstanceOf(Rejected.class);
        assertThat(validate(event("spin", Map.of("categoryCount", "3")))).isInstanceOf(Rejected.class);
        assertThat(validate(event("spin", Map.of("categoryCount", true)))).isInstanceOf(Rejected.class);
        assertThat(validate(event("spin", Map.of("categoryCount", 3L)))).isInstanceOf(Valid.class);
    }

    @Test
    void enforcesIntegerRanges() {
        assertThat(validate(event("spin", Map.of("categoryCount", 0)))).isInstanceOf(Rejected.class);
        assertThat(validate(event("spin", Map.of("categoryCount", 100)))).isInstanceOf(Valid.class);
        assertThat(validate(event("spin", Map.of("categoryCount", 101)))).isInstanceOf(Rejected.class);
        assertThat(validate(event("app_open", Map.of("dueCount", -1)))).isInstanceOf(Rejected.class);
        assertThat(validate(event("app_open", Map.of("dueCount", 10_000)))).isInstanceOf(Valid.class);
        assertThat(validate(event("app_open", Map.of("dueCount", 10_001)))).isInstanceOf(Rejected.class);
        assertThat(validate(event("answer_submitted",
                Map.of("questionId", "q", "answerLength", 5001)))).isInstanceOf(Rejected.class);
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 6})
    void rejectsBoxOutsideOneToFive(int box) {
        Map<String, Object> props = selfEvalProps();
        props.put("box", box);
        assertThat(validate(event("self_eval", props))).isInstanceOf(Rejected.class);
    }

    @Test
    void rejectsNonBooleanWasDue() {
        Map<String, Object> props = selfEvalProps();
        props.put("wasDue", "true");
        assertThat(validate(event("self_eval", props))).isInstanceOf(Rejected.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MATCH", "maybe", ""})
    void rejectsUnknownAliasResult(String aliasResult) {
        Map<String, Object> props = selfEvalProps();
        props.put("aliasResult", aliasResult);
        assertThat(validate(event("self_eval", props))).isInstanceOf(Rejected.class);
    }

    @Test
    void acceptsEveryAliasResultAndResult() {
        for (String aliasResult : List.of("match", "partial", "none", "skipped")) {
            for (String result : List.of("knew", "partial", "didnt")) {
                Map<String, Object> props = selfEvalProps();
                props.put("aliasResult", aliasResult);
                props.put("result", result);
                assertThat(validate(event("self_eval", props))).isInstanceOf(Valid.class);
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "bir cevap", "a\u0000b", "q\uD800", "ğ-soru"})
    void rejectsQuestionIdOutsideCharset(String questionId) {
        var props = Map.<String, Object>of("questionId", questionId, "answerLength", 10);
        assertThat(validate(event("answer_submitted", props))).isInstanceOf(Rejected.class);
    }

    @Test
    void rejectsQuestionIdLongerThan128() {
        var props = Map.<String, Object>of("questionId", "q".repeat(129), "answerLength", 10);
        assertThat(validate(event("answer_submitted", props))).isInstanceOf(Rejected.class);
    }
}
