package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.model.FamilyMember;
import com.mediverse.model.User;
import com.mediverse.model.Booking;
import com.mediverse.model.Prescription;
import com.mediverse.model.PharmacyMedicine;
import com.mediverse.repository.BookingRepository;
import com.mediverse.repository.FamilyMemberRepository;
import com.mediverse.repository.PharmacyMedicineRepository;
import com.mediverse.repository.PrescriptionRepository;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/family-members")
public class FamilyMemberController {

    @Autowired
    private FamilyMemberRepository familyMemberRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private PharmacyMedicineRepository pharmacyMedicineRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @PostMapping
    public ResponseEntity<?> addFamilyMember(
            @RequestBody Map<String, Object> payload,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = extractUserId(authHeader);
            User user = authService.getUserById(userId);

            String name = (String) payload.get("name");
            Integer age = payload.get("age") != null ? Integer.valueOf(payload.get("age").toString()) : null;
            String gender = (String) payload.get("gender");
            String relation = (String) payload.get("relation");
            String phone = (String) payload.get("phone");
            String dob = (String) payload.get("dob");
            String bloodGroup = (String) payload.get("bloodGroup");
            String emergencyNumber = (String) payload.get("emergencyNumber");
            String preferredLanguage = (String) payload.get("preferredLanguage");
            String existingMedicalCondition = (String) payload.get("existingMedicalCondition");
            String idProof = (String) payload.get("idProof");
            String allergies = (String) payload.get("allergies");
            String currentMedication = (String) payload.get("currentMedication");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Name is required"));
            }

            if (phone != null && !phone.trim().isEmpty()) {
                if (!phone.trim().matches("^\\d{10}$")) {
                    return ResponseEntity.badRequest().body(ApiResponse.error("Phone number must be exactly 10 digits"));
                }
            }

            if (emergencyNumber != null && !emergencyNumber.trim().isEmpty()) {
                if (!emergencyNumber.trim().matches("^\\d{10}$")) {
                    return ResponseEntity.badRequest()
                            .body(ApiResponse.error("Emergency contact number must be exactly 10 digits"));
                }
            }

            FamilyMember member = new FamilyMember();
            member.setUser(user);
            member.setName(name);
            member.setAge(age);
            member.setGender(gender);
            member.setRelation(relation);
            member.setPhone(phone);
            member.setDob(dob);
            member.setBloodGroup(bloodGroup);
            member.setEmergencyNumber(emergencyNumber);
            member.setPreferredLanguage(preferredLanguage);
            member.setExistingMedicalCondition(existingMedicalCondition);
            member.setIdProof(idProof);
            member.setAllergies(allergies);
            member.setCurrentMedication(currentMedication);

            FamilyMember saved = familyMemberRepository.save(member);
            return ResponseEntity.ok(ApiResponse.success("Family member added successfully", toMap(saved)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getFamilyMembers(@RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = extractUserId(authHeader);
            List<FamilyMember> members = familyMemberRepository.findByUserIdOrderByCreatedAtDesc(userId);
            return ResponseEntity.ok(members.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteFamilyMember(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long userId = extractUserId(authHeader);
            FamilyMember member = familyMemberRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("Family member not found"));

            if (!member.getUser().getId().equals(userId)) {
                return ResponseEntity.status(403).body(ApiResponse.error("Access denied"));
            }

            // Delete bookings and their related data
            List<Booking> bookings = bookingRepository.findByPatientIdAndFamilyMemberIdOrderByCreatedAtDesc(userId, id);
            for (Booking booking : bookings) {
                List<Prescription> prescriptions = prescriptionRepository.findByBookingId(booking.getId());
                for (Prescription prescription : prescriptions) {
                    List<PharmacyMedicine> pmList = pharmacyMedicineRepository.findByPrescriptionId(prescription.getId());
                    pharmacyMedicineRepository.deleteAll(pmList);
                }
                prescriptionRepository.deleteAll(prescriptions);
            }
            bookingRepository.deleteAll(bookings);

            // Delete any remaining prescriptions directly tied to this family member
            List<Prescription> remainingPrescriptions = prescriptionRepository
                    .findByPatientIdAndFamilyMemberIdOrderByCreatedAtDesc(userId, id);
            for (Prescription p : remainingPrescriptions) {
                List<PharmacyMedicine> pmList = pharmacyMedicineRepository.findByPrescriptionId(p.getId());
                pharmacyMedicineRepository.deleteAll(pmList);
            }
            prescriptionRepository.deleteAll(remainingPrescriptions);

            familyMemberRepository.delete(member);
            return ResponseEntity.ok(ApiResponse.success("Family member removed successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private Map<String, Object> toMap(FamilyMember member) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", member.getId());
        m.put("name", member.getName());
        m.put("age", member.getAge());
        m.put("gender", member.getGender());
        m.put("relation", member.getRelation());
        m.put("phone", member.getPhone());
        m.put("dob", member.getDob());
        m.put("bloodGroup", member.getBloodGroup());
        m.put("emergencyNumber", member.getEmergencyNumber());
        m.put("preferredLanguage", member.getPreferredLanguage());
        m.put("existingMedicalCondition", member.getExistingMedicalCondition());
        m.put("idProof", member.getIdProof());
        m.put("allergies", member.getAllergies());
        m.put("currentMedication", member.getCurrentMedication());
        return m;
    }

    private Long extractUserId(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = tokenProvider.getEmailFromToken(token);
        return authService.getUserByEmail(email).getId();
    }
}
