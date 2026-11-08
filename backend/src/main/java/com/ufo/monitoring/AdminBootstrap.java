package com.ufo.monitoring;
import org.springframework.boot.*;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
@Component
class AdminBootstrap implements ApplicationRunner {
    private final UserService service;
    private final AppUserRepository users;
    private final String email,password;
    AdminBootstrap(UserService service,AppUserRepository users,@Value("${app.admin-email}") String email,@Value("${app.admin-password}") String password) {
        this.service=service;this.users=users;this.email=email;this.password=password;
    }
    public void run(ApplicationArguments args) {
        if(users.count()!=0||email.isBlank()||password.isBlank()) return;
        if(password.length()<12||password.length()>72) throw new IllegalArgumentException("Bootstrap password must be 12..72 characters");
        service.create(new UserService.Create("Super Administrator",email,password,UserRole.SUPER_ADMIN,null));
    }
}
