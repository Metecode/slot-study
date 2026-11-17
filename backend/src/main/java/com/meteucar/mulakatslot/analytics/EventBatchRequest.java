package com.meteucar.mulakatslot.analytics;

import java.util.List;

/**
 * POST /api/events gövdesi. Kurulum, platform ve sürüm zarfta bir kez gelir:
 * bir batch tek kurulumundur, rate limit de buna dayanıyor.
 *
 * <p>Alanlar String: Jackson ayrıştırsaydı bozuk bir UUID tüm isteği
 * Spring'in varsayılan 400'üne çevirirdi. Doğrulama {@link EventValidator}'da.
 */
public record EventBatchRequest(
        String installId,
        String platform,
        String appVersion,
        List<EventRequest> events) {
}
