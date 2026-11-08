package com.ufo.monitoring;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
interface UserSessionRepository extends JpaRepository<UserSession,Long> {
    Optional<UserSession> findByTokenHash(String hash);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from UserSession s where s.id=:id")
    Optional<UserSession> lockById(@Param("id") long id);
}
