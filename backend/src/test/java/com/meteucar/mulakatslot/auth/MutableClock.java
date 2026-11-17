package com.meteucar.mulakatslot.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * Testlerin zamanı ileri sarabilmesi için. Tolerans penceresi saniyelerle
 * ölçülüyor; gerçek zamanı beklemek testi hem yavaşlatır hem kırılgan yapar.
 *
 * <p>instant volatile: eşzamanlılık testinde iki iş parçacığı aynı saati okuyor.
 */
public class MutableClock extends Clock {

    private final ZoneId zone;
    private volatile Instant instant;

    public MutableClock(Instant instant, ZoneId zone) {
        this.instant = instant;
        this.zone = zone;
    }

    public void advance(Duration amount) {
        this.instant = this.instant.plus(amount);
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId newZone) {
        return new MutableClock(instant, newZone);
    }

    @Override
    public Instant instant() {
        return instant;
    }
}
