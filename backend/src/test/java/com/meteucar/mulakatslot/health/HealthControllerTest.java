package com.meteucar.mulakatslot.health;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;

/**
 * Sağlık ucu token'sız GET ve HEAD ile çalışır; HEAD gövdesiz döner.
 *
 * Gerçek sunucuya istek atılır: HEAD'de gövdeyi Spring değil servlet
 * konteyneri atıyor, MockMvc gövdeyi olduğu gibi döndürürdü.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class HealthControllerTest {

    private final HttpClient client = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    @Test
    void getReturnsUp() throws Exception {
        HttpResponse<String> response = send("GET");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo("{\"status\":\"up\"}");
    }

    @Test
    void headReturnsOkWithoutBody() throws Exception {
        HttpResponse<String> response = send("HEAD");

        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEmpty();
    }

    private HttpResponse<String> send(String method) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health"))
                .method(method, HttpRequest.BodyPublishers.noBody())
                .build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
