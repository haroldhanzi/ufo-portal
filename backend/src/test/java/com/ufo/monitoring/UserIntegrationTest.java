package com.ufo.monitoring;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:users-test;MODE=MySQL;DB_CLOSE_DELAY=-1","monitoring.tick-ms=3600000","logging.level.root=WARN","debug=false"})
@AutoConfigureMockMvc
class UserIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserService service;
    @Autowired AppUserRepository users;
    @Autowired UserSessionRepository sessions;
    @Autowired OmadaSiteRepository sites;
    @Autowired PasswordEncoder encoder;
    @Autowired ObjectMapper mapper;
    @BeforeEach void reset(){sessions.deleteAll();users.deleteAll();OmadaSite site=new OmadaSite();site.id="site";site.name="Test site";sites.save(site);}
    AppUser user(String email,UserRole role){return service.create(new UserService.Create("Test User",email,"test-password-123",role,role==UserRole.SUPER_ADMIN?null:"site"));}
    String login(String email) throws Exception {
        var result=mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"email\":\""+email+"\",\"password\":\"test-password-123\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.tokenType").value("Bearer")).andExpect(jsonPath("$.user.passwordHash").doesNotExist()).andReturn();
        return "Bearer "+mapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
    }
    @Test void administratorCreatesUpdatesDisablesAndEnablesUsers() throws Exception {
        user("admin@example.com",UserRole.SUPER_ADMIN);String auth=login("admin@example.com");
        mvc.perform(post("/api/users").header("Authorization",auth).contentType("application/json")
            .content("{\"name\":\"Operator\",\"email\":\"operator@example.com\",\"password\":\"operator-password-123\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.passwordHash").doesNotExist());
        AppUser target=users.findByEmail("operator@example.com").orElseThrow();assertThat(encoder.matches("operator-password-123",target.passwordHash)).isTrue();
        mvc.perform(put("/api/users/"+target.id).header("Authorization",auth).contentType("application/json").content("{\"name\":\"Viewer\",\"email\":\"viewer@example.com\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("PORTAL_PARTNER"));
        mvc.perform(patch("/api/users/"+target.id+"/enabled").header("Authorization",auth).contentType("application/json").content("{\"enabled\":false}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
        mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"email\":\"viewer@example.com\",\"password\":\"operator-password-123\"}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/users/"+target.id+"/enabled").header("Authorization",auth).contentType("application/json").content("{\"enabled\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(true));
    }
    @Test void partnerListsSiteUsersAndForgedTokenIsRejected() throws Exception {
        user("viewer@example.com",UserRole.PORTAL_PARTNER);String auth=login("viewer@example.com");
        mvc.perform(get("/api/users").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$.page.totalElements").value(1));
        mvc.perform(get("/api/monitoring/devices").param("siteId","site").header("Authorization",auth)).andExpect(status().isOk());
        mvc.perform(post("/api/monitoring/devices/99999/reboot").header("Authorization",auth)).andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+"x".repeat(43))).andExpect(status().isUnauthorized());
    }
    @Test void disablingInvalidatesBearerEvenAfterReenablingAndLastAdminIsProtected() throws Exception {
        AppUser admin=user("admin@example.com",UserRole.SUPER_ADMIN),viewer=user("viewer@example.com",UserRole.PORTAL_PARTNER);String auth=login("viewer@example.com");
        service.enabled(viewer.id,false);mvc.perform(get("/api/auth/me").header("Authorization",auth)).andExpect(status().isUnauthorized());
        service.enabled(viewer.id,true);mvc.perform(get("/api/auth/me").header("Authorization",auth)).andExpect(status().isUnauthorized());
        assertThatThrownBy(()->service.enabled(admin.id,false)).hasMessageContaining("last enabled administrator");
        assertThatThrownBy(()->service.update(admin.id,new UserService.Update("Admin",admin.email,UserRole.PORTAL_PARTNER,null))).hasMessageContaining("last enabled administrator");
    }
    @Test void passwordResetInvalidatesBearerAndDuplicateEmailIsRejected() throws Exception {
        user("admin@example.com",UserRole.SUPER_ADMIN);String auth=login("admin@example.com");AppUser viewer=user("viewer@example.com",UserRole.PORTAL_PARTNER);String other=login("viewer@example.com");
        mvc.perform(put("/api/users/"+viewer.id+"/password").header("Authorization",auth).contentType("application/json").content("{\"password\":\"new-password-123\"}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization",other)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/users").header("Authorization",auth).contentType("application/json").content("{\"name\":\"Duplicate\",\"email\":\"VIEWER@example.com\",\"password\":\"duplicate-password\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site\"}"))
            .andExpect(status().isConflict());
    }
    @Test void logoutRevokesTokenAndDatabaseStoresOnlyItsHash() throws Exception {
        user("admin@example.com",UserRole.SUPER_ADMIN);String auth=login("admin@example.com");
        assertThat(sessions.findAll().getFirst().tokenHash).isNotEqualTo(auth.substring(7)).hasSize(64);
        mvc.perform(post("/api/auth/logout").header("Authorization",auth)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization",auth)).andExpect(status().isUnauthorized());
    }
    @Test void expiredBearerIsRejected() throws Exception {
        user("admin@example.com",UserRole.SUPER_ADMIN);String auth=login("admin@example.com");
        UserSession session=sessions.findAll().getFirst();session.expiresAt=java.time.Instant.EPOCH;sessions.save(session);
        mvc.perform(get("/api/auth/me").header("Authorization",auth)).andExpect(status().isUnauthorized());
    }
}
