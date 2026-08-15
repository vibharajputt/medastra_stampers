package com.mediverse.repository;

import com.mediverse.model.Hospital;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HospitalRepository extends JpaRepository<Hospital, Long> {

    List<Hospital> findByDoctorId(Long doctorId);

    List<Hospital> findByCityContainingIgnoreCase(String city);

    List<Hospital> findByNameContainingIgnoreCase(String name);
}
