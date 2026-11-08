package com.ufo.monitoring;
import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.atomic.*;
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
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:omada-session-test;MODE=MySQL;DB_CLOSE_DELAY=-1","omada.controller-id=controller",
    "omada.site-id=site","omada.client-id=client","omada.client-secret=secret","monitoring.tick-ms=3600000","logging.level.root=WARN","debug=false"})
@AutoConfigureMockMvc
class OmadaSessionIntegrationTest {
    static final AtomicInteger tokenCalls=new AtomicInteger(),resourceCalls=new AtomicInteger();
    static final AtomicBoolean rejectOnce=new AtomicBoolean();
    static final AtomicReference<byte[]> received=new AtomicReference<>();
    static final AtomicReference<String> contentType=new AtomicReference<>(),authorization=new AtomicReference<>();
    static final HttpServer server;
    static {
        try {
            server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
            server.createContext("/",exchange->{
                String path=exchange.getRequestURI().getPath(),body;
                if(path.equals("/openapi/authorize/token")) {
                    exchange.getRequestBody().readAllBytes();
                    body="{\"errorCode\":0,\"result\":{\"accessToken\":\"upstream-"+tokenCalls.incrementAndGet()+"\",\"expiresIn\":7200}}";
                } else {
                    resourceCalls.incrementAndGet();received.set(exchange.getRequestBody().readAllBytes());
                    contentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
                    body=rejectOnce.getAndSet(false)?"{\"errorCode\":-44112,\"msg\":\"Expired\"}":"{\"errorCode\":0,\"result\":[]}";
                }
                byte[] bytes=body.getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","application/json");
                exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
            });server.start();
        }catch(Exception error){throw new ExceptionInInitializerError(error);}
    }
    @DynamicPropertySource static void endpoint(DynamicPropertyRegistry properties) {properties.add("omada.base-url",()->"http://127.0.0.1:"+server.getAddress().getPort());}
    @AfterAll static void stop(){server.stop(0);}
    @Autowired MockMvc mvc;
    @Autowired UserService users;
    @Autowired AppUserRepository repository;
    @Autowired UserSessionRepository sessions;
    @Autowired ObjectMapper mapper;
    @Autowired OmadaSiteRepository sites;
    @BeforeEach void reset() {sessions.deleteAll();repository.deleteAll();tokenCalls.set(0);resourceCalls.set(0);rejectOnce.set(false);OmadaSite site=new OmadaSite();site.id="site";site.name="Test site";sites.save(site);}
    String login(UserRole role) throws Exception {
        String email="user"+repository.count()+"@example.com";users.create(new UserService.Create("User",email,"test-password-123",role,role==UserRole.SUPER_ADMIN?null:"site"));
        var result=mvc.perform(post("/api/auth/login").contentType("application/json").content("{\"email\":\""+email+"\",\"password\":\"test-password-123\"}"))
            .andExpect(status().isOk()).andReturn();
        return "Bearer "+mapper.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
    }
    @Test void loginDoesNotContactOmadaAndFirstRequestCachesTokenPerSession() throws Exception {
        String auth=login(UserRole.SUPER_ADMIN);assertThat(tokenCalls.get()).isZero();
        mvc.perform(get("/api/auth/config").header("Authorization",auth)).andExpect(status().isOk());assertThat(tokenCalls.get()).isZero();
        mvc.perform(get("/api/omada/v1/sites/site/portals").header("Authorization",auth)).andExpect(status().isOk());
        mvc.perform(get("/api/omada/v1/sites/site/hotspot/voucher-groups").header("Authorization",auth)).andExpect(status().isOk());
        assertThat(tokenCalls.get()).isEqualTo(1);assertThat(authorization.get()).isEqualTo("AccessToken=upstream-1");
        assertThat(sessions.findAll().getFirst().omadaAccessToken).isEqualTo("upstream-1");
        String second=login(UserRole.PORTAL_PARTNER);mvc.perform(get("/api/omada/v1/sites/site/portals").header("Authorization",second)).andExpect(status().isOk());
        assertThat(tokenCalls.get()).isEqualTo(2);
    }
    @Test void expiredTokenAndOmadaRejectionRenewAutomatically() throws Exception {
        String auth=login(UserRole.SUPER_ADMIN);mvc.perform(get("/api/omada/v1/sites/site/portals").header("Authorization",auth)).andExpect(status().isOk());
        UserSession session=sessions.findAll().getFirst();session.omadaExpiresAt=Instant.EPOCH;sessions.save(session);
        mvc.perform(get("/api/omada/v1/sites/site/portals").header("Authorization",auth)).andExpect(status().isOk());assertThat(tokenCalls.get()).isEqualTo(2);
        rejectOnce.set(true);mvc.perform(get("/api/omada/v1/sites/site/portals").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$.errorCode").value(0));
        assertThat(tokenCalls.get()).isEqualTo(3);assertThat(resourceCalls.get()).isEqualTo(4);
    }
    @Test void concurrentFirstRequestsAcquireOneToken() throws Exception {
        String auth=login(UserRole.SUPER_ADMIN);
        try(var executor=java.util.concurrent.Executors.newFixedThreadPool(4)) {
            var tasks=new java.util.ArrayList<java.util.concurrent.Future<?>>();
            for(int i=0;i<4;i++) tasks.add(executor.submit(()->{
                try {mvc.perform(get("/api/omada/v1/sites/site/portals").header("Authorization",auth)).andExpect(status().isOk());}
                catch(Exception error){throw new IllegalStateException(error);}
            }));
            for(var task:tasks) task.get(30,java.util.concurrent.TimeUnit.SECONDS);
        }
        assertThat(tokenCalls.get()).isEqualTo(1);assertThat(resourceCalls.get()).isEqualTo(4);
    }
    @Test void preservesMultipartBytesAndSupportsPatch() throws Exception {
        String auth=login(UserRole.PORTAL_PARTNER);byte[] bytes={0,13,10,(byte)255,(byte)128};
        mvc.perform(post("/api/omada/v1/sites/site/portal/pics?type=logo").header("Authorization",auth).contentType("multipart/form-data; boundary=example").content(bytes))
            .andExpect(status().isOk());assertThat(received.get()).containsExactly(bytes);assertThat(contentType.get()).contains("boundary=example");
        mvc.perform(patch("/api/omada/v1/sites/site/portal/123").header("Authorization",auth).contentType("application/json").content("{\"name\":\"Updated\"}"))
            .andExpect(status().isOk());assertThat(new String(received.get(),StandardCharsets.UTF_8)).contains("Updated");
    }
    @Test void rejectsUnauthenticatedViewerWritesAndUnconfiguredSiteWithoutContactingOmada() throws Exception {
        mvc.perform(get("/api/omada/v1/sites/site/portals")).andExpect(status().isUnauthorized());
        String auth=login(UserRole.PORTAL_PARTNER);
        mvc.perform(post("/api/omada/v1/sites/other/portal").header("Authorization",auth)).andExpect(status().isForbidden());
        mvc.perform(get("/api/omada/v1/sites/other/portals").header("Authorization",auth)).andExpect(status().isForbidden());
        mvc.perform(get("/api/omada/v1/sites/site/authorize/token").header("Authorization",auth)).andExpect(status().isBadRequest());
        assertThat(tokenCalls.get()).isZero();
    }
}
