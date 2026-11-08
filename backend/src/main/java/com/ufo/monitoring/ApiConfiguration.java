package com.ufo.monitoring;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.cors.*;
@Configuration
public class ApiConfiguration {
    @Bean PasswordEncoder passwordEncoder() {return new BCryptPasswordEncoder();}
    @Bean UserDetailsService userDetailsService(AppUserRepository users) {
        return email->{AppUser u=users.findByEmail(email.toLowerCase(java.util.Locale.ROOT)).orElseThrow(()->new UsernameNotFoundException("Invalid login"));
            return User.withUsername(u.email).password(u.passwordHash).roles(u.role.name()).disabled(!u.enabled).build();};
    }
    @Bean AuthenticationManager authenticationManager(UserDetailsService users,PasswordEncoder encoder) {
        var provider=new org.springframework.security.authentication.dao.DaoAuthenticationProvider(users);provider.setPasswordEncoder(encoder);return new ProviderManager(provider);
    }
    @Bean CorsConfigurationSource cors(@Value("${monitoring.cors-origin}") String origin) {
        var c=new CorsConfiguration();c.setAllowedOrigins(List.of(origin));c.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
        c.setAllowedHeaders(List.of("Content-Type","Authorization","X-API-Key"));
        var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/api/**",c);return source;
    }
    @Bean SecurityFilterChain security(HttpSecurity http,BearerSessions sessions,@Value("${monitoring.api-key}") String key) throws Exception {
        // Bearer credentials are explicitly supplied in headers; no cookie authentication is accepted.
        http.cors(c->{}).csrf(c->c.disable()).sessionManagement(c->c.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(c->c.disable()).formLogin(c->c.disable()).httpBasic(c->c.disable()).logout(c->c.disable())
            .exceptionHandling(c->c.authenticationEntryPoint((req,res,error)->json(res,401,"Sign in required"))
                .accessDeniedHandler((req,res,error)->json(res,403,"Access denied")))
            .authorizeHttpRequests(c->c.requestMatchers("/actuator/health","/api/auth/login").permitAll()
                .requestMatchers("/api/sites").hasRole("SUPER_ADMIN")
                .requestMatchers("/api/users/**","/api/users").hasAnyRole("SUPER_ADMIN","PORTAL_PARTNER")
                .requestMatchers("/api/omada/**").hasAnyRole("SUPER_ADMIN","PORTAL_PARTNER")
                .requestMatchers("/api/monitoring/**").hasAnyRole("SUPER_ADMIN","PORTAL_PARTNER","MONITORING_MACHINE")
                .requestMatchers("/api/auth/**").authenticated().anyRequest().denyAll());
        http.addFilterBefore(new OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
                String authorization=req.getHeader("Authorization");
                if(authorization!=null && !req.getRequestURI().equals("/api/auth/login")) {
                    var identity=authorization.startsWith("Bearer ")?sessions.authenticate(authorization.substring(7)):java.util.Optional.<BearerSessions.Identity>empty();
                    if(identity.isEmpty()){json(res,401,"Session expired or invalid");return;}
                    var user=identity.get().user();req.setAttribute("userSessionId",identity.get().sessionId());
                    SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated(user.email,null,
                        List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_"+user.role))));
                } else if(machineKey(req,key)) {
                    SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated("machine",null,
                        List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_MONITORING_MACHINE"))));
                }
                chain.doFilter(req,res);
            }
        },AnonymousAuthenticationFilter.class);
        return http.build();
    }
    private boolean machineKey(HttpServletRequest req,String key) {
        String supplied=req.getHeader("X-API-Key");return req.getRequestURI().startsWith("/api/monitoring/")&&!key.isBlank()&&supplied!=null&&
            MessageDigest.isEqual(key.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8));
    }
    static void json(HttpServletResponse res,int status,String message) throws IOException {
        res.setStatus(status);res.setContentType("application/json");res.getWriter().write("{\"message\":\""+message+"\"}");
    }
}
