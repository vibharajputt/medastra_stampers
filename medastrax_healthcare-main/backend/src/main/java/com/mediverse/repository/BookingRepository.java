package com.mediverse.repository;

import com.mediverse.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByPatientIdOrderByCreatedAtDesc(Long patientId);

    List<Booking> findByPatientIdAndFamilyMemberIdOrderByCreatedAtDesc(Long patientId, Long familyMemberId);

    List<Booking> findByPatientIdAndFamilyMemberIsNullOrderByCreatedAtDesc(Long patientId);

    List<Booking> findByDoctorIdOrderByCreatedAtDesc(Long doctorId);

    List<Booking> findByHospitalIdOrderByCreatedAtDesc(Long hospitalId);

    List<Booking> findByDoctorIdAndBookingDate(Long doctorId, LocalDate date);

    List<Booking> findByStatus(Booking.BookingStatus status);

    List<Booking> findAllByOrderByCreatedAtDesc();
}
