package com.mediverse.service;

import com.mediverse.model.OtpVerification;
import com.mediverse.repository.OtpVerificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class OtpService {

    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);
    private static final int OTP_LENGTH = 6;
    private static final int OTP_EXPIRY_MINUTES = 5;
    private final SecureRandom secureRandom = new SecureRandom();

    @Autowired
    private OtpVerificationRepository otpRepository;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String officialEmail;

    /**
     * Generate and send OTP
     */
    @Transactional
    public String sendOtp(String identifier, OtpVerification.OtpType type) {
        if (type == OtpVerification.OtpType.PHONE) {
            if (identifier == null || !identifier.trim().matches("^\\d{10}$")) {
                throw new RuntimeException("Phone number must be exactly 10 digits");
            }
        }

        // Delete any existing OTP for this identifier+type
        otpRepository.deleteByIdentifierAndType(identifier, type);

        // Generate 6-digit OTP
        String otp = generateOtp();

        // Save to database
        OtpVerification otpVerification = new OtpVerification(identifier, otp, type);
        otpVerification.setExpiresAt(LocalDateTime.now().plusMinutes(OTP_EXPIRY_MINUTES));
        otpRepository.save(otpVerification);

        // Send OTP via appropriate channel
        if (type == OtpVerification.OtpType.EMAIL) {
            sendEmailOtp(identifier, otp);
        } else if (type == OtpVerification.OtpType.PHONE) {
            sendPhoneOtp(identifier, otp);
        }

        return otp;
    }

    /**
     * Verify OTP
     */
    @Transactional
    public boolean verifyOtp(String identifier, String otp, OtpVerification.OtpType type) {
        Optional<OtpVerification> optionalOtp = otpRepository
                .findTopByIdentifierAndTypeOrderByCreatedAtDesc(identifier, type);

        if (optionalOtp.isEmpty()) {
            logger.warn("🔒 No OTP found for {} ({})", identifier, type);
            return false;
        }

        OtpVerification otpVerification = optionalOtp.get();

        // Check if expired
        if (otpVerification.isExpired()) {
            logger.warn("🔒 OTP expired for {} ({})", identifier, type);
            return false;
        }

        // Check if already verified
        if (otpVerification.isVerified()) {
            logger.warn("🔒 OTP already used for {} ({})", identifier, type);
            return false;
        }

        // Check OTP match
        if (!otpVerification.getOtp().equals(otp)) {
            logger.warn("🔒 Invalid OTP for {} ({})", identifier, type);
            return false;
        }

        // Mark as verified
        otpVerification.setVerified(true);
        otpRepository.save(otpVerification);

        logger.info("✅ OTP verified for {} ({})", identifier, type);
        return true;
    }

    /**
     * Check if identifier is verified
     */
    public boolean isVerified(String identifier, OtpVerification.OtpType type) {
        Optional<OtpVerification> optionalOtp = otpRepository
                .findTopByIdentifierAndTypeOrderByCreatedAtDesc(identifier, type);
        return optionalOtp.isPresent() && optionalOtp.get().isVerified();
    }

    /**
     * Generate a 6-digit OTP
     */
    private String generateOtp() {
        int otp = 100000 + secureRandom.nextInt(900000);
        return String.valueOf(otp);
    }

    /**
     * Send OTP via email using JavaMailSender
     */
    private void sendEmailOtp(String email, String otp) {
        try {
            if (mailSender != null) {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(email);
                message.setSubject("🔐 Mediverse - Email Verification OTP");
                message.setText(
                        "Hello!\n\n" +
                                "Your email verification OTP for Mediverse is:\n\n" +
                                "    " + otp + "\n\n" +
                                "This OTP is valid for " + OTP_EXPIRY_MINUTES + " minutes.\n\n" +
                                "If you didn't request this, please ignore this email.\n\n" +
                                "— Team Mediverse");
                message.setFrom(officialEmail);
                mailSender.send(message);
                logger.info("📧 Email OTP sent successfully to: {}", email);
            } else {
                logger.info("📧 [MOCK EMAIL] OTP for {}: {}", email, otp);
            }
        } catch (Exception e) {
            // Log but don't fail - allow mock mode for development
            logger.warn("📧 Email sending failed (using mock mode). OTP for {}: {}", email, otp);
            logger.warn("📧 Error: {}", e.getMessage());
        }
    }

    /**
     * Send OTP via SMS (mock for dev - logs to console)
     * In production, integrate with Twilio/MSG91/Fast2SMS
     */
    private void sendPhoneOtp(String phone, String otp) {
        // For development: log the OTP to console
        // In production: integrate with SMS gateway (Twilio, MSG91, Fast2SMS etc.)
        logger.info("📱 ========================================");
        logger.info("📱  SMS OTP VERIFICATION");
        logger.info("📱  Phone: {}", phone);
        logger.info("📱  OTP: {}", otp);
        logger.info("📱  Valid for {} minutes", OTP_EXPIRY_MINUTES);
        logger.info("📱 ========================================");
    }
}
