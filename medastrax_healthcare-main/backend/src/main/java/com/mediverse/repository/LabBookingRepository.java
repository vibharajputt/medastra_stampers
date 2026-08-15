package com.mediverse.repository;

import com.mediverse.model.LabBooking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LabBookingRepository extends JpaRepository<LabBooking, Long> {

    public List<LabBooking> findByPatientId(Long patientId);

    public List<LabBooking> findByLabName(String labName);

    public List<LabBooking> findByPrescriptionId(Long prescriptionId);
}
