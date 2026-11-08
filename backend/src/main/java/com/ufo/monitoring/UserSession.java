package com.ufo.monitoring;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="user_session")
class UserSession {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) Long id;
    Long userId;
    String tokenHash;
    long authVersion;
    Instant expiresAt;
    boolean revoked;
    @Column(columnDefinition="TEXT") String omadaAccessToken;
    Instant omadaExpiresAt;
}
