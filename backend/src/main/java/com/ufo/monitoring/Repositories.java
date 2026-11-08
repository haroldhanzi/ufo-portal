package com.ufo.monitoring;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;

interface DeviceRepository extends JpaRepository<Device, Long> {
    Optional<Device> findBySiteIdAndMac(String siteId, String mac);
    List<Device> findBySiteId(String siteId);
    Page<Device> findBySiteId(String siteId, Pageable pageable);
}
interface StatusChangeRepository extends JpaRepository<StatusChange, Long> {
    Page<StatusChange> findByDeviceId(Long deviceId, Pageable pageable);
}
interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {
    List<AlertRule> findByDeviceIdIn(Collection<Long> deviceIds);
    List<AlertRule> findByDeviceId(Long deviceId);
}
interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRuleIdAndStateRevisionOrderBySequenceNumberAsc(Long ruleId, long revision);
    Page<Notification> findByDeviceId(Long deviceId, Pageable pageable);
    Page<Notification> findByDeviceIdAndKind(Long deviceId, RuleKind kind, Pageable pageable);
    List<Notification> findTop50ByDeliveryStateAndNextAttemptLessThanEqualOrderByCreatedAtAsc(DeliveryState state, java.time.Instant now);
}
