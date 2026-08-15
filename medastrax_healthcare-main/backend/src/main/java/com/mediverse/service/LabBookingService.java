package com.mediverse.service;

import com.mediverse.model.LabBooking;
import com.mediverse.model.User;
import com.mediverse.repository.LabBookingRepository;
import com.mediverse.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class LabBookingService {

    @Autowired
    private LabBookingRepository labBookingRepository;

    @Autowired
    private UserRepository userRepository;

    public LabBooking createBooking(Long patientId, String labName, String testsJson, String deliveryAddress,
                                    Double testAmount, Double collectionCharges, Double totalAmount, Long prescriptionId) {
        Optional<User> patientOpt = userRepository.findById(patientId);
        if (!patientOpt.isPresent()) {
            throw new RuntimeException("Patient not found");
        }
        LabBooking booking = new LabBooking();
        booking.setPatient(patientOpt.get());
        booking.setLabName(labName);
        booking.setTestsJson(testsJson);
        booking.setDeliveryAddress(deliveryAddress);
        booking.setStatus("PENDING");
        booking.setTestAmount(testAmount);
        booking.setCollectionCharges(collectionCharges);
        booking.setTotalAmount(totalAmount);
        booking.setPrescriptionId(prescriptionId);
        return labBookingRepository.save(booking);
    }

    public List<LabBooking> getBookingsByPatient(Long patientId) {
        return labBookingRepository.findByPatientId(patientId);
    }

    public List<LabBooking> getBookingsByLab(String labName) {
        return labBookingRepository.findByLabName(labName);
    }

    public LabBooking updateStatus(Long bookingId, String status) {
        LabBooking booking = labBookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        booking.setStatus(status);
        return labBookingRepository.save(booking);
    }

    public List<User> getAllLabs() {
        return userRepository.findByRole(User.Role.LAB);
    }
}
