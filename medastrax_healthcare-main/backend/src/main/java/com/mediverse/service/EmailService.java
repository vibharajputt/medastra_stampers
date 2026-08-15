package com.mediverse.service;

import com.mediverse.model.Booking;
import com.mediverse.model.Hospital;
import com.mediverse.dto.ContactFormRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String officialEmail;



    public void sendContactEmails(ContactFormRequest request) {
        try {
            // 1. Send notification email to team
            SimpleMailMessage teamMail = new SimpleMailMessage();
            teamMail.setFrom(officialEmail);
            teamMail.setTo(officialEmail);
            teamMail.setSubject("🔔 New Contact Inquiry from " + request.name());

            String phoneDisplay = (request.phone() == null || request.phone().trim().isEmpty()) ? "Not provided"
                    : request.phone();
            String teamBody = "You have received a new contact form submission.\n\n" +
                    "═══════════════════════════════════════\n" +
                    "           CUSTOMER DETAILS\n" +
                    "═══════════════════════════════════════\n\n" +
                    "👤 Name:     " + request.name() + "\n" +
                    "📧 Email:    " + request.email() + "\n" +
                    "📞 Phone:    " + phoneDisplay + "\n" +
                    "📋 Purpose:  " + request.purpose() + "\n\n" +
                    "═══════════════════════════════════════\n" +
                    "           QUERY / MESSAGE\n" +
                    "═══════════════════════════════════════\n\n" +
                    request.message() + "\n\n" +
                    "───────────────────────────────────────\n" +
                    "Please follow up with this lead within 24 hours.\n";
            teamMail.setText(teamBody);
            mailSender.send(teamMail);
            logger.info("📧 Contact detail notification email sent to team at {}", officialEmail);

            // 2. Send auto-reply confirmation email to customer
            SimpleMailMessage customerMail = new SimpleMailMessage();
            customerMail.setFrom(officialEmail);
            customerMail.setTo(request.email());
            customerMail.setSubject("Thank you for contacting Mediverse! 🏥");
            String customerBody = "Dear " + request.name() + ",\n\n" +
                    "Thank you for reaching out to Mediverse!\n\n" +
                    "We have received your message and our team will contact you within 24 hours.\n\n" +
                    "Here's a summary of your inquiry:\n" +
                    "• Purpose: " + request.purpose() + "\n" +
                    "• Message: " + request.message() + "\n\n" +
                    "If you have any urgent queries, feel free to reach us at " + officialEmail + "\n\n" +
                    "Best Regards,\n" +
                    "Team Mediverse\n" +
                    "Making Healthcare Smarter 🚀\n";
            customerMail.setText(customerBody);
            mailSender.send(customerMail);
            logger.info("📧 Auto-reply confirmation email sent to customer: {}", request.email());

        } catch (MailException ex) {
            logger.error("❌ Failed to send contact emails: {}", ex.getMessage(), ex);
            throw ex;
        }
    }

    // Mock email service for development
    public void sendBookingConfirmation(String toEmail, Booking booking, Hospital hospital) {
        logger.info("📧 [MOCK EMAIL] Sending booking confirmation to: {}", toEmail);
        logger.info("📧 Booking Details:");
        logger.info("   Hospital: {}", hospital.getName());
        logger.info("   Date: {}", booking.getBookingDate());
        logger.info("   Time: {}", booking.getTimeSlot());
        logger.info("   Type: {}", booking.getType());
        logger.info("   Status: {}", booking.getStatus());
        logger.info("📧 [MOCK EMAIL] Email sent successfully!");
    }

    public void sendPrescriptionNotification(String toEmail, String patientName, String doctorName) {
        logger.info("📧 [MOCK EMAIL] Sending prescription notification to: {}", toEmail);
        logger.info("   Patient: {}, Doctor: {}", patientName, doctorName);
        logger.info("📧 [MOCK EMAIL] Email sent successfully!");
    }
}
