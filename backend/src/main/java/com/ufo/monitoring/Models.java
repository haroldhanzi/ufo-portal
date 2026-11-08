package com.ufo.monitoring;

import jakarta.persistence.*;
import java.time.*;

enum DeviceState { UNKNOWN, CONNECTED, DISCONNECTED }
enum RuleKind { NOTIFICATION, ESCALATION }
enum DeliveryMethod { EMAIL, SMS, BOTH }
enum RuleTrigger { STATE, STATE_CHANGE, PERIOD_IN_STATE }
enum DeliveryState { PENDING, DELIVERED, FAILED }

@Entity @Table(name="device")
class Device {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @Version public long version;
    public String siteId, mac, deviceNumber, name, location;
    @Enumerated(EnumType.STRING) public DeviceState previousState = DeviceState.UNKNOWN;
    @Enumerated(EnumType.STRING) public DeviceState currentState = DeviceState.UNKNOWN;
    public Instant lastStatusChange, lastObserved;
    public long stateRevision;
    @Transient public java.util.List<Requests.Recipient> alertRecipients = java.util.List.of();
    @Transient public java.util.List<Requests.Recipient> escalationRecipients = java.util.List.of();
    @Transient public java.util.List<Double> escalationHours = java.util.List.of();
}
@Entity @Table(name="status_change")
class StatusChange {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    public Long deviceId;
    @Enumerated(EnumType.STRING) public DeviceState previousState, currentState;
    public Instant changedAt;
}
@Entity @Table(name="alert_rule")
class AlertRule {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    public Long deviceId;
    @Enumerated(EnumType.STRING) public RuleKind kind;
    @Enumerated(EnumType.STRING) public DeliveryMethod method;
    @Enumerated(EnumType.STRING) public RuleTrigger triggerType;
    @Enumerated(EnumType.STRING) public DeviceState targetState;
    public long minimumSeconds, repeatSeconds;
    public int maximumCount;
    public LocalTime startTime, endTime;
    public String zoneId, overrideMac;
    @Column(columnDefinition="TEXT") public String recipientsJson;
}
@Entity @Table(name="notification")
class Notification {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    public Long deviceId, ruleId;
    @Enumerated(EnumType.STRING) public RuleKind kind;
    public long stateRevision;
    public int sequenceNumber;
    @Enumerated(EnumType.STRING) public DeliveryMethod method;
    @Column(columnDefinition="TEXT") public String recipientsJson;
    @Column(length=2000) public String message;
    public Instant createdAt, deliveredAt, nextAttempt;
    @Enumerated(EnumType.STRING) public DeliveryState deliveryState = DeliveryState.PENDING;
    public int attemptCount;
}
