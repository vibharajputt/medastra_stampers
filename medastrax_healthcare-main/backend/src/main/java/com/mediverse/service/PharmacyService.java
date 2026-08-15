package com.mediverse.service;

import com.mediverse.dto.PharmacyPriceRequest;
import com.mediverse.model.PharmacyMedicine;
import com.mediverse.model.Prescription;
import com.mediverse.model.User;
import com.mediverse.repository.PharmacyMedicineRepository;
import com.mediverse.repository.PrescriptionRepository;
import com.mediverse.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class PharmacyService {

    @Autowired
    private PharmacyMedicineRepository pharmacyMedicineRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private UserRepository userRepository;

    public List<PharmacyMedicine> setPrices(PharmacyPriceRequest request, Long pharmacyId) {
        User pharmacy = userRepository.findById(pharmacyId)
                .orElseThrow(() -> new RuntimeException("Pharmacy not found"));

        Prescription prescription = prescriptionRepository.findById(request.getPrescriptionId())
                .orElseThrow(() -> new RuntimeException("Prescription not found"));

        // Clear existing prices for this pharmacy-prescription combo
        List<PharmacyMedicine> existing = pharmacyMedicineRepository
                .findByPharmacyIdAndPrescriptionId(pharmacyId, request.getPrescriptionId());
        pharmacyMedicineRepository.deleteAll(existing);

        List<PharmacyMedicine> medicines = new ArrayList<>();
        for (PharmacyPriceRequest.MedicinePrice mp : request.getMedicines()) {
            PharmacyMedicine medicine = PharmacyMedicine.builder()
                    .pharmacy(pharmacy)
                    .prescription(prescription)
                    .medicineName(mp.getMedicineName())
                    .sellingPrice(mp.getSellingPrice())
                    .available(mp.getAvailable() != null ? mp.getAvailable() : true)
                    .notes(mp.getNotes())
                    .build();
            medicines.add(medicine);
        }

        return pharmacyMedicineRepository.saveAll(medicines);
    }

    public List<PharmacyMedicine> getPharmacyMedicines(Long pharmacyId) {
        return pharmacyMedicineRepository.findByPharmacyId(pharmacyId);
    }

    public Map<String, Object> getPharmaciesForPrescription(Long prescriptionId) {
        List<PharmacyMedicine> allMedicines = pharmacyMedicineRepository
                .findByPrescriptionId(prescriptionId);

        // Group by pharmacy
        Map<Long, List<PharmacyMedicine>> byPharmacy = allMedicines.stream()
                .collect(Collectors.groupingBy(pm -> pm.getPharmacy().getId()));

        List<Map<String, Object>> pharmacyList = new ArrayList<>();
        for (Map.Entry<Long, List<PharmacyMedicine>> entry : byPharmacy.entrySet()) {
            User pharmacy = entry.getValue().get(0).getPharmacy();
            List<PharmacyMedicine> meds = entry.getValue();

            Map<String, Object> pharmacyInfo = new HashMap<>();
            pharmacyInfo.put("pharmacyId", pharmacy.getId());
            pharmacyInfo.put("pharmacyName", pharmacy.getName());
            pharmacyInfo.put("email", pharmacy.getEmail());
            pharmacyInfo.put("phone", pharmacy.getPhone());
            pharmacyInfo.put("address", pharmacy.getAddress());
            pharmacyInfo.put("city", pharmacy.getCity());

            pharmacyInfo.put("medicines", meds.stream().map(m -> {
                Map<String, Object> medInfo = new HashMap<>();
                medInfo.put("name", m.getMedicineName());
                medInfo.put("price", m.getSellingPrice());
                medInfo.put("available", m.getAvailable());
                return medInfo;
            }).collect(Collectors.toList()));

            pharmacyInfo.put("totalPrice", meds.stream()
                    .filter(m -> m.getSellingPrice() != null)
                    .map(PharmacyMedicine::getSellingPrice)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add));

            pharmacyInfo.put("allAvailable", meds.stream()
                    .allMatch(m -> m.getAvailable() != null && m.getAvailable()));

            pharmacyList.add(pharmacyInfo);
        }

        // Sort by total price
        pharmacyList.sort((a, b) -> {
            java.math.BigDecimal priceA = (java.math.BigDecimal) a.get("totalPrice");
            java.math.BigDecimal priceB = (java.math.BigDecimal) b.get("totalPrice");
            return priceA.compareTo(priceB);
        });

        Map<String, Object> result = new HashMap<>();
        result.put("prescriptionId", prescriptionId);
        result.put("pharmacies", pharmacyList);
        result.put("totalPharmacies", pharmacyList.size());
        return result;
    }

    public List<User> getAllPharmacies() {
        return userRepository.findByRole(User.Role.PHARMACY);
    }

    public User updatePharmacyProfile(Long pharmacyId, Map<String, String> profileData) {
        User pharmacy = userRepository.findById(pharmacyId)
                .orElseThrow(() -> new RuntimeException("Pharmacy not found"));

        if (profileData.containsKey("name")) pharmacy.setName(profileData.get("name"));
        if (profileData.containsKey("phone")) pharmacy.setPhone(profileData.get("phone"));
        if (profileData.containsKey("address")) pharmacy.setAddress(profileData.get("address"));
        if (profileData.containsKey("city")) pharmacy.setCity(profileData.get("city"));

        return userRepository.save(pharmacy);
    }
}
