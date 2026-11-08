package com.ufo.monitoring;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
class OmadaProxyController {
    private final OmadaSessionClient client;
    private final String controllerId;
    private final SiteAccess access;
    OmadaProxyController(OmadaSessionClient client,@Value("${omada.controller-id}") String controllerId,SiteAccess access) {
        this.client=client;this.controllerId=controllerId;this.access=access;
    }
    @RequestMapping(value="/api/omada/{version:v[12]}/sites/{site}/{*resource}",method={RequestMethod.GET,RequestMethod.POST,RequestMethod.PUT,RequestMethod.PATCH,RequestMethod.DELETE})
    ResponseEntity<byte[]> proxy(@PathVariable String version,@PathVariable String site,@PathVariable String resource,
        @RequestBody(required=false) byte[] body,HttpServletRequest request) {
        Long sessionId=(Long)request.getAttribute("userSessionId");
        if(sessionId==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"User session required");
        access.requireSite(site);
        if(resource.contains("..")||resource.contains("%")||resource.contains("//")||
            !resource.matches("^/(wireless-network|time-range-profiles|portals?|hotspot|url-filters)(/.*)?$"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unsupported Omada resource");
        if(body!=null&&body.length>10*1024*1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"Maximum request size is 10 MB");
        String path="/openapi/"+version+"/"+encode(controllerId)+"/sites/"+encode(site)+resource;
        if(request.getQueryString()!=null) path+="?"+request.getQueryString();
        return client.exchange(sessionId,HttpMethod.valueOf(request.getMethod()),path,body,request.getContentType());
    }
    private String encode(String value) {return org.springframework.web.util.UriUtils.encodePathSegment(value,java.nio.charset.StandardCharsets.UTF_8);}
}
