package com.ufo.monitoring;
import jakarta.validation.constraints.*;
import java.time.Clock;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.http.HttpStatus.*;
@Service @Transactional
public class UserService {
    public record Create(@NotBlank @Size(max=200) String name,@NotBlank @Email @Size(max=200) String email,
                         @NotBlank @Size(min=12,max=72) String password,@NotNull UserRole role,@Size(max=100) String siteId) {}
    public record Update(@NotBlank @Size(max=200) String name,@NotBlank @Email @Size(max=200) String email,@NotNull UserRole role,@Size(max=100) String siteId) {}
    public record Password(@NotBlank @Size(min=12,max=72) String password) {}
    public record Enabled(@NotNull Boolean enabled) {}
    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final SiteCatalog sites;
    UserService(AppUserRepository users,PasswordEncoder encoder,Clock clock,SiteCatalog sites) { this.users=users;this.encoder=encoder;this.clock=clock;this.sites=sites; }
    private AppUser partnerActor() {
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if(auth==null) return null; // Trusted bootstrap and internal calls.
        AppUser actor=users.findByEmail(auth.getName()).filter(u->u.enabled)
            .orElseThrow(()->new ResponseStatusException(UNAUTHORIZED,"Sign in required"));
        if(actor.role==UserRole.SUPER_ADMIN)return null;
        if(actor.siteId==null||actor.siteId.isBlank())throw new ResponseStatusException(FORBIDDEN,"No site assigned to your account");
        return actor;
    }
    public org.springframework.data.domain.Page<AppUser> list(String search,org.springframework.data.domain.Pageable page) {
        AppUser actor=partnerActor();
        return actor==null?users.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(search,search,page):users.searchSiteUsers(actor.siteId,search,page);
    }
    public AppUser get(long id) {
        AppUser target=users.findById(id).orElseThrow(()->new ResponseStatusException(NOT_FOUND,"User not found"));
        AppUser actor=partnerActor();
        if(actor!=null&&(target.role!=UserRole.PORTAL_PARTNER||!actor.siteId.equals(target.siteId)))
            throw new ResponseStatusException(FORBIDDEN,"You can only manage users at your assigned site");
        return target;
    }
    private String assignedSite(UserRole role,String requestedSite) {
        AppUser actor=partnerActor();
        if(actor==null)return requestedSite;
        if(role!=UserRole.PORTAL_PARTNER)throw new ResponseStatusException(FORBIDDEN,"Only super administrators can assign administrator access");
        if(requestedSite!=null&&!requestedSite.isBlank()&&!actor.siteId.equals(requestedSite))
            throw new ResponseStatusException(FORBIDDEN,"You can only assign your own site");
        return actor.siteId;
    }
    public AppUser create(Create input) {
        String siteId=assignedSite(input.role(),input.siteId());
        AppUser user=new AppUser(); user.name=input.name().trim();user.email=input.email().trim().toLowerCase(Locale.ROOT);
        user.passwordHash=encoder.encode(input.password());user.role=input.role();user.createdAt=clock.instant();user.updatedAt=clock.instant();
        assignSite(user,siteId);
        return users.saveAndFlush(user);
    }
    public AppUser update(long id,Update input) {
        String siteId=assignedSite(input.role(),input.siteId());
        var admins=users.lockAdmins(); AppUser user=get(id);
        if(user.enabled&&user.role==UserRole.SUPER_ADMIN&&input.role()!=UserRole.SUPER_ADMIN&&admins.size()<=1)
            throw new ResponseStatusException(CONFLICT,"Cannot demote the last enabled administrator");
        String oldSite=user.siteId;UserRole oldRole=user.role;
        user.name=input.name().trim();user.email=input.email().trim().toLowerCase(Locale.ROOT);user.role=input.role();user.updatedAt=clock.instant();
        assignSite(user,siteId);
        if(!java.util.Objects.equals(oldSite,user.siteId)||oldRole!=user.role) user.authVersion++;
        return users.saveAndFlush(user);
    }
    public AppUser enabled(long id,boolean enabled) {
        var admins=users.lockAdmins(); AppUser user=get(id);
        if(!enabled&&user.enabled&&user.role==UserRole.SUPER_ADMIN&&admins.size()<=1)
            throw new ResponseStatusException(CONFLICT,"Cannot disable the last enabled administrator");
        if(enabled&&user.role==UserRole.PORTAL_PARTNER) sites.requireActive(user.siteId);
        if(user.enabled!=enabled) user.authVersion++;
        user.enabled=enabled;user.updatedAt=clock.instant();return users.save(user);
    }
    public void password(long id,String password) { AppUser user=get(id);user.passwordHash=encoder.encode(password);user.authVersion++;user.updatedAt=clock.instant(); }
    private void assignSite(AppUser user,String siteId) {
        if(user.role==UserRole.SUPER_ADMIN){user.siteId=null;user.siteName=null;return;}
        OmadaSite site=sites.requireActive(siteId);user.siteId=site.id;user.siteName=site.name;
    }
}
