package com.meteucar.mulakatslot.health;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Veritabanı erişilemezken sağlık ucu 503 döner ve hata ayrıntısı sızdırmaz.
 *
 * Paylaşılan TestcontainersConfiguration konteyneri durdurulamaz (diğer test
 * sınıfları da kullanıyor); bu sınıf kendi konteynerini açar, test içinde
 * durdurur ve context'i kapatır.
 */
@Import(HealthDatabaseDownTest.OwnPostgres.class)
@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class HealthDatabaseDownTest {

    @TestConfiguration(proxyBeanMethods = false)
    static class OwnPostgres {

        @Bean
        @ServiceConnection
        PostgreSQLContainer healthDownPostgres() {
            return new PostgreSQLContainer(DockerImageName.parse("postgres:latest"));
        }
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PostgreSQLContainer postgres;

    @Test
    void returnsServiceUnavailableWhenDatabaseIsDown() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());

        postgres.stop();

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("down"))
                .andExpect(jsonPath("$.db").value("down"))
                .andExpect(jsonPath("$.length()").value(2));
    }
}
