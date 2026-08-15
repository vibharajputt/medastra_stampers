package com.mediverse.repository;

import com.mediverse.model.OtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {

    Optional<OtpVerification> findTopByIdentifierAndTypeOrderByCreatedAtDesc(
            String identifier, OtpVerification.OtpType type);

    void deleteByIdentifierAndType(String identifier, OtpVerification.OtpType type);
}
