package com.ufo.monitoring;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
interface AppUserRepository extends JpaRepository<AppUser,Long> {
    Optional<AppUser> findByEmail(String email);
    Page<AppUser> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name,String email,Pageable page);
    @Query("select u from AppUser u where u.role=com.ufo.monitoring.UserRole.PORTAL_PARTNER and u.siteId=:siteId and (lower(u.name) like lower(concat('%',:search,'%')) or lower(u.email) like lower(concat('%',:search,'%')))")
    Page<AppUser> searchSiteUsers(String siteId,String search,Pageable page);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from AppUser u where u.enabled=true and u.role=com.ufo.monitoring.UserRole.SUPER_ADMIN order by u.id")
    List<AppUser> lockAdmins();
}
