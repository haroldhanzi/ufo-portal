package com.ufo.monitoring;

import java.time.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.*;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:monitoring-test;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "monitoring.api-key=test-key","monitoring.tick-ms=3600000","logging.level.root=WARN","debug=false"})
@AutoConfigureMockMvc
class MonitoringIntegrationTest {
    @TestConfiguration static class TimeConfiguration {
        @Bean @Primary MutableClock testClock() { return new MutableClock(); }
    }
    static class MutableClock extends Clock {
        Instant now=Instant.parse("2026-10-12T08:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
        void advance(long seconds) { now=now.plusSeconds(seconds); }
    }
    @Autowired MonitoringService service;
    @Autowired DeviceRepository devices;
    @Autowired NotificationRepository notices;
    @Autowired StatusChangeRepository history;
    @Autowired AlertRuleRepository rules;
    @Autowired MutableClock clock;
    @Autowired MockMvc mvc;
    @BeforeEach void reset() {
        notices.deleteAll(); rules.deleteAll(); history.deleteAll(); devices.deleteAll();
        clock.now=Instant.parse("2026-10-12T08:00:00Z");
    }
    Device device(String mac,String number) {
        return service.create(new Requests.DeviceInput("site-1",mac,number,"AP "+number,"Library"));
    }
    Requests.RuleInput rule(RuleKind kind,RuleTrigger trigger,long seconds,int maximum,String override) {
        return new Requests.RuleInput(kind,DeliveryMethod.EMAIL,trigger,DeviceState.DISCONNECTED,seconds,60,maximum,
            LocalTime.MIDNIGHT,LocalTime.MIDNIGHT,"Africa/Harare",override,
            List.of(new Requests.Recipient("Support","support@example.com",null)));
    }
    void observe(Device device,DeviceState state) { service.observe(device.id,new Requests.Observation(state,clock.instant())); }

    @Test void discoveryCreatesHardwareAndPreservesEditedMetadataOnLaterPolls() {
        Device found=service.discoverAndObserve("site-1","aa-bb-cc-dd-ee-01","Omada AP",DeviceState.CONNECTED,clock.instant());
        assertThat(found.currentState).isEqualTo(DeviceState.CONNECTED);
        service.update(found.id,new Requests.DeviceInput("site-1",found.mac,"AP-1","Custom name","Library"));
        clock.advance(30);
        Device again=service.discoverAndObserve("site-1","AA-BB-CC-DD-EE-01","Renamed upstream",DeviceState.DISCONNECTED,clock.instant());
        assertThat(devices.count()).isEqualTo(1);
        assertThat(again.id).isEqualTo(found.id);
        assertThat(again.name).isEqualTo("Custom name");
        assertThat(again.location).isEqualTo("Library");
        assertThat(again.deviceNumber).isEqualTo("AP-1");
        assertThat(again.previousState).isEqualTo(DeviceState.CONNECTED);
        assertThat(again.currentState).isEqualTo(DeviceState.DISCONNECTED);
    }
    @Test void inventoryIncludesOnlyActiveDisconnectionContactsAndEscalationHours() {
        Device d=device("aa-bb-cc-dd-ee-09","9");
        service.addRule(d.id,rule(RuleKind.NOTIFICATION,RuleTrigger.STATE_CHANGE,0,3,null));
        service.addRule(d.id,rule(RuleKind.ESCALATION,RuleTrigger.PERIOD_IN_STATE,5400,3,null));
        service.addRule(d.id,rule(RuleKind.ESCALATION,RuleTrigger.PERIOD_IN_STATE,7200,0,null));
        Device other=device("aa-bb-cc-dd-ee-10","10");
        service.populateAlertContacts(List.of(d,other));
        assertThat(d.alertRecipients).extracting(Requests.Recipient::name).containsExactly("Support");
        assertThat(d.escalationRecipients).extracting(Requests.Recipient::email).containsExactly("support@example.com");
        assertThat(d.escalationHours).containsExactly(1.5);
        assertThat(other.alertRecipients).isEmpty();
        assertThat(other.escalationHours).isEmpty();
    }
    @Test void tracksTransitionsAndRejectsOutOfOrderObservations() {
        Device d=device("aa-bb-cc-dd-ee-01","1"); observe(d,DeviceState.CONNECTED);
        clock.advance(10); observe(d,DeviceState.DISCONNECTED);
        service.observe(d.id,new Requests.Observation(DeviceState.CONNECTED,clock.instant().minusSeconds(20)));
        Device result=service.requireDevice(d.id);
        assertThat(result.mac).isEqualTo("AA:BB:CC:DD:EE:01");
        assertThat(result.previousState).isEqualTo(DeviceState.CONNECTED);
        assertThat(result.currentState).isEqualTo(DeviceState.DISCONNECTED);
        assertThat(result.lastStatusChange).isEqualTo(clock.instant());
        assertThat(history.count()).isEqualTo(2);
    }
    @Test void respectsEscalationDelayAndMaximumWithoutDuplicates() {
        Device d=device("AA:BB:CC:DD:EE:01","1");
        service.addRule(d.id,rule(RuleKind.ESCALATION,RuleTrigger.PERIOD_IN_STATE,3600,2,null));
        observe(d,DeviceState.DISCONNECTED); assertThat(notices.count()).isZero();
        clock.advance(3599); service.evaluateAll(); assertThat(notices.count()).isZero();
        clock.advance(1); service.evaluateAll(); service.evaluateAll(); assertThat(notices.count()).isEqualTo(1);
        clock.advance(60); service.evaluateAll(); assertThat(notices.count()).isEqualTo(2);
        clock.advance(60); service.evaluateAll(); assertThat(notices.count()).isEqualTo(2);
    }
    @Test void zeroDisablesAndUnknownDoesNotTrigger() {
        Device d=device("AA:BB:CC:DD:EE:01","1");
        service.addRule(d.id,rule(RuleKind.NOTIFICATION,RuleTrigger.STATE,0,0,null));
        observe(d,DeviceState.DISCONNECTED); assertThat(notices.count()).isZero();
        service.addRule(d.id,rule(RuleKind.NOTIFICATION,RuleTrigger.STATE,0,1,null));
        clock.advance(1); observe(d,DeviceState.UNKNOWN); service.evaluateAll(); assertThat(notices.count()).isZero();
    }
    @Test void disconnectedOverrideSuppressesUntilConnected() {
        Device gateway=device("AA:BB:CC:DD:EE:02","2");
        Device d=device("AA:BB:CC:DD:EE:01","1");
        service.addRule(d.id,rule(RuleKind.NOTIFICATION,RuleTrigger.STATE,0,1,gateway.mac));
        observe(d,DeviceState.DISCONNECTED); assertThat(notices.count()).isZero();
        observe(gateway,DeviceState.CONNECTED); service.evaluateAll(); assertThat(notices.count()).isEqualTo(1);
    }
    @Test void apiRequiresKeyAndValidatesAndIsolatesSite() throws Exception {
        mvc.perform(get("/api/monitoring/devices").param("siteId","site-1")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/monitoring/devices").header("X-API-Key","test-key").contentType("application/json")
            .content("{\"siteId\":\"site-1\",\"mac\":\"bad\",\"deviceNumber\":\"1\",\"name\":\"AP\",\"location\":\"Library\"}"))
            .andExpect(status().isBadRequest());
        Device d=device("AA:BB:CC:DD:EE:01","1");
        mvc.perform(get("/api/monitoring/devices").header("X-API-Key","test-key").param("siteId","other-site"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.page.totalElements").value(0));
        mvc.perform(post("/api/monitoring/devices/"+d.id+"/reboot").header("X-API-Key","test-key"))
            .andExpect(status().isConflict());
    }
    @Test void supportsOvernightWindows() {
        assertThat(MonitoringService.inWindow(LocalTime.of(1,0),LocalTime.of(22,0),LocalTime.of(6,0))).isTrue();
        assertThat(MonitoringService.inWindow(LocalTime.NOON,LocalTime.of(22,0),LocalTime.of(6,0))).isFalse();
    }
    @Test void stateChangeOnlyFiresOncePerTransition() {
        Device d=device("AA:BB:CC:DD:EE:01","1");
        service.addRule(d.id,rule(RuleKind.NOTIFICATION,RuleTrigger.STATE_CHANGE,0,10,null));
        observe(d,DeviceState.CONNECTED); clock.advance(1); observe(d,DeviceState.DISCONNECTED);
        clock.advance(100); service.evaluateAll(); assertThat(notices.count()).isEqualTo(1);
        observe(d,DeviceState.CONNECTED); clock.advance(1); observe(d,DeviceState.DISCONNECTED);
        assertThat(notices.count()).isEqualTo(2);
    }
}
