package com.ufo.monitoring;
import java.util.List;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/sites")
class SiteController {
    private final SiteCatalog sites;
    SiteController(SiteCatalog sites){this.sites=sites;}
    @GetMapping List<OmadaSite> list(@RequestAttribute("userSessionId") long id){return sites.sync(id);}
}
