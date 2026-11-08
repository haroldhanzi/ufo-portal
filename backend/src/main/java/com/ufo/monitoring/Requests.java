package com.ufo.monitoring;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.*;
import java.util.List;

public class Requests {
    public record DeviceInput(@NotBlank @Size(max=100) String siteId,
        @NotBlank @Pattern(regexp="(?i)[0-9a-f]{2}([:-][0-9a-f]{2}){5}") String mac,
        @NotBlank @Size(max=100) String deviceNumber, @NotBlank @Size(max=200) String name,
        @NotBlank @Size(max=300) String location) {}
    public record Observation(@NotNull DeviceState state, @NotNull Instant observedAt) {}
    public record Recipient(@NotBlank String name, @Email String email,
        @Pattern(regexp="^\\+?[0-9]{7,15}$") String mobile) {}
    public record RuleInput(@NotNull RuleKind kind, @NotNull DeliveryMethod method,
        @NotNull RuleTrigger triggerType, @NotNull DeviceState targetState,
        @Min(0) long minimumSeconds, @Min(1) long repeatSeconds, @Min(0) @Max(1000) int maximumCount,
        @NotNull LocalTime startTime, @NotNull LocalTime endTime, @NotBlank String zoneId,
        @Pattern(regexp="(?i)[0-9a-f]{2}([:-][0-9a-f]{2}){5}") String overrideMac,
        @NotEmpty @Size(max=100) List<@Valid Recipient> recipients) {}
}
