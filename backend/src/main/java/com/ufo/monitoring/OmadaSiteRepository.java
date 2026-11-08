package com.ufo.monitoring;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface OmadaSiteRepository extends JpaRepository<OmadaSite,String> {
    List<OmadaSite> findByActiveTrueOrderByNameAsc();
}
