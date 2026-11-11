package com.meteucar.mulakatslot.health;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Uygulama ayakta ve veritabanına erişiyorsa 200, erişemiyorsa 503.
 * Hata ayrıntısı yanıtta değil logda (DatabaseProbe). HEAD istekleri de
 * buraya gelir; Spring gövdeyi atar.
 */
@RestController
public class HealthController {

    private final DatabaseProbe databaseProbe;

    HealthController(DatabaseProbe databaseProbe) {
        this.databaseProbe = databaseProbe;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, String>> health() {
        if (databaseProbe.isUp()) {
            return ResponseEntity.ok(Map.of("status", "up"));
        }
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("status", "down", "db", "down"));
    }
}
