package com.meteucar.mulakatslot.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Ana application.yml ile uygulama bağlamı açılır.
 *
 * src/test/resources/application.yml classpath'te ana dosyayla aynı adı
 * taşıdığı için onu gölgeliyor: diğer testler ana dosyayı hiç okumuyor.
 * Hikari connection-timeout "2s" yazıldığında (long bekliyor) testler yeşil
 * kalmış, uygulama canlıda açılmamıştı. Bu test ana dosyayı açıkça yükler;
 * ana dosyaya eklenen ayar burada doğrulanır.
 *
 * Yol göreli (file:src/main/resources/...): test backend/ dizininden
 * çalıştırılmalı. Maven (./mvnw test) ve CI bunu zaten yapıyor; IDE'de
 * çalışma dizini repo kökü olursa dosya bulunamaz.
 *
 * Ortam değişkenlerinden gelen sırlar test değerleriyle verilir; DB_URL
 * gerekmez, bağlantıyı @ServiceConnection (Testcontainers) sağlar.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = {
        "spring.config.location=file:src/main/resources/application.yml",
        "JWT_SECRET=test-jwt-secret-en-az-otuz-iki-bayt-olmali",
        "GITHUB_CLIENT_ID=test-client-id",
        "GITHUB_CLIENT_SECRET=test-client-secret",
        "app.content.location=classpath:test-content/*.json"
})
class MainConfigurationTest {

    @Autowired
    private DataSource dataSource;

    @Test
    void contextLoadsWithMainConfiguration() {
        // Varsayılan 30000 olurdu; 2000 görmek ana dosyanın okunduğunu kanıtlar.
        assertThat(dataSource).isInstanceOf(HikariDataSource.class);
        assertThat(((HikariDataSource) dataSource).getConnectionTimeout()).isEqualTo(2000);
    }
}
