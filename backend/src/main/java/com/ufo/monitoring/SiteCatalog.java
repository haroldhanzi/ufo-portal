package com.ufo.monitoring;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
@Service
public class SiteCatalog {
    private final OmadaSessionClient client;
    private final OmadaSiteRepository sites;
    private final ObjectMapper mapper;
    private final String controllerId;
    SiteCatalog(OmadaSessionClient client,OmadaSiteRepository sites,ObjectMapper mapper,@Value("${omada.controller-id}") String controllerId) {
        this.client=client;this.sites=sites;this.mapper=mapper;this.controllerId=controllerId;
    }
    @Transactional public List<OmadaSite> sync(long sessionId) {
        var found=new LinkedHashMap<String,OmadaSite>();
        for(int page=1;page<=1000;page++) {
            String path="/openapi/v1/"+org.springframework.web.util.UriUtils.encodePathSegment(controllerId,java.nio.charset.StandardCharsets.UTF_8)+"/sites?page="+page+"&pageSize=100";
            var response=client.exchange(sessionId,HttpMethod.GET,path,null,null);
            try {
                JsonNode envelope=mapper.readTree(response.getBody());
                if(!response.getStatusCode().is2xxSuccessful()||envelope.path("errorCode").asInt(-1)!=0)
                    throw new IllegalArgumentException("Omada rejected site request");
                JsonNode result=envelope.path("result"),data=result.isArray()?result:result.path("data");
                if(!data.isArray()) throw new IllegalArgumentException("Invalid site list");
                for(JsonNode row:data) {
                    String id=row.path("siteId").asText(row.path("id").asText());
                    String name=row.path("name").asText(row.path("siteName").asText(id));
                    if(id.isBlank()||id.length()>100||name.length()>200) throw new IllegalArgumentException("Invalid site information");
                    OmadaSite site=new OmadaSite();site.id=id;site.name=name.isBlank()?id:name;found.put(id,site);
                }
                if(result.isArray()||data.size()<100||page*100>=result.path("totalRows").asInt(Integer.MAX_VALUE)) break;
                if(page==1000) throw new IllegalArgumentException("Too many site pages");
            }catch(Exception error) {throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"Unable to load Omada sites");}
        }
        for(OmadaSite old:sites.findAll()) {old.active=found.containsKey(old.id);sites.save(old);}
        sites.saveAll(found.values());sites.flush();return sites.findByActiveTrueOrderByNameAsc();
    }
    public OmadaSite requireActive(String id) {
        if(id==null||id.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a site for the portal partner");
        return sites.findById(id).filter(s->s.active).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a valid active Omada site from the dropdown"));
    }
}
