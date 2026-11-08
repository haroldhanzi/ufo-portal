package com.ufo.monitoring;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.authentication.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
@RestController @RequestMapping("/api/auth")
class AuthController {
    record Login(@NotBlank String email,@NotBlank String password) {}
    private final AuthenticationManager manager;
    private final AppUserRepository users;
    private final BearerSessions sessions;
    private final String siteId,siteName;
    AuthController(AuthenticationManager manager,AppUserRepository users,BearerSessions sessions,
                   @Value("${omada.site-id}") String siteId,@Value("${omada.site-name}") String siteName) {
        this.manager=manager;this.users=users;this.sessions=sessions;this.siteId=siteId;this.siteName=siteName;
    }
    @GetMapping("/me") AppUser me(java.security.Principal principal) {
        return users.findByEmail(principal.getName()).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Sign in required"));
    }
    @GetMapping("/config") Map<String,String> config(java.security.Principal principal) {
        AppUser user=me(principal);
        if(user.role==UserRole.SUPER_ADMIN) return Map.of("siteId",siteId,"siteName",siteName);
        return Map.of("siteId",user.siteId==null?"":user.siteId,"siteName",user.siteName==null?"Assigned site":user.siteName);
    }
    @PostMapping("/login") BearerSessions.LoginResult login(@Valid @RequestBody Login input) {
        try {
            var auth=manager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(input.email().trim().toLowerCase(java.util.Locale.ROOT),input.password()));
            return sessions.create(users.findByEmail(auth.getName()).orElseThrow());
        } catch(org.springframework.security.core.AuthenticationException error) {throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid email or password");}
    }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT) void logout(HttpServletRequest request) {
        sessions.revoke((Long)request.getAttribute("userSessionId"));
    }
}
