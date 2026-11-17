package com.meteucar.mulakatslot.analytics;

import com.meteucar.mulakatslot.analytics.EventPropsSchema.FieldRule;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Gelen batch'i ve olayları eler. Saf: Spring, veritabanı ve log bilmez.
 *
 * <p>İki seviye var. Zarf (kurulum, platform, sürüm, olay sayısı) bozuksa
 * batch'in hiçbir olayına güvenilemez, tamamı 400 alır. Olay bozuksa yalnızca
 * o olay atlanır: tek hatalı olay yüzünden diğerleri kaybolmasın.
 *
 * <p>Ret nedenleri sabit metin; istemciden gelen hiçbir değer loga ulaşmasın.
 */
final class EventValidator {

    static final int MAX_EVENTS_PER_BATCH = 50;

    /** Çevrimdışı kalan istemcinin kuyruğu bu kadar geriye gidebilir. */
    static final Duration MAX_PAST = Duration.ofDays(7);

    /** İstemci saatinin ileri kayması için pay. */
    static final Duration MAX_FUTURE = Duration.ofMinutes(5);

    static final Set<String> PLATFORMS = Set.of("web", "android", "ios");

    /** package.json sürümü; Android'in versionCode şeması da X.Y.Z istiyor. */
    private static final Pattern APP_VERSION = Pattern.compile("^\\d{1,4}\\.\\d{1,4}\\.\\d{1,4}$");

    /**
     * Kanonik UUID biçimi. UUID.fromString tek başına gevşek: "1-1-1-1-1"i
     * de kabul ediyor.
     */
    private static final Pattern UUID_TEXT = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private EventValidator() {
    }

    /** Batch'in tüm olaylarında ortak olan, doğrulanmış zarf. */
    record BatchHeader(UUID installId, String platform, String appVersion) {
    }

    /** Saklanmaya hazır olay; props yalnızca şemadaki alanları taşır. */
    record AcceptedEvent(UUID eventId, String name, Instant occurredAt, Map<String, Object> props) {
    }

    sealed interface BatchResult permits ValidBatch, InvalidBatch {
    }

    record ValidBatch(BatchHeader header) implements BatchResult {
    }

    record InvalidBatch(String reason) implements BatchResult {
    }

    sealed interface EventResult permits Valid, Rejected {
    }

    record Valid(AcceptedEvent event) implements EventResult {
    }

    /** @param reason sabit metin; loga olduğu gibi yazılır */
    record Rejected(String reason) implements EventResult {
    }

    static BatchResult validateBatch(EventBatchRequest batch) {
        if (batch == null) {
            return new InvalidBatch("gövde yok");
        }
        UUID installId = parseUuid(batch.installId());
        if (installId == null) {
            return new InvalidBatch("installId geçerli UUID değil");
        }
        if (batch.platform() == null || !PLATFORMS.contains(batch.platform())) {
            return new InvalidBatch("platform tanınmıyor");
        }
        if (batch.appVersion() == null || !APP_VERSION.matcher(batch.appVersion()).matches()) {
            return new InvalidBatch("appVersion X.Y.Z biçiminde değil");
        }
        List<EventRequest> events = batch.events();
        if (events == null || events.isEmpty()) {
            return new InvalidBatch("events boş");
        }
        if (events.size() > MAX_EVENTS_PER_BATCH) {
            return new InvalidBatch("events " + MAX_EVENTS_PER_BATCH + " olaydan uzun");
        }
        return new ValidBatch(new BatchHeader(installId, batch.platform(), batch.appVersion()));
    }

    static EventResult validateEvent(EventRequest event, Instant now) {
        if (event == null) {
            return new Rejected("olay boş");
        }
        UUID eventId = parseUuid(event.eventId());
        if (eventId == null) {
            return new Rejected("eventId geçerli UUID değil");
        }
        if (!EventPropsSchema.isKnownEvent(event.name())) {
            return new Rejected("olay adı listede yok");
        }

        Instant occurredAt = parseInstant(event.occurredAt());
        if (occurredAt == null) {
            return new Rejected("occurredAt geçerli ISO tarih değil");
        }
        if (occurredAt.isBefore(now.minus(MAX_PAST))) {
            return new Rejected("occurredAt 7 günden eski");
        }
        if (occurredAt.isAfter(now.plus(MAX_FUTURE))) {
            return new Rejected("occurredAt 5 dakikadan fazla ileride");
        }

        if (!(event.props() instanceof Map<?, ?> rawProps)) {
            return new Rejected("props nesne değil");
        }
        Map<String, Object> props = new LinkedHashMap<>();
        for (Map.Entry<String, FieldRule> field : EventPropsSchema.fieldsOf(event.name()).entrySet()) {
            Object value = rawProps.get(field.getKey());
            // Eksik alan ve null aynı şey: zorunlu alan yok.
            if (value == null) {
                return new Rejected("props alanı eksik");
            }
            if (!field.getValue().accepts(value)) {
                return new Rejected("props alanı tipi ya da aralığı geçersiz");
            }
            props.put(field.getKey(), value);
        }
        // Şemada olmayan alanlar buraya hiç kopyalanmadı: sessizce atıldı.
        return new Valid(new AcceptedEvent(eventId, event.name(), occurredAt, props));
    }

    private static UUID parseUuid(String value) {
        if (value == null || !UUID_TEXT.matcher(value).matches()) {
            return null;
        }
        return UUID.fromString(value);
    }

    private static Instant parseInstant(String value) {
        if (value == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
