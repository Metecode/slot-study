package com.meteucar.mulakatslot.analytics;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.auth.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class InstallRateLimiterTest {

    /** Bir dakikanın 15. saniyesi: pencere sonuna 45 sn var. */
    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-17T12:00:15Z"), ZoneOffset.UTC);

    private final UUID installA = UUID.randomUUID();
    private final UUID installB = UUID.randomUUID();

    @Test
    void allowsUpToPerInstallLimitWithinAMinute() {
        var limiter = new InstallRateLimiter(clock, 120, 6000);

        assertThat(limiter.tryAcquire(installA, 50).allowed()).isTrue();
        assertThat(limiter.tryAcquire(installA, 50).allowed()).isTrue();
        assertThat(limiter.tryAcquire(installA, 20).allowed()).isTrue();

        var denied = limiter.tryAcquire(installA, 1);
        assertThat(denied.allowed()).isFalse();
        assertThat(denied.retryAfterSeconds()).isEqualTo(45);
    }

    @Test
    void deniedBatchConsumesNothing() {
        var limiter = new InstallRateLimiter(clock, 120, 6000);
        limiter.tryAcquire(installA, 100);

        // 30 sığmıyor ama 20 sığıyor: reddedilen batch sayaçtan düşülmedi.
        assertThat(limiter.tryAcquire(installA, 30).allowed()).isFalse();
        assertThat(limiter.tryAcquire(installA, 20).allowed()).isTrue();
    }

    @Test
    void installsAreCountedSeparately() {
        var limiter = new InstallRateLimiter(clock, 120, 6000);
        limiter.tryAcquire(installA, 120);

        assertThat(limiter.tryAcquire(installA, 1).allowed()).isFalse();
        assertThat(limiter.tryAcquire(installB, 50).allowed()).isTrue();
    }

    @Test
    void windowResetsAtNextMinute() {
        var limiter = new InstallRateLimiter(clock, 120, 6000);
        limiter.tryAcquire(installA, 120);

        clock.advance(Duration.ofSeconds(44));
        assertThat(limiter.tryAcquire(installA, 1).allowed()).isFalse();

        clock.advance(Duration.ofSeconds(1));
        assertThat(limiter.tryAcquire(installA, 120).allowed()).isTrue();
    }

    @Test
    void globalCeilingStopsRotatingInstallIds() {
        var limiter = new InstallRateLimiter(clock, 120, 200);

        assertThat(limiter.tryAcquire(UUID.randomUUID(), 100).allowed()).isTrue();
        assertThat(limiter.tryAcquire(UUID.randomUUID(), 100).allowed()).isTrue();
        // Yepyeni bir kimlik de genel tavana takılır.
        assertThat(limiter.tryAcquire(UUID.randomUUID(), 1).allowed()).isFalse();
    }

    @Test
    void forgetsInstallsOfPreviousMinute() {
        var limiter = new InstallRateLimiter(clock, 120, 6000);
        for (int i = 0; i < 10; i++) {
            limiter.tryAcquire(UUID.randomUUID(), 1);
        }
        assertThat(limiter.trackedInstallCount()).isEqualTo(10);

        clock.advance(Duration.ofMinutes(1));
        limiter.tryAcquire(installA, 1);

        assertThat(limiter.trackedInstallCount()).isEqualTo(1);
    }

    @Test
    void retryAfterIsAtLeastOneSecond() {
        var lastSecond = new MutableClock(Instant.parse("2026-11-17T12:00:59.900Z"), ZoneOffset.UTC);
        var limiter = new InstallRateLimiter(lastSecond, 1, 6000);
        limiter.tryAcquire(installA, 1);

        assertThat(limiter.tryAcquire(installA, 1).retryAfterSeconds()).isEqualTo(1);
    }
}
