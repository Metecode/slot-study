package com.meteucar.mulakatslot.analytics;

import com.meteucar.mulakatslot.analytics.AnalyticsIngestService.Accepted;
import com.meteucar.mulakatslot.analytics.AnalyticsIngestService.BatchRejected;
import com.meteucar.mulakatslot.analytics.AnalyticsIngestService.RateLimited;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Kullanım ölçümü. Kimlik doğrulama yok ve olaylar hesaba bağlanmaz: uç
 * kendi güvenlik zincirinde (SecurityConfig.eventsFilterChain), orada JWT
 * hiç okunmuyor. Burada da principal parametresi yok; eklenmemeli.
 */
@RestController
public class AnalyticsEventController {

    private final AnalyticsIngestService ingestService;

    public AnalyticsEventController(AnalyticsIngestService ingestService) {
        this.ingestService = ingestService;
    }

    @PostMapping("/api/events")
    public ResponseEntity<Map<String, Object>> ingest(@RequestBody EventBatchRequest batch) {
        return switch (ingestService.ingest(batch)) {
            case Accepted(int accepted, int skipped) -> ResponseEntity.status(HttpStatus.ACCEPTED)
                    .body(Map.of("accepted", accepted, "skipped", skipped));
            case BatchRejected() -> invalidBatch();
            case RateLimited(long retryAfterSeconds) -> ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, Long.toString(retryAfterSeconds))
                    .body(Map.of("error", "rate_limited"));
        };
    }

    /** Bozuk JSON da aynı sözleşmeyle dönsün; Spring'in varsayılan gövdesi değil. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
        return invalidBatch();
    }

    private static ResponseEntity<Map<String, Object>> invalidBatch() {
        return ResponseEntity.badRequest().body(Map.of("error", "invalid_batch"));
    }
}
