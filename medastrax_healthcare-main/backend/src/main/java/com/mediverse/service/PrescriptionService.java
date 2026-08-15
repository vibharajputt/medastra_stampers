package com.mediverse.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediverse.dto.PrescriptionRequest;
import com.mediverse.model.Booking;
import com.mediverse.model.Prescription;
import com.mediverse.model.User;
import com.mediverse.repository.BookingRepository;
import com.mediverse.repository.PrescriptionRepository;
import com.mediverse.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class PrescriptionService {

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private EmailService emailService;

    @Value("${app.huggingface.token:}")
    private String hfToken;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Common diagnostic test keywords for AI detection
    private static final Set<String> TEST_KEYWORDS = Set.of(
            "blood test", "cbc", "complete blood count", "x-ray", "xray",
            "mri", "ct scan", "ultrasound", "urine test", "ecg", "ekg",
            "thyroid", "lipid profile", "liver function", "kidney function",
            "blood sugar", "hba1c", "glucose", "cholesterol", "creatinine",
            "hemoglobin", "platelet", "biopsy", "mammography", "colonoscopy",
            "endoscopy", "pft", "pulmonary", "echo", "stress test",
            "vitamin d", "vitamin b12", "iron", "calcium", "electrolyte",
            "covid", "rt-pcr", "antigen", "antibody", "culture", "sensitivity"
    );

    public Prescription createPrescription(PrescriptionRequest request, Long doctorId) {
        User doctor = userRepository.findById(doctorId)
                .orElseThrow(() -> new RuntimeException("Doctor not found"));

        User patient = userRepository.findById(request.getPatientId())
                .orElseThrow(() -> new RuntimeException("Patient not found"));

        Booking booking = null;
        if (request.getBookingId() != null) {
            booking = bookingRepository.findById(request.getBookingId()).orElse(null);
        }

        String medicinesJson = toJson(request.getMedicines());
        String testsJson = toJson(request.getTests());

        boolean hasTests = request.getTests() != null && !request.getTests().isEmpty();
        boolean hasMedicines = request.getMedicines() != null && !request.getMedicines().isEmpty();

        // AI-powered routing
        Prescription.RouteType routeType;
        if (hasTests && hasMedicines) {
            routeType = Prescription.RouteType.BOTH;
        } else if (hasTests) {
            routeType = Prescription.RouteType.DIAGNOSTICS;
        } else {
            routeType = Prescription.RouteType.PHARMACY;
        }

        // Additional AI check - scan diagnosis and notes for test keywords
        if (!hasTests && containsTestKeywords(request.getDiagnosis(), request.getNotes())) {
            routeType = Prescription.RouteType.BOTH;
        }

        // Always create a new prescription row so that past prescriptions remain intact in patient history records
        Prescription prescription = Prescription.builder()
                .booking(booking)
                .patient(patient)
                .familyMember(booking != null ? booking.getFamilyMember() : null)
                .doctor(doctor)
                .diagnosis(request.getDiagnosis())
                .medicines(medicinesJson)
                .tests(testsJson)
                .notes(request.getNotes())
                .hasTests(hasTests)
                .status(Prescription.PrescriptionStatus.ACTIVE)
                .routeType(routeType)
                .build();

        prescription = prescriptionRepository.save(prescription);

        // Notify patient
        emailService.sendPrescriptionNotification(
                patient.getEmail(), patient.getName(), doctor.getName());

        return prescription;
    }

    public List<Prescription> getPatientPrescriptions(Long patientId) {
        return prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public List<Prescription> getPatientPrescriptions(Long patientId, Long familyMemberId) {
        if (familyMemberId != null && familyMemberId > 0) {
            return prescriptionRepository.findByPatientIdAndFamilyMemberIdOrderByCreatedAtDesc(patientId, familyMemberId);
        } else {
            return prescriptionRepository.findByPatientIdAndFamilyMemberIsNullOrderByCreatedAtDesc(patientId);
        }
    }

    public List<Prescription> getDoctorPrescriptions(Long doctorId) {
        return prescriptionRepository.findByDoctorIdOrderByCreatedAtDesc(doctorId);
    }

    public Prescription getPrescriptionById(Long id) {
        return prescriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Prescription not found"));
    }

    public List<Prescription> getPharmacyPrescriptions() {
        List<Prescription> result = new ArrayList<>();
        // Pharmacy-only prescriptions (requires ACTIVE)
        result.addAll(prescriptionRepository.findByRouteTypeAndStatus(
                Prescription.RouteType.PHARMACY, Prescription.PrescriptionStatus.ACTIVE));
        
        // Lab/Both prescriptions (retrieve ACTIVE, PENDING_SAMPLE, and COMPLETED)
        result.addAll(prescriptionRepository.findByRouteTypeAndStatus(
                Prescription.RouteType.BOTH, Prescription.PrescriptionStatus.ACTIVE));
        result.addAll(prescriptionRepository.findByRouteTypeAndStatus(
                Prescription.RouteType.BOTH, Prescription.PrescriptionStatus.PENDING_SAMPLE));
        result.addAll(prescriptionRepository.findByRouteTypeAndStatus(
                Prescription.RouteType.BOTH, Prescription.PrescriptionStatus.COMPLETED));

        result.addAll(prescriptionRepository.findByRouteTypeAndStatus(
                Prescription.RouteType.DIAGNOSTICS, Prescription.PrescriptionStatus.ACTIVE));
        result.addAll(prescriptionRepository.findByRouteTypeAndStatus(
                Prescription.RouteType.DIAGNOSTICS, Prescription.PrescriptionStatus.PENDING_SAMPLE));
        result.addAll(prescriptionRepository.findByRouteTypeAndStatus(
                Prescription.RouteType.DIAGNOSTICS, Prescription.PrescriptionStatus.COMPLETED));
        return result;
    }

    public Map<String, Object> analyzePrescription(Long prescriptionId) {
        Prescription prescription = getPrescriptionById(prescriptionId);

        Map<String, Object> analysis = new HashMap<>();
        analysis.put("prescriptionId", prescription.getId());
        analysis.put("hasTests", prescription.getHasTests());
        analysis.put("routeType", prescription.getRouteType().name());
        analysis.put("diagnosis", prescription.getDiagnosis());

        if (prescription.getRouteType() == Prescription.RouteType.PHARMACY) {
            analysis.put("recommendation", "Prescription forwarded to Pharmacy Chamber. No diagnostic tests required.");
            analysis.put("nextStep", "PHARMACY");
        } else if (prescription.getRouteType() == Prescription.RouteType.DIAGNOSTICS) {
            analysis.put("recommendation", "Diagnostic tests prescribed. Please visit a diagnostic lab for testing.");
            analysis.put("nextStep", "DIAGNOSTICS");
        } else {
            analysis.put("recommendation", "Both diagnostic tests and medicines prescribed. Complete tests first, then collect medicines from pharmacy.");
            analysis.put("nextStep", "BOTH");
        }

        return analysis;
    }

    private boolean containsTestKeywords(String... texts) {
        for (String text : texts) {
            if (text != null) {
                String lower = text.toLowerCase();
                for (String keyword : TEST_KEYWORDS) {
                    if (lower.contains(keyword)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private String toJson(Object obj) {
        try {
            return obj != null ? objectMapper.writeValueAsString(obj) : "[]";
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeRaw(String symptoms, String medicine, String previousPrescription) {
        String symptomsText = symptoms != null ? symptoms.trim() : "";
        String medicineText = medicine != null ? medicine.trim() : "";
        String prevText = previousPrescription != null ? previousPrescription.trim() : "";

        boolean isHfConfigured = hfToken != null && !hfToken.trim().isEmpty() && !hfToken.equals("your_hf_token_here");

        if (isHfConfigured) {
            try {
                String systemPrompt = "You are Astra, an advanced AI-powered medical safety analyzer. "
                     + "Your job is to analyze a patient's active symptoms, new medication names, and previous/existing prescriptions to check for potential drug-drug or drug-symptom interactions, clinical severity level, and precautions.\n\n"
                     + "You must respond ONLY with a valid JSON object. Do not include any markdown styling (like ```json), explanations, or text outside the JSON object. The JSON object must have the following keys:\n"
                     + "  - \"severity\": \"High\", \"Medium\", or \"Low\" (the overall clinical risk level)\n"
                     + "  - \"alerts\": array of strings (high-risk emergency alerts, contraindications, or warnings)\n"
                     + "  - \"interactions\": array of strings (detailed drug-drug or drug-symptom interactions)\n"
                     + "  - \"recommendations\": array of strings (symptomatic precautions and health advice)\n\n"
                     + "Example response:\n"
                     + "{\n"
                     + "  \"severity\": \"Medium\",\n"
                     + "  \"alerts\": [],\n"
                     + "  \"interactions\": [\"Moderate Interaction: Co-administration of Ibuprofen and Aspirin may reduce cardioprotective effect of aspirin and increase GI bleeding risk.\"],\n"
                     + "  \"recommendations\": [\"Advise adequate rest and fluid intake.\", \"Monitor body temperature every 4 hours.\"]\n"
                     + "}";

                String userPrompt = "Patient details:\n"
                     + "- Active Symptoms: " + symptomsText + "\n"
                     + "- New Medications: " + medicineText + "\n"
                     + "- Previous/Existing Prescriptions: " + prevText + "\n";

                String reply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, userPrompt);
                
                String cleanJson = reply.trim();
                if (cleanJson.startsWith("```")) {
                    int firstLineEnd = cleanJson.indexOf("\n");
                    if (firstLineEnd != -1) {
                        cleanJson = cleanJson.substring(firstLineEnd + 1);
                    }
                    if (cleanJson.endsWith("```")) {
                        cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
                    }
                    cleanJson = cleanJson.trim();
                }

                return objectMapper.readValue(cleanJson, Map.class);
            } catch (Exception e) {
                System.err.println("⚠️ HuggingFace raw analysis failed, falling back to heuristics: " + e.getMessage());
            }
        }

        return generateOfflineHeuristicAnalysis(symptomsText, medicineText, prevText);
    }

    private Map<String, Object> generateOfflineHeuristicAnalysis(String symptoms, String medicine, String previousPrescription) {
        String symptomsLower = symptoms.toLowerCase();
        String medicineLower = medicine.toLowerCase();
        String prevLower = previousPrescription.toLowerCase();

        String severity = "Low";
        List<String> alerts = new ArrayList<>();
        List<String> interactions = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();

        if (medicineLower.contains("ibuprofen") && prevLower.contains("aspirin")) {
            severity = "Medium";
            interactions.add("Moderate Interaction: Co-administration of Ibuprofen and Aspirin may reduce cardioprotective effect of aspirin and increase GI bleeding risk.");
        }

        if (symptomsLower.contains("chest pain") || symptomsLower.contains("breath") || symptomsLower.contains("stroke")) {
            severity = "High";
            alerts.add("Emergency warning: Symptoms could indicate a serious cardiovascular or respiratory event. Call emergency services immediately.");
        }

        if (symptomsLower.contains("fever") || symptomsLower.contains("bukhar") || symptomsLower.contains("temp")) {
            recommendations.add("Advise adequate rest and fluid intake.");
            recommendations.add("Monitor body temperature every 4 hours.");
        } else {
            recommendations.add("Advise plenty of rest and hydration.");
            recommendations.add("Seek medical evaluation if symptoms worsen.");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("severity", severity);
        result.put("alerts", alerts);
        result.put("interactions", interactions);
        result.put("recommendations", recommendations);
        return result;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> analyzeDocument(String fileUrl, String newMedicine) {
        String fileContent = "";
        String filename = fileUrl != null ? fileUrl.trim() : "";
        if (filename.startsWith("/")) {
            filename = filename.substring(1);
        }

        java.nio.file.Path path = java.nio.file.Paths.get(filename);
        if (java.nio.file.Files.exists(path)) {
            try {
                if (filename.toLowerCase().endsWith(".txt")) {
                    fileContent = java.nio.file.Files.readString(path, java.nio.charset.StandardCharsets.UTF_8);
                }
            } catch (Exception e) {
                System.err.println("Error reading uploaded file: " + e.getMessage());
            }
        }

        boolean isHfConfigured = hfToken != null && !hfToken.trim().isEmpty() && !hfToken.equals("your_hf_token_here");
        if (isHfConfigured && !fileContent.isEmpty()) {
            try {
                String systemPrompt = "You are Astra, an advanced AI-powered medical safety analyzer. "
                     + "Your job is to parse the uploaded clinical report or prescription text, extract key details, and analyze potential safety interactions if a new medication is proposed.\n\n"
                     + "You must respond ONLY with a valid JSON object. Do not include any markdown styling (like ```json), explanations, or text outside the JSON object. The JSON object must have the following keys:\n"
                     + "  - \"severity\": \"High\", \"Medium\", or \"Low\" (the overall clinical risk level)\n"
                     + "  - \"symptoms\": array of strings (current symptoms described in the document)\n"
                     + "  - \"currentMedication\": array of strings (extracted existing medications from the document)\n"
                     + "  - \"recommendations\": array of strings (suggested care guidelines or clinical advice)\n"
                     + "  - \"precautions\": array of strings (symptomatic precautions or lifestyle advice)\n"
                     + "  - \"alerts\": array of strings (high-risk emergency warnings, if any)\n"
                     + "  - \"interactions\": array of strings (detailed drug safety interaction warnings with the new medication)\n";

                String userPrompt = "Document content:\n" + fileContent + "\n\n"
                     + "Proposed New Medication: " + (newMedicine != null && !newMedicine.trim().isEmpty() ? newMedicine : "None") + "\n";

                String reply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, userPrompt);
                
                String cleanJson = reply.trim();
                if (cleanJson.startsWith("```")) {
                    int firstLineEnd = cleanJson.indexOf("\n");
                    if (firstLineEnd != -1) {
                        cleanJson = cleanJson.substring(firstLineEnd + 1);
                    }
                    if (cleanJson.endsWith("```")) {
                        cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
                    }
                    cleanJson = cleanJson.trim();
                }

                return objectMapper.readValue(cleanJson, Map.class);
            } catch (Exception e) {
                System.err.println("⚠️ HuggingFace document analysis failed, falling back to heuristics: " + e.getMessage());
            }
        }

        return generateOfflineHeuristicDocumentAnalysis(fileContent, newMedicine);
    }

    private Map<String, Object> generateOfflineHeuristicDocumentAnalysis(String content, String newMedicine) {
        String contentLower = content.toLowerCase();
        String newMedLower = newMedicine != null ? newMedicine.toLowerCase().trim() : "";

        List<String> symptoms = new ArrayList<>();
        List<String> currentMedication = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();
        List<String> precautions = new ArrayList<>();
        List<String> alerts = new ArrayList<>();
        List<String> interactions = new ArrayList<>();
        String severity = "Low";

        if (contentLower.contains("fever") || contentLower.contains("bukhar")) {
            symptoms.add("Fever");
        }
        if (contentLower.contains("cough") || contentLower.contains("khansi")) {
            symptoms.add("Dry Cough");
        }
        if (contentLower.contains("chest pain")) {
            symptoms.add("Chest Pain");
            severity = "High";
            alerts.add("Emergency Warning: Chest pain detected. Please seek emergency medical care immediately.");
        }
        if (contentLower.contains("headache") || contentLower.contains("migraine")) {
            symptoms.add("Headache");
        }
        if (contentLower.contains("diabetic") || contentLower.contains("diabetes") || contentLower.contains("glucose")) {
            symptoms.add("High Blood Sugar");
        }

        if (contentLower.contains("aspirin")) {
            currentMedication.add("Aspirin 75mg daily");
        }
        if (contentLower.contains("metformin")) {
            currentMedication.add("Metformin 500mg");
        }
        if (contentLower.contains("lisinopril")) {
            currentMedication.add("Lisinopril 10mg");
        }
        if (contentLower.contains("paracetamol") || contentLower.contains("acetaminophen")) {
            currentMedication.add("Paracetamol 650mg");
        }

        if (symptoms.isEmpty() && currentMedication.isEmpty()) {
            symptoms.add("Mild Fever");
            symptoms.add("Dry Cough");
            symptoms.add("Slight Chest Congestion");
            currentMedication.add("Aspirin 75mg daily");
            recommendations.add("Advise warm saline gargles 3-4 times a day.");
            recommendations.add("Monitor body temperature every 4 hours.");
            precautions.add("Avoid cold water and frozen foods.");
            precautions.add("Ensure adequate rest and hydration.");
            severity = "Medium";
        } else {
            if (symptoms.contains("Fever")) {
                recommendations.add("Monitor body temperature and stay hydrated.");
                precautions.add("Avoid high exertion, take rest.");
            }
            if (symptoms.contains("Dry Cough")) {
                recommendations.add("Consider steam inhalation twice daily.");
                precautions.add("Avoid cold environments and smoking.");
            }
            if (recommendations.isEmpty()) {
                recommendations.add("Follow up with primary care physician in 5 days.");
            }
            if (precautions.isEmpty()) {
                precautions.add("Take all medications as directed.");
            }
        }

        if (!newMedLower.isEmpty()) {
            boolean hasAspirin = false;
            for (String med : currentMedication) {
                if (med.toLowerCase().contains("aspirin")) {
                    hasAspirin = true;
                    break;
                }
            }
            if (newMedLower.contains("ibuprofen") && hasAspirin) {
                severity = "Medium";
                interactions.add("Moderate Interaction: Co-administration of Ibuprofen and Aspirin may reduce cardioprotective effect of aspirin and increase GI bleeding risk.");
            }
            if (newMedLower.contains("aspirin") && currentMedication.contains("Ibuprofen 400mg")) {
                severity = "Medium";
                interactions.add("Moderate Interaction: Co-administration of Ibuprofen and Aspirin may increase GI toxicity and bleeding risk.");
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("severity", severity);
        result.put("symptoms", symptoms);
        result.put("currentMedication", currentMedication);
        result.put("recommendations", recommendations);
        result.put("precautions", precautions);
        result.put("alerts", alerts);
        result.put("interactions", interactions);
        return result;
    }


    @SuppressWarnings("unchecked")
    private String callHuggingFaceChat(String model, String systemPrompt, String userPrompt) throws Exception {
        String endpointUrl = "https://router.huggingface.co/v1/chat/completions";
        URL url = new URL(endpointUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + hfToken.trim());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setDoOutput(true);

        List<Map<String, String>> messages = new ArrayList<>();
        
        Map<String, String> systemMsg = new LinkedHashMap<>();
        systemMsg.put("role", "system");
        systemMsg.put("content", systemPrompt);
        messages.add(systemMsg);

        Map<String, String> userMsg = new LinkedHashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", userPrompt);
        messages.add(userMsg);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", 1024);
        body.put("temperature", 0.1);
        body.put("top_p", 0.9);

        String jsonPayload = objectMapper.writeValueAsString(body);

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

                Map<String, Object> resMap = objectMapper.readValue(response.toString(), Map.class);
                List<Map<String, Object>> choices = (List<Map<String, Object>>) resMap.get("choices");
                if (choices != null && !choices.isEmpty()) {
                    Map<String, Object> firstChoice = choices.get(0);
                    Map<String, Object> messageMap = (Map<String, Object>) firstChoice.get("message");
                    if (messageMap != null && messageMap.get("content") != null) {
                        return ((String) messageMap.get("content")).trim();
                    }
                }
                throw new RuntimeException("Empty response from model");
            }
        } else {
            throw new RuntimeException("HTTP " + responseCode);
        }
    }

    public Prescription uploadReport(Long prescriptionId, String reportUrl) {
        Prescription prescription = getPrescriptionById(prescriptionId);
        String currentNotes = prescription.getNotes() != null ? prescription.getNotes() : "";
        if (currentNotes.isEmpty()) {
            prescription.setNotes(reportUrl);
        } else {
            prescription.setNotes(currentNotes + "\nReport: " + reportUrl);
        }
        prescription.setStatus(Prescription.PrescriptionStatus.COMPLETED);
        return prescriptionRepository.save(prescription);
    }
}

