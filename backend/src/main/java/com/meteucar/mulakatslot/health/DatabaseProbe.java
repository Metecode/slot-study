package com.meteucar.mulakatslot.health;

import java.time.Duration;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Veritabanına SELECT 1 atarak erişilebilir olup olmadığını söyler.
 *
 * Sorgu zaman aşımı yalnızca bağlantı alındıktan sonrasını kapsar. DB hiç
 * erişilemezken süre bağlantı beklerken geçer; onu Hikari'nin
 * connection-timeout'u (application.yml, 2 sn) sınırlar.
 */
@Component
class DatabaseProbe {

    static final Duration QUERY_TIMEOUT = Duration.ofSeconds(2);

    private static final Logger log = LoggerFactory.getLogger(DatabaseProbe.class);

    private final JdbcTemplate jdbcTemplate;

    DatabaseProbe(DataSource dataSource) {
        // Paylaşılan JdbcTemplate'in zaman aşımını değiştirmemek için kendi örneği.
        this.jdbcTemplate = new JdbcTemplate(dataSource);
        this.jdbcTemplate.setQueryTimeout((int) QUERY_TIMEOUT.toSeconds());
    }

    boolean isUp() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return true;
        } catch (RuntimeException e) {
            // Sağlık ucu sık yoklanıyor (compose 15 sn'de bir); DB düşükken
            // her seferinde stack trace basmamak için yalnızca sınıf ve mesaj.
            log.warn("Sağlık kontrolü: veritabanına erişilemedi ({}: {})",
                    e.getClass().getSimpleName(), e.getMessage());
            return false;
        }
    }
}
