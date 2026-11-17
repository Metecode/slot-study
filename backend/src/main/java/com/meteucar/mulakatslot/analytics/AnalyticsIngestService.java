package com.meteucar.mulakatslot.analytics;

import com.meteucar.mulakatslot.analytics.EventValidator.AcceptedEvent;
import com.meteucar.mulakatslot.analytics.EventValidator.BatchHeader;
import com.meteucar.mulakatslot.analytics.EventValidator.InvalidBatch;
import com.meteucar.mulakatslot.analytics.EventValidator.Rejected;
import com.meteucar.mulakatslot.analytics.EventValidator.Valid;
import com.meteucar.mulakatslot.analytics.EventValidator.ValidBatch;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Batch'i doğrular, sınırı uygular ve geçerli olayları yazar.
 *
 * <p>Log yalnızca sayı ve sabit metinli nedenler içerir: installId, soru
 * kimliği ya da başka bir istemci değeri yazılmaz.
 */
@Service
public class AnalyticsIngestService {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsIngestService.class);

    private final InstallRateLimiter rateLimiter;
    private final AnalyticsEventWriter writer;
    private final Clock clock;

    public AnalyticsIngestService(InstallRateLimiter rateLimiter, AnalyticsEventWriter writer, Clock clock) {
        this.rateLimiter = rateLimiter;
        this.writer = writer;
        this.clock = clock;
    }

    sealed interface Outcome permits Accepted, BatchRejected, RateLimited {
    }

    /**
     * @param accepted geçerli olay sayısı; daha önce yazılmış (tekrar gelen)
     *                 olaylar dahil, istemci için onlar da başarılı
     */
    record Accepted(int accepted, int skipped) implements Outcome {
    }

    record BatchRejected() implements Outcome {
    }

    record RateLimited(long retryAfterSeconds) implements Outcome {
    }

    Outcome ingest(EventBatchRequest batch) {
        BatchHeader header;
        switch (EventValidator.validateBatch(batch)) {
            case InvalidBatch(String reason) -> {
                // 400 zaten istemciye dönüyor; bozuk istemci sürümünü
                // aramak gerekirse debug açılır.
                log.debug("Analitik: batch reddedildi ({})", reason);
                return new BatchRejected();
            }
            case ValidBatch(BatchHeader validHeader) -> header = validHeader;
        }

        var decision = rateLimiter.tryAcquire(header.installId(), batch.events().size());
        if (!decision.allowed()) {
            return new RateLimited(decision.retryAfterSeconds());
        }

        Instant now = clock.instant();
        List<AcceptedEvent> valid = new ArrayList<>();
        Map<String, Integer> skippedByReason = new TreeMap<>();
        for (EventRequest event : batch.events()) {
            switch (EventValidator.validateEvent(event, now)) {
                case Valid(AcceptedEvent accepted) -> valid.add(accepted);
                case Rejected(String reason) -> skippedByReason.merge(reason, 1, Integer::sum);
            }
        }

        int inserted = writer.insert(header, valid, now);
        int skipped = batch.events().size() - valid.size();
        if (skipped > 0) {
            log.info("Analitik: {} olaydan {} tanesi atlandı {}", batch.events().size(), skipped, skippedByReason);
        }
        if (inserted < valid.size()) {
            log.debug("Analitik: {} olay daha önce yazılmıştı", valid.size() - inserted);
        }
        return new Accepted(valid.size(), skipped);
    }
}
