package com.ufo.monitoring;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/users")
public class UserController {
    private final UserService service;
    private final AppUserRepository users;
    UserController(UserService service,AppUserRepository users) {this.service=service;this.users=users;}
    @GetMapping Page<AppUser> list(@RequestParam(defaultValue="") String search,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) {
        if(page<0||size<1||size>200) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid page or size");
        return service.list(search,PageRequest.of(page,size,Sort.by("name")));
    }
    @GetMapping("/{id}") AppUser get(@PathVariable long id) {return service.get(id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) AppUser create(@Valid @RequestBody UserService.Create input) {return service.create(input);}
    @PutMapping("/{id}") AppUser update(@PathVariable long id,@Valid @RequestBody UserService.Update input) {return service.update(id,input);}
    @PatchMapping("/{id}/enabled") AppUser enabled(@PathVariable long id,@Valid @RequestBody UserService.Enabled input) {return service.enabled(id,input.enabled());}
    @PutMapping("/{id}/password") @ResponseStatus(HttpStatus.NO_CONTENT)
    void password(@PathVariable long id,@Valid @RequestBody UserService.Password input) {service.password(id,input.password());}
}
