package com.meteucar.mulakatslot.analytics;

/**
 * Batch'teki tek olay, API sınırındaki şekliyle.
 *
 * <p>Alanlar ayrıştırılmamış gelir: bozuk tarih ya da UUID, ya da nesne
 * olmayan props yalnızca bu olayı atlatır, tüm batch'i değil.
 * props'ta tanınmayan alanlar {@link EventValidator}'da sessizce atılır.
 */
public record EventRequest(
        String eventId,
        String name,
        String occurredAt,
        Object props) {
}
