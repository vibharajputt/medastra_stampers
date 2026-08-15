package com.mediverse.repository;

import com.mediverse.model.RiskAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RiskAssessmentRepository extends JpaRepository<RiskAssessment, Long> {

    // For time-series: all assessments for a patient newest-first
    List<RiskAssessment> findByPatientIdOrderByCreatedAtDesc(Long patientId);

    // Latest single assessment for a patient
    Optional<RiskAssessment> findTopByPatientIdOrderByCreatedAtDesc(Long patientId);

    // Last N assessments for time-series chart (Spring will limit via Pageable)
    List<RiskAssessment> findTop30ByPatientIdOrderByCreatedAtDesc(Long patientId);
}
