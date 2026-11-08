package com.ufo.monitoring;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.Instant;
enum UserRole { SUPER_ADMIN, PORTAL_PARTNER }
@Entity @Table(name="app_user")
public class AppUser {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @Version public long version;
    public long authVersion;
    public String name,email;
    public String siteId,siteName;
    @JsonIgnore public String passwordHash;
    @Enumerated(EnumType.STRING) public UserRole role;
    public boolean enabled=true;
    public Instant createdAt,updatedAt;
}
