package com.ufo.monitoring;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.*;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:site-isolation;MODE=MySQL;DB_CLOSE_DELAY=-1",
    "omada.controller-id=controller","omada.client-id=client","omada.client-secret=secret","monitoring.tick-ms=3600000","logging.level.root=WARN","debug=false"})
@AutoConfigureMockMvc
class SiteIsolationIntegrationTest {
    static final HttpServer server;
    static {
        try {
            server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
            server.createContext("/",exchange->{
                exchange.getRequestBody().readAllBytes();String path=exchange.getRequestURI().getPath();
                String body=path.contains("authorize/token")?"{\"errorCode\":0,\"result\":{\"accessToken\":\"omada-token\",\"expiresIn\":7200}}":
                    path.endsWith("/sites")?"{\"errorCode\":0,\"result\":{\"data\":[{\"siteId\":\"site-a\",\"name\":\"Library\"},{\"siteId\":\"site-b\",\"name\":\"Campus\"}],\"totalRows\":2}}":
                    "{\"errorCode\":0,\"result\":[]}";
                byte[] bytes=body.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");
                exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
            });server.start();
        }catch(Exception error){throw new ExceptionInInitializerError(error);}
    }
    @DynamicPropertySource static void endpoint(DynamicPropertyRegistry p){p.add("omada.base-url",()->"http://127.0.0.1:"+server.getAddress().getPort());}
    @AfterAll static void stop(){server.stop(0);}
    @Autowired MockMvc mvc;
    @Autowired UserService users;
    @Autowired AppUserRepository userRows;
    @Autowired UserSessionRepository sessions;
    @Autowired OmadaSiteRepository sites;
    @Autowired MonitoringService monitoring;
    @Autowired DeviceRepository devices;
    @Autowired StatusChangeRepository changes;
    @Autowired AlertRuleRepository rules;
    @Autowired NotificationRepository notifications;
    @Autowired ObjectMapper mapper;
    String admin,partner;
    AppUser partnerUser;
    Device a,b;
    @BeforeEach void setup() throws Exception {
        notifications.deleteAll();rules.deleteAll();changes.deleteAll();devices.deleteAll();sessions.deleteAll();userRows.deleteAll();sites.deleteAll();
        users.create(new UserService.Create("Super admin","admin@example.com","test-password-123",UserRole.SUPER_ADMIN,null));
        admin=login("admin@example.com");
        mvc.perform(get("/api/sites").header("Authorization",admin)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        partnerUser=users.create(new UserService.Create("Partner","partner@example.com","test-password-123",UserRole.PORTAL_PARTNER,"site-a"));
        partner=login("partner@example.com");
        a=monitoring.create(new Requests.DeviceInput("site-a","AA:BB:CC:DD:EE:01","1","Library AP","Library"));
        b=monitoring.create(new Requests.DeviceInput("site-b","AA:BB:CC:DD:EE:02","2","Campus AP","Campus"));
    }
    String login(String email) throws Exception {
        var response=mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"email\":\""+email+"\",\"password\":\"test-password-123\"}"))
            .andExpect(status().isOk()).andReturn();return "Bearer "+mapper.readTree(response.getResponse().getContentAsString()).path("accessToken").asText();
    }
    @Test void administratorSelectsSiteAndPartnerReceivesItAutomatically() throws Exception {
        mvc.perform(post("/api/users").header("Authorization",admin).contentType("application/json")
            .content("{\"name\":\"New Partner\",\"email\":\"new@example.com\",\"password\":\"test-password-123\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site-b\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.siteId").value("site-b")).andExpect(jsonPath("$.siteName").value("Campus"));
        mvc.perform(get("/api/auth/config").header("Authorization",partner)).andExpect(status().isOk()).andExpect(jsonPath("$.siteId").value("site-a"));
        mvc.perform(get("/api/sites").header("Authorization",partner)).andExpect(status().isForbidden());
        mvc.perform(post("/api/users").header("Authorization",partner).contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest());
    }
    @Test void partnerCreatesAndManagesUsersAtOwnSiteAndRevokesTheirSessions() throws Exception {
        var response=mvc.perform(post("/api/users").header("Authorization",partner).contentType("application/json")
            .content("{\"name\":\"Colleague\",\"email\":\"colleague@example.com\",\"password\":\"test-password-123\",\"role\":\"PORTAL_PARTNER\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.siteId").value("site-a"))
            .andExpect(jsonPath("$.siteName").value("Library")).andExpect(jsonPath("$.passwordHash").doesNotExist()).andReturn();
        long id=mapper.readTree(response.getResponse().getContentAsString()).path("id").asLong();
        String colleague=login("colleague@example.com");
        mvc.perform(get("/api/users").header("Authorization",partner).param("search","colleague"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.page.totalElements").value(1));
        mvc.perform(put("/api/users/"+id).header("Authorization",partner).contentType("application/json")
            .content("{\"name\":\"Updated colleague\",\"email\":\"colleague@example.com\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site-a\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Updated colleague"));
        mvc.perform(patch("/api/users/"+id+"/enabled").header("Authorization",partner).contentType("application/json").content("{\"enabled\":false}"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization",colleague)).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/users/"+id+"/enabled").header("Authorization",partner).contentType("application/json").content("{\"enabled\":true}"))
            .andExpect(status().isOk());
        colleague=login("colleague@example.com");
        mvc.perform(put("/api/users/"+id+"/password").header("Authorization",partner).contentType("application/json").content("{\"password\":\"changed-password-123\"}"))
            .andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").header("Authorization",colleague)).andExpect(status().isUnauthorized());
    }
    @Test void partnerCannotSeeOrModifyOtherSitesOrEscalatePrivileges() throws Exception {
        AppUser foreign=users.create(new UserService.Create("Foreign","foreign@example.com","test-password-123",UserRole.PORTAL_PARTNER,"site-b"));
        AppUser superAdmin=userRows.findByEmail("admin@example.com").orElseThrow();
        mvc.perform(get("/api/users").header("Authorization",partner)).andExpect(status().isOk())
            .andExpect(jsonPath("$.page.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(partnerUser.id));
        mvc.perform(get("/api/users").header("Authorization",partner).param("search","foreign"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.page.totalElements").value(0));
        for(long id:new long[]{foreign.id,superAdmin.id}) {
            mvc.perform(get("/api/users/"+id).header("Authorization",partner)).andExpect(status().isForbidden());
            mvc.perform(put("/api/users/"+id).header("Authorization",partner).contentType("application/json")
                .content("{\"name\":\"Hijacked\",\"email\":\"hijacked@example.com\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site-a\"}"))
                .andExpect(status().isForbidden());
            mvc.perform(patch("/api/users/"+id+"/enabled").header("Authorization",partner).contentType("application/json").content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
            mvc.perform(put("/api/users/"+id+"/password").header("Authorization",partner).contentType("application/json").content("{\"password\":\"hijacked-password-123\"}"))
                .andExpect(status().isForbidden());
        }
        for(String assignment:new String[]{"\"role\":\"SUPER_ADMIN\"","\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site-b\""}) {
            mvc.perform(post("/api/users").header("Authorization",partner).contentType("application/json")
                .content("{\"name\":\"Forged\",\"email\":\"forged@example.com\",\"password\":\"test-password-123\","+assignment+"}"))
                .andExpect(status().isForbidden());
            mvc.perform(put("/api/users/"+partnerUser.id).header("Authorization",partner).contentType("application/json")
                .content("{\"name\":\"Partner\",\"email\":\"partner@example.com\","+assignment+"}"))
                .andExpect(status().isForbidden());
        }
        assertThat(userRows.findById(foreign.id).orElseThrow().name).isEqualTo("Foreign");
        assertThat(userRows.findByEmail("forged@example.com")).isEmpty();
    }
    @Test void adminSeesAllHardwareButPartnerOnlyAssignedSite() throws Exception {
        mvc.perform(get("/api/monitoring/devices").header("Authorization",admin)).andExpect(status().isOk()).andExpect(jsonPath("$.page.totalElements").value(2));
        mvc.perform(get("/api/monitoring/devices").header("Authorization",partner)).andExpect(status().isOk())
            .andExpect(jsonPath("$.page.totalElements").value(1)).andExpect(jsonPath("$.content[0].siteId").value("site-a"));
        mvc.perform(get("/api/monitoring/devices").param("siteId","site-b").header("Authorization",partner)).andExpect(status().isForbidden());
        mvc.perform(get("/api/monitoring/devices/"+a.id).header("Authorization",partner)).andExpect(status().isOk());
    }
    @Test void everyDeviceIdOperationChecksOwnership() throws Exception {
        String base="/api/monitoring/devices/"+b.id;
        for(String suffix:new String[]{"","/history","/rules","/notifications"})
            mvc.perform(get(base+suffix).header("Authorization",partner)).andExpect(status().isForbidden());
        mvc.perform(post(base+"/reboot").header("Authorization",partner)).andExpect(status().isForbidden());
        mvc.perform(post(base+"/observations").header("Authorization",partner).contentType("application/json").content("{\"state\":\"CONNECTED\",\"observedAt\":\"2026-01-01T00:00:00Z\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(put(base).header("Authorization",partner).contentType("application/json")
            .content("{\"siteId\":\"site-b\",\"mac\":\"AA:BB:CC:DD:EE:02\",\"deviceNumber\":\"2\",\"name\":\"Tampered\",\"location\":\"Campus\"}"))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/monitoring/devices").header("Authorization",partner).contentType("application/json")
            .content("{\"siteId\":\"site-b\",\"mac\":\"AA:BB:CC:DD:EE:03\",\"deviceNumber\":\"3\",\"name\":\"Tampered\",\"location\":\"Campus\"}"))
            .andExpect(status().isForbidden());
        assertThat(devices.findById(b.id).orElseThrow().name).isEqualTo("Campus AP");
    }
    @Test void partnerCanManageOwnOmadaSiteButCannotChangeUrlToAnotherSite() throws Exception {
        mvc.perform(get("/api/omada/v1/sites/site-a/portals").header("Authorization",partner)).andExpect(status().isOk());
        mvc.perform(post("/api/omada/v1/sites/site-a/portal").header("Authorization",partner).contentType("application/json").content("{}"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/omada/v1/sites/site-b/portals").header("Authorization",partner)).andExpect(status().isForbidden());
        mvc.perform(post("/api/omada/v1/sites/site-b/portal").header("Authorization",partner).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
    @Test void reassignmentRevokesExistingBearerAndNewLoginUsesNewSite() throws Exception {
        mvc.perform(put("/api/users/"+partnerUser.id).header("Authorization",admin).contentType("application/json")
            .content("{\"name\":\"Partner\",\"email\":\"partner@example.com\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"site-b\"}"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization",partner)).andExpect(status().isUnauthorized());
        String updated=login("partner@example.com");
        mvc.perform(get("/api/auth/config").header("Authorization",updated)).andExpect(status().isOk()).andExpect(jsonPath("$.siteId").value("site-b"));
        mvc.perform(get("/api/monitoring/devices").header("Authorization",updated)).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(b.id));
    }
    @Test void forgedSiteAssignmentIsRejected() throws Exception {
        mvc.perform(post("/api/users").header("Authorization",admin).contentType("application/json")
            .content("{\"name\":\"Partner\",\"email\":\"forged@example.com\",\"password\":\"test-password-123\",\"role\":\"PORTAL_PARTNER\",\"siteId\":\"not-a-site\"}"))
            .andExpect(status().isBadRequest());
    }
}
