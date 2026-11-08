package com.ufo.monitoring;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/monitoring")
public class MonitoringController {
    private final MonitoringService service;
    private final DeviceRepository devices;
    private final AlertRuleRepository rules;
    private final StatusChangeRepository changes;
    private final NotificationRepository notifications;
    private final OmadaGateway omada;
    private final SiteAccess access;
    private final OmadaSessionClient sessionClient;
    MonitoringController(MonitoringService service,DeviceRepository devices,AlertRuleRepository rules,
                         StatusChangeRepository changes,NotificationRepository notifications,OmadaGateway omada,SiteAccess access,OmadaSessionClient sessionClient) {
        this.service=service; this.devices=devices; this.rules=rules; this.changes=changes; this.notifications=notifications; this.omada=omada;this.access=access;
        this.sessionClient=sessionClient;
    }
    @GetMapping("/devices") Page<Device> list(@RequestParam(required=false) String siteId,@RequestParam(defaultValue="0") int page,
                                              @RequestParam(defaultValue="50") int size) {
        String site=access.inventorySite(siteId);var pageable=paging(page,size,"deviceNumber");
        var inventory=site==null?devices.findAll(pageable):devices.findBySiteId(site,pageable);
        service.populateAlertContacts(inventory.getContent());
        return inventory;
    }
    @PostMapping("/devices") @ResponseStatus(HttpStatus.CREATED)
    Device create(@Valid @RequestBody Requests.DeviceInput input) { return service.create(input); }
    @GetMapping("/devices/{id}") Device get(@PathVariable long id) { return service.requireDevice(id); }
    @PutMapping("/devices/{id}") Device update(@PathVariable long id,@Valid @RequestBody Requests.DeviceInput input) { return service.update(id,input); }
    @PostMapping("/devices/{id}/observations")
    Device observe(@PathVariable long id,@Valid @RequestBody Requests.Observation input) { return service.observe(id,input); }
    @GetMapping("/devices/{id}/history") Page<StatusChange> history(@PathVariable long id,@RequestParam(defaultValue="0") int page,
                                                                 @RequestParam(defaultValue="50") int size) {
        service.requireDevice(id); return changes.findByDeviceId(id,paging(page,size,"changedAt"));
    }
    @PostMapping("/devices/{id}/rules") @ResponseStatus(HttpStatus.CREATED)
    AlertRule addRule(@PathVariable long id,@Valid @RequestBody Requests.RuleInput input) { return service.addRule(id,input); }
    @GetMapping("/devices/{id}/rules") List<AlertRule> rules(@PathVariable long id) { service.requireDevice(id); return rules.findByDeviceId(id); }
    @DeleteMapping("/devices/{id}/rules/{ruleId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void disableRule(@PathVariable long id,@PathVariable long ruleId) { service.deleteRule(id,ruleId); }
    @GetMapping("/devices/{id}/notifications") Page<Notification> notifications(@PathVariable long id,
        @RequestParam(required=false) RuleKind kind,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) {
        service.requireDevice(id); Pageable pageable=paging(page,size,"createdAt");
        return kind==null?notifications.findByDeviceId(id,pageable):notifications.findByDeviceIdAndKind(id,kind,pageable);
    }
    @PostMapping("/devices/{id}/reboot") @ResponseStatus(HttpStatus.ACCEPTED)
    void reboot(@PathVariable long id,@RequestAttribute(value="userSessionId",required=false) Long sessionId) { omada.reboot(service.requireDevice(id),sessionId,sessionClient); }
    private Pageable paging(int page,int size,String field) {
        if (page<0 || size<1 || size>200) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,"Page must be >=0 and size 1..200");
        return PageRequest.of(page,size,Sort.by(field.equals("deviceNumber")?Sort.Direction.ASC:Sort.Direction.DESC,field));
    }
}
