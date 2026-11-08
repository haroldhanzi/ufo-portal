package com.ufo.monitoring;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
@Service
public class SiteAccess {
    private final AppUserRepository users;
    SiteAccess(AppUserRepository users){this.users=users;}
    private AppUser actor() {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        // Scheduled jobs have no HTTP principal; the server-only ingestion key is also trusted.
        if(auth==null||auth.getName().equals("machine")) return null;
        return users.findByEmail(auth.getName()).filter(u->u.enabled)
            .orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"User not found"));
    }
    public void requireSite(String id) {
        AppUser user=actor();
        if(user!=null&&user.role==UserRole.PORTAL_PARTNER&&(user.siteId==null||!user.siteId.equals(id)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"This site is not assigned to your account");
    }
    public String inventorySite(String requested) {
        AppUser user=actor();
        if(user==null||user.role==UserRole.SUPER_ADMIN) return requested==null||requested.isBlank()?null:requested;
        requireSite(user.siteId);
        if(requested!=null&&!requested.isBlank()) requireSite(requested);
        return user.siteId;
    }
}
