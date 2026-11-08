package com.ufo.monitoring;
import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
@Service
public class OmadaSessionClient {
    private final UserSessionRepository sessions;
    private final AppUserRepository users;
    private final Clock clock;
    private final RestClient client;
    private final ObjectMapper mapper;
    private final String controllerId,clientId,clientSecret;
    OmadaSessionClient(UserSessionRepository sessions,AppUserRepository users,Clock clock,ObjectMapper mapper,
        @Value("${omada.base-url}") String baseUrl,@Value("${omada.controller-id}") String controllerId,
        @Value("${omada.client-id}") String clientId,@Value("${omada.client-secret}") String clientSecret) {
        this.sessions=sessions;this.users=users;this.clock=clock;this.mapper=mapper;
        this.controllerId=controllerId;this.clientId=clientId;this.clientSecret=clientSecret;
        var factory=new org.springframework.http.client.JdkClientHttpRequestFactory(java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());factory.setReadTimeout(Duration.ofSeconds(15));
        client=RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    @Transactional
    public ResponseEntity<byte[]> exchange(long sessionId,HttpMethod method,String path,byte[] body,String contentType) {
        // Lock the bearer session through token acquisition and request/refresh; concurrent requests reuse its token.
        UserSession session=sessions.lockById(sessionId).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Session not found"));
        var user=users.findById(session.userId);
        if(session.revoked||!clock.instant().isBefore(session.expiresAt)||user.isEmpty()||!user.get().enabled||user.get().authVersion!=session.authVersion)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Session expired or invalid");
        if(controllerId.isBlank()||clientId.isBlank()||clientSecret.isBlank())
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Omada credentials are not configured on the server");
        try {
            if(session.omadaAccessToken==null||session.omadaExpiresAt==null||!clock.instant().isBefore(session.omadaExpiresAt.minusSeconds(60))) renew(session);
            ResponseEntity<byte[]> response=send(session,method,path,body,contentType);
            if(expired(response)) {renew(session);response=send(session,method,path,body,contentType);}
            if(response.getStatusCode().value()==401) return ResponseEntity.status(502).contentType(MediaType.APPLICATION_JSON)
                .body("{\"errorCode\":-1,\"msg\":\"Omada authentication failed\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return response;
        } catch(org.springframework.web.client.RestClientException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Unable to reach Omada");
        }
    }
    private void renew(UserSession session) {
        JsonNode response=client.post().uri("/openapi/authorize/token?grant_type=client_credentials").contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("omadacId",controllerId,"client_id",clientId,"client_secret",clientSecret)).retrieve().body(JsonNode.class);
        if(response==null||response.path("errorCode").asInt(-1)!=0||response.path("result").path("accessToken").asText().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Omada did not issue an access token");
        JsonNode result=response.path("result");session.omadaAccessToken=result.path("accessToken").asText();
        session.omadaExpiresAt=clock.instant().plusSeconds(result.path("expiresIn").asLong(7200));
    }
    private ResponseEntity<byte[]> send(UserSession session,HttpMethod method,String path,byte[] body,String contentType) {
        var request=client.method(method).uri(path).header("Authorization","AccessToken="+session.omadaAccessToken);
        if(contentType!=null) request.header("Content-Type",contentType);
        if(body!=null&&body.length>0) request.body(body);
        return request.exchange((req,res)-> {
            var builder=ResponseEntity.status(res.getStatusCode()).cacheControl(CacheControl.noStore());
            if(res.getHeaders().getContentType()!=null) builder.contentType(res.getHeaders().getContentType());
            return builder.body(res.getBody().readAllBytes());
        });
    }
    private boolean expired(ResponseEntity<byte[]> response) {
        if(response.getStatusCode().value()==401) return true;
        try {return response.getBody()!=null&&mapper.readTree(response.getBody()).path("errorCode").asInt()==-44112;}
        catch(Exception error){return false;}
    }
}
