package com.ufo.monitoring;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Component
public class OmadaGateway {
    private final RestClient client;
    private final Clock clock;
    private final String controllerId,clientId,clientSecret,devicesPath,rebootPath,stateField,connected,disconnected,rebootMethod;
    private final DeviceRepository devices;
    private final MonitoringService service;
    private String accessToken;
    private Instant expiresAt=Instant.EPOCH;
    private final long staleSeconds;
    OmadaGateway(Clock clock,DeviceRepository devices,MonitoringService service,
        @Value("${omada.base-url}") String baseUrl,@Value("${omada.controller-id}") String controllerId,
        @Value("${omada.client-id}") String clientId,@Value("${omada.client-secret}") String clientSecret,
        @Value("${omada.devices-path}") String devicesPath,@Value("${omada.reboot-path}") String rebootPath,
        @Value("${omada.reboot-method}") String rebootMethod,@Value("${omada.state-field}") String stateField,
        @Value("${omada.connected-value}") String connected,@Value("${omada.disconnected-value}") String disconnected,
        @Value("${monitoring.stale-seconds}") long staleSeconds) {
        var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000); factory.setReadTimeout(15000);
        this.client=RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.clock=clock; this.devices=devices; this.service=service; this.controllerId=controllerId;
        this.clientId=clientId; this.clientSecret=clientSecret; this.devicesPath=devicesPath; this.rebootPath=rebootPath;
        this.stateField=stateField; this.connected=connected; this.disconnected=disconnected; this.rebootMethod=rebootMethod;
        this.staleSeconds=staleSeconds;
    }
    boolean pollingConfigured() { return !devicesPath.isBlank()&&!connected.isBlank()&&!disconnected.isBlank()&&credentialsConfigured(); }
    private boolean credentialsConfigured() { return !controllerId.isBlank()&&!clientId.isBlank()&&!clientSecret.isBlank(); }
    private synchronized String token() {
        if (!credentialsConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Omada credentials are not configured");
        if (accessToken!=null && clock.instant().isBefore(expiresAt.minusSeconds(60))) return accessToken;
        JsonNode response=client.post().uri("/openapi/authorize/token?grant_type=client_credentials")
            .contentType(MediaType.APPLICATION_JSON).body(Map.of("omadacId",controllerId,"client_id",clientId,"client_secret",clientSecret))
            .retrieve().body(JsonNode.class);
        JsonNode result=result(response);
        accessToken=result.path("accessToken").asText();
        if (accessToken.isBlank()) throw new IllegalStateException("Omada token response has no access token");
        expiresAt=clock.instant().plusSeconds(result.path("expiresIn").asLong(7200));
        return accessToken;
    }
    static JsonNode result(JsonNode response) {
        if (response==null || response.path("errorCode").asInt(-1)!=0 || !response.has("result"))
            throw new IllegalStateException("Omada returned an unsuccessful or invalid response");
        return response.get("result");
    }
    void pollSite(String siteId) {
        int page=1;
        while (page<=1000) {
            String path=path(devicesPath,siteId,null);
            JsonNode result=result(client.get().uri(path+ (path.contains("?")?"&":"?")+"page="+page+"&pageSize=100")
                .header("Authorization","AccessToken="+token()).retrieve().body(JsonNode.class));
            JsonNode data=result.isArray()?result:result.path("data");
            if (!data.isArray()) throw new IllegalStateException("Omada device response must contain an array or result.data");
            Instant observedAt=clock.instant();
            for (JsonNode row:data) {
                String mac=row.path("mac").asText();
                String state=row.path(stateField).asText();
                DeviceState mapped=state.equals(connected)?DeviceState.CONNECTED:state.equals(disconnected)?DeviceState.DISCONNECTED:DeviceState.UNKNOWN;
                if (!mac.matches("(?i)[0-9a-f]{2}([:-][0-9a-f]{2}){5}")) continue;
                service.discoverAndObserve(siteId,mac,row.path("name").asText(),mapped,observedAt);
            }
            if (result.isArray() || data.size()<100 || page*100>=result.path("totalRows").asInt(Integer.MAX_VALUE)) return;
            page++;
        }
        throw new IllegalStateException("Omada device pagination exceeded 1000 pages");
    }
    public void reboot(Device device) {
        reboot(device,null,null);
    }
    public void reboot(Device device,Long sessionId,OmadaSessionClient sessionClient) {
        if (device.currentState!=DeviceState.CONNECTED || device.lastObserved==null ||
            device.lastObserved.isBefore(clock.instant().minusSeconds(staleSeconds)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Only recently observed connected devices can be rebooted");
        if (rebootPath.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Omada reboot endpoint is not configured");
        try {
            String rebootUrl=path(rebootPath,device.siteId,device.mac.replace(':','-'));
            JsonNode response;
            if(sessionId!=null) {
                var upstream=sessionClient.exchange(sessionId,HttpMethod.valueOf(rebootMethod),rebootUrl,null,null);
                if(!upstream.getStatusCode().is2xxSuccessful()) throw new IllegalStateException("Omada rejected reboot");
                try {response=new com.fasterxml.jackson.databind.ObjectMapper().readTree(upstream.getBody());}
                catch(java.io.IOException error){throw new IllegalStateException("Invalid reboot response",error);}
            } else response=client.method(HttpMethod.valueOf(rebootMethod)).uri(rebootUrl)
                .header("Authorization","AccessToken="+token()).retrieve().body(JsonNode.class);
            if (response==null) throw new IllegalStateException("Omada rejected reboot");
            int code=response.path("errorCode").asInt(-1);
            if(code!=0) {
                String reason=switch(code) {
                    case -39006 -> "Device no longer exists in Omada";
                    case -39007 -> "Device is not connected";
                    case -39008 -> "Device is upgrading; wait before rebooting";
                    case -39009 -> "Device is already rebooting";
                    case -39010 -> "Device is synchronizing configurations";
                    case -39011 -> "Controller is provisioning the device";
                    default -> "Omada could not send the reboot command";
                };
                throw new ResponseStatusException(code>=-39011&&code<=-39007?HttpStatus.CONFLICT:HttpStatus.BAD_GATEWAY,reason);
            }
        } catch (org.springframework.web.client.RestClientException|IllegalStateException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Omada reboot request failed");
        }
    }
    Set<String> siteIds() {
        var found=new LinkedHashSet<String>();
        for(int page=1;page<=1000;page++) {
            JsonNode result=result(client.get().uri(path("/openapi/v1/{omadacId}/sites", "",null)+"?page="+page+"&pageSize=100")
                .header("Authorization","AccessToken="+token()).retrieve().body(JsonNode.class));
            JsonNode data=result.path("data");
            if(!data.isArray()) throw new IllegalStateException("Invalid Omada site list");
            for(JsonNode row:data) {String id=row.path("siteId").asText();if(!id.isBlank())found.add(id);}
            if(data.size()<100||page*100>=result.path("totalRows").asLong(Long.MAX_VALUE))return found;
        }
        throw new IllegalStateException("Omada site pagination exceeded 1000 pages");
    }
    private String path(String template,String siteId,String mac) {
        if (!template.startsWith("/openapi/")) throw new IllegalStateException("Omada path must start with /openapi/");
        return template.replace("{omadacId}",encode(controllerId)).replace("{siteId}",encode(siteId))
            .replace("{deviceMac}",mac==null?"":encode(mac));
    }
    private String encode(String value) { return org.springframework.web.util.UriUtils.encodePathSegment(value,java.nio.charset.StandardCharsets.UTF_8); }
}
