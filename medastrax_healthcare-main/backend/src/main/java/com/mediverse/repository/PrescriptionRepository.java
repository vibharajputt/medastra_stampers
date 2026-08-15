package com.mediverse.repository;

import com.mediverse.model.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {

    List<Prescription> findByPatientIdOrderByCreatedAtDesc(Long patientId);

    List<Prescription> findByPatientIdAndFamilyMemberIdOrderByCreatedAtDesc(Long patientId, Long familyMemberId);

    List<Prescription> findByPatientIdAndFamilyMemberIsNullOrderByCreatedAtDesc(Long patientId);

    List<Prescription> findByDoctorIdOrderByCreatedAtDesc(Long doctorId);

    List<Prescription> findByBookingId(Long bookingId);

    List<Prescription> findByRouteTypeAndStatus(Prescription.RouteType routeType, Prescription.PrescriptionStatus status);

    List<Prescription> findByStatus(Prescription.PrescriptionStatus status);
}
