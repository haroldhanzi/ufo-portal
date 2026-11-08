package com.ufo.monitoring;
import java.time.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
@Service
public class BearerSessions {
    record LoginResult(String accessToken,String tokenType,Instant expiresAt,AppUser user) {}
    record Identity(long sessionId,AppUser user) {}
    private final UserSessionRepository sessions;
    private final AppUserRepository users;
    private final Clock clock;
    private final long seconds;
    private final SecureRandom random=new SecureRandom();
    BearerSessions(UserSessionRepository sessions,AppUserRepository users,Clock clock,@Value("${app.session-seconds:28800}") long seconds) {
        this.sessions=sessions;this.users=users;this.clock=clock;this.seconds=seconds;
    }
    @Transactional public LoginResult create(AppUser user) {
        byte[] bytes=new byte[32];random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        UserSession session=new UserSession();session.userId=user.id;session.tokenHash=hash(token);session.authVersion=user.authVersion;
        session.expiresAt=clock.instant().plusSeconds(seconds);sessions.save(session);
        return new LoginResult(token,"Bearer",session.expiresAt,user);
    }
    @Transactional(readOnly=true) public Optional<Identity> authenticate(String token) {
        if(token==null||token.length()!=43) return Optional.empty();
        return sessions.findByTokenHash(hash(token)).filter(s->!s.revoked&&clock.instant().isBefore(s.expiresAt))
            .flatMap(s->users.findById(s.userId).filter(u->u.enabled&&u.authVersion==s.authVersion).map(u->new Identity(s.id,u)));
    }
    @Transactional public void revoke(long id) {
        sessions.lockById(id).ifPresent(s->{s.revoked=true;s.omadaAccessToken=null;s.omadaExpiresAt=null;});
    }
    static String hash(String value) {
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException error){throw new IllegalStateException(error);}
    }
}
