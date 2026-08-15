package com.mediverse.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediverse.model.PatientProfile;
import com.mediverse.model.Prescription;
import com.mediverse.model.RiskAssessment;
import com.mediverse.repository.PatientProfileRepository;
import com.mediverse.repository.PrescriptionRepository;
import com.mediverse.repository.RiskAssessmentRepository;
import com.mediverse.service.TwilioSmsService;
import com.mediverse.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Core Risk Engine Service
 * Implements:
 *  - Numeric risk scoring (0-100) with named contributing factors
 *  - Anomaly detection against standard medical reference ranges
 *  - Missing-data-aware confidence calculation (Hard Mode requirement)
 *  - Explainability factor breakdown
 *  - Proactive emergency alert threshold trigger
 */
@Service
public class RiskAssessmentService {

    @Autowired
    private RiskAssessmentRepository riskAssessmentRepository;

    @Autowired
    private PatientProfileRepository patientProfileRepository;

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    @Autowired
    private TwilioSmsService twilioSmsService;

    @Autowired
    private AuthService authService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ──────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Perform a full risk assessment for a patient.
     * Accepts optional vitals from the request; falls back to profile data
     * for any missing parameter (Hard Mode: missing data handling).
     */
    public Map<String, Object> assessRisk(Long patientId, Map<String, Object> vitals) {

        PatientProfile profile = patientProfileRepository.findByUserId(patientId).orElse(null);
        List<Prescription> prescriptions = prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(patientId);

        // ── 1. Collect parameters (merge supplied vitals + profile data) ──────
        RiskInputs inputs = collectInputs(vitals, profile, prescriptions);

        // ── 2. Confidence score based on data completeness ────────────────────
        int[] confidenceResult = calculateConfidence(inputs);
        int confidence = confidenceResult[0];
        int missingPct = confidenceResult[1];

        // ── 3. Risk scoring ───────────────────────────────────────────────────
        List<Map<String, Object>> factors = new ArrayList<>();
        int rawScore = computeRiskScore(inputs, factors);

        // Dampen score by confidence (if only 30% data present, cap contribution)
        int finalScore = dampScoreByConfidence(rawScore, confidence);

        // ── 4. Anomaly detection ──────────────────────────────────────────────
        List<Map<String, Object>> anomalies = detectAnomalies(inputs);

        // Boost score for each anomaly detected
        finalScore = Math.min(100, finalScore + (anomalies.size() * 5));

        // ── 5. Risk level label ───────────────────────────────────────────────
        String riskLevel = classifyRiskLevel(finalScore);

        // ── 6. Persist assessment for time-series ─────────────────────────────
        boolean alertTriggered = finalScore >= 75;
        RiskAssessment assessment = new RiskAssessment();
        assessment.setPatientId(patientId);
        assessment.setRiskScore(finalScore);
        assessment.setRiskLevel(riskLevel);
        assessment.setConfidence(confidence);
        assessment.setMissingDataPercentage(missingPct);
        assessment.setAlertTriggered(alertTriggered);

        try {
            assessment.setFactors(objectMapper.writeValueAsString(factors));
            assessment.setAnomalies(objectMapper.writeValueAsString(anomalies));
        } catch (Exception e) {
            assessment.setFactors("[]");
            assessment.setAnomalies("[]");
        }
        riskAssessmentRepository.save(assessment);

        // ── 7. Proactive emergency alert ──────────────────────────────────────
        if (alertTriggered && profile != null) {
            triggerProactiveAlert(patientId, profile, riskLevel, finalScore);
        }

        // ── 8. Build response ─────────────────────────────────────────────────
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("riskScore", finalScore);
        result.put("riskLevel", riskLevel);
        result.put("confidence", confidence);
        result.put("missingDataPercentage", missingPct);
        result.put("factors", factors);
        result.put("anomalies", anomalies);
        result.put("alertTriggered", alertTriggered);
        result.put("assessmentId", assessment.getId());
        result.put("timestamp", assessment.getCreatedAt());

        // Explanation summary for Hard Mode — communicating what was missing
        result.put("dataQualityNote", buildDataQualityNote(missingPct, inputs));
        return result;
    }

    /**
     * Get time-series history of risk scores for the patient (last 30 assessments).
     */
    public List<Map<String, Object>> getRiskHistory(Long patientId) {
        List<RiskAssessment> history = riskAssessmentRepository
                .findTop30ByPatientIdOrderByCreatedAtDesc(patientId);

        // Reverse so oldest is first (for chart rendering)
        Collections.reverse(history);

        return history.stream().map(a -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", a.getId());
            item.put("riskScore", a.getRiskScore());
            item.put("riskLevel", a.getRiskLevel());
            item.put("confidence", a.getConfidence());
            item.put("alertTriggered", a.getAlertTriggered());
            item.put("timestamp", a.getCreatedAt());
            return item;
        }).collect(Collectors.toList());
    }

    /**
     * Get the latest risk assessment summary for the patient (for dashboard widget).
     */
    public Optional<Map<String, Object>> getLatestRiskSummary(Long patientId) {
        return riskAssessmentRepository.findTopByPatientIdOrderByCreatedAtDesc(patientId)
                .map(a -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("riskScore", a.getRiskScore());
                    item.put("riskLevel", a.getRiskLevel());
                    item.put("confidence", a.getConfidence());
                    item.put("alertTriggered", a.getAlertTriggered());
                    item.put("timestamp", a.getCreatedAt());

                    // Parse factors for mini widget
                    try {
                        List<?> factors = objectMapper.readValue(a.getFactors(), List.class);
                        item.put("topFactors", factors.stream().limit(3).collect(Collectors.toList()));
                    } catch (Exception e) {
                        item.put("topFactors", new ArrayList<>());
                    }
                    return item;
                });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Data Collection
    // ──────────────────────────────────────────────────────────────────────────

    private RiskInputs collectInputs(Map<String, Object> vitals, PatientProfile profile, List<Prescription> prescriptions) {
        RiskInputs inp = new RiskInputs();

        // Vitals from the request body (user-entered or from wearable)
        if (vitals != null) {
            inp.heartRate = getInt(vitals, "heartRate");
            inp.systolicBP = getInt(vitals, "systolicBP");
            inp.diastolicBP = getInt(vitals, "diastolicBP");
            inp.bloodSugar = getInt(vitals, "bloodSugar");
            inp.spo2 = getInt(vitals, "spo2");
            inp.temperature = getDouble(vitals, "temperature");
            inp.weight = getDouble(vitals, "weight");
            inp.height = getDouble(vitals, "height");
            inp.respiratoryRate = getInt(vitals, "respiratoryRate");
        }

        // Profile-derived inputs
        if (profile != null) {
            inp.age = profile.getAge();
            inp.gender = profile.getGender();

            String conditions = profile.getExistingMedicalCondition();
            if (conditions != null) {
                String c = conditions.toLowerCase();
                inp.hasDiabetes = c.contains("diabetes") || c.contains("diabetic");
                inp.hasHypertension = c.contains("hypertension") || c.contains("high bp") || c.contains("hbp");
                inp.hasHeartDisease = c.contains("heart") || c.contains("cardiac") || c.contains("coronary");
                inp.hasAsthma = c.contains("asthma") || c.contains("copd");
                inp.hasKidneyDisease = c.contains("kidney") || c.contains("renal");
                inp.existingConditionsText = conditions;
            }

            String allergies = profile.getAllergies();
            inp.hasAllergies = allergies != null && !allergies.trim().isEmpty() && !allergies.equalsIgnoreCase("none");
        }

        // Prescription-derived inputs
        inp.prescriptionCount = prescriptions.size();
        if (!prescriptions.isEmpty()) {
            String allDiagnosis = prescriptions.stream()
                    .filter(p -> p.getDiagnosis() != null)
                    .map(p -> p.getDiagnosis().toLowerCase())
                    .collect(Collectors.joining(" "));
            inp.hasCriticalDiagnosis = allDiagnosis.contains("chest pain") || allDiagnosis.contains("cardiac")
                    || allDiagnosis.contains("stroke") || allDiagnosis.contains("critical")
                    || allDiagnosis.contains("pulmonary");
            inp.recentDiagnoses = allDiagnosis;
        }

        return inp;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Confidence & Missing Data Calculation (Hard Mode)
    // ──────────────────────────────────────────────────────────────────────────

    private int[] calculateConfidence(RiskInputs inp) {
        // 9 measurable parameters. Each present = 1 point.
        int totalParams = 9;
        int presentParams = 0;

        if (inp.heartRate != null) presentParams++;
        if (inp.systolicBP != null) presentParams++;
        if (inp.diastolicBP != null) presentParams++;
        if (inp.bloodSugar != null) presentParams++;
        if (inp.spo2 != null) presentParams++;
        if (inp.temperature != null) presentParams++;
        if (inp.age != null) presentParams++;
        if (inp.weight != null) presentParams++;
        if (inp.height != null) presentParams++;

        // Profile conditions count as bonus context (doesn't affect missing%)
        int missingParams = totalParams - presentParams;
        int missingPct = (int) ((missingParams / (double) totalParams) * 100);

        // Base confidence from vitals completeness
        int confidence = (int) ((presentParams / (double) totalParams) * 75);

        // Boost confidence if we have medical history context
        if (inp.existingConditionsText != null && !inp.existingConditionsText.isEmpty()) confidence += 10;
        if (inp.prescriptionCount > 0) confidence += 10;
        if (inp.recentDiagnoses != null && !inp.recentDiagnoses.isEmpty()) confidence += 5;

        confidence = Math.min(100, confidence);
        return new int[]{confidence, missingPct};
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Risk Scoring Algorithm
    // ──────────────────────────────────────────────────────────────────────────

    private int computeRiskScore(RiskInputs inp, List<Map<String, Object>> factors) {
        int score = 0;

        // ── Age risk factor ───────────────────────────────────────────────────
        if (inp.age != null) {
            if (inp.age >= 75) { score += 20; addFactor(factors, "Age (75+)", 20, "up", "Advanced age significantly increases risk"); }
            else if (inp.age >= 65) { score += 14; addFactor(factors, "Age (65-74)", 14, "up", "Older age increases risk"); }
            else if (inp.age >= 50) { score += 8; addFactor(factors, "Age (50-64)", 8, "up", "Middle-age risk factor"); }
            else if (inp.age >= 40) { score += 4; addFactor(factors, "Age (40-49)", 4, "neutral", "Moderate age risk"); }
        }

        // ── Blood pressure risk ───────────────────────────────────────────────
        if (inp.systolicBP != null) {
            if (inp.systolicBP >= 180) { score += 25; addFactor(factors, "Hypertensive Crisis (SBP ≥180)", 25, "up", "Critical blood pressure level"); }
            else if (inp.systolicBP >= 160) { score += 18; addFactor(factors, "Stage 2 Hypertension (SBP 160-179)", 18, "up", "Severe high blood pressure"); }
            else if (inp.systolicBP >= 140) { score += 12; addFactor(factors, "Stage 1 Hypertension (SBP 140-159)", 12, "up", "High blood pressure"); }
            else if (inp.systolicBP >= 130) { score += 6; addFactor(factors, "Elevated BP (SBP 130-139)", 6, "up", "Elevated blood pressure"); }
            else if (inp.systolicBP < 90) { score += 10; addFactor(factors, "Hypotension (SBP <90)", 10, "up", "Dangerously low blood pressure"); }
        }

        // ── Heart rate risk ───────────────────────────────────────────────────
        if (inp.heartRate != null) {
            if (inp.heartRate > 130) { score += 18; addFactor(factors, "Severe Tachycardia (HR>130)", 18, "up", "Critically elevated heart rate"); }
            else if (inp.heartRate > 110) { score += 12; addFactor(factors, "Tachycardia (HR 110-130)", 12, "up", "Elevated heart rate"); }
            else if (inp.heartRate > 100) { score += 6; addFactor(factors, "Elevated Heart Rate (HR 100-110)", 6, "up", "Mildly elevated heart rate"); }
            else if (inp.heartRate < 40) { score += 18; addFactor(factors, "Severe Bradycardia (HR<40)", 18, "up", "Critically low heart rate"); }
            else if (inp.heartRate < 60) { score += 5; addFactor(factors, "Bradycardia (HR<60)", 5, "up", "Low heart rate"); }
        }

        // ── Blood sugar risk ──────────────────────────────────────────────────
        if (inp.bloodSugar != null) {
            if (inp.bloodSugar >= 300) { score += 22; addFactor(factors, "Severe Hyperglycemia (BG≥300)", 22, "up", "Critically high blood sugar"); }
            else if (inp.bloodSugar >= 200) { score += 15; addFactor(factors, "Hyperglycemia (BG 200-299)", 15, "up", "High blood sugar"); }
            else if (inp.bloodSugar >= 140) { score += 8; addFactor(factors, "Pre-diabetic range (BG 140-199)", 8, "up", "Elevated blood sugar"); }
            else if (inp.bloodSugar < 50) { score += 20; addFactor(factors, "Severe Hypoglycemia (BG<50)", 20, "up", "Critically low blood sugar — emergency risk"); }
            else if (inp.bloodSugar < 70) { score += 10; addFactor(factors, "Hypoglycemia (BG 50-70)", 10, "up", "Low blood sugar"); }
        }

        // ── SpO2 risk ─────────────────────────────────────────────────────────
        if (inp.spo2 != null) {
            if (inp.spo2 < 85) { score += 25; addFactor(factors, "Critical Hypoxia (SpO2<85%)", 25, "up", "Emergency oxygen deficiency"); }
            else if (inp.spo2 < 90) { score += 18; addFactor(factors, "Severe Hypoxia (SpO2 85-89%)", 18, "up", "Dangerously low oxygen"); }
            else if (inp.spo2 < 94) { score += 10; addFactor(factors, "Mild Hypoxia (SpO2 90-93%)", 10, "up", "Below normal oxygen saturation"); }
            else if (inp.spo2 < 96) { score += 4; addFactor(factors, "Low-normal SpO2 (94-95%)", 4, "up", "Slightly low oxygen"); }
        }

        // ── Temperature risk ──────────────────────────────────────────────────
        if (inp.temperature != null) {
            if (inp.temperature >= 40.0) { score += 18; addFactor(factors, "Hyperpyrexia (≥40°C)", 18, "up", "Dangerously high fever"); }
            else if (inp.temperature >= 39.0) { score += 10; addFactor(factors, "High Fever (39-39.9°C)", 10, "up", "High fever detected"); }
            else if (inp.temperature >= 38.0) { score += 5; addFactor(factors, "Moderate Fever (38-38.9°C)", 5, "up", "Moderate fever"); }
            else if (inp.temperature < 35.5) { score += 15; addFactor(factors, "Hypothermia (<35.5°C)", 15, "up", "Low body temperature"); }
        }

        // ── Chronic conditions ────────────────────────────────────────────────
        if (inp.hasDiabetes) { score += 10; addFactor(factors, "Diabetes Mellitus", 10, "up", "Pre-existing diabetic condition"); }
        if (inp.hasHypertension) { score += 10; addFactor(factors, "Chronic Hypertension", 10, "up", "Pre-existing high blood pressure condition"); }
        if (inp.hasHeartDisease) { score += 15; addFactor(factors, "Cardiac Disease History", 15, "up", "Pre-existing heart condition"); }
        if (inp.hasAsthma) { score += 8; addFactor(factors, "Respiratory Disease (Asthma/COPD)", 8, "up", "Pre-existing respiratory condition"); }
        if (inp.hasKidneyDisease) { score += 10; addFactor(factors, "Chronic Kidney Disease", 10, "up", "Pre-existing kidney condition"); }
        if (inp.hasCriticalDiagnosis) { score += 20; addFactor(factors, "Critical Prior Diagnosis", 20, "up", "History of critical medical event"); }

        // ── Prescription burden ───────────────────────────────────────────────
        if (inp.prescriptionCount >= 5) { score += 8; addFactor(factors, "Polypharmacy (≥5 medications)", 8, "up", "Multiple active medications"); }
        else if (inp.prescriptionCount >= 3) { score += 4; addFactor(factors, "Multiple medications (3-4)", 4, "neutral", "Several active medications"); }

        // ── Positive factors (reduce score) ───────────────────────────────────
        if (inp.age != null && inp.age < 35 && !inp.hasDiabetes && !inp.hasHeartDisease) {
            score = Math.max(0, score - 5);
            addFactor(factors, "Young & No chronic conditions", -5, "down", "Lower baseline risk for age");
        }

        return Math.min(100, Math.max(0, score));
    }

    private void addFactor(List<Map<String, Object>> factors, String name, int points, String direction, String explanation) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("factor", name);
        f.put("points", points);
        f.put("direction", direction); // "up" = increases risk, "down" = decreases risk, "neutral" = minor
        f.put("explanation", explanation);
        factors.add(f);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Anomaly Detection
    // ──────────────────────────────────────────────────────────────────────────

    private List<Map<String, Object>> detectAnomalies(RiskInputs inp) {
        List<Map<String, Object>> anomalies = new ArrayList<>();

        checkAnomaly(anomalies, "Heart Rate", inp.heartRate, 60, 100, "bpm");
        checkAnomaly(anomalies, "Systolic BP", inp.systolicBP, 90, 120, "mmHg");
        checkAnomaly(anomalies, "Diastolic BP", inp.diastolicBP, 60, 80, "mmHg");
        checkAnomaly(anomalies, "Blood Sugar (Fasting)", inp.bloodSugar, 70, 100, "mg/dL");
        checkAnomaly(anomalies, "SpO2", inp.spo2, 96, 100, "%");
        checkAnomaly(anomalies, "Respiratory Rate", inp.respiratoryRate, 12, 20, "breaths/min");

        if (inp.temperature != null) {
            if (inp.temperature < 36.1 || inp.temperature > 37.5) {
                anomaly(anomalies, "Body Temperature", inp.temperature + "°C", "36.1-37.5°C",
                        inp.temperature > 37.5 ? "HIGH" : "LOW",
                        inp.temperature >= 39.0 ? "CRITICAL" : "WARNING");
            }
        }

        // BMI anomaly if weight and height available
        if (inp.weight != null && inp.height != null && inp.height > 0) {
            double bmi = inp.weight / (inp.height * inp.height);
            if (bmi < 18.5) {
                anomaly(anomalies, "BMI", String.format("%.1f", bmi), "18.5-24.9", "LOW", "WARNING");
            } else if (bmi >= 30) {
                anomaly(anomalies, "BMI (Obese)", String.format("%.1f", bmi), "18.5-24.9", "HIGH",
                        bmi >= 35 ? "CRITICAL" : "WARNING");
            }
        }

        return anomalies;
    }

    private void checkAnomaly(List<Map<String, Object>> anomalies, String name, Integer value,
                               int normalMin, int normalMax, String unit) {
        if (value == null) return;
        if (value < normalMin) {
            String severity = (value < normalMin * 0.8) ? "CRITICAL" : "WARNING";
            anomaly(anomalies, name, value + " " + unit, normalMin + "-" + normalMax + " " + unit, "LOW", severity);
        } else if (value > normalMax) {
            String severity = (value > normalMax * 1.3) ? "CRITICAL" : "WARNING";
            anomaly(anomalies, name, value + " " + unit, normalMin + "-" + normalMax + " " + unit, "HIGH", severity);
        }
    }

    private void anomaly(List<Map<String, Object>> anomalies, String parameter, String value,
                         String normalRange, String direction, String severity) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("parameter", parameter);
        a.put("value", value);
        a.put("normalRange", normalRange);
        a.put("direction", direction);
        a.put("severity", severity); // WARNING or CRITICAL
        anomalies.add(a);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Dampen score based on data confidence (Hard Mode)
    // ──────────────────────────────────────────────────────────────────────────

    private int dampScoreByConfidence(int rawScore, int confidence) {
        if (confidence >= 80) return rawScore;         // High confidence — use as-is
        if (confidence >= 60) return (int)(rawScore * 0.9);  // Minor dampening
        if (confidence >= 40) return (int)(rawScore * 0.80); // Moderate dampening
        return (int)(rawScore * 0.70);                 // Low data — significant dampening
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Risk Level Classification
    // ──────────────────────────────────────────────────────────────────────────

    private String classifyRiskLevel(int score) {
        if (score >= 80) return "CRITICAL";
        if (score >= 60) return "HIGH";
        if (score >= 40) return "MODERATE";
        if (score >= 20) return "LOW";
        return "SAFE";
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Proactive Emergency Alert
    // ──────────────────────────────────────────────────────────────────────────

    private void triggerProactiveAlert(Long patientId, PatientProfile profile, String riskLevel, int riskScore) {
        try {
            String emergencyContact = profile.getEmergencyNumber();
            if (emergencyContact == null || emergencyContact.trim().isEmpty()) return;

            com.mediverse.model.User user = profile.getUser();
            String patientName = (user != null && user.getName() != null) ? user.getName() : "Patient";

            String message = String.format(
                "⚠️ MedAstraX AUTO RISK ALERT\n" +
                "Patient: %s\n" +
                "Risk Level: %s (Score: %d/100)\n" +
                "An AI risk assessment detected elevated health risk.\n" +
                "Please check on the patient immediately.",
                patientName, riskLevel, riskScore
            );

            twilioSmsService.sendSms(emergencyContact, message);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to send proactive risk alert: " + e.getMessage());
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Data Quality Note (Hard Mode — explain what was missing)
    // ──────────────────────────────────────────────────────────────────────────

    private String buildDataQualityNote(int missingPct, RiskInputs inp) {
        List<String> missing = new ArrayList<>();
        if (inp.heartRate == null) missing.add("Heart Rate");
        if (inp.systolicBP == null) missing.add("Blood Pressure");
        if (inp.bloodSugar == null) missing.add("Blood Sugar");
        if (inp.spo2 == null) missing.add("Oxygen Saturation (SpO2)");
        if (inp.temperature == null) missing.add("Body Temperature");

        if (missing.isEmpty()) {
            return "All key vitals provided. Assessment confidence is high.";
        }
        return String.format(
            "%d%% of health parameters are missing (%s). " +
            "Risk score has been adjusted for incomplete data. " +
            "Provide missing vitals for a more accurate assessment.",
            missingPct, String.join(", ", missing)
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PRIVATE: Utility helpers
    // ──────────────────────────────────────────────────────────────────────────

    private Integer getInt(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        try { return Integer.parseInt(val.toString()); } catch (Exception e) { return null; }
    }

    private Double getDouble(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return null; }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // INNER CLASS: Risk Input Parameters
    // ──────────────────────────────────────────────────────────────────────────

    private static class RiskInputs {
        // Vitals (may be null if not provided)
        Integer heartRate;
        Integer systolicBP;
        Integer diastolicBP;
        Integer bloodSugar;
        Integer spo2;
        Double temperature;
        Double weight;
        Double height;
        Integer respiratoryRate;

        // Profile-derived
        Integer age;
        String gender;
        boolean hasDiabetes;
        boolean hasHypertension;
        boolean hasHeartDisease;
        boolean hasAsthma;
        boolean hasKidneyDisease;
        boolean hasAllergies;
        String existingConditionsText;

        // Prescription-derived
        int prescriptionCount;
        boolean hasCriticalDiagnosis;
        String recentDiagnoses;
    }
}
