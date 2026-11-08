package com.ufo.monitoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
class NotificationDispatcher {
    private final NotificationRepository notices;
    private final Clock clock;
    private final ObjectMapper mapper;
    private final String url,token;
    private final RestClient client;
    NotificationDispatcher(NotificationRepository notices,Clock clock,ObjectMapper mapper,
        @Value("${monitoring.delivery-url}") String url,@Value("${monitoring.delivery-token}") String token) {
        this.notices=notices; this.clock=clock; this.mapper=mapper; this.url=url; this.token=token;
        var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000); factory.setReadTimeout(15000);
        client=RestClient.builder().requestFactory(factory).build();
    }
    @Scheduled(fixedDelayString="${monitoring.tick-ms}")
    void dispatch() {
        if (url.isBlank()) return;
        for (Notification notice:notices.findTop50ByDeliveryStateAndNextAttemptLessThanEqualOrderByCreatedAtAsc(DeliveryState.PENDING,clock.instant())) {
            if (notice.nextAttempt!=null && clock.instant().isBefore(notice.nextAttempt)) continue;
            notice.attemptCount++;
            try {
                client.post().uri(url).contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization","Bearer "+token).header("Idempotency-Key","ufo-monitoring-"+notice.id)
                    .body(Map.of("id",notice.id,"kind",notice.kind,"method",notice.method,
                        "recipients",mapper.readTree(notice.recipientsJson),"message",notice.message))
                    .retrieve().toBodilessEntity();
                notice.deliveryState=DeliveryState.DELIVERED; notice.deliveredAt=clock.instant();
            } catch (Exception error) {
                notice.deliveryState=notice.attemptCount>=5?DeliveryState.FAILED:DeliveryState.PENDING;
                notice.nextAttempt=clock.instant().plusSeconds(Math.min(3600,30L*(1L<<notice.attemptCount)));
            }
            notices.save(notice);
        }
    }
}
