package com.ufo.monitoring;
import jakarta.persistence.*;
@Entity @Table(name="omada_site")
public class OmadaSite {
    @Id @Column(length=100) public String id;
    @Column(length=200) public String name;
    public boolean active=true;
}
