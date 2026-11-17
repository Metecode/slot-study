package com.meteucar.mulakatslot.config;

import com.meteucar.mulakatslot.auth.GithubAuthenticationSuccessHandler;
import java.time.Duration;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Üç filtre zinciri var: iki farklı oturum modeli (OAuth el sıkışması ve
 * API) ve hiç kimlik okumayan kullanım ölçümü ucu.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String EVENTS_PATH = "/api/events";

    /**
     * GitHub el sıkışması. Yetkilendirme isteğinin durumu (state parametresi,
     * PKCE doğrulayıcısı) iki HTTP isteği arasında saklanmak zorunda, bu yüzden
     * yalnızca burada session'a izin veriyoruz. Başarı anında
     * {@link GithubAuthenticationSuccessHandler} session'ı kapatır.
     */
    @Bean
    @Order(1)
    SecurityFilterChain oauthFilterChain(HttpSecurity http,
            GithubAuthenticationSuccessHandler successHandler) throws Exception {
        return http
                .securityMatcher("/oauth2/**", "/login/**")
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .oauth2Login(oauth2 -> oauth2.successHandler(successHandler))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .build();
    }

    /**
     * Kullanım ölçümü. Olaylar hesaba bağlanmamalı; bu yüzden bu zincirde
     * resource server YOK: Authorization başlığı gelse bile JWT okunmaz,
     * principal oluşmaz. Yan faydası: süresi dolmuş Bearer başlığı taşıyan
     * girişli bir web istemcisinin olayları API zincirindeki gibi 401 almaz.
     *
     * <p>Kimlik doğrulama olmadığı için CSRF'in koruyacağı bir şey yok.
     */
    @Bean
    @Order(2)
    SecurityFilterChain eventsFilterChain(HttpSecurity http) throws Exception {
        return http
                .securityMatcher(EVENTS_PATH)
                // Yalnızca POST eşlenmiş; diğer metotlara Spring MVC 405 döner.
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .cors(cors -> cors.configurationSource(eventsCorsSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .build();
    }

    /**
     * Mobil uygulamanın WebView origin'leri: iOS'ta capacitor://localhost,
     * Android'de https://localhost. Web aynı origin'den geliyor, CORS'a
     * ihtiyacı yok.
     *
     * <p>Bilerek bean değil: CorsConfigurationSource bean'i diğer zincirler
     * ve Spring MVC tarafından da bulunup kullanılabilirdi. Diğer uçların
     * CORS davranışı (hiç izin yok) değişmesin.
     *
     * <p>Cookie ve kimlik taşınmadığı için credentials kapalı. Retry-After
     * açıkça izinli: cross-origin yanıtta istemci onu başka türlü okuyamaz.
     */
    private static CorsConfigurationSource eventsCorsSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("capacitor://localhost", "https://localhost"));
        config.setAllowedMethods(List.of("POST"));
        config.setAllowedHeaders(List.of("Content-Type"));
        config.setExposedHeaders(List.of("Retry-After"));
        config.setAllowCredentials(false);
        config.setMaxAge(Duration.ofDays(1));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration(EVENTS_PATH, config);
        return source;
    }

    /**
     * API. Kimlik yalnızca Authorization başlığındaki Bearer JWT ile
     * doğrulanır, sunucuda oturum tutulmaz.
     */
    @Bean
    @Order(3)
    SecurityFilterChain apiFilterChain(HttpSecurity http, JsonAuthenticationEntryPoint entryPoint) throws Exception {
        return http
                .authorizeHttpRequests(auth -> auth
                        // Uygulama hesapsız da çalışır: sağlık ve soru uçları herkese açık.
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/questions").permitAll()
                        // Uptime izleyicileri (UptimeRobot) sağlık ucunu HEAD ile yokluyor.
                        .requestMatchers(HttpMethod.HEAD, "/api/health").permitAll()
                        // Bu iki uç kimliğini cookie'den alır, Bearer token'ı yoktur.
                        .requestMatchers(HttpMethod.POST, "/api/auth/refresh", "/api/auth/logout").permitAll()
                        // Bir uç hata verdiğinde konteyner isteği /error'a ERROR
                        // dispatch'iyle iletir ve güvenlik zinciri bunu da
                        // değerlendirir. Kapalı bırakılırsa herkese açık bir ucun
                        // 404'ü ya da 500'ü 401'e dönüşür ve gerçek hata kaybolur.
                        .requestMatchers("/error").permitAll()
                        // Varsayılan kapalı: sayılmayan her yol kimlik ister.
                        .anyRequest().authenticated())
                // API uçları kimliği yalnızca Authorization başlığıyla doğruluyor;
                // tarayıcı bu başlığı başka sitelerin isteklerine kendiliğinden
                // eklemediği için CSRF mümkün değil. Cookie ile çalışan tek uç
                // /api/auth/refresh ve /api/auth/logout; onları da refresh
                // cookie'sindeki SameSite=Strict koruyor.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(Customizer.withDefaults())
                        // Geçersiz/eksik token'da da yönlendirme değil JSON dönsün.
                        .authenticationEntryPoint(entryPoint))
                .exceptionHandling(handling -> handling.authenticationEntryPoint(entryPoint))
                .build();
    }
}
