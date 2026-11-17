package com.meteucar.mulakatslot.analytics;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import com.meteucar.mulakatslot.auth.MutableClock;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * CORS yalnızca /api/events için ve yalnızca mobil WebView origin'lerine
 * açık; diğer uçlarda hiçbir origin'e izin yok.
 */
@Import({TestcontainersConfiguration.class, AnalyticsTestClock.class})
@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsCorsTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MutableClock clock;

    @ParameterizedTest
    @ValueSource(strings = {"capacitor://localhost", "https://localhost"})
    void preflightToEventsIsAllowedForMobileOrigins(String origin) throws Exception {
        mockMvc.perform(preflight("/api/events", origin))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, origin))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS, containsString("POST")))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }

    @Test
    void actualPostExposesRetryAfter() throws Exception {
        clock.advance(Duration.ofMinutes(1));
        String body = """
                {"installId":"%s","platform":"ios","appVersion":"1.0.0",
                 "events":[{"eventId":"%s","name":"spin","occurredAt":"%s","props":{"categoryCount":2}}]}"""
                .formatted(UUID.randomUUID(), UUID.randomUUID(), clock.instant());

        mockMvc.perform(post("/api/events").header(HttpHeaders.ORIGIN, "capacitor://localhost")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isAccepted())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "capacitor://localhost"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS, containsString("Retry-After")));
    }

    @ParameterizedTest
    // http://localhost değil: MockMvc'nin kendi origin'i, CORS isteği sayılmaz.
    @ValueSource(strings = {"https://evil.example", "http://localhost:5173", "capacitor://evil"})
    void preflightToEventsIsRejectedForOtherOrigins(String origin) throws Exception {
        mockMvc.perform(preflight("/api/events", origin))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    /** Mobil origin'leri yalnızca olay ucu için eklendi; senkron uçları değişmedi. */
    @ParameterizedTest
    @ValueSource(strings = {"/api/progress", "/api/questions", "/api/auth/refresh", "/api/me"})
    void otherEndpointsGetNoCorsHeaders(String path) throws Exception {
        mockMvc.perform(preflight(path, "capacitor://localhost"))
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }

    private static MockHttpServletRequestBuilder preflight(String path, String origin) {
        return options(path)
                .header(HttpHeaders.ORIGIN, origin)
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type");
    }
}
