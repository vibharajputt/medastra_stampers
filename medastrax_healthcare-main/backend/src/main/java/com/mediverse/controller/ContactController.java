package com.mediverse.controller;

import com.mediverse.dto.ContactFormRequest;
import com.mediverse.service.EmailService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ContactController {

    private static final Logger logger = LoggerFactory.getLogger(ContactController.class);

    @Autowired
    private EmailService emailService;

    @PostMapping("/contact")
    public ResponseEntity<Map<String, String>> handleContactSubmit(@Valid @RequestBody ContactFormRequest request) {
        Map<String, String> resp = new HashMap<>();
        try {
            logger.info("New Contact Form Submission: name='{}', email='{}', phone='{}', purpose='{}', message='{}'",
                    request.name(), request.email(), request.phone(), request.purpose(), request.message());

            try {
                emailService.sendContactEmails(request);
            } catch (Exception mailEx) {
                logger.error("SMTP email failed (inquiry logged anyway): {}", mailEx.getMessage());
            }

            resp.put("message", "Your message has been sent successfully!");
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            logger.error("Contact form submission error: {}", e.getMessage(), e);
            resp.put("error", "Failed to send message: " + e.getMessage());
            return ResponseEntity.status(500).body(resp);
        }
    }
}
