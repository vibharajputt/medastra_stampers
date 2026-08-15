package com.mediverse.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediverse.dto.BookingRequest;
import com.mediverse.model.Booking;
import com.mediverse.model.FamilyMember;
import com.mediverse.model.Hospital;
import com.mediverse.model.PatientProfile;
import com.mediverse.model.User;
import com.mediverse.repository.BookingRepository;
import com.mediverse.repository.FamilyMemberRepository;
import com.mediverse.repository.HospitalRepository;
import com.mediverse.repository.PatientProfileRepository;
import com.mediverse.repository.UserRepository;

@Service
public class BookingService {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private FamilyMemberRepository familyMemberRepository;

    @Autowired
    private PatientProfileRepository patientProfileRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private com.mediverse.service.NotificationService notificationService;

    @Autowired
    private com.mediverse.service.ReminderService reminderService;

    @Value("${app.huggingface.token:}")
    private String hfToken;


    public Booking createBooking(BookingRequest request, Long patientId) {
        User patient = userRepository.findById(patientId)
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        FamilyMember familyMember = null;
        if (request.getFamilyMemberId() != null) {
            familyMember = familyMemberRepository.findById(request.getFamilyMemberId())
                    .orElseThrow(() -> new RuntimeException("Family member not found"));
        }

        Hospital hospital = hospitalRepository.findById(request.getHospitalId())
                .orElseThrow(() -> new RuntimeException("Hospital not found"));

        User doctor = userRepository.findById(request.getDoctorId())
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        java.time.LocalDate bookingDate = request.getBookingDate();
        if (bookingDate == null) {
            throw new RuntimeException("Booking date is required");
        }
        if (bookingDate.isBefore(java.time.LocalDate.now())) {
            throw new RuntimeException("Cannot book appointment for a past date");
        }

        String timeSlot = request.getTimeSlot();
        if (timeSlot == null || timeSlot.trim().isEmpty()) {
            throw new RuntimeException("Time slot is required");
        }

        List<String> availableSlots = getAvailableTimeSlots(doctor.getId(), bookingDate);
        if (!availableSlots.contains(timeSlot)) {
            throw new RuntimeException("The selected time slot is already booked or has passed");
        }

        Booking.BookingStatus bookingStatus = Booking.BookingStatus.PENDING;
        String paymentStatus = request.getPaymentStatus() != null ? request.getPaymentStatus().toUpperCase() : "PENDING";
        if (!"CASH".equalsIgnoreCase(request.getPaymentMethod()) || "PAID".equalsIgnoreCase(paymentStatus)) {
            bookingStatus = Booking.BookingStatus.CONFIRMED;
            paymentStatus = "PAID";
        }

        Booking booking = Booking.builder()
                .patient(patient)
                .familyMember(familyMember)
                .hospital(hospital)
                .doctor(doctor)
                .bookingDate(request.getBookingDate())
                .timeSlot(request.getTimeSlot())
                .type(Booking.BookingType.valueOf(request.getType().toUpperCase()))
                .status(bookingStatus)
                .notes(request.getNotes())
                .patientName(request.getPatientName() != null ? request.getPatientName() : (familyMember != null ? familyMember.getName() : patient.getName()))
                .patientPhone(request.getPatientPhone() != null ? request.getPatientPhone() : (familyMember != null ? familyMember.getPhone() : patient.getPhone()))
                .age(request.getAge() != null ? request.getAge() : (familyMember != null ? familyMember.getAge() : null))
                .gender(request.getGender() != null ? request.getGender() : (familyMember != null ? familyMember.getGender() : null))
                .symptoms(request.getSymptoms())
                .paymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod().toUpperCase() : "CASH")
                .paymentStatus(paymentStatus)
                .build();

        // Analyze previous prescription for new user if uploaded
        Optional<PatientProfile> profileOpt = patientProfileRepository.findByUserId(patient.getId());
        if (profileOpt.isPresent()) {
            PatientProfile profile = profileOpt.get();
            if (Boolean.TRUE.equals(profile.getIsFirstTimeUser()) &&
                profile.getPrescriptionReportUrl() != null &&
                !profile.getPrescriptionReportUrl().trim().isEmpty()) {
                
                String summary = generatePrescriptionSummary(profile, booking);
                booking.setPreviousPrescriptionSummary(summary);
                
                // Mark user as no longer a new patient for subsequent bookings
                profile.setIsFirstTimeUser(false);
                patientProfileRepository.save(profile);
            }
        }

        // Compute initial condition badge based on symptoms & previous prescription summary
        String profileConditions = "";
        String profileMedications = "";
        String profileAllergies = "";
        if (profileOpt.isPresent()) {
            PatientProfile profile = profileOpt.get();
            profileConditions = profile.getExistingMedicalCondition() != null ? profile.getExistingMedicalCondition() : "";
            profileMedications = profile.getCurrentMedication() != null ? profile.getCurrentMedication() : "";
            profileAllergies = profile.getAllergies() != null ? profile.getAllergies() : "";
        }
        
        BadgeResult initialBadge = computeConditionBadge(
            booking.getSymptoms(), 
            booking.getPreviousPrescriptionSummary(),
            profileConditions,
            profileMedications,
            profileAllergies
        );
        booking.setConditionBadge(initialBadge.badge);
        booking.setConditionBadgeReason(initialBadge.reason);

        // Initialize default recommendations based on symptoms
        booking.setAiRecommendations(generateRecommendations(null, booking.getSymptoms()));

        booking = bookingRepository.save(booking);

        // Send confirmation email
        emailService.sendBookingConfirmation(patient.getEmail(), booking, hospital);

        // Create server-side notifications for patient and doctor
        try {
            String patientTitle = "Booking Confirmed";
            String patientMessage = String.format("Your booking with Dr. %s is confirmed for %s %s.", doctor.getName(), booking.getBookingDate().toString(), booking.getTimeSlot());
            notificationService.createNotification("PATIENT", patient.getId(), patientTitle, patientMessage);

            String doctorTitle = "New Booking";
            String doctorMessage = String.format("%s booked %s %s at %s.", booking.getPatientName(), booking.getBookingDate().toString(), booking.getTimeSlot(), hospital.getName());
            notificationService.createNotification("DOCTOR", doctor.getId(), doctorTitle, doctorMessage);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to create notifications: " + e.getMessage());
        }

        return booking;
    }

    public List<Booking> getPatientBookings(Long patientId) {
        return bookingRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public List<Booking> getPatientBookings(Long patientId, Long familyMemberId) {
        if (familyMemberId != null && familyMemberId > 0) {
            return bookingRepository.findByPatientIdAndFamilyMemberIdOrderByCreatedAtDesc(patientId, familyMemberId);
        } else {
            return bookingRepository.findByPatientIdAndFamilyMemberIsNullOrderByCreatedAtDesc(patientId);
        }
    }

    public List<Booking> getDoctorBookings(Long doctorId) {
        return bookingRepository.findAllByOrderByCreatedAtDesc();
    }

    public Booking updateBookingStatus(Long bookingId, String status, Long userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        booking.setStatus(Booking.BookingStatus.valueOf(status.toUpperCase()));
        return bookingRepository.save(booking);
    }

    public Booking rescheduleBooking(Long bookingId, java.time.LocalDate newDate, String newTimeSlot, Long userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!booking.getPatient().getId().equals(userId) && !booking.getDoctor().getId().equals(userId)) {
            throw new RuntimeException("Unauthorized to reschedule this booking");
        }

        if (newDate.isBefore(java.time.LocalDate.now())) {
            throw new RuntimeException("Cannot reschedule appointment to a past date");
        }

        if (booking.getStatus() != Booking.BookingStatus.PENDING && booking.getStatus() != Booking.BookingStatus.CONFIRMED) {
            throw new RuntimeException("Only pending or confirmed appointments can be rescheduled");
        }

        if (!(booking.getBookingDate().equals(newDate) && booking.getTimeSlot().equalsIgnoreCase(newTimeSlot))) {
            List<String> availableSlots = getAvailableTimeSlots(booking.getDoctor().getId(), newDate);
            if (!availableSlots.contains(newTimeSlot)) {
                throw new RuntimeException("The selected time slot is already booked or unavailable");
            }
        }

        booking.setBookingDate(newDate);
        booking.setTimeSlot(newTimeSlot);
        Booking updatedBooking = bookingRepository.save(booking);

        try {
            String patientTitle = "Appointment Rescheduled";
            String patientMessage = String.format("Your appointment with Dr. %s has been rescheduled to %s %s.", 
                    booking.getDoctor().getName(), 
                    newDate.toString(), 
                    newTimeSlot);
            notificationService.createNotification("PATIENT", booking.getPatient().getId(), patientTitle, patientMessage);

            String doctorTitle = "Appointment Rescheduled";
            String doctorMessage = String.format("Appointment with %s has been rescheduled to %s %s.", 
                    booking.getPatientName(), 
                    newDate.toString(), 
                    newTimeSlot);
            notificationService.createNotification("DOCTOR", booking.getDoctor().getId(), doctorTitle, doctorMessage);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to create reschedule notifications: " + e.getMessage());
        }

        return updatedBooking;
    }


    public Booking getBookingById(Long bookingId) {
        return bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
    }

    public static java.time.LocalTime parseSlotTime(String slot) {
        if (slot == null || slot.trim().isEmpty()) {
            return null;
        }
        try {
            String[] parts = slot.trim().split("\\s+");
            if (parts.length < 2) return null;
            String timePart = parts[0];
            String ampm = parts[1].toUpperCase();
            String[] timeSplit = timePart.split(":");
            if (timeSplit.length < 2) return null;
            int hour = Integer.parseInt(timeSplit[0]);
            int minute = Integer.parseInt(timeSplit[1]);
            if ("PM".equals(ampm) && hour < 12) {
                hour += 12;
            }
            if ("AM".equals(ampm) && hour == 12) {
                hour = 0;
            }
            return java.time.LocalTime.of(hour, minute);
        } catch (Exception e) {
            return null;
        }
    }

    public List<String> getAvailableTimeSlots(Long doctorId, java.time.LocalDate date) {
        if (date.isBefore(java.time.LocalDate.now())) {
            return new ArrayList<>();
        }

        List<String> allSlots = Arrays.asList(
                "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
                "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
                "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM",
                "04:00 PM", "04:30 PM", "05:00 PM", "05:30 PM",
                "06:00 PM", "06:15 PM", "06:30 PM", "07:00 PM", "07:30 PM",
                "08:00 PM", "08:30 PM", "09:00 PM"
        );

        List<Booking> existingBookings = bookingRepository.findByDoctorIdAndBookingDate(doctorId, date);
        List<String> bookedSlots = existingBookings.stream()
                .filter(b -> b.getStatus() != Booking.BookingStatus.CANCELLED)
                .map(Booking::getTimeSlot)
                .toList();

        java.time.LocalTime nowTime = java.time.LocalTime.now();
        boolean isToday = date.equals(java.time.LocalDate.now());

        return allSlots.stream()
                .filter(slot -> !bookedSlots.contains(slot))
                .filter(slot -> {
                    if (isToday) {
                        java.time.LocalTime slotTime = parseSlotTime(slot);
                        return slotTime != null && slotTime.isAfter(nowTime);
                    }
                    return true;
                })
                .toList();
    }

    public Booking updateMeetingLink(Long bookingId, String meetingLink) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));
        booking.setMeetingLink(meetingLink);
        return bookingRepository.save(booking);
    }

    public Booking updateAiReport(Long bookingId, String aiReport) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        booking.setAiReport(aiReport);

        // Generate recommendations on the AI summary
        booking.setAiRecommendations(generateRecommendations(aiReport, booking.getSymptoms()));

        // If AI report contains medicine/exercise cues, send SMS reminders to patient.
        try {
            reminderService.sendMedicineAndExerciseRemindersIfDue(booking);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to send Twilio reminders: " + e.getMessage());
        }

        // Fetch patient profile details
        String profileConditions = "";
        String profileMedications = "";
        String profileAllergies = "";
        Optional<PatientProfile> profileOpt = patientProfileRepository.findByUserId(booking.getPatient().getId());
        if (profileOpt.isPresent()) {
            PatientProfile profile = profileOpt.get();
            profileConditions = profile.getExistingMedicalCondition() != null ? profile.getExistingMedicalCondition() : "";
            profileMedications = profile.getCurrentMedication() != null ? profile.getCurrentMedication() : "";
            profileAllergies = profile.getAllergies() != null ? profile.getAllergies() : "";
        }

        // Compute a color-coded badge for doctor visibility based on AI report / text content.
        BadgeResult badge = computeConditionBadge(
            aiReport, 
            booking.getPreviousPrescriptionSummary(),
            profileConditions,
            profileMedications,
            profileAllergies
        );
        booking.setConditionBadge(badge.badge);
        booking.setConditionBadgeReason(badge.reason);

        return bookingRepository.save(booking);
    }

    private static class BadgeResult {
        private final String badge;
        private final String reason;

        private BadgeResult(String badge, String reason) {
            this.badge = badge;
            this.reason = reason;
        }
    }

    private BadgeResult computeConditionBadge(String aiReport, String prescriptionSummary, String profileConditions, String profileMedications, String profileAllergies) {
        StringBuilder scanTextBuilder = new StringBuilder();
        if (aiReport != null) scanTextBuilder.append(aiReport).append(" ");
        if (prescriptionSummary != null) scanTextBuilder.append(prescriptionSummary).append(" ");
        if (profileConditions != null) scanTextBuilder.append(profileConditions).append(" ");
        if (profileMedications != null) scanTextBuilder.append(profileMedications).append(" ");
        if (profileAllergies != null) scanTextBuilder.append(profileAllergies).append(" ");
        
        String scanText = scanTextBuilder.toString().toLowerCase();

        // 🔴 Emergency / Red flags
        List<String> redFlags = Arrays.asList(
                "chest pain", "severe chest", "heart attack", "myocardial infarction",
                "difficulty breathing", "shortness of breath", "severe shortness",
                "stroke", "face drooping", "arm weakness", "slurred speech",
                "unconscious", "loss of consciousness", "fainting",
                "severe bleeding", "uncontrolled bleeding",
                "suicidal", "self-harm", "suicid"
        );

        for (String k : redFlags) {
            if (scanText.contains(k)) {
                boolean inAi = aiReport != null && aiReport.toLowerCase().contains(k);
                String source = inAi ? "symptoms in AI report" : "prescription history/profile";
                return new BadgeResult("RED", "Red-flag detected in " + source + " (" + k + ")");
            }
        }

        // 🟠 Urgent / needs doctor within 24h
        List<String> urgent = Arrays.asList(
                "high fever", "persistent fever", "fever >",
                "severe pain", "severe", "worsening",
                "severe vomiting", "cannot keep fluids",
                "rapid", "danger", "critical"
        );

        for (String k : urgent) {
            if (scanText.contains(k)) {
                boolean inAi = aiReport != null && aiReport.toLowerCase().contains(k);
                String source = inAi ? "symptoms in AI report" : "prescription history/profile";
                return new BadgeResult("ORANGE", "Urgent concern detected in " + source + " (" + k + ")");
            }
        }

        // 🟡 Semi-urgent / schedule this week
        List<String> semiUrgent = Arrays.asList(
                "moderate", "persistent", "mild to moderate",
                "infection", "possible", "may indicate"
        );

        for (String k : semiUrgent) {
            if (scanText.contains(k)) {
                boolean inAi = aiReport != null && aiReport.toLowerCase().contains(k);
                String source = inAi ? "symptoms in AI report" : "prescription history/profile";
                return new BadgeResult("YELLOW", "Moderate risk signal in " + source + " (" + k + ")");
            }
        }

        if ((aiReport == null || aiReport.trim().isEmpty()) && (prescriptionSummary == null || prescriptionSummary.trim().isEmpty())) {
            return new BadgeResult("GREEN", "No AI report or prescription summary available yet");
        }

        return new BadgeResult("GREEN", "No high-risk signals detected in report or history");
    }

    // ─── MedGemma Prescription Analysis ─────────────────────────────

    private String readPrescriptionFileContent(String fileUrl) {
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            return "";
        }
        try {
            String fileName = fileUrl;
            if (fileUrl.startsWith("/uploads/")) {
                fileName = fileUrl.substring(9);
            } else if (fileUrl.startsWith("uploads/")) {
                fileName = fileUrl.substring(8);
            }
            java.nio.file.Path path = java.nio.file.Paths.get("uploads", fileName);
            if (java.nio.file.Files.exists(path)) {
                String fileNameLower = fileName.toLowerCase();
                if (fileNameLower.endsWith(".txt") || fileNameLower.endsWith(".json") || fileNameLower.endsWith(".csv")) {
                    byte[] bytes = java.nio.file.Files.readAllBytes(path);
                    return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                } else if (fileNameLower.endsWith(".pdf")) {
                    try (org.apache.pdfbox.pdmodel.PDDocument document = org.apache.pdfbox.pdmodel.PDDocument.load(path.toFile())) {
                        org.apache.pdfbox.text.PDFTextStripper stripper = new org.apache.pdfbox.text.PDFTextStripper();
                        String text = stripper.getText(document);
                        if (text != null && !text.trim().isEmpty()) {
                            return text.trim();
                        }
                    } catch (Exception pdfEx) {
                        System.err.println("⚠️ Error reading PDF file with PDFBox: " + pdfEx.getMessage());
                    }
                    return "[PDF File: " + fileName + " (Scanned PDF - text extraction unavailable)]";
                } else {
                    return "[Binary File: " + fileName + " (Image format. Details extracted from profile and symptoms below)]";
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error reading prescription file: " + e.getMessage());
        }
        return "";
    }

    private String generatePrescriptionSummary(PatientProfile profile, Booking booking) {
        String fileUrl = profile.getPrescriptionReportUrl();
        String fileContent = readPrescriptionFileContent(fileUrl);

        String existingConditions = profile.getExistingMedicalCondition() != null ? profile.getExistingMedicalCondition() : "None";
        String currentMeds = profile.getCurrentMedication() != null ? profile.getCurrentMedication() : "None";
        String allergies = profile.getAllergies() != null ? profile.getAllergies() : "None";
        String bookingSymptoms = booking.getSymptoms() != null ? booking.getSymptoms() : "None";

        String systemPrompt = "You are Astra, an advanced AI medical history analyst for the MedAstrax platform. "
                + "Your task is to analyze the patient's medical profile details, current symptoms, and any text extracted from their previous prescription "
                + "to generate a professional, concise, structured clinical summary for the attending doctor. "
                + "The summary must be structured in markdown with the following headings:\n"
                + "1. 🏥 **Previous Hospital / Doctor Details**: Mention hospital name and doctor name if available, or state 'Not specified'.\n"
                + "2. 🩺 **Diagnosed Conditions & Clinical History**: Summarize existing/past conditions and medical history.\n"
                + "3. 💊 **Active Medications & Dosages**: Detail current medications, dosages, and frequency.\n"
                + "4. ⚠️ **Allergies & Warnings**: Highlight any allergies or contraindications the doctor must be aware of.\n"
                + "5. 💡 **Key Insights & Recommendations for Attending Doctor**: Advise on potential drug-drug interactions, follow-up tests, or clinical areas to investigate during the upcoming consultation.\n\n"
                + "Be extremely professional, precise, and objective.";

        String userPrompt = "Please analyze this patient's medical background to create a prescription and medical history summary.\n\n"
                + "### PATIENT MEDICAL PROFILE:\n"
                + "- **Existing Conditions**: " + existingConditions + "\n"
                + "- **Current Medications**: " + currentMeds + "\n"
                + "- **Allergies**: " + allergies + "\n"
                + "- **Booking Symptoms / Chief Complaint**: " + bookingSymptoms + "\n\n"
                + "### EXTRACTED PREVIOUS PRESCRIPTION TEXT CONTENT:\n"
                + (fileContent.isEmpty() ? "(No readable text extracted from prescription file - PDF/Image format or empty)" : fileContent) + "\n\n"
                + "Generate a beautifully structured summary in markdown.";

        String imageUrl = getPrescriptionImageDataUrl(fileUrl);

        if (hfToken != null && !hfToken.trim().isEmpty() && !hfToken.equals("your_hf_token_here")) {
            try {
                return callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, userPrompt, imageUrl);
            } catch (Exception e) {
                System.err.println("⚠️ MedGemma API call failed: " + e.getMessage() + ". Trying fallback Gemma model.");
                try {
                    return callHuggingFaceChat("google/gemma-3-27b-it", systemPrompt, userPrompt, imageUrl);
                } catch (Exception e2) {
                    System.err.println("⚠️ Fallback AI model failed: " + e2.getMessage());
                }
            }
        }
        
        return generateOfflinePrescriptionSummary(profile, booking, fileContent);
    }

    private String getPrescriptionImageDataUrl(String fileUrl) {
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            return null;
        }
        try {
            String fileName = fileUrl;
            if (fileUrl.startsWith("/uploads/")) {
                fileName = fileUrl.substring(9);
            } else if (fileUrl.startsWith("uploads/")) {
                fileName = fileUrl.substring(8);
            }
            java.nio.file.Path path = java.nio.file.Paths.get("uploads", fileName);
            if (java.nio.file.Files.exists(path)) {
                byte[] header = new byte[12];
                try (java.io.InputStream is = java.nio.file.Files.newInputStream(path)) {
                    int read = is.read(header);
                    if (read < 4) return null;
                } catch (Exception e) {}

                String mediaType = null;
                if (header[0] == (byte) 0x89 && header[1] == (byte) 0x50 && header[2] == (byte) 0x4E && header[3] == (byte) 0x47) {
                    mediaType = "image/png";
                } else if (header[0] == (byte) 0xFF && header[1] == (byte) 0xD8) {
                    mediaType = "image/jpeg";
                } else if (header[0] == (byte) 0x52 && header[1] == (byte) 0x49 && header[2] == (byte) 0x46 && header[3] == (byte) 0x46 &&
                           header[8] == (byte) 0x57 && header[9] == (byte) 0x45 && header[10] == (byte) 0x42 && header[11] == (byte) 0x50) {
                    mediaType = "image/webp";
                } else if (header[0] == (byte) 0x47 && header[1] == (byte) 0x49 && header[2] == (byte) 0x46) {
                    mediaType = "image/gif";
                }

                if (mediaType != null) {
                    byte[] fileBytes = java.nio.file.Files.readAllBytes(path);
                    String base64 = java.util.Base64.getEncoder().encodeToString(fileBytes);
                    return "data:" + mediaType + ";base64," + base64;
                }
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error getting prescription image data URL: " + e.getMessage());
        }
        return null;
    }

    private String callHuggingFaceChat(String model, String systemPrompt, String userPrompt) throws Exception {
        return callHuggingFaceChat(model, systemPrompt, userPrompt, null);
    }

    private String callHuggingFaceChat(String model, String systemPrompt, String userPrompt, String imageUrl) throws Exception {
        String endpointUrl = "https://router.huggingface.co/v1/chat/completions";
        URL url = new URL(endpointUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + hfToken.trim());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(15000);
        conn.setDoOutput(true);

        List<Map<String, Object>> messages = new ArrayList<>();
        
        Map<String, Object> systemMsg = new HashMap<>();
        systemMsg.put("role", "system");
        systemMsg.put("content", systemPrompt);
        messages.add(systemMsg);

        Map<String, Object> userMsg = new HashMap<>();
        userMsg.put("role", "user");

        if (imageUrl != null && !imageUrl.isEmpty()) {
            List<Map<String, Object>> contentList = new ArrayList<>();
            
            Map<String, Object> textPart = new HashMap<>();
            textPart.put("type", "text");
            textPart.put("text", userPrompt);
            contentList.add(textPart);
            
            Map<String, Object> imagePart = new HashMap<>();
            imagePart.put("type", "image_url");
            Map<String, Object> imageUrlMap = new HashMap<>();
            imageUrlMap.put("url", imageUrl);
            imagePart.put("image_url", imageUrlMap);
            contentList.add(imagePart);
            
            userMsg.put("content", contentList);
        } else {
            userMsg.put("content", userPrompt);
        }
        messages.add(userMsg);

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", 800);
        body.put("temperature", 0.2);

        ObjectMapper mapper = new ObjectMapper();
        String jsonPayload = mapper.writeValueAsString(body);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(jsonPayload.getBytes(StandardCharsets.UTF_8));
        }

        int responseCode = conn.getResponseCode();
        if (responseCode == 200) {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) {
                    response.append(line.trim());
                }

                Map<String, Object> resMap = mapper.readValue(response.toString(), Map.class);
                List<Map<String, Object>> choices = (List<Map<String, Object>>) resMap.get("choices");
                if (choices != null && !choices.isEmpty()) {
                    Map<String, Object> firstChoice = choices.get(0);
                    Map<String, Object> messageMap = (Map<String, Object>) firstChoice.get("message");
                    if (messageMap != null && messageMap.get("content") != null) {
                        return ((String) messageMap.get("content")).trim();
                    }
                }
            }
        }
        throw new RuntimeException("HTTP " + responseCode);
    }

    private String generateOfflinePrescriptionSummary(PatientProfile profile, Booking booking, String fileContent) {
        String existingConditions = profile.getExistingMedicalCondition() != null ? profile.getExistingMedicalCondition() : "None";
        String currentMeds = profile.getCurrentMedication() != null ? profile.getCurrentMedication() : "None";
        String allergies = profile.getAllergies() != null ? profile.getAllergies() : "None";
        String symptoms = booking.getSymptoms() != null ? booking.getSymptoms() : "None";

        StringBuilder sb = new StringBuilder();
        sb.append("# 🏥 Previous Prescription & History Summary (Offline Analyze)\n\n");
        sb.append("*(Note: Offline heuristic analysis was used because the Astra service is currently offline or unreachable. Please verify details with the patient.)*\n\n");
        
        sb.append("## 🏥 Previous Hospital / Doctor Details\n");
        if (fileContent != null && !fileContent.trim().isEmpty() && fileContent.length() < 1000) {
            String lower = fileContent.toLowerCase();
            if (lower.contains("hospital")) {
                sb.append("- Inferred Hospital: Previous hospital detected in prescription text.\n");
            } else {
                sb.append("- Hospital Name: Not explicitly specified in prescription text.\n");
            }
        } else {
            sb.append("- Hospital Name: Not specified (PDF/Image prescription uploaded)\n");
        }
        sb.append("\n");

        sb.append("## 🩺 Diagnosed Conditions & Clinical History\n");
        if (!"none".equalsIgnoreCase(existingConditions.trim())) {
            sb.append("- **Known Conditions**: ").append(existingConditions).append("\n");
        } else {
            sb.append("- No existing long-term medical conditions registered in patient profile.\n");
        }
        sb.append("- **Current symptoms for appointment**: ").append(symptoms).append("\n");
        sb.append("\n");

        sb.append("## 💊 Active Medications & Dosages\n");
        if (!"none".equalsIgnoreCase(currentMeds.trim())) {
            sb.append("- **Prescribed Medications**: ").append(currentMeds).append("\n");
        } else {
            sb.append("- No active daily medications reported in patient profile.\n");
        }
        sb.append("\n");

        sb.append("## ⚠️ Allergies & Warnings\n");
        if (!"none".equalsIgnoreCase(allergies.trim())) {
            sb.append("- 🔴 **Allergies Detected**: ").append(allergies).append("\n");
        } else {
            sb.append("- 🟢 No known drug or food allergies reported by patient.\n");
        }
        sb.append("\n");

        sb.append("## 💡 Key Insights & Recommendations for Attending Doctor\n");
        sb.append("- **Initial Assessment**: Patient is a first-time user booking a new consultation.\n");
        if (!"none".equalsIgnoreCase(allergies.trim())) {
            sb.append("- **Precaution**: Ensure no medications are prescribed that conflict with reported allergy: **").append(allergies).append("**.\n");
        }
        if (!"none".equalsIgnoreCase(currentMeds.trim())) {
            sb.append("- **Drug Interaction Check**: Review compatibility of new prescriptions with active medications: **").append(currentMeds).append("**.\n");
        }
        sb.append("- **Next Steps**: Please conduct a physical/clinical review of the patient's uploaded prescription file during the consultation call.");
        
        return sb.toString();
    }

    public String generateRecommendations(String aiReport, String symptoms) {
        // Human-like organic implementation for generating patient recommendations
        StringBuilder recs = new StringBuilder();
        recs.append("### Actionable Health Recommendations:\n\n");
        
        String scanText = "";
        if (aiReport != null) scanText += aiReport + " ";
        if (symptoms != null) scanText += symptoms;
        scanText = scanText.toLowerCase();
        
        if (scanText.contains("fever") || scanText.contains("cold") || scanText.contains("cough") || scanText.contains("flu")) {
            recs.append("- 💧 **Hydration**: Consume at least 3-4 liters of warm liquids (water, herbal tea, broth) daily.\n");
            recs.append("- 🛌 **Rest & Recovery**: Ensure at least 8 hours of quiet sleep. Avoid heavy tasks.\n");
            recs.append("- 🌡️ **Temperature Watch**: Keep a regular log of your body temperature (every 4 hours).\n");
        }
        if (scanText.contains("chest pain") || scanText.contains("heart") || scanText.contains("breath") || scanText.contains("cardiac")) {
            recs.append("- 🚨 **Emergency Alarm**: If you feel radiating tightness, numbness in your left arm, or dizziness, call emergency services immediately.\n");
            recs.append("- 🩺 **ECG & Diagnostics**: Consult a cardiologist for a baseline 12-lead ECG and Troponin blood work.\n");
            recs.append("- 🚫 **Exertion**: Absolutely avoid physical stress or heavy lifting.\n");
        }
        if (scanText.contains("diabetes") || scanText.contains("metformin") || scanText.contains("sugar") || scanText.contains("glucose")) {
            recs.append("- 🥗 **Dietary Advice**: Stick to high-fiber, low-carb foods. Limit direct sugars, juices, and refined flour.\n");
            recs.append("- 🩸 **Blood Glucose Log**: Keep a written log of fasting and post-meal glucose levels for your clinician.\n");
        }
        if (scanText.contains("pain") || scanText.contains("headache") || scanText.contains("migraine") || scanText.contains("ache")) {
            recs.append("- 🧘 **Symptom Management**: Rest in a dark, quiet room. Apply cold/warm compresses where comfortable.\n");
            recs.append("- 📱 **Limit Screens**: Reduce screen exposure to minimize digital eye strain.\n");
        }
        
        // Default advice if no specific conditions trigger it
        if (recs.length() < 50) {
            recs.append("- 🚶 **Active Living**: Strive for at least 20-30 minutes of light activity (like walking) daily.\n");
            recs.append("- 🥗 **Balanced Diet**: Focus on whole foods, fresh fruits, vegetables, and lean proteins.\n");
            recs.append("- 💧 **Fluid Intake**: Drink water regularly throughout the day.\n");
        }
        
        recs.append("- 🩺 **Doctor Follow-Up**: Be sure to discuss these points during your upcoming consultation.");
        return recs.toString();
    }
}
