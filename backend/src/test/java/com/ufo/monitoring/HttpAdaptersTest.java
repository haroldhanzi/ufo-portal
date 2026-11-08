package com.ufo.monitoring;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class HttpAdaptersTest {
    HttpServer server;
    String base;
    Clock clock=Clock.fixed(Instant.parse("2026-10-12T08:00:00Z"),ZoneOffset.UTC);
    @BeforeEach void start() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        base="http://127.0.0.1:"+server.getAddress().getPort();
        server.start();
    }
    @AfterEach void stop() { server.stop(0); }
    void respond(String path,int status,String body) {
        server.createContext(path,exchange->{
            byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(status,bytes.length); exchange.getResponseBody().write(bytes); exchange.close();
        });
    }
    @Test void pollsAuthenticatedOmadaSnapshotAndMapsOnlyConfiguredValues() {
        respond("/openapi/authorize/token",200,"{\"errorCode\":0,\"result\":{\"accessToken\":\"token\",\"expiresIn\":7200}}");
        server.createContext("/openapi/v1/controller/sites/site/devices",exchange->{
            assertThat(exchange.getRequestHeaders().getFirst("Authorization")).isEqualTo("AccessToken=token");
            byte[] body="{\"errorCode\":0,\"result\":{\"data\":[{\"mac\":\"aa-bb-cc-dd-ee-01\",\"status\":1}],\"totalRows\":1}}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(200,body.length); exchange.getResponseBody().write(body); exchange.close();
        });
        DeviceRepository devices=mock(DeviceRepository.class);
        MonitoringService service=mock(MonitoringService.class);
        Device device=new Device(); device.id=1L;
        when(devices.findBySiteIdAndMac("site","AA:BB:CC:DD:EE:01")).thenReturn(Optional.of(device));
        OmadaGateway gateway=new OmadaGateway(clock,devices,service,base,"controller","client","secret",
            "/openapi/v1/{omadacId}/sites/{siteId}/devices","","POST","status","1","0",180);
        gateway.pollSite("site");
        verify(service).discoverAndObserve("site","aa-bb-cc-dd-ee-01","",DeviceState.CONNECTED,clock.instant());
    }
    @Test void rebootUsesDocumentedBodylessPostAndHyphenatedMac() {
        respond("/openapi/authorize/token",200,"{\"errorCode\":0,\"result\":{\"accessToken\":\"token\",\"expiresIn\":7200}}");
        AtomicInteger calls=new AtomicInteger();
        server.createContext("/openapi/v1/controller/sites/site/devices/AA-BB-CC-DD-EE-01/reboot",exchange->{
            assertThat(exchange.getRequestMethod()).isEqualTo("POST");
            assertThat(exchange.getRequestHeaders().getFirst("Authorization")).isEqualTo("AccessToken=token");
            assertThat(exchange.getRequestBody().readAllBytes()).isEmpty();
            byte[] body=(calls.getAndIncrement()==0?"{\"errorCode\":0}":"{\"errorCode\":-39008}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(200,body.length);exchange.getResponseBody().write(body);exchange.close();
        });
        OmadaGateway gateway=new OmadaGateway(clock,mock(DeviceRepository.class),mock(MonitoringService.class),base,"controller","client","secret",
            "/openapi/v1/{omadacId}/sites/{siteId}/devices","/openapi/v1/{omadacId}/sites/{siteId}/devices/{deviceMac}/reboot","POST","status","1","0",180);
        Device device=new Device();device.siteId="site";device.mac="AA:BB:CC:DD:EE:01";
        device.currentState=DeviceState.CONNECTED;device.lastObserved=clock.instant();
        gateway.reboot(device);
        assertThatThrownBy(()->gateway.reboot(device)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class).hasMessageContaining("upgrading");
        device.lastObserved=clock.instant().minusSeconds(181);
        assertThatThrownBy(()->gateway.reboot(device)).hasMessageContaining("recently observed");
        assertThat(calls.get()).isEqualTo(2);
    }
    @Test void failedPollingNeverCreatesDisconnectedObservations() {
        respond("/openapi/authorize/token",200,"{\"errorCode\":0,\"result\":{\"accessToken\":\"token\"}}");
        respond("/openapi/devices",200,"{\"errorCode\":-1001,\"msg\":\"Failure\"}");
        MonitoringService service=mock(MonitoringService.class);
        OmadaGateway gateway=new OmadaGateway(clock,mock(DeviceRepository.class),service,base,"controller","client","secret",
            "/openapi/devices","","POST","status","1","0",180);
        assertThatThrownBy(()->gateway.pollSite("site")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(service);
    }
    @Test void notificationDeliveryUsesIdempotencyAndRetriesFailedRequests() {
        NotificationRepository repository=mock(NotificationRepository.class);
        Notification notice=new Notification(); notice.id=12L; notice.kind=RuleKind.ESCALATION;
        notice.method=DeliveryMethod.EMAIL; notice.message="Device disconnected"; notice.recipientsJson="[]";
        notice.nextAttempt=clock.instant();
        when(repository.findTop50ByDeliveryStateAndNextAttemptLessThanEqualOrderByCreatedAtAsc(any(),any())).thenReturn(List.of(notice));
        AtomicInteger calls=new AtomicInteger();
        server.createContext("/deliver",exchange->{
            assertThat(exchange.getRequestHeaders().getFirst("Idempotency-Key")).isEqualTo("ufo-monitoring-12");
            assertThat(exchange.getRequestHeaders().getFirst("Authorization")).isEqualTo("Bearer secret");
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(calls.getAndIncrement()==0?503:204,-1); exchange.close();
        });
        NotificationDispatcher dispatcher=new NotificationDispatcher(repository,clock,new ObjectMapper(),base+"/deliver","secret");
        dispatcher.dispatch();
        assertThat(notice.deliveryState).isEqualTo(DeliveryState.PENDING);
        assertThat(notice.attemptCount).isEqualTo(1);
        assertThat(notice.nextAttempt).isAfter(clock.instant());
        notice.nextAttempt=clock.instant(); dispatcher.dispatch();
        assertThat(notice.deliveryState).isEqualTo(DeliveryState.DELIVERED);
        assertThat(notice.deliveredAt).isEqualTo(clock.instant());
    }
}
