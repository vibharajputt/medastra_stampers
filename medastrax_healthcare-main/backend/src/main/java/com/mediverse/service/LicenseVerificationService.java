package com.mediverse.service;

import java.util.Set;

import org.springframework.stereotype.Service;

@Service
public class LicenseVerificationService {

    private static final Set<String> VALID_LICENSES = Set.of(
            "43821",
            "67534",
            "29105",
            "78456",
            "51293",
            "84627",
            "39847"
    );

    public boolean verifyLicense(String licenseNo) {
        if (licenseNo == null || licenseNo.isBlank()) {
            return false;
        }
        return VALID_LICENSES.contains(licenseNo.trim());
    }

    // For pharmacy licenses we currently use the same static list.
    // This method is separate to allow different verification logic later.
    public boolean verifyPharmacyLicense(String licenseNo) {
        return verifyLicense(licenseNo);
    }

    public boolean verifyLabLicense(String licenseNo) {
        return verifyLicense(licenseNo);
    }
}
