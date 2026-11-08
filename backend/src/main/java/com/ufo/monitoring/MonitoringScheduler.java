package com.ufo.monitoring;

import java.time.Clock;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
class MonitoringScheduler {
    private static final Logger log=LoggerFactory.getLogger(MonitoringScheduler.class);
    private final DeviceRepository devices;
    private final MonitoringService service;
    private final OmadaGateway omada;
    private final Clock clock;
    private final long staleSeconds;
    MonitoringScheduler(DeviceRepository devices,MonitoringService service,OmadaGateway omada,Clock clock,
                        @Value("${monitoring.stale-seconds}") long staleSeconds) {
        this.devices=devices; this.service=service; this.omada=omada; this.clock=clock; this.staleSeconds=staleSeconds;
    }
    @Scheduled(fixedDelayString="${monitoring.tick-ms}",initialDelayString="${monitoring.tick-ms}")
    public void tick() {
        if (omada.pollingConfigured()) {
            var sites=new java.util.LinkedHashSet<>(devices.findAll().stream().map(d->d.siteId).toList());
            try {sites.addAll(omada.siteIds());}
            catch(RuntimeException error) {log.warn("Omada site discovery failed; polling known sites");}
            for (String site:sites) {
                try { omada.pollSite(site); }
                catch (RuntimeException error) { log.warn("Omada polling failed for site {}; preserving observations",site); }
            }
        }
        for (Device device:devices.findAll()) {
            if (device.currentState!=DeviceState.UNKNOWN && device.lastObserved!=null &&
                device.lastObserved.isBefore(clock.instant().minusSeconds(staleSeconds))) {
                try { service.observe(device.id,new Requests.Observation(DeviceState.UNKNOWN,clock.instant())); }
                catch (RuntimeException error) { log.warn("Could not expire stale observation for device {}",device.id); }
            }
        }
        try { service.evaluateAll(); }
        catch (RuntimeException error) { log.warn("Rule evaluation failed; will retry on next tick",error); }
    }
}
