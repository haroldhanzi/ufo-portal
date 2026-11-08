package com.ufo.monitoring;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class MonitoringService {
    private final DeviceRepository devices;
    private final StatusChangeRepository changes;
    private final AlertRuleRepository rules;
    private final NotificationRepository notifications;
    private final Clock clock;
    private final ObjectMapper mapper;
    private final SiteAccess access;
    MonitoringService(DeviceRepository devices, StatusChangeRepository changes, AlertRuleRepository rules,
                      NotificationRepository notifications, Clock clock, ObjectMapper mapper,SiteAccess access) {
        this.devices=devices; this.changes=changes; this.rules=rules; this.notifications=notifications;
        this.clock=clock; this.mapper=mapper;this.access=access;
    }
    public static String normalizeMac(String mac) { return mac.replace('-', ':').toUpperCase(Locale.ROOT); }
    public void populateAlertContacts(List<Device> inventory) {
        if (inventory.isEmpty()) return;
        var byDevice = rules.findByDeviceIdIn(inventory.stream().map(d -> d.id).toList())
            .stream().filter(r -> r.maximumCount > 0 && r.targetState == DeviceState.DISCONNECTED)
            .collect(java.util.stream.Collectors.groupingBy(r -> r.deviceId));
        for (Device device : inventory) {
            var active = byDevice.getOrDefault(device.id, List.of());
            device.alertRecipients = contacts(active, RuleKind.NOTIFICATION);
            device.escalationRecipients = contacts(active, RuleKind.ESCALATION);
            device.escalationHours = active.stream().filter(r -> r.kind == RuleKind.ESCALATION)
                .map(r -> r.minimumSeconds / 3600.0).distinct().sorted().toList();
        }
    }
    private List<Requests.Recipient> contacts(List<AlertRule> active, RuleKind kind) {
        var result = new LinkedHashSet<Requests.Recipient>();
        for (AlertRule rule : active) if (rule.kind == kind) {
            try {
                result.addAll(Arrays.asList(mapper.readValue(rule.recipientsJson, Requests.Recipient[].class)));
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Unable to read alert recipients", e);
            }
        }
        return List.copyOf(result);
    }
    public Device requireDevice(long id) {
        Device device=devices.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Device not found"));
        access.requireSite(device.siteId);return device;
    }
    public Device create(Requests.DeviceInput input) {
        access.requireSite(input.siteId().trim());
        Device device=new Device();
        device.lastStatusChange=clock.instant();
        apply(device,input);
        return devices.saveAndFlush(device);
    }
    public Device update(long id, Requests.DeviceInput input) {
        Device device=requireDevice(id);
        if (!device.siteId.equals(input.siteId()) || !device.mac.equals(normalizeMac(input.mac()))) {
            throw new ResponseStatusException(BAD_REQUEST,"Site and MAC cannot change after registration");
        }
        apply(device,input);
        return devices.saveAndFlush(device);
    }
    public Device discoverAndObserve(String siteId,String mac,String name,DeviceState state,Instant observedAt) {
        access.requireSite(siteId);
        String normalized=normalizeMac(mac);
        Device device=devices.findBySiteIdAndMac(siteId,normalized).orElseGet(()-> {
            Device found=new Device();found.siteId=siteId;found.mac=normalized;
            found.deviceNumber=normalized;found.name=name.isBlank()?normalized:name.substring(0,Math.min(name.length(),200));
            found.location="";found.lastStatusChange=observedAt;return devices.saveAndFlush(found);
        });
        return observe(device.id,new Requests.Observation(state,observedAt));
    }
    private void apply(Device device, Requests.DeviceInput input) {
        device.siteId=input.siteId().trim(); device.mac=normalizeMac(input.mac());
        device.deviceNumber=input.deviceNumber().trim(); device.name=input.name().trim(); device.location=input.location().trim();
    }
    public Device observe(long id, Requests.Observation observation) {
        Device device=requireDevice(id);
        Instant now=clock.instant();
        if (observation.observedAt().isAfter(now.plusSeconds(30)))
            throw new ResponseStatusException(BAD_REQUEST,"Observation cannot be in the future");
        if (device.lastObserved!=null && !observation.observedAt().isAfter(device.lastObserved)) return device;
        device.lastObserved=observation.observedAt();
        if (device.currentState!=observation.state()) {
            device.previousState=device.currentState;
            device.currentState=observation.state(); device.lastStatusChange=observation.observedAt(); device.stateRevision++;
            StatusChange change=new StatusChange(); change.deviceId=device.id;
            change.previousState=device.previousState; change.currentState=device.currentState; change.changedAt=device.lastStatusChange;
            changes.save(change);
        }
        evaluate(device, now);
        return devices.save(device);
    }
    public AlertRule addRule(long deviceId, Requests.RuleInput input) {
        requireDevice(deviceId);
        try { ZoneId.of(input.zoneId()); } catch (DateTimeException error) { throw new ResponseStatusException(BAD_REQUEST,"Invalid time zone"); }
        if (input.overrideMac()!=null) {
            Device device=requireDevice(deviceId);
            String mac=normalizeMac(input.overrideMac());
            if (device.mac.equals(mac)) throw new ResponseStatusException(BAD_REQUEST,"Override must reference another device");
            if (devices.findBySiteIdAndMac(device.siteId,mac).isEmpty())
                throw new ResponseStatusException(BAD_REQUEST,"Override device must be registered at the same site");
        }
        for (Requests.Recipient recipient: input.recipients()) {
            if (input.method()!=DeliveryMethod.SMS && (recipient.email()==null || recipient.email().isBlank()))
                throw new ResponseStatusException(BAD_REQUEST,"Email recipients require an email address");
            if (input.method()!=DeliveryMethod.EMAIL && (recipient.mobile()==null || recipient.mobile().isBlank()))
                throw new ResponseStatusException(BAD_REQUEST,"SMS recipients require a mobile number");
        }
        AlertRule rule=new AlertRule(); rule.deviceId=deviceId; rule.kind=input.kind(); rule.method=input.method();
        rule.triggerType=input.triggerType(); rule.targetState=input.targetState(); rule.minimumSeconds=input.minimumSeconds();
        rule.repeatSeconds=input.repeatSeconds(); rule.maximumCount=input.maximumCount(); rule.startTime=input.startTime();
        rule.endTime=input.endTime(); rule.zoneId=input.zoneId();
        rule.overrideMac=input.overrideMac()==null?null:normalizeMac(input.overrideMac());
        try { rule.recipientsJson=mapper.writeValueAsString(input.recipients()); }
        catch (JsonProcessingException error) { throw new IllegalArgumentException("Cannot encode recipients",error); }
        return rules.save(rule);
    }
    public void deleteRule(long deviceId,long ruleId) {
        requireDevice(deviceId);
        AlertRule rule=rules.findById(ruleId).filter(r->r.deviceId==deviceId)
            .orElseThrow(()->new ResponseStatusException(NOT_FOUND,"Rule not found"));
        // Preserve the rule and its audit history; zero disables future notifications.
        rule.maximumCount=0;
    }
    public void evaluateAll() {
        Instant now=clock.instant();
        devices.findAll().forEach(device->evaluate(device,now));
    }
    void evaluate(Device device, Instant now) {
        for (AlertRule rule:rules.findByDeviceId(device.id)) {
            if (rule.maximumCount==0 || device.currentState==DeviceState.UNKNOWN || device.currentState!=rule.targetState) continue;
            if (!inWindow(now.atZone(ZoneId.of(rule.zoneId)).toLocalTime(),rule.startTime,rule.endTime)) continue;
            if (rule.overrideMac!=null && devices.findBySiteIdAndMac(device.siteId,rule.overrideMac)
                    .map(d->d.currentState!=DeviceState.CONNECTED).orElse(true)) continue;
            if (rule.triggerType==RuleTrigger.STATE_CHANGE && device.previousState==DeviceState.UNKNOWN) continue;
            if (Duration.between(device.lastStatusChange,now).getSeconds()<rule.minimumSeconds) continue;
            List<Notification> sent=notifications.findByRuleIdAndStateRevisionOrderBySequenceNumberAsc(rule.id,device.stateRevision);
            if (sent.size()>=rule.maximumCount || (rule.triggerType==RuleTrigger.STATE_CHANGE && !sent.isEmpty())) continue;
            if (!sent.isEmpty() && now.isBefore(sent.getLast().createdAt.plusSeconds(rule.repeatSeconds))) continue;
            Notification notice=new Notification(); notice.deviceId=device.id; notice.ruleId=rule.id; notice.kind=rule.kind;
            notice.stateRevision=device.stateRevision; notice.sequenceNumber=sent.size()+1; notice.method=rule.method;
            notice.recipientsJson=rule.recipientsJson; notice.createdAt=now; notice.nextAttempt=now;
            notice.message=rule.kind+": "+device.name+" ("+device.deviceNumber+", "+device.mac+") at "+device.location+
                " is "+device.currentState+" since "+device.lastStatusChange;
            notifications.save(notice);
        }
    }
    static boolean inWindow(LocalTime time,LocalTime start,LocalTime end) {
        if (start.equals(end)) return true;
        return start.isBefore(end) ? !time.isBefore(start)&&time.isBefore(end) : !time.isBefore(start)||time.isBefore(end);
    }
}
