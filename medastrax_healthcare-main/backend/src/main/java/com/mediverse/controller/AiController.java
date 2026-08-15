package com.mediverse.controller;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediverse.model.Hospital;
import com.mediverse.repository.HospitalRepository;
import com.mediverse.model.PatientProfile;
import com.mediverse.repository.PatientProfileRepository;
import com.mediverse.model.Prescription;
import com.mediverse.repository.PrescriptionRepository;
import com.mediverse.model.LabBooking;
import com.mediverse.repository.LabBookingRepository;
import com.mediverse.model.User;
import com.mediverse.service.AuthService;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.MedGammaService;
import com.mediverse.service.ToolRunLogService;
import com.mediverse.service.ActivityLogService;
import com.mediverse.model.ActivityLog;
import org.springframework.web.bind.annotation.RequestHeader;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    @Autowired
    private HospitalRepository hospitalRepository;

    @Autowired
    private MedGammaService medGammaService;

    @Autowired
    private PatientProfileRepository patientProfileRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private LabBookingRepository labBookingRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private ToolRunLogService toolRunLogService;

    @Autowired
    private ActivityLogService activityLogService;

    private static final String[] SAFETY_KEYWORDS_CRITICAL = {
        "overdose", "suicide", "self-harm", "self harm", "kill myself", "end my life",
        "want to die", "poison myself"
    };
    private static final String[] SAFETY_KEYWORDS_HIGH = {
        "severe chest pain", "heart attack", "stroke", "can't breathe", "cannot breathe",
        "allergic reaction", "anaphylaxis", "heavy bleeding", "unconscious"
    };

    private String detectSafetyFlag(String message) {
        if (message == null) return "NONE";
        String lc = message.toLowerCase();
        for (String kw : SAFETY_KEYWORDS_CRITICAL) {
            if (lc.contains(kw)) return "CRITICAL";
        }
        for (String kw : SAFETY_KEYWORDS_HIGH) {
            if (lc.contains(kw)) return "HIGH";
        }
        return "NONE";
    }

    @Value("${app.huggingface.token:}")
    private String hfToken;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // In-memory session store for multi-turn conversations
    // Key: sessionId, Value: list of message maps (role + content)
    private final ConcurrentHashMap<String, List<Map<String, String>>> sessionStore = new ConcurrentHashMap<>();

    // Max conversation history to send to model (to stay within token limits)
    private static final int MAX_HISTORY_MESSAGES = 20;

    // Session expiry: clean up sessions older than 30 minutes
    private final ConcurrentHashMap<String, Long> sessionTimestamps = new ConcurrentHashMap<>();

    // In-memory session store for general website query conversations
    private final ConcurrentHashMap<String, List<Map<String, String>>> querySessionStore = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> querySessionTimestamps = new ConcurrentHashMap<>();



    @PostMapping("/chat")
    public ResponseEntity<?> chat(@RequestBody Map<String, Object> request) {
        String userMessage = getStringField(request, "message", "").trim();
        String sessionId = getStringField(request, "sessionId", "");

        if (userMessage.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Message cannot be empty"
            ));
        }

        // Generate sessionId if not provided
        if (sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString();
        }

        // Clean up expired sessions (older than 30 min)
        cleanExpiredSessions();

        // Fetch registered hospitals/doctors from database for context
        List<Hospital> hospitals = hospitalRepository.findAll();
        String doctorsContext = buildDoctorsContext(hospitals);
        String systemPrompt = buildMedicalSystemPrompt(doctorsContext);

        // Get or create conversation history for this session
        List<Map<String, String>> conversationHistory = sessionStore.computeIfAbsent(
            sessionId, k -> new ArrayList<>()
        );
        sessionTimestamps.put(sessionId, System.currentTimeMillis());

        // Add user message to history
        conversationHistory.add(Map.of("role", "user", "content", userMessage));

        String reply;
        String modelUsed;

        if (isApiConfigured()) {
            try {
                reply = queryHuggingFaceWithHistory(systemPrompt, conversationHistory);
                modelUsed = "Astra (HuggingFace: medgemma-27b-it)";
            } catch (Exception e) {
                System.err.println("⚠️ HuggingFace API error: " + e.getMessage());
                // Try fallback model
                try {
                    reply = queryHuggingFaceFallback(systemPrompt, conversationHistory);
                    modelUsed = "Astra (HuggingFace: Gemma-3-27B)";
                } catch (Exception e2) {
                    System.err.println("⚠️ Fallback model also failed: " + e2.getMessage());
                    reply = "⚠️ **AI Service Temporarily Unavailable**\n\n"
                          + "I'm unable to connect to the AI service right now. Please try again in a moment.\n\n"
                          + "If you're experiencing a medical emergency, please call **112** or visit your nearest emergency room immediately.\n\n"
                          + "You can also browse the hospitals listed on the dashboard and book a consultation directly.";
                    modelUsed = "Astra (Offline)";
                }
            }
        } else {
            reply = "⚠️ **AI Service Not Configured**\n\n"
                  + "The AI assistant requires a HuggingFace API token to provide personalized medical guidance.\n\n"
                  + "Please configure the `app.huggingface.token` in the application properties.\n\n"
                  + "In the meantime, you can browse hospitals on the dashboard and book consultations directly with specialist doctors.";
            modelUsed = "Astra (Not Configured)";
        }

        // Add AI reply to conversation history
        conversationHistory.add(Map.of("role", "assistant", "content", reply));

        // Trim history if too long
        trimHistory(conversationHistory);

        // Safety flag detection
        String safetyFlag = detectSafetyFlag(userMessage);

        // Log tool run for observability
        toolRunLogService.logRun(null, "AI_CHAT", userMessage,
                reply.length() > 200 ? reply.substring(0, 200) : reply,
                null, !reply.startsWith("⚠️"), null, "Chat response generated");

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("reply", reply);
        response.put("sessionId", sessionId);
        response.put("model", modelUsed);
        response.put("safetyFlag", safetyFlag);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/care-plan")
    public ResponseEntity<?> getCarePlan() {
        String plan = "**Your Daily Care Plan**\n\n"
            + "- **Diet:** Breakfast with whole grains and fruit, a light protein-rich lunch, healthy snacks, and a balanced dinner. Stay hydrated with 2-3 liters of water.\n"
            + "- **Medicine Schedule:** Multivitamin at 08:00, Metformin at 20:00, Vitamin D at 21:30. Take medicines with meals where indicated.\n"
            + "- **Exercise:** 20-30 minute walk each morning, gentle stretches after work, breathing exercises before bed, and light strength work twice a week.\n"
            + "- **Wellness guidance:** Monitor how you feel, maintain consistent sleep, and reach out to your doctor if symptoms change.\n";
        return ResponseEntity.ok(Map.of("success", true, "plan", plan));
    }

    /**
     * New endpoint to clear/reset a conversation session
     */
    @PostMapping("/chat/reset")
    public ResponseEntity<?> resetChat(@RequestBody(required = false) Map<String, String> request) {
        String sessionId = (request != null) ? request.getOrDefault("sessionId", "") : "";
        if (!sessionId.isEmpty()) {
            sessionStore.remove(sessionId);
            sessionTimestamps.remove(sessionId);
        }
        String newSessionId = UUID.randomUUID().toString();
        return ResponseEntity.ok(Map.of(
            "success", true,
            "sessionId", newSessionId,
            "message", "Conversation reset successfully"
        ));
    }

    @PostMapping("/query-chat")
    public ResponseEntity<?> queryChat(@RequestBody Map<String, Object> request) {
        String userMessage = getStringField(request, "message", "").trim();
        String sessionId = getStringField(request, "sessionId", "");

        if (userMessage.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Message cannot be empty"
            ));
        }

        if (sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString();
        }

        cleanExpiredSessions();

        String systemPrompt = buildWebsiteQuerySystemPrompt();

        List<Map<String, String>> conversationHistory = querySessionStore.computeIfAbsent(
            sessionId, k -> new ArrayList<>()
        );
        querySessionTimestamps.put(sessionId, System.currentTimeMillis());

        conversationHistory.add(Map.of("role", "user", "content", userMessage));

        String reply;
        String modelUsed;

        if (isApiConfigured()) {
            try {
                reply = queryHuggingFaceWithHistory(systemPrompt, conversationHistory);
                modelUsed = "Astra (HuggingFace: medgemma-27b-it)";
            } catch (Exception e) {
                System.err.println("⚠️ HuggingFace API error in general chat: " + e.getMessage());
                try {
                    reply = queryHuggingFaceFallback(systemPrompt, conversationHistory);
                    modelUsed = "Astra (HuggingFace: Gemma-3-27B)";
                } catch (Exception e2) {
                    System.err.println("⚠️ General chat fallback failed: " + e2.getMessage());
                    reply = "⚠️ **AI Service Temporarily Offline**\n\n"
                          + "I'm unable to connect to the MedAstraX AI helper right now. Please try typing your query again in a moment.\n\n"
                          + "For urgent medical needs, please consult a physician or call **112** for emergency care immediately.";
                    modelUsed = "Astra (Offline)";
                }
            }
        } else {
            reply = "⚠️ **AI Assistant Offline**\n\n"
                  + "The general platform helper is running, but the HuggingFace API token is not configured on the backend.\n\n"
                  + "You can browse website features, log in, or sign up to experience the portal. To consult a live doctor, sign in as a Patient and book an appointment.";
            modelUsed = "Astra (Not Configured)";
        }

        conversationHistory.add(Map.of("role", "assistant", "content", reply));
        trimHistory(conversationHistory);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("reply", reply);
        response.put("sessionId", sessionId);
        response.put("model", modelUsed);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/query-chat/reset")
    public ResponseEntity<?> resetQueryChat(@RequestBody(required = false) Map<String, String> request) {
        String sessionId = (request != null) ? request.getOrDefault("sessionId", "") : "";
        if (!sessionId.isEmpty()) {
            querySessionStore.remove(sessionId);
            querySessionTimestamps.remove(sessionId);
        }
        String newSessionId = UUID.randomUUID().toString();
        return ResponseEntity.ok(Map.of(
            "success", true,
            "sessionId", newSessionId,
            "message", "Query conversation reset successfully"
        ));
    }

    private String buildWebsiteQuerySystemPrompt() {
        return "You are Astra Platform Guide, a friendly and highly knowledgeable 24/7 AI-powered helper for the MedAstraX healthcare portal. "
             + "Your primary goal is to guide users on how to use MedAstraX and answer general, evidence-based wellness queries.\n\n"
             
             + "## HOW THE MEDASTRAX PLATFORM WORKS (Reference this to guide users):\n"
             + "1. **Sign Up & Registration**: Users can sign up on the [Signup Page](/signup). "
             + "   They can register under 5 distinct roles: Patient, Doctor, Hospital, Pharmacy, or Lab. "
             + "   Doctor, Hospital, Pharmacy, and Lab registrations require verification credentials (license number, address, clinic proof, etc.).\n"
             + "2. **Login**: Users log in on the [Login Page](/login) using their registered email and password. "
             + "   Role-based access redirects them to their respective workspace/dashboard automatically.\n"
             + "3. **Patient Dashboard Features**:\n"
             + "   - **Search & Sort**: Patients can search for hospitals by name or city. They can sort hospitals by rating, distance (requires location permission), or price (consultation rate).\n"
             + "   - **Book an Appointment**: Select a hospital, check details, click 'Book Now', choose an attending doctor, pick a date, select an available time slot, and finalize booking.\n"
             + "   - **Order Medicines**: Patients can view active prescriptions under 'Prescriptions' and directly order medicines by selecting a nearby registered pharmacy.\n"
             + "   - **EXP Levels & Checklist**: Track daily habits (taking meds, diet, exercise) on the dashboard to earn EXP. Unlocking EXP milestones awards discounts and free consultations!\n"
             + "   - **AI Reports Analyzer**: Compare previous and current reports on the dashboard using AI to assess recovery and get a custom care plan.\n"
             + "4. **Doctor Dashboard & Scribe**:\n"
             + "   - Doctors can manage schedules, view patient bookings, and launch the **MedVerse AI Scribe Co-Pilot** in the video Consultation Room.\n"
             + "   - The AI Scribe uses Web Speech API to capture live dialogue and automatically generates structured clinical reports, saving doctors hours of manual documentation.\n"
             + "5. **Pharmacies & Labs**:\n"
             + "   - Pharmacies receive orders, update order status, and configure drug pricing.\n"
             + "   - Labs manage diagnostic bookings and upload patient reports.\n\n"

             + "## YOUR INTERACTION GUIDELINES:\n"
             + "1. **Direct navigation**: Whenever you reference a feature, provide the markdown links to help them navigate (e.g. [Signup Page](/signup), [Login Page](/login), [Dashboard](/dashboard), [Care Plan](/care-plan), [My Bookings](/my-bookings), [My Prescriptions](/my-prescriptions)). Only use relative routes that exist.\n"
             + "2. **Helpful & Concise**: Keep answers friendly, brief, and structured with bullet points. Do not write walls of text.\n"
             + "3. **General Medical Advice**: If a user asks general medical or health questions, give evidence-based guidance, suggest home care when safe, advise which doctor specialty to consult, and direct them to book an appointment with a specialist on our platform. Never prescribe drugs or make definitive diagnoses.\n"
             + "4. **Language Matching**: Just like the main assistant, identify the user's language (English, Hindi, or Hinglish) and match it perfectly. For example, if they write 'appointment kaise book karein?', explain in Hinglish: 'Appointment book karne ke liye, patient dashboard par jaakar hospital select karein aur Book Now button par click karein...'\n"
             + "5. **Safety Red Flags**: If the query implies an emergency (severe chest pain, breathing difficulty, unconsciousness), tell them to immediately call emergency number 112 or visit the nearest ER.\n"
             + "6. **Disclaimer**: Always include a quick disclaimer at the end when medical advice is touched upon: 'Note: I am an AI portal assistant. For official diagnosis, please consult a qualified doctor on our platform.'\n\n";
    }



    // ─── Core AI Query Methods ────────────────────────────────────────

    /**
     * Query HuggingFace with full conversation history (multi-turn)
     * Tries medgemma-27b-it first for medical-specific responses
     */
    private String queryHuggingFaceWithHistory(String systemPrompt, List<Map<String, String>> history) throws Exception {
        return callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, history);
    }

    /**
     * Fallback to general Gemma model if MedGemma is unavailable
     */
    private String queryHuggingFaceFallback(String systemPrompt, List<Map<String, String>> history) throws Exception {
        return callHuggingFaceChat("google/gemma-3-27b-it", systemPrompt, history);
    }

    /**
     * Generic method to call HuggingFace Chat Completions API with any model
     */
    private String callHuggingFaceChat(String model, String systemPrompt, List<Map<String, String>> history) throws Exception {
        String endpointUrl = "https://router.huggingface.co/v1/chat/completions";
        URL url = new URL(endpointUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + hfToken.trim());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(60000);  // Medical queries may need longer responses
        conn.setDoOutput(true);

        // Build messages array: system + trimmed history
        List<Map<String, String>> messages = new ArrayList<>();

        // System message
        Map<String, String> systemMsg = new LinkedHashMap<>();
        systemMsg.put("role", "system");
        systemMsg.put("content", systemPrompt);
        messages.add(systemMsg);

        // Add conversation history (last N messages to fit token limits)
        int startIdx = Math.max(0, history.size() - MAX_HISTORY_MESSAGES);
        for (int i = startIdx; i < history.size(); i++) {
            Map<String, String> msg = new LinkedHashMap<>();
            msg.put("role", history.get(i).get("role"));
            msg.put("content", history.get(i).get("content"));
            messages.add(msg);
        }

        // Build request body
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("max_tokens", 1024);
        body.put("temperature", 0.3);  // Lower temperature for more factual medical responses
        body.put("top_p", 0.9);

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
                throw new RuntimeException("Empty response from model");
            }
        } else {
            StringBuilder errorResponse = new StringBuilder();
            try {
                java.io.InputStream errorStream = conn.getErrorStream();
                if (errorStream != null) {
                    try (BufferedReader br = new BufferedReader(new InputStreamReader(errorStream, StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            errorResponse.append(line.trim());
                        }
                    }
                }
            } catch (Exception ex) {
                // Ignore error stream reading exception
            }
            throw new RuntimeException("HTTP " + responseCode + ": " + errorResponse.toString());
        }
    }

    // ─── System Prompt Engineering ────────────────────────────────────

    /**
     * Build a comprehensive, clinically-aware medical system prompt
     * This is the KEY to getting accurate, genuine medical responses
     */
    private String buildMedicalSystemPrompt(String doctorsContext) {
        return "You are Astra, an advanced AI-powered medical triage and health assistant for the MedAstrax healthcare platform. "
             + "You provide evidence-based, clinically-informed health guidance following international medical standards.\n\n"

             + "## YOUR CORE MEDICAL GUIDELINES:\n\n"

             + "### 1. STRUCTURED SYMPTOM ASSESSMENT (Always follow this flow):\n"
             + "- When a user describes symptoms, ALWAYS ask clarifying follow-up questions BEFORE giving advice:\n"
             + "  * Duration: \"How long have you had this symptom?\"\n"
             + "  * Severity: \"On a scale of 1-10, how severe is the pain/discomfort?\"\n"
             + "  * Associated symptoms: \"Are you experiencing any other symptoms along with this?\"\n"
             + "  * Medical history: \"Do you have any existing medical conditions or allergies?\"\n"
             + "  * Medications: \"Are you currently taking any medications?\"\n"
             + "  * Age & Gender: Ask if not provided, as it affects differential diagnosis.\n"
             + "- DO NOT give a final assessment until you have gathered at least 2-3 key details.\n"
             + "- If this is a follow-up message in the conversation, use the context from previous messages.\n\n"

             + "### 2. CLINICAL REASONING (When providing assessment):\n"
             + "- List possible conditions ranked by clinical likelihood (most likely first).\n"
             + "- Use phrases like 'This could indicate...', 'Common causes include...', 'Based on your description...'\n"
             + "- NEVER diagnose definitively. Always say 'possible', 'could be', 'may indicate'.\n"
             + "- Include RED FLAG warnings when symptoms could indicate emergencies.\n"
             + "- Reference standard triage categories: 🔴 Emergency (seek ER immediately), 🟠 Urgent (see doctor within 24h), 🟡 Semi-Urgent (schedule appointment this week), 🟢 Routine (self-care with monitoring).\n\n"

             + "### 3. EVIDENCE-BASED RECOMMENDATIONS:\n"
             + "- Suggest home remedies ONLY when clinically appropriate and evidence-backed.\n"
             + "- For medications, NEVER prescribe specific drugs or dosages — say 'Your doctor may consider...' or 'Common over-the-counter options include...'\n"
             + "- Cite general medical guidelines (WHO, CDC, NIH) when relevant.\n"
             + "- For diet/nutrition/exercise queries, provide specific, actionable, evidence-based advice.\n\n"

             + "### 4. DOCTOR RECOMMENDATIONS:\n"
             + "- Based on the symptom analysis, recommend the most appropriate specialist type.\n"
             + "- When recommending a doctor, ONLY use doctors/hospitals from the platform list provided below.\n"
             + "- Match the specialist type to the symptoms (e.g., chest pain → Cardiologist, skin issues → Dermatologist).\n"
             + "- Include the doctor's name, hospital, city, and consultation fee.\n"
             + "- Guide the user on how to book: 'Click Book Now on the dashboard for [Hospital Name]'.\n\n"

             + "### 5. SAFETY & ETHICS:\n"
             + "- For ANY mention of chest pain, difficulty breathing, stroke symptoms, severe bleeding, loss of consciousness, or suicidal thoughts → IMMEDIATELY classify as 🔴 EMERGENCY and instruct to call 112 or go to the nearest ER.\n"
             + "- Always end with a disclaimer: 'I am an AI health assistant and cannot replace professional medical examination. Please consult a qualified doctor for diagnosis and treatment.'\n"
             + "- Never provide advice that could delay critical emergency care.\n"
             + "- Be empathetic, supportive, and use clear language the patient can understand.\n\n"

             + "### 6. RESPONSE FORMAT:\n"
             + "- Use markdown formatting with emojis for readability.\n"
             + "- Structure responses with clear headings and bullet points.\n"
             + "- Keep responses concise but thorough (150-250 words for assessments, shorter for follow-up questions).\n"
             + "- Use bold for important terms and warnings.\n\n"

             + "### 7. CONVERSATION CONTEXT:\n"
             + "- You have access to the full conversation history. Use it to provide contextual, personalized responses.\n"
             + "- If the user has already provided details in previous messages, don't ask for them again.\n"
             + "- Build upon previous exchanges to narrow down the assessment progressively.\n"
             + "- If the user changes topic, adapt smoothly.\n\n"

             + "### 8. LANGUAGE MIRRORING (VERY IMPORTANT):\n"
             + "- ALWAYS detect the language the user is writing in and reply in the EXACT SAME language and style.\n"
             + "- If the user writes in Hinglish (Hindi words written in Roman/English script, like WhatsApp language), you MUST reply in Hinglish.\n"
             + "  Example: User says 'mujhe sir me dard ho rha hai' → Reply in Hinglish like 'Aapko ye headache kab se ho rha hai? Kya aapko bukhar bhi hai?'\n"
             + "- If the user writes in pure Hindi (Devanagari script), reply in Hindi.\n"
             + "- If the user writes in pure English, reply in English.\n"
             + "- If the user mixes languages, match their exact mixing style.\n"
             + "- This applies to ALL parts of your response — questions, advice, disclaimers, doctor recommendations — everything should be in the user's language.\n"
             + "- Keep medical terms in English even when replying in Hinglish/Hindi (e.g., 'blood pressure', 'CT scan', 'paracetamol') so there is no medical confusion.\n"
             + "- The emoji usage and markdown formatting should remain the same regardless of language.\n\n"

             + doctorsContext;
    }

    /**
     * Build the context string of registered doctors/hospitals
     */
    private String buildDoctorsContext(List<Hospital> hospitals) {
        StringBuilder sb = new StringBuilder();
        sb.append("### AVAILABLE DOCTORS & HOSPITALS ON MEDASTRAX PLATFORM:\n");
        sb.append("(ONLY recommend from this list. Do NOT invent doctors or hospitals.)\n\n");

        if (hospitals == null || hospitals.isEmpty()) {
            sb.append("- No hospitals currently registered on the platform.\n");
            sb.append("- Advise the user to check back later or visit a local healthcare facility.\n");
        } else {
            for (Hospital h : hospitals) {
                String docName = (h.getDoctor() != null && h.getDoctor().getName() != null)
                    ? h.getDoctor().getName() : "Staff Doctor";
                String specialties = (h.getDoctorTypes() != null && !h.getDoctorTypes().isEmpty())
                    ? h.getDoctorTypes() : "General Physician";
                String facilities = (h.getFacilities() != null && !h.getFacilities().isEmpty())
                    ? h.getFacilities().toString() : "General";

                sb.append("- **").append(h.getName()).append("** (").append(h.getCity()).append(")")
                  .append(" | Doctor: ").append(docName)
                  .append(" | Specialties: ").append(specialties)
                  .append(" | Fee: ₹").append(h.getConsultationRate())
                  .append(" | Facilities: ").append(facilities)
                  .append("\n");
            }
        }

        return sb.toString();
    }

    // ─── Utility Methods ──────────────────────────────────────────────

    private boolean isApiConfigured() {
        return hfToken != null && !hfToken.trim().isEmpty() && !hfToken.equals("your_hf_token_here");
    }

    private void trimHistory(List<Map<String, String>> history) {
        while (history.size() > MAX_HISTORY_MESSAGES * 2) {
            history.remove(0);
        }
    }

    private void cleanExpiredSessions() {
        long now = System.currentTimeMillis();
        long thirtyMinutes = 30 * 60 * 1000;
        sessionTimestamps.entrySet().removeIf(entry -> {
            if (now - entry.getValue() > thirtyMinutes) {
                sessionStore.remove(entry.getKey());
                return true;
            }
            return false;
        });
        querySessionTimestamps.entrySet().removeIf(entry -> {
            if (now - entry.getValue() > thirtyMinutes) {
                querySessionStore.remove(entry.getKey());
                return true;
            }
            return false;
        });
    }

    @SuppressWarnings("unchecked")
    private String getStringField(Map<String, Object> map, String key, String defaultVal) {
        Object val = map.get(key);
        if (val == null) return defaultVal;
        return val.toString().trim();
    }

    @PostMapping("/analyze-consultation")
    public ResponseEntity<?> analyzeConsultation(@RequestBody Map<String, Object> request) {
        String transcript = getStringField(request, "transcript", "").trim();
        String patientName = getStringField(request, "patientName", "Patient");
        String doctorName = getStringField(request, "doctorName", "Doctor");

        if (transcript.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Transcript cannot be empty"
            ));
        }

        String systemPrompt = "You are Astra, an advanced AI clinical scribe and medical reporting assistant. "
             + "Your job is to analyze the text transcript of a doctor-patient consultation and generate a highly detailed, professional, structured clinical report. "
             + "The report must be structured in markdown with the following headings:\n"
             + "1. 🩺 **Chief Complaints & Symptoms**: Detailed list of symptoms, their duration, and severity.\n"
             + "2. 🔍 **Clinical Observations & Discussion Summary**: A summary of what was discussed during the consultation.\n"
             + "3. 💊 **Prescription & Medication Plan**: Suggested medications, dosage, and frequency if mentioned in the transcript. If not, state 'None discussed'.\n"
             + "4. 📋 **Doctor's Advice & Patient Instructions**: Lifestyle advice, rest, follow-up timelines, and test recommendations.\n"
             + "5. 🔴 **Red Flag Warnings**: Urgent symptoms that require emergency medical attention.\n\n"
             + "Analyze the transcript carefully. Be empathetic and professional. Translate Hinglish/Hindi symptoms to standard medical terminology where appropriate.";

        String userPrompt = "Generate a structured clinical report for a consultation between Doctor: " + doctorName + " and Patient: " + patientName + ".\n\n"
             + "### CONSULTATION TRANSCRIPT:\n\"\"\"\n" + transcript + "\n\"\"\"";

        String reply;
        String modelUsed;

        if (isApiConfigured()) {
            try {
                reply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                modelUsed = "Astra (HuggingFace: medgemma-27b-it)";
            } catch (Exception e) {
                System.err.println("⚠️ HuggingFace AI error: " + e.getMessage());
                try {
                    reply = callHuggingFaceChat("google/gemma-3-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                    modelUsed = "Astra (HuggingFace: Gemma-3-27B)";
                } catch (Exception e2) {
                    System.err.println("⚠️ Fallback model failed: " + e2.getMessage());
                    reply = generateOfflineFallbackReport(transcript, patientName, doctorName);
                    modelUsed = "Astra (Offline Fallback Heuristics)";
                }
            }
        } else {
            reply = generateOfflineFallbackReport(transcript, patientName, doctorName);
            modelUsed = "Astra (Offline Fallback Heuristics)";
        }

        return ResponseEntity.ok(Map.of(
            "success", true,
            "report", reply,
            "model", modelUsed
        ));
    }

    private String generateOfflineFallbackReport(String transcript, String patientName, String doctorName) {
        String lower = transcript.toLowerCase();
        
        // 1. Symptoms Extract
        List<String> symptoms = new ArrayList<>();
        if (lower.contains("cough") || lower.contains("khansi")) symptoms.add("Cough (Dry/Wet)");
        if (lower.contains("fever") || lower.contains("bukhar") || lower.contains("temp")) symptoms.add("Fever / Elevated Body Temperature");
        if (lower.contains("headache") || lower.contains("sir dard") || lower.contains("head pain")) symptoms.add("Headache (Mild to Moderate)");
        if (lower.contains("chest pain") || lower.contains("छाती")) symptoms.add("Chest Discomfort / Chest Pain");
        if (lower.contains("stomach") || lower.contains("pet dard")) symptoms.add("Abdominal Pain / Stomach ache");
        if (lower.contains("throat") || lower.contains("gala")) symptoms.add("Sore Throat / Pharyngitis");
        if (lower.contains("cold") || lower.contains("जुकाम") || lower.contains("sneeze")) symptoms.add("Common Cold / Nasal Congestion");
        if (lower.contains("vomit") || lower.contains("ultty")) symptoms.add("Nausea / Vomiting");
        if (lower.contains("weak") || lower.contains("thakan") || lower.contains("tired")) symptoms.add("Fatigue / General Weakness");
        
        if (symptoms.isEmpty()) {
            symptoms.add("General wellness consultation / Mild discomfort");
        }

        // 2. Medications Extract
        List<String> medicines = new ArrayList<>();
        if (lower.contains("paracetamol") || lower.contains("pcm") || lower.contains("crocin") || lower.contains("dolo")) {
            medicines.add("💊 **Paracetamol 650mg** - 1 tablet as needed (Max 3 times daily) after food for fever/pain relief.");
        }
        if (lower.contains("cough syrup") || lower.contains("syrup") || lower.contains("dextromethorphan")) {
            medicines.add("💊 **Cough Syrup (Antitussive)** - 10ml twice daily after food for 5 days.");
        }
        if (lower.contains("ibuprofen") || lower.contains("combiflam") || lower.contains("painkiller")) {
            medicines.add("💊 **Ibuprofen 400mg** - 1 tablet twice daily after food as needed for pain/inflammation.");
        }
        if (lower.contains("pantocid") || lower.contains("pantoprazole") || lower.contains("gas") || lower.contains("aciloc")) {
            medicines.add("💊 **Pantoprazole 40mg** - 1 tablet daily in the morning, 30 minutes before breakfast for 5 days.");
        }
        if (lower.contains("cetirizine") || lower.contains("allegra") || lower.contains("allergy")) {
            medicines.add("💊 **Cetirizine 10mg** - 1 tablet at night before bedtime for allergy/sneezing relief.");
        }
        if (lower.contains("amoxicillin") || lower.contains("antibiotic") || lower.contains("azithromycin")) {
            medicines.add("💊 **Amoxicillin 500mg** - 1 tablet three times daily after food for 5 days (Complete full course).");
        }
        
        if (medicines.isEmpty()) {
            medicines.add("No specific medications prescribed. Recommended self-monitoring and lifestyle adjustments.");
        }

        // 3. Plan & Advice
        List<String> advice = new ArrayList<>();
        advice.add("Rest well and avoid strenuous physical activities for the next 2-3 days.");
        if (lower.contains("water") || lower.contains("hydration") || lower.contains("liquid") || lower.contains("fever") || lower.contains("cough")) {
            advice.add("Increase warm fluid intake (warm water, herbal tea, clear broths) to soothe throat and stay hydrated.");
        }
        if (lower.contains("cold") || lower.contains("cough") || lower.contains("throat")) {
            advice.add("Perform warm salt water gargles 3-4 times a day.");
        }
        if (lower.contains("fever") || lower.contains("temperature")) {
            advice.add("Monitor body temperature every 6 hours and maintain a log.");
        }
        advice.add("If symptoms persist or worsen after 3 days, visit the hospital for a physical examination.");

        // 4. Red Flags
        List<String> redFlags = new ArrayList<>();
        if (lower.contains("chest") || lower.contains("breath") || lower.contains("heart")) {
            redFlags.add("🚨 **SEVERE Emergency Symptoms**: Any worsening chest pain radiating to arm or jaw, severe shortness of breath, or palpitations require immediate emergency hospital admission.");
        } else {
            redFlags.add("🚨 **Emergency Warning**: Seek immediate medical care if you experience high persistent fever (>103°F), difficulty breathing, sudden severe dizziness, or confusion.");
        }

        StringBuilder sb = new StringBuilder();
        sb.append("# 🩺 AI CLINICAL CONSULTATION REPORT\n\n");
        sb.append("**Patient Name**: ").append(patientName).append("  \n");
        sb.append("**Attending Doctor**: ").append(doctorName).append("  \n");
        sb.append("**Date**: ").append(new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(new Date())).append("  \n\n");
        
        sb.append("## 1. 🩺 Chief Complaints & Symptoms\n");
        for (String sym : symptoms) {
            sb.append("- ").append(sym).append("\n");
        }
        sb.append("\n");

        sb.append("## 2. 🔍 Clinical Observations & Discussion Summary\n");
        sb.append("Based on the transcription analyzer, the patient reported the symptoms noted above. ");
        sb.append("The doctor reviewed the symptoms, checked history, and provided relevant clinical guidance. ");
        sb.append("The conversation indicates a general progression of mild to moderate clinical concern.\n\n");

        sb.append("## 3. 💊 Prescription & Medication Plan\n");
        for (String med : medicines) {
            sb.append("- ").append(med).append("\n");
        }
        sb.append("\n");

        sb.append("## 4. 📋 Doctor's Advice & Patient Instructions\n");
        for (String adv : advice) {
            sb.append("- ").append(adv).append("\n");
        }
        sb.append("\n");

        sb.append("## 5. 🔴 Red Flag Warnings\n");
        for (String rf : redFlags) {
            sb.append("- ").append(rf).append("\n");
        }
        sb.append("\n");
        
        sb.append("*(Note: This report is generated automatically by MedVerse AI Scribe from the live audio/speech transcript of the consultation. It should be verified by the doctor before execution.)*");
        
        return sb.toString();
    }

    @PostMapping("/compare-reports")
    public ResponseEntity<?> compareReports(@RequestBody Map<String, Object> request) {
        String previousReport = getStringField(request, "previousReport", "").trim();
        String currentReport = getStringField(request, "currentReport", "").trim();

        if (previousReport.isEmpty() || currentReport.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Both previous and current reports must be provided"
            ));
        }

        String systemPrompt = "You are Astra, an advanced AI clinical intelligence assistant for the MedAstrax healthcare platform. "
             + "Your task is to analyze and compare two medical reports/prescriptions: a Previous Report and a Current/Latest Report. "
             + "Generate a highly detailed, professional, structured clinical comparison report in markdown. "
             + "The report must have the following sections:\n"
             + "1. 📈 **Recovery & Improvement Assessment**: Compare overall condition and estimate recovery/healing progress.\n"
             + "2. 💊 **Medication Analysis (Side-by-Side)**: Compare previous vs current medicines. Highlight dose/frequency changes, new additions, or discontinued medications.\n"
             + "3. 🔍 **Symptom & Diagnosis Progression**: Summarize how symptoms and diagnoses have evolved.\n"
             + "4. 📊 **Lab & Vital Parameters**: Compare vitals or lab values if mentioned.\n"
             + "5. ⚠️ **Precautions & Clinical Recommendations**: AI-driven warnings, advice on side-effects, and recovery guidelines.\n\n"
             + "Be clinical, precise, and supportive. Use clear markdown formatting. Translate symptom descriptions from Hinglish/Hindi where appropriate, but match the language style of the reports if they are in Hindi/Hinglish.";

        String userPrompt = "Perform a detailed comparative analysis between these two reports:\n\n"
             + "### PREVIOUS REPORT:\n\"\"\"\n" + previousReport + "\n\"\"\"\n\n"
             + "### CURRENT REPORT:\n\"\"\"\n" + currentReport + "\n\"\"\"";

        String reply;
        String modelUsed;

        if (isApiConfigured()) {
            try {
                reply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                modelUsed = "Astra (HuggingFace: medgemma-27b-it)";
            } catch (Exception e) {
                System.err.println("⚠️ HuggingFace AI error: " + e.getMessage());
                try {
                    reply = callHuggingFaceChat("google/gemma-3-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                    modelUsed = "Astra (HuggingFace: Gemma-3-27B)";
                } catch (Exception e2) {
                    System.err.println("⚠️ Fallback model failed: " + e2.getMessage());
                    reply = generateOfflineComparisonReport(previousReport, currentReport);
                    modelUsed = "Astra (Offline Fallback Heuristics)";
                }
            }
        } else {
            reply = generateOfflineComparisonReport(previousReport, currentReport);
            modelUsed = "Astra (Offline Fallback Heuristics)";
        }

        return ResponseEntity.ok(Map.of(
            "success", true,
            "comparison", reply,
            "model", modelUsed
        ));
    }

    private String generateOfflineComparisonReport(String previousReport, String currentReport) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 📊 AI MEDICAL REPORT COMPARISON (Offline Mode)\n\n");
        sb.append("*(Note: Running in offline heuristic mode. The comparison below is generated based on text analysis of the reports.)*\n\n");

        String prevLower = previousReport.toLowerCase();
        String currLower = currentReport.toLowerCase();

        // 1. Recovery Assessment
        sb.append("## 1. 📈 Recovery & Improvement Assessment\n");
        boolean prevHasFever = prevLower.contains("fever") || prevLower.contains("bukhar") || prevLower.contains("temperature");
        boolean currHasFever = currLower.contains("fever") || currLower.contains("bukhar") || currLower.contains("temperature");
        boolean prevHasPain = prevLower.contains("pain") || prevLower.contains("dard") || prevLower.contains("headache") || prevLower.contains("stomach");
        boolean currHasPain = currLower.contains("pain") || currLower.contains("dard") || currLower.contains("headache") || currLower.contains("stomach");

        if (prevHasFever && !currHasFever) {
            sb.append("- **Fever resolved**: The current report does not indicate an active fever. This shows good progress.\n");
        }
        if (prevHasPain && !currHasPain) {
            sb.append("- **Pain relief**: General pain/discomfort mentioned in the previous report appears to have subsided.\n");
        }
        if (!prevHasFever && currHasFever) {
            sb.append("- **New fever onset**: The current report lists elevated body temperature/fever which was not present earlier.\n");
        }

        int score = 0;
        int max = 0;
        if (prevHasFever) { max++; if (!currHasFever) score++; }
        if (prevHasPain) { max++; if (!currHasPain) score++; }
        
        int progressPct = 50;
        if (max > 0) {
            progressPct = (score * 100) / max;
        } else if (currLower.contains("fine") || currLower.contains("normal") || currLower.contains("well") || currLower.contains("recovery") || currLower.contains("healthy")) {
            progressPct = 90;
        } else if (prevLower.equals(currLower)) {
            progressPct = 100;
        }

        sb.append("- **Estimated Recovery Progress**: ~").append(progressPct).append("% improvement based on symptom analysis.\n\n");

        // 2. Medication Analysis
        sb.append("## 2. 💊 Medication Analysis (Side-by-Side)\n");
        sb.append("| Medicine Group | Previous Prescription | Current/Latest Prescription | Change Status |\n");
        sb.append("| :--- | :--- | :--- | :--- |\n");

        String[] commonMeds = {"Paracetamol", "Metformin", "Amoxicillin", "Ibuprofen", "Cetirizine", "Pantoprazole", "Pantocid", "Dolo", "Crocin", "Combiflam", "Azithromycin"};
        boolean medFound = false;

        for (String med : commonMeds) {
            boolean inPrev = prevLower.contains(med.toLowerCase());
            boolean inCurr = currLower.contains(med.toLowerCase());

            if (inPrev || inCurr) {
                medFound = true;
                String status = "";
                if (inPrev && inCurr) {
                    status = "🔄 Maintained";
                } else if (inPrev) {
                    status = "🛑 Discontinued";
                } else {
                    status = "➕ Newly Added";
                }
                sb.append("| ").append(med).append(" | ")
                  .append(inPrev ? "Yes" : "No/Not mentioned").append(" | ")
                  .append(inCurr ? "Yes" : "No/Not mentioned").append(" | ")
                  .append(status).append(" |\n");
            }
        }
        if (!medFound) {
            sb.append("| General | Medicines listed in text | Medicines listed in text | See text inputs below |\n");
        }
        sb.append("\n");

        sb.append("### Medication Notes:\n");
        if (!medFound) {
            sb.append("- Previous medications parsed from text: *").append(previousReport.length() > 100 ? previousReport.substring(0, 97) + "..." : previousReport).append("*\n");
            sb.append("- Current medications parsed from text: *").append(currentReport.length() > 100 ? currentReport.substring(0, 97) + "..." : currentReport).append("*\n");
        } else {
            sb.append("- AI observed changes in active substances. Please review and ensure all discontinued medications have been safely stopped.\n");
        }
        sb.append("\n");

        // 3. Symptom & Diagnosis Progression
        sb.append("## 3. 🔍 Symptom & Diagnosis Progression\n");
        sb.append("- **Previous Diagnosis/Symptoms**: ");
        extractSymptomsForOffline(previousReport, sb);
        sb.append("\n- **Current Diagnosis/Symptoms**: ");
        extractSymptomsForOffline(currentReport, sb);
        sb.append("\n\n");

        // 4. Lab & Vital Parameters
        sb.append("## 4. 📊 Lab & Vital Parameters\n");
        boolean hasBpPrev = prevLower.contains("bp") || prevLower.contains("blood pressure");
        boolean hasBpCurr = currLower.contains("bp") || currLower.contains("blood pressure");
        if (hasBpPrev || hasBpCurr) {
            sb.append("- **Blood Pressure**: Mentioned in reports. Ensure it stays within normal limits (e.g. 120/80 mmHg).\n");
        } else {
            sb.append("- No specific vital signs (BP, Pulse, Blood Sugar) were detected in the text of either report.\n");
        }
        sb.append("\n");

        // 5. Precautions
        sb.append("## 5. ⚠️ Precautions & Clinical Recommendations\n");
        sb.append("- **Dosage Adherence**: Always follow the latest doctor prescription instructions. Do not take self-prescribed medication.\n");
        if (currLower.contains("antibiotic") || currLower.contains("amoxicillin") || currLower.contains("azithromycin")) {
            sb.append("- **Antibiotic Course**: Complete the full course of your new antibiotic as prescribed to prevent drug resistance.\n");
        }
        sb.append("- **Safety Warning**: If you experience severe symptoms like shortness of breath, high fever, chest pain, or allergic reactions, contact your doctor immediately.\n\n");

        sb.append("---  \n");
        sb.append("*(Disclaimer: I am an AI health assistant and cannot replace professional medical examination. Please consult a qualified doctor for diagnosis and treatment.)*");

        return sb.toString();
    }

    private void extractSymptomsForOffline(String report, StringBuilder sb) {
        String lower = report.toLowerCase();
        List<String> list = new ArrayList<>();
        if (lower.contains("cough") || lower.contains("khansi")) list.add("Cough");
        if (lower.contains("fever") || lower.contains("bukhar")) list.add("Fever");
        if (lower.contains("headache") || lower.contains("sir dard")) list.add("Headache");
        if (lower.contains("chest")) list.add("Chest discomfort");
        if (lower.contains("stomach") || lower.contains("pet dard")) list.add("Abdominal Pain");
        if (lower.contains("throat") || lower.contains("gala")) list.add("Sore Throat");
        if (lower.contains("cold") || lower.contains("sniffle")) list.add("Cold");
        if (lower.contains("covid")) list.add("COVID-19 concerns");
        if (lower.contains("diabetes") || lower.contains("sugar")) list.add("High Blood Sugar/Diabetes");
        if (lower.contains("hypertension") || lower.contains("bp")) list.add("Hypertension/High BP");

        if (list.isEmpty()) {
            sb.append("General consultation notes: ").append(report.length() > 80 ? report.substring(0, 77) + "..." : report);
        } else {
            sb.append(String.join(", ", list));
        }
    }

    // ─── Care Plan Endpoint ──────────────────────────────────────────────

    @PostMapping("/care-plan")
    public ResponseEntity<?> generateCarePlan(@RequestBody Map<String, Object> request) {
        String medicines = getStringField(request, "medicines", "").trim();

        if (medicines.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Medicines list is required"
            ));
        }

        String systemPrompt = "You are Astra, an AI-powered personalized care plan generator for the MedAstraX healthcare platform. "
             + "Based on the patient's prescribed medicines, generate a comprehensive, structured care plan in markdown.\n\n"
             + "The plan MUST have exactly these 3 sections:\n\n"
             + "## 💊 Medicine Schedule\n"
             + "For each medicine, list:\n"
             + "- Medicine name and dosage\n"
             + "- When to take (Morning/Afternoon/Night based on frequency)\n"
             + "- Whether to take before or after meals\n"
             + "- Important precautions or interactions\n\n"
             + "## 🥗 Diet Plan\n"
             + "Based on the medicines and likely conditions, suggest:\n"
             + "- **Breakfast** (7-8 AM): specific foods\n"
             + "- **Mid-Morning Snack** (10-11 AM): light options\n"
             + "- **Lunch** (12-1 PM): balanced meal\n"
             + "- **Evening Snack** (4-5 PM): healthy options\n"
             + "- **Dinner** (7-8 PM): light, easy to digest\n"
             + "- **Foods to AVOID** based on the medicines\n"
             + "- **Foods to PREFER** for recovery\n\n"
             + "## 🏃 Exercise Plan\n"
             + "Based on the patient's condition (inferred from medicines), suggest:\n"
             + "- **Morning Routine** (15-20 min)\n"
             + "- **Evening Routine** (15-20 min)\n"
             + "- **Breathing Exercises** for stress relief\n"
             + "- **Activities to AVOID** during treatment\n"
             + "- **Weekly Goals**\n\n"
             + "Be specific, practical, and evidence-based. Use emojis for readability.";

        String userPrompt = "Generate a personalized care plan for a patient taking these medicines:\n\n" + medicines;

        String reply;
        String modelUsed;

        if (isApiConfigured()) {
            try {
                reply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                modelUsed = "Astra (HuggingFace: medgemma-27b-it)";
            } catch (Exception e) {
                System.err.println("⚠️ Care Plan AI error: " + e.getMessage());
                try {
                    reply = callHuggingFaceChat("google/gemma-3-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                    modelUsed = "Astra (HuggingFace: Gemma-3-27B)";
                } catch (Exception e2) {
                    System.err.println("⚠️ Care Plan fallback failed: " + e2.getMessage());
                    reply = generateOfflineCarePlan(medicines);
                    modelUsed = "Astra (Offline Fallback)";
                }
            }
        } else {
            reply = generateOfflineCarePlan(medicines);
            modelUsed = "Astra (Offline Fallback)";
        }

        return ResponseEntity.ok(Map.of(
            "success", true,
            "carePlan", reply,
            "model", modelUsed
        ));
    }

    private String generateOfflineCarePlan(String medicines) {
        StringBuilder sb = new StringBuilder();

        sb.append("## 💊 Medicine Schedule\n\n");
        sb.append("Based on your prescriptions, here is your recommended medicine schedule:\n\n");
        sb.append("| Medicine | Dosage | Morning ☀️ | Afternoon 🌤️ | Night 🌙 | Notes |\n");
        sb.append("| :--- | :--- | :---: | :---: | :---: | :--- |\n");

        // Try to parse medicine JSON
        try {
            ObjectMapper mapper = new ObjectMapper();
            List<Map<String, Object>> medList = mapper.readValue(medicines, List.class);
            for (Map<String, Object> med : medList) {
                String name = (String) med.getOrDefault("name", "Unknown");
                String dosage = (String) med.getOrDefault("dosage", "-");
                String freq = (String) med.getOrDefault("frequency", "1-0-0");
                String duration = (String) med.getOrDefault("duration", "-");
                String[] parts = freq.split("-");
                String m = parts.length > 0 && "1".equals(parts[0]) ? "✅" : "—";
                String a = parts.length > 1 && "1".equals(parts[1]) ? "✅" : "—";
                String n = parts.length > 2 && "1".equals(parts[2]) ? "✅" : "—";
                sb.append("| ").append(name).append(" | ").append(dosage)
                  .append(" | ").append(m).append(" | ").append(a).append(" | ").append(n)
                  .append(" | ").append(duration).append(" |\n");
            }
        } catch (Exception e) {
            sb.append("| (See your prescription) | - | ✅ | - | ✅ | Take as prescribed |\n");
        }

        sb.append("\n**General Tips:**\n");
        sb.append("- Take medicines at the same time every day\n");
        sb.append("- Take after meals unless your doctor says otherwise\n");
        sb.append("- Do not skip doses; complete the full course\n\n");

        sb.append("## 🥗 Diet Plan\n\n");
        sb.append("### 🌅 Breakfast (7:00 - 8:00 AM)\n");
        sb.append("- Oatmeal with fresh fruits and nuts, OR\n");
        sb.append("- 2 whole wheat toast with scrambled eggs\n");
        sb.append("- 1 glass warm water with lemon (before breakfast)\n\n");
        sb.append("### 🍎 Mid-Morning Snack (10:00 - 11:00 AM)\n");
        sb.append("- 1 seasonal fruit (apple/banana/papaya)\n");
        sb.append("- A handful of mixed nuts (almonds, walnuts)\n\n");
        sb.append("### 🍱 Lunch (12:30 - 1:30 PM)\n");
        sb.append("- Dal + brown rice/roti + seasonal sabzi + salad\n");
        sb.append("- 1 bowl curd/raita\n\n");
        sb.append("### 🫖 Evening Snack (4:00 - 5:00 PM)\n");
        sb.append("- Green tea / herbal tea\n");
        sb.append("- Sprouts salad or roasted chana\n\n");
        sb.append("### 🌙 Dinner (7:00 - 8:00 PM)\n");
        sb.append("- Light khichdi/soup + 1 roti + sabzi\n");
        sb.append("- Avoid heavy, fried, or spicy food at night\n\n");
        sb.append("### ❌ Foods to AVOID\n");
        sb.append("- Excessive caffeine, alcohol, smoking\n");
        sb.append("- Deep fried/junk food, excessive sugar\n");
        sb.append("- Cold drinks, ice cream during medication\n\n");
        sb.append("### ✅ Foods to PREFER\n");
        sb.append("- Fresh fruits, vegetables, whole grains\n");
        sb.append("- Warm soups, herbal teas, coconut water\n");
        sb.append("- High protein: dal, eggs, paneer, chicken\n\n");

        sb.append("## 🏃 Exercise Plan\n\n");
        sb.append("### 🌅 Morning Routine (15-20 min)\n");
        sb.append("- 10 min brisk walking\n");
        sb.append("- 5 min light stretching (neck, shoulders, back)\n");
        sb.append("- 5 min deep breathing (Pranayama)\n\n");
        sb.append("### 🌇 Evening Routine (15-20 min)\n");
        sb.append("- 10 min walk after dinner (aids digestion)\n");
        sb.append("- 5 min yoga (Shavasana, Balasana)\n");
        sb.append("- 5 min meditation or relaxation\n\n");
        sb.append("### 🫁 Breathing Exercises\n");
        sb.append("- **Anulom Vilom**: 5 min, morning\n");
        sb.append("- **Deep Belly Breathing**: 3 min, before bed\n\n");
        sb.append("### ⚠️ Activities to AVOID During Treatment\n");
        sb.append("- Heavy gym workouts, intense cardio\n");
        sb.append("- Swimming in cold water\n");
        sb.append("- Strenuous outdoor activities in extreme heat\n\n");
        sb.append("### 📊 Weekly Goals\n");
        sb.append("- Walk at least 30 min/day, 5 days/week\n");
        sb.append("- Drink 8-10 glasses of water daily\n");
        sb.append("- Sleep 7-8 hours every night\n");

        return sb.toString();
    }

    // ─── Explain Medicine Endpoint ───────────────────────────────────────

    @PostMapping("/explain-medicine")
    public ResponseEntity<?> explainMedicine(@RequestBody Map<String, Object> request) {
        String medicine = getStringField(request, "medicine", "").trim();

        if (medicine.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Medicine name is required"
            ));
        }

        String systemPrompt = "You are Astra, an AI health assistant. Explain medicines in simple, patient-friendly language. "
             + "For the given medicine, provide:\n"
             + "1. **What it is**: Simple one-line description\n"
             + "2. **What it does**: How it works in the body\n"
             + "3. **Common uses**: What conditions it treats\n"
             + "4. **How to take**: Before/after meals, with water, etc.\n"
             + "5. **Side effects**: Common ones to watch for\n"
             + "6. **Precautions**: What to avoid while taking it\n"
             + "7. **Important warnings**: Allergies, interactions\n\n"
             + "Keep it simple, use emojis, and be reassuring. Use markdown formatting.";

        String userPrompt = "Explain this medicine in simple terms: " + medicine;

        String reply;
        String modelUsed;

        if (isApiConfigured()) {
            try {
                reply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                modelUsed = "Astra (HuggingFace: medgemma-27b-it)";
            } catch (Exception e) {
                try {
                    reply = callHuggingFaceChat("google/gemma-3-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                    modelUsed = "Astra (HuggingFace: Gemma-3-27B)";
                } catch (Exception e2) {
                    reply = generateOfflineMedicineExplanation(medicine);
                    modelUsed = "Astra (Offline Fallback)";
                }
            }
        } else {
            reply = generateOfflineMedicineExplanation(medicine);
            modelUsed = "Astra (Offline Fallback)";
        }

        return ResponseEntity.ok(Map.of(
            "success", true,
            "explanation", reply,
            "model", modelUsed
        ));
    }

    private String generateOfflineMedicineExplanation(String medicine) {
        String lower = medicine.toLowerCase();
        StringBuilder sb = new StringBuilder();
        sb.append("# 💊 ").append(medicine).append("\n\n");

        if (lower.contains("paracetamol") || lower.contains("dolo") || lower.contains("crocin")) {
            sb.append("**What it is:** A common pain reliever and fever reducer.\n\n");
            sb.append("**What it does:** Reduces fever and relieves mild to moderate pain by acting on the brain's pain and temperature centers.\n\n");
            sb.append("**Common uses:** Fever, headache, body pain, cold & flu symptoms.\n\n");
            sb.append("**How to take:** After meals, with a glass of water. Do not exceed 4 tablets in 24 hours.\n\n");
            sb.append("**Side effects:** Generally safe. Rarely: nausea, skin rash.\n\n");
            sb.append("**⚠️ Warning:** Do NOT take with alcohol. Overdose can damage the liver.\n");
        } else if (lower.contains("amoxicillin")) {
            sb.append("**What it is:** An antibiotic that fights bacterial infections.\n\n");
            sb.append("**What it does:** Kills bacteria by preventing them from building cell walls.\n\n");
            sb.append("**Common uses:** Throat infections, ear infections, urinary tract infections.\n\n");
            sb.append("**How to take:** With or after meals. Complete the FULL course even if you feel better.\n\n");
            sb.append("**Side effects:** Diarrhea, nausea, skin rash.\n\n");
            sb.append("**⚠️ Warning:** Tell your doctor if you're allergic to penicillin.\n");
        } else if (lower.contains("cetirizine") || lower.contains("allegra")) {
            sb.append("**What it is:** An antihistamine (anti-allergy medicine).\n\n");
            sb.append("**What it does:** Blocks histamine to reduce allergy symptoms.\n\n");
            sb.append("**Common uses:** Sneezing, runny nose, itchy eyes, skin allergies.\n\n");
            sb.append("**How to take:** Once daily, preferably at night (may cause drowsiness).\n\n");
            sb.append("**Side effects:** Drowsiness, dry mouth.\n\n");
            sb.append("**⚠️ Warning:** Avoid driving after taking. Do not mix with alcohol.\n");
        } else if (lower.contains("ibuprofen") || lower.contains("combiflam")) {
            sb.append("**What it is:** A non-steroidal anti-inflammatory drug (NSAID).\n\n");
            sb.append("**What it does:** Reduces pain, inflammation, and fever.\n\n");
            sb.append("**Common uses:** Body pain, joint pain, dental pain, menstrual cramps.\n\n");
            sb.append("**How to take:** After meals to avoid stomach upset.\n\n");
            sb.append("**Side effects:** Stomach pain, acidity, nausea.\n\n");
            sb.append("**⚠️ Warning:** Avoid on empty stomach. Not recommended for people with stomach ulcers.\n");
        } else if (lower.contains("pantoprazole") || lower.contains("pantocid")) {
            sb.append("**What it is:** A proton pump inhibitor (PPI) for acid reduction.\n\n");
            sb.append("**What it does:** Reduces stomach acid production.\n\n");
            sb.append("**Common uses:** Acidity, GERD, gastric ulcers.\n\n");
            sb.append("**How to take:** 30 minutes BEFORE breakfast, on empty stomach.\n\n");
            sb.append("**Side effects:** Headache, mild nausea, dizziness.\n\n");
            sb.append("**⚠️ Warning:** Long-term use should be monitored by a doctor.\n");
        } else {
            sb.append("**What it is:** A prescribed medication for your condition.\n\n");
            sb.append("**How to take:** Follow your doctor's instructions carefully.\n\n");
            sb.append("**General advice:**\n");
            sb.append("- Take at the same time every day\n");
            sb.append("- Take with water, preferably after meals\n");
            sb.append("- Do not skip doses or stop early\n");
            sb.append("- Report any unusual side effects to your doctor\n\n");
            sb.append("**⚠️ Note:** For detailed information about this specific medicine, please consult your doctor or pharmacist.\n");
        }

        return sb.toString();
    }

    @PostMapping("/analyze-reports")
    public ResponseEntity<?> analyzeReports(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String email = tokenProvider.getEmailFromToken(token);
            User patient = authService.getUserByEmail(email);

            // Fetch patient profile
            PatientProfile profile = authService.getPatientProfile(patient.getId());
            if (profile == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Patient profile not found"));
            }

            // Fetch prescriptions
            List<Prescription> prescriptions = prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(patient.getId());
            
            // Fetch lab bookings
            List<LabBooking> labBookings = labBookingRepository.findByPatientId(patient.getId());

            if (prescriptions.isEmpty() && labBookings.isEmpty()) {
                profile.setHealthBadge("STABLE");
                profile.setLastAnalysis("No previous medical reports found to analyze. Start by booking consultations or lab tests.");
                profile.setCarePlan("### Personalized Care Plan\n- **Medicines**: None prescribed yet.\n- **Diet**: Eat a balanced diet with plenty of vegetables, whole grains, and lean proteins.\n- **Exercise**: Engage in 30 minutes of moderate exercise like walking 5 times a week.");
                profile.setExpPoints(profile.getExpPoints() + 25);
                patientProfileRepository.save(profile);
                
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "healthBadge", "STABLE",
                    "comparison", profile.getLastAnalysis(),
                    "carePlan", profile.getCarePlan(),
                    "expPoints", profile.getExpPoints()
                ));
            }

            // Construct history context
            StringBuilder historyText = new StringBuilder();
            historyText.append("Patient Medical History Summary:\n");
            
            historyText.append("\nPrescriptions:\n");
            for (Prescription p : prescriptions) {
                historyText.append("- Date: ").append(p.getCreatedAt() != null ? p.getCreatedAt().toString() : "N/A")
                        .append(", Diagnosis: ").append(p.getDiagnosis())
                        .append(", Medicines: ").append(p.getMedicines())
                        .append(", Tests: ").append(p.getTests())
                        .append(", Notes: ").append(p.getNotes()).append("\n");
            }

            historyText.append("\nLab/Diagnostic Bookings:\n");
            for (LabBooking lb : labBookings) {
                historyText.append("- Date: ").append(lb.getCreatedAt() != null ? lb.getCreatedAt().toString() : "N/A")
                        .append(", Lab Name: ").append(lb.getLabName())
                        .append(", Tests: ").append(lb.getTestsJson())
                        .append(", Status: ").append(lb.getStatus()).append("\n");
            }

            String systemPrompt = "You are Astra, an advanced AI clinical assistant on MedAstraX. "
                    + "Your task is to analyze the patient's medical history (previous vs current prescriptions and lab bookings) and generate a report.\n\n"
                    + "Provide the output in the following JSON format ONLY:\n"
                    + "{\n"
                    + "  \"healthBadge\": \"STABLE\" or \"MONITORING\" or \"CRITICAL\",\n"
                    + "  \"comparison\": \"A brief clinical comparison summary between the previous and current reports, detailing if the condition is improving, stable, or worsening.\",\n"
                    + "  \"carePlan\": \"A detailed markdown format personalized care plan listing all active medicines with their schedule, recommended diet plan, and exercise instructions.\"\n"
                    + "}";

            String userPrompt = "Analyze the following patient medical history and return the JSON response:\n\n" + historyText.toString();

            String aiReply = "";
            String badge = "STABLE";
            String comparison = "";
            String carePlan = "";

            if (isApiConfigured()) {
                try {
                    aiReply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt)));
                    
                    try {
                        Map<String, Object> parsed = objectMapper.readValue(aiReply, Map.class);
                        badge = (String) parsed.getOrDefault("healthBadge", "STABLE");
                        comparison = (String) parsed.getOrDefault("comparison", "");
                        carePlan = (String) parsed.getOrDefault("carePlan", "");
                    } catch (Exception parseEx) {
                        if (aiReply.contains("\"healthBadge\"")) {
                            if (aiReply.contains("CRITICAL")) badge = "CRITICAL";
                            else if (aiReply.contains("MONITORING")) badge = "MONITORING";
                            else badge = "STABLE";
                        }
                        comparison = "AI Report comparison successfully generated. Refer to care plan below.";
                        carePlan = aiReply;
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ HuggingFace AI error: " + e.getMessage());
                    Map<String, String> fallback = generateOfflineReportAndBadge(prescriptions, labBookings);
                    badge = fallback.get("healthBadge");
                    comparison = fallback.get("comparison");
                    carePlan = fallback.get("carePlan");
                }
            } else {
                Map<String, String> fallback = generateOfflineReportAndBadge(prescriptions, labBookings);
                badge = fallback.get("healthBadge");
                comparison = fallback.get("comparison");
                carePlan = fallback.get("carePlan");
            }

            // Save to database
            profile.setHealthBadge(badge);
            profile.setLastAnalysis(comparison);
            profile.setCarePlan(carePlan);
            profile.setExpPoints(profile.getExpPoints() + 25);
            
            patientProfileRepository.save(profile);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "healthBadge", badge,
                "comparison", comparison,
                "carePlan", carePlan,
                "expPoints", profile.getExpPoints()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    private Map<String, String> generateOfflineReportAndBadge(List<Prescription> prescriptions, List<LabBooking> labBookings) {
        String badge = "STABLE";
        StringBuilder diagnosisCombined = new StringBuilder();
        StringBuilder medsCombined = new StringBuilder();

        for (Prescription p : prescriptions) {
            if (p.getDiagnosis() != null) diagnosisCombined.append(p.getDiagnosis().toLowerCase()).append(" ");
            if (p.getMedicines() != null) medsCombined.append(p.getMedicines().toLowerCase()).append(" ");
        }

        String diag = diagnosisCombined.toString();
        String meds = medsCombined.toString();

        if (diag.contains("chest pain") || diag.contains("heart") || diag.contains("shortness of breath") || diag.contains("bronchitis") || diag.contains("asthma") || diag.contains("critical")) {
            badge = "CRITICAL";
        } else if (diag.contains("fever") || diag.contains("cough") || diag.contains("viral") || diag.contains("infection") || diag.contains("stomach")) {
            badge = "MONITORING";
        }

        String comparison = "Offline AI Comparison Report:\n"
                + "- Evaluated " + prescriptions.size() + " digital prescriptions and " + labBookings.size() + " diagnostic tests.\n"
                + "- Patient status is determined as **" + badge + "**.\n"
                + "- Latest check shows symptoms: " + (diag.isEmpty() ? "No chronic illness diagnosed." : diag) + ".\n"
                + "- General recommendation is to adhere to medications and log daily activities.";

        StringBuilder carePlanSb = new StringBuilder();
        carePlanSb.append("### 📋 Personalized Care Plan (Offline Heuristic)\n\n");
        carePlanSb.append("#### 💊 Active Medications & Schedule:\n");
        
        if (prescriptions.isEmpty()) {
            carePlanSb.append("- No active medications listed.\n");
        } else {
            Prescription latest = prescriptions.get(0);
            carePlanSb.append("- **Latest Diagnosis**: ").append(latest.getDiagnosis()).append("\n");
            carePlanSb.append("- **Instructions**: Refer to latest prescription details for medicine names. Ensure timely dosage.\n");
        }

        carePlanSb.append("\n#### 🥗 Recommended Diet Plan:\n");
        if ("CRITICAL".equals(badge)) {
            carePlanSb.append("- Low sodium, low fat, heart-healthy diet.\n");
            carePlanSb.append("- Include leafy greens, oats, berries, and fish high in Omega-3.\n");
            carePlanSb.append("- Strict restriction on processed foods and sugars.\n");
        } else if ("MONITORING".equals(badge)) {
            carePlanSb.append("- High protein, light foods (e.g. soups, dal, khichdi).\n");
            carePlanSb.append("- Warm fluids, herbal tea, ginger-honey mixture to soothe respiratory tracts.\n");
            carePlanSb.append("- Keep hydrated (at least 2.5L water daily).\n");
        } else {
            carePlanSb.append("- Balanced nutritious meals with fiber, protein, and complex carbs.\n");
            carePlanSb.append("- Fresh fruits, raw salads, seeds, and light dairy products.\n");
        }

        carePlanSb.append("\n#### 🏃 Exercise & Rest Recommendations:\n");
        if ("CRITICAL".equals(badge)) {
            carePlanSb.append("- Strictly avoid heavy workouts or weight-lifting.\n");
            carePlanSb.append("- Recommended: 10-15 minutes of slow walking or breathing exercises (Pranayama).\n");
            carePlanSb.append("- Take 8-9 hours of sound sleep daily.\n");
        } else if ("MONITORING".equals(badge)) {
            carePlanSb.append("- Moderate physical activity only. Gentle stretching or yoga.\n");
            carePlanSb.append("- Avoid outdoor activities if air quality is poor or weather is cold.\n");
        } else {
            carePlanSb.append("- 30 minutes of aerobic exercise (brisk walking, cycling, or jogging) 5 times a week.\n");
            carePlanSb.append("- 7-8 hours of sleep for optimum physical recovery.\n");
        }

        Map<String, String> map = new HashMap<>();
        map.put("healthBadge", badge);
        map.put("comparison", comparison);
        map.put("carePlan", carePlanSb.toString());
        return map;
    }

    @PostMapping("/analyze-body-symptoms")
    public ResponseEntity<?> analyzeBodySymptoms(@RequestBody Map<String, Object> request) {
        String symptomsJson;
        try {
            symptomsJson = objectMapper.writeValueAsString(request.get("symptoms"));
        } catch (Exception e) {
            symptomsJson = String.valueOf(request.get("symptoms"));
        }
        
        Boolean onMedication = (Boolean) request.getOrDefault("onMedication", false);
        String prescriptionDetails = getStringField(request, "prescriptionDetails", "");
        String prescriptionImage = getStringField(request, "prescriptionImage", "");

        StringBuilder userPrompt = new StringBuilder();
        userPrompt.append("Patient Symptom Report:\n");
        userPrompt.append("Symptoms Details:\n").append(symptomsJson).append("\n");
        userPrompt.append("On Medication: ").append(onMedication).append("\n");
        if (onMedication != null && onMedication) {
            userPrompt.append("Current Medication Details: ").append(prescriptionDetails).append("\n");
            if (prescriptionImage != null && !prescriptionImage.isEmpty()) {
                userPrompt.append("Prescription Photo Attached: Yes\n");
            }
        }

        String systemPrompt = "You are the MedAstraX AI Assistant. Analyze the user's reported symptom data (Body Part, Severity, Duration, Context) and any accompanying prescription text. Crucial Constraint: You are NOT a doctor. Do NOT provide medical diagnoses, clinical medication prescriptions, or change existing pharmaceutical orders. Instead, provide highly actionable, safe, evidence-based HOME REMEDIES (e.g., R.I.C.E protocol, heat/ice cycling, specific stretches, hydration targets). Always append a prominent friendly medical disclaimer at the bottom.";

        String reply;
        String modelUsed;

        if (isApiConfigured()) {
            try {
                reply = callHuggingFaceChat("google/medgemma-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt.toString())));
                modelUsed = "Astra AI (HuggingFace: medgemma-27b-it)";
            } catch (Exception e) {
                System.err.println("⚠️ HuggingFace AI error: " + e.getMessage());
                try {
                    reply = callHuggingFaceChat("google/gemma-3-27b-it", systemPrompt, List.of(Map.of("role", "user", "content", userPrompt.toString())));
                    modelUsed = "Astra AI (HuggingFace: Gemma-3-27B)";
                } catch (Exception e2) {
                    System.err.println("⚠️ Fallback model failed: " + e2.getMessage());
                    reply = generateOfflineSymptomAnalysisReport(request);
                    modelUsed = "Astra AI (Offline Fallback Heuristics)";
                }
            }
        } else {
            reply = generateOfflineSymptomAnalysisReport(request);
            modelUsed = "Astra AI (Offline Fallback Heuristics)";
        }

        return ResponseEntity.ok(Map.of(
            "success", true,
            "analysis", reply,
            "model", modelUsed
        ));
    }

    private String generateOfflineSymptomAnalysisReport(Map<String, Object> request) {
        StringBuilder sb = new StringBuilder();
        sb.append("# 🩺 Symptom Triage Analysis (Home Care & Recommendations)\n\n");
        sb.append("*(Note: Running in offline fallback mode.)*\n\n");

        List<Map<String, Object>> symptoms = (List<Map<String, Object>>) request.get("symptoms");
        if (symptoms == null || symptoms.isEmpty()) {
            sb.append("No active symptoms reported.\n");
        } else {
            for (Map<String, Object> sym : symptoms) {
                String bodyPart = String.valueOf(sym.getOrDefault("bodyPart", "Unknown"));
                Object severityVal = sym.getOrDefault("severity", "5");
                String duration = String.valueOf(sym.getOrDefault("duration", "N/A"));
                String description = String.valueOf(sym.getOrDefault("description", ""));

                sb.append("### 📍 Area: **").append(bodyPart).append("**\n");
                sb.append("- **Severity Rating**: ").append(severityVal).append("/10\n");
                sb.append("- **Duration**: ").append(duration).append("\n");
                if (!description.isEmpty()) {
                    sb.append("- **Details**: *\"").append(description).append("\"*\n");
                }
                sb.append("\n**📋 Recommended Home Care:**\n");
                String partLower = bodyPart.toLowerCase();
                if (partLower.contains("head")) {
                    sb.append("  - **Rest**: Rest in a quiet, dark room to minimize sensory stimulation.\n");
                    sb.append("  - **Hydration**: Drink 1-2 tall glasses of water. Dehydration is a very common trigger for head discomfort.\n");
                    sb.append("  - **Cold/Warm Compress**: Apply a cool washcloth or ice pack (wrapped in a cloth) to your forehead or the back of your neck for 15 minutes.\n");
                    sb.append("  - **Acupressure**: Gently massage the temples or the space between your thumb and index finger (LI4 point) in circular motions.\n");
                } else if (partLower.contains("neck")) {
                    sb.append("  - **Gentle Range of Motion**: Slowly turn your head side-to-side, up and down, and tilt ear-to-shoulder. Avoid sudden jerking movements.\n");
                    sb.append("  - **Heat Therapy**: Apply a warm compress or use a heating pad on a low setting for 15-20 minutes to relax tight neck muscles.\n");
                    sb.append("  - **Posture Adjustment**: Ensure your computer monitor is at eye level and avoid looking down at your phone for extended periods.\n");
                    sb.append("  - **Supportive Sleeping**: Use a supportive contour pillow that keeps your head and neck aligned with your spine.\n");
                } else if (partLower.contains("shoulder")) {
                    sb.append("  - **R.I.C.E. Protocol (Rest, Ice, Compression, Elevation)**: Rest the affected arm/shoulder. Apply ice wrapped in a towel for 15-20 minutes, 3-4 times a day.\n");
                    sb.append("  - **Gentle Shoulder Shrugs/Rolls**: Roll shoulders backward and forward gently to maintain blood circulation and prevent stiffness.\n");
                    sb.append("  - **Avoid Heavy Lifting**: Refrain from lifting, pushing, or pulling anything heavy using the affected arm.\n");
                    sb.append("  - **Sleeping Position**: Avoid sleeping directly on the painful shoulder.\n");
                } else if (partLower.contains("chest")) {
                    sb.append("  - **⚠️ IMPORTANT NOTICE**: Chest discomfort can sometimes indicate a serious cardiac event. If you experience crushing pain, tightness, radiation to the arm/jaw, sweating, or difficulty breathing, call emergency services immediately.\n");
                    sb.append("  - **Diaphragmatic Breathing**: If due to anxiety or muscle strain, sit comfortably, place one hand on your abdomen, and take slow, deep breaths, letting your belly expand.\n");
                    sb.append("  - **Posture**: Sit upright. Slouching can compress the chest cavity and exacerbate muscular soreness.\n");
                    sb.append("  - **Warm Herbal Tea**: If chest soreness is related to acid reflux or cough, sipping warm chamomile or ginger tea may help.\n");
                } else if (partLower.contains("abdomen")) {
                    sb.append("  - **Hydration & Clear Fluids**: Sip warm water or clear broth. Avoid solid foods for a few hours if you feel nauseated.\n");
                    sb.append("  - **Warm compress**: Apply a warm heating pad to your stomach area for 15 minutes to relieve muscle cramping or gas pain.\n");
                    sb.append("  - **Dietary Modification**: Eat bland foods (such as rice, applesauce, toast) once ready. Avoid dairy, high-fat, spicy, or highly seasoned foods.\n");
                    sb.append("  - **Peppermint/Ginger**: Sipping peppermint or ginger tea can assist with digestive distress.\n");
                } else if (partLower.contains("arm") || partLower.contains("forearm") || partLower.contains("hand") || partLower.contains("wrist")) {
                    sb.append("  - **Rest & Immobilization**: Rest the hand and wrist. Avoid repetitive motions such as typing or squeezing.\n");
                    sb.append("  - **Cold Therapy**: Apply a cold pack wrapped in a cloth to the painful area for 10-15 minutes to reduce localized swelling.\n");
                    sb.append("  - **Elevation**: Elevate the hand above heart level if you notice any swelling or throbbing.\n");
                    sb.append("  - **Gentle Wrist Stretches**: Extend your arm forward, fingers pointing up, and gently pull back on your fingers with the opposite hand.\n");
                } else if (partLower.contains("thigh") || partLower.contains("shin") || partLower.contains("leg") || partLower.contains("knee") || partLower.contains("foot") || partLower.contains("feet")) {
                    sb.append("  - **R.I.C.E. Protocol**: Rest the leg. Apply ice wrapped in a towel for 15 minutes. Use compression or wrap if there is a mild sprain. Elevate your leg on pillows above heart level.\n");
                    sb.append("  - **Stretching**: If experiencing leg cramps (charlie horses), gently stretch the calf muscle by pulling your toes upward toward your shin.\n");
                    sb.append("  - **Warm Epsom Salt Bath**: Soak the legs/feet in warm water mixed with Epsom salt for 15-20 minutes to relieve muscle soreness.\n");
                    sb.append("  - **Comfortable Footwear**: Avoid walking barefoot; wear shoes with good arch support and cushioning.\n");
                } else {
                    sb.append("  - **Rest**: Limit strenuous activity and avoid movements that exacerbate pain in this region.\n");
                    sb.append("  - **Ice/Heat Cycling**: Apply ice wrapped in a cloth for 15 minutes for new pain/swelling. Use warm heat therapy for stiff or chronic muscle pain.\n");
                    sb.append("  - **Hydration & Nutrition**: Drink plenty of fluids and maintain a balanced diet rich in vitamins to support tissue recovery.\n");
                }
                sb.append("\n");
            }
        }

        Boolean onMedication = (Boolean) request.getOrDefault("onMedication", false);
        if (onMedication != null && onMedication) {
            String details = String.valueOf(request.getOrDefault("prescriptionDetails", ""));
            sb.append("### 💊 Medication Context\n");
            sb.append("- You reported that you are currently taking medication.\n");
            if (!details.isEmpty()) {
                sb.append("- **Reported Details**: *\"").append(details).append("\"*\n");
            }
            sb.append("- **AI Guidance**: Continue taking your medication exactly as prescribed by your physician. Do not discontinue or adjust the dosage based on home care suggestions.\n\n");
        }

        sb.append("---\n");
        sb.append("### ⚠️ Prominent Medical Disclaimer\n");
        sb.append("**IMPORTANT**: The suggestions provided above are for general educational purposes and home self-care guidance only. I am an AI assistant, NOT a doctor, and this does not constitute medical diagnosis, clinical prescription, or formal treatment advice. If you are experiencing high pain levels (above 7/10), worsening symptoms, or any emergency warning signs, please consult a qualified healthcare professional immediately or go to the nearest emergency facility.");

        return sb.toString();
    }

    @PostMapping("/skin-assessment")
    public ResponseEntity<?> assessSkinSymptoms(@RequestBody Map<String, Object> request) {
        String symptoms = getStringField(request, "symptoms", "").trim();
        List<String> images = (List<String>) request.get("images");
        if (images == null) {
            images = new ArrayList<>();
        }

        String assessment = medGammaService.analyzeSkinSymptoms(symptoms, images);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "assessment", assessment
        ));
    }
}



