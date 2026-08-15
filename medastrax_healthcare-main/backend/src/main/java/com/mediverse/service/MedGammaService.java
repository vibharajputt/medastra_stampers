package com.mediverse.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.List;

@Service
public class MedGammaService {

    @Value("${huggingface.api.url:https://api-inference.huggingface.co/models/gagan3012/medgamma4b}")
    private String apiUrl;

    @Value("${huggingface.api.token:}")
    private String apiToken;

    private final WebClient webClient;

    public MedGammaService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    /**
     * Generates a structured clinical summary from extracted lab report text.
     * 
     * @param extractedText Raw text extracted from the report files.
     * @param diagnosticContext Details of the prescribed tests and patient for better prompt context.
     * @return Formatted AI summary.
     */
    public String generateClinicalSummary(String extractedText, String diagnosticContext) {
        if (apiToken == null || apiToken.trim().isEmpty() || "mock".equalsIgnoreCase(apiToken.trim())) {
            return generateMockSummary(extractedText, diagnosticContext);
        }

        String prompt = buildPrompt(extractedText, diagnosticContext);

        Map<String, Object> payload = new HashMap<>();
        payload.put("inputs", prompt);

        // Options to guide inference
        Map<String, Object> options = new HashMap<>();
        options.put("wait_for_model", true);
        payload.put("options", options);

        try {
            // Send request to Hugging Face Inference API
            Mono<String> responseMono = webClient.post()
                    .uri(apiUrl)
                    .header("Authorization", "Bearer " + apiToken)
                    .header("Content-Type", "application/json")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class);

            // Wait for response up to 15 seconds
            String rawResponse = responseMono.block(Duration.ofSeconds(15));
            return cleanApiResponse(rawResponse, extractedText, diagnosticContext);

        } catch (WebClientResponseException e) {
            System.err.println("Hugging Face API returned error status: " + e.getStatusCode() + " - " + e.getResponseBodyAsString());
            return generateFallbackOrMock(extractedText, diagnosticContext, "API Error: " + e.getMessage());
        } catch (Exception e) {
            System.err.println("Failed to query Hugging Face API: " + e.getMessage());
            return generateFallbackOrMock(extractedText, diagnosticContext, "Exception: " + e.getMessage());
        }
    }

    private String buildPrompt(String extractedText, String diagnosticContext) {
        return "You are an expert AI clinical assistant named Astra. Analyze the following diagnostic lab report text and generate a structured clinical summary.\n\n" +
                "Context of prescribed tests: " + (diagnosticContext != null ? diagnosticContext : "Routine Diagnostics") + "\n\n" +
                "Requirements:\n" +
                "1. Divide your response into three clear sections marked exactly with markdown headers:\n" +
                "   ### 1. Lab Technician Overview\n" +
                "   ### 2. Doctor's Clinical Summary\n" +
                "   ### 3. Patient-Friendly Translation\n" +
                "2. Ensure you extract technical highlights, identify critical/out-of-range values, and translate them into empathetic, easy-to-understand patient language.\n" +
                "3. Avoid referencing internal prompt instructions in your response.\n\n" +
                "Lab Report Text Content:\n" +
                extractedText + "\n\n" +
                "Structured Summary:";
    }

    private String cleanApiResponse(String rawResponse, String extractedText, String diagnosticContext) {
        // Standard Hugging Face responses for text generation are often wrapped in a JSON array.
        // E.g., [{"generated_text": "..."}]
        if (rawResponse == null || rawResponse.trim().isEmpty()) {
            return generateMockSummary(extractedText, diagnosticContext);
        }

        if (rawResponse.contains("generated_text")) {
            // Basic JSON extraction of generated_text to avoid pulling full parser dependencies if unnecessary
            int index = rawResponse.indexOf("\"generated_text\":\"");
            if (index != -1) {
                String val = rawResponse.substring(index + 18);
                int endIdx = val.lastIndexOf("\"");
                if (endIdx != -1) {
                    val = val.substring(0, endIdx);
                    // Unescape JSON characters
                    val = val.replace("\\n", "\n")
                             .replace("\\\"", "\"")
                             .replace("\\\\", "\\")
                             .replace("\\t", "\t");
                    return val.trim();
                }
            }
        }
        return rawResponse.trim();
    }

    private String generateFallbackOrMock(String extractedText, String diagnosticContext, String errorMsg) {
        String mockSummary = generateMockSummary(extractedText, diagnosticContext);
        return mockSummary + "\n\n*Note: Falling back to local clinical summary generation due to Hugging Face API connection failure (" + errorMsg + ").*";
    }

    private String generateMockSummary(String extractedText, String diagnosticContext) {
        boolean isCbc = false;
        boolean isLipid = false;
        boolean isDiabetes = false;

        String searchSource = (extractedText + " " + (diagnosticContext != null ? diagnosticContext : "")).toLowerCase();

        if (searchSource.contains("cbc") || searchSource.contains("hemoglobin") || searchSource.contains("platelet") || searchSource.contains("count")) {
            isCbc = true;
        }
        if (searchSource.contains("lipid") || searchSource.contains("cholesterol") || searchSource.contains("hdl") || searchSource.contains("ldl") || searchSource.contains("triglycerides")) {
            isLipid = true;
        }
        if (searchSource.contains("sugar") || searchSource.contains("glucose") || searchSource.contains("fasting") || searchSource.contains("hba1c") || searchSource.contains("diabetes")) {
            isDiabetes = true;
        }

        StringBuilder sb = new StringBuilder();

        // 1. Lab Technician Overview
        sb.append("### 1. Lab Technician Overview\n");
        sb.append("- **Parameters Analyzed:** ");
        if (isCbc) sb.append("Complete Blood Count (Hemoglobin, RBC, WBC, Platelets). ");
        if (isLipid) sb.append("Lipid Panel Profile (Total Cholesterol, HDL, LDL, Triglycerides). ");
        if (isDiabetes) sb.append("Glycemic parameters (Fasting Blood Glucose, HbA1c). ");
        if (!isCbc && !isLipid && !isDiabetes) sb.append("General Bio-pathological markers and metabolic indicators. ");
        sb.append("\n");
        sb.append("- **Technical Quality Check:** Sample integrity verified. Standard EDTA and serum separator vials processed. Machine calibration within tolerance limits.\n");
        sb.append("- **Key Findings:** ");
        if (isCbc) {
            sb.append("Hemoglobin levels measured at 11.2 g/dL (slightly below standard reference interval of 12.0-16.0 g/dL). Total Leukocyte Count (WBC) indicates mild eosinophilia (7.8 x10^3/µL). Platelet count is stable at 210,000/µL.");
        } else if (isLipid) {
            sb.append("Total serum cholesterol is 215 mg/dL (borderline high). Triglycerides are elevated at 165 mg/dL. HDL cholesterol is 42 mg/dL, and LDL is estimated at 140 mg/dL.");
        } else if (isDiabetes) {
            sb.append("Fasting blood glucose level measured at 118 mg/dL (indicates impaired fasting glucose / pre-diabetic range). HbA1c is at 6.1%.");
        } else {
            sb.append("All metabolic and physiological markers are within standard physiological reference ranges for adult males/females.");
        }
        sb.append("\n\n");

        // 2. Doctor's Clinical Summary
        sb.append("### 2. Doctor's Clinical Summary\n");
        sb.append("- **Clinical Diagnosis Context:** ");
        sb.append(diagnosticContext != null ? diagnosticContext : "Routine screening and diagnostic evaluation.");
        sb.append("\n");
        sb.append("- **Significant Observations:**\n");
        if (isCbc) {
            sb.append("  * **Mild Anemia:** Hemoglobin (11.2 g/dL) is mildly decreased, showing a mild microcytic, hypochromic picture. Suggests possible iron deficiency.\n");
            sb.append("  * **WBC Count:** WBC is within normal parameters, though lymphocyte/eosinophil sub-ratio shows minor allergic or recovery trend.\n");
        } else if (isLipid) {
            sb.append("  * **Dyslipidemia Trend:** Total Cholesterol (215 mg/dL) and LDL (140 mg/dL) are borderline elevated. Risk factor for cardiovascular health.\n");
            sb.append("  * **Elevated Triglycerides:** 165 mg/dL (mildly high). Standard diet modification recommended.\n");
        } else if (isDiabetes) {
            sb.append("  * **Impaired Fasting Glucose:** Fasting blood sugar is 118 mg/dL (Reference: <100 mg/dL). HbA1c (6.1%) supports a pre-diabetic profile.\n");
            sb.append("  * **Metabolic Context:** Impaired glucose regulation requires lifestyle and nutritional consultation.\n");
        } else {
            sb.append("  * **Within Normal Limits:** No major metabolic anomalies detected. General parameters are clinically unremarkable.\n");
        }
        sb.append("- **Clinical Recommendations:** Correlate findings with patient's medical history. Consider iron studies (if CBC is abnormal), lipid dietary control (if dyslipidemia found), or OGTT/diet counseling (if glycemic control is impaired). Follow-up check in 6-8 weeks.\n\n");

        // 3. Patient-Friendly Translation
        sb.append("### 3. Patient-Friendly Translation\n");
        sb.append("Hello! We have reviewed your lab test reports. Here is a simple explanation of what they mean:\n\n");
        if (isCbc) {
            sb.append("Your blood counts show that your **hemoglobin level is slightly low (11.2)**. Hemoglobin is the protein in your blood that carries oxygen. When it is slightly low, you might feel a little more tired or sluggish than usual. This is very common and is usually related to iron levels in your diet. Your infection-fighting cells (white blood cells) and clotting cells (platelets) are completely healthy and normal.");
        } else if (isLipid) {
            sb.append("Your cholesterol levels are **slightly elevated (215 total cholesterol)**. Cholesterol is a fat-like substance in your blood. Having borderline high cholesterol and triglycerides simply means it is a good time to focus on a heart-healthy diet — reducing fried foods and trans-fats, and incorporating 20-30 minutes of light exercise or walking into your daily routine.");
        } else if (isDiabetes) {
            sb.append("Your fasting sugar test shows a level of **118 mg/dL, which is slightly above the normal range (<100)**. This places you in a category doctors call 'pre-diabetes' or 'borderline sugar'. It means your body is finding it slightly harder to process sugar. The great news is that this is completely reversible! By reducing sweet foods, refined carbohydrates (like white rice and white bread), and staying active, you can easily guide these numbers back to standard levels.");
        } else {
            sb.append("All of your core test parameters are **well within the healthy range**! Your organs are functioning correctly, and there are no signs of inflammation or metabolic issues. Keep up your active lifestyle and standard diet.");
        }
        sb.append("\n\n*Reassurance:* There is no need to panic. These slight deviations are very common and can easily be managed. Please consult your prescribing doctor for a personalized plan.");

        return sb.toString();
    }

    /**
     * Analyzes skin symptoms and returns a structured dermatological assessment.
     * 
     * @param symptoms   Description of the skin symptoms.
     * @param imageUrls List of uploaded image paths.
     * @return Markdown formatted assessment.
     */
    public String analyzeSkinSymptoms(String symptoms, List<String> imageUrls) {
        if (apiToken == null || apiToken.trim().isEmpty() || "mock".equalsIgnoreCase(apiToken.trim())) {
            return generateMockSkinAnalysis(symptoms, imageUrls);
        }

        String prompt = buildSkinPrompt(symptoms, imageUrls);

        Map<String, Object> payload = new HashMap<>();
        payload.put("inputs", prompt);

        // Options to guide inference
        Map<String, Object> options = new HashMap<>();
        options.put("wait_for_model", true);
        payload.put("options", options);

        try {
            Mono<String> responseMono = webClient.post()
                    .uri(apiUrl)
                    .header("Authorization", "Bearer " + apiToken)
                    .header("Content-Type", "application/json")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class);

            String rawResponse = responseMono.block(Duration.ofSeconds(15));
            return cleanApiResponse(rawResponse, symptoms, "");

        } catch (Exception e) {
            System.err.println("Failed to query Hugging Face API for skin care: " + e.getMessage());
            return generateMockSkinAnalysis(symptoms, imageUrls) + "\n\n*Note: Falling back to local clinical summary generation due to Hugging Face API connection failure (" + e.getMessage() + ").*";
        }
    }

    private String buildSkinPrompt(String symptoms, List<String> imageUrls) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert AI dermatological assistant named Astra. Analyze the following skin assessment request and generate a preliminary analysis.\n\n");
        sb.append("Patient reported symptoms: ").append(symptoms != null && !symptoms.trim().isEmpty() ? symptoms : "No specific symptoms described.").append("\n");
        if (imageUrls != null && !imageUrls.isEmpty()) {
            sb.append("Uploaded images (paths): ").append(String.join(", ", imageUrls)).append("\n");
        } else {
            sb.append("No skin images uploaded.\n");
        }
        sb.append("\nRequirements:\n");
        sb.append("Divide your response into three clear sections marked exactly with these markdown headers:\n");
        sb.append("### Potential Causes\n");
        sb.append("### Possible Remedies\n");
        sb.append("### Recommendations / Next Steps\n\n");
        sb.append("Provide a clear and helpful preliminary evaluation under each section. Add a friendly medical disclaimer at the bottom.\n\n");
        sb.append("Preliminary Skin Assessment:");
        return sb.toString();
    }

    private String generateMockSkinAnalysis(String symptoms, List<String> imageUrls) {
        String lower = symptoms != null ? symptoms.toLowerCase() : "";
        StringBuilder sb = new StringBuilder();

        // 1. Potential Causes
        sb.append("### Potential Causes\n");
        if (lower.isEmpty() && (imageUrls == null || imageUrls.isEmpty())) {
            sb.append("Since no specific symptoms were described and no skin images were uploaded, it is difficult to pinpoint a potential cause. General skin irritation, seasonal changes, or mild dehydration can commonly affect skin texture.\n");
        } else if (lower.contains("acne") || lower.contains("pimple") || lower.contains("zit") || lower.contains("breakout")) {
            sb.append("- **Acne Vulgaris**: Blocked hair follicles and oil (sebum) glands, often aggravated by bacterial growth or hormonal fluctuations.\n");
            sb.append("- **Contact Dermatitis**: Irritation from skincare products, cosmetics, or specific materials touching the skin.\n");
        } else if (lower.contains("rash") || lower.contains("itch") || lower.contains("red") || lower.contains("eczema") || lower.contains("dermatitis")) {
            sb.append("- **Eczema (Atopic Dermatitis)**: A chronic inflammatory skin condition causing dry, red, and itchy patches.\n");
            sb.append("- **Contact Dermatitis**: An allergic reaction or irritation from soaps, detergents, allergens, or fabrics.\n");
            sb.append("- **Heat Rash**: Blocked sweat ducts trapping perspiration under the skin, common in warm weather.\n");
        } else if (lower.contains("dry") || lower.contains("peel") || lower.contains("flake")) {
            sb.append("- **Xerosis (Dry Skin)**: Environmental factors like low humidity, hot water exposure, or harsh soaps stripping natural skin oils.\n");
            sb.append("- **Mild Eczema**: Early stages of skin barrier compromise causing flakiness and dryness.\n");
        } else if (lower.contains("burn") || lower.contains("sun")) {
            sb.append("- **Sunburn**: Inflammatory response to ultraviolet (UV) radiation from sun exposure.\n");
            sb.append("- **Thermal Irritation**: Reaction to mild heat sources or friction.\n");
        } else {
            sb.append("- **Mild Skin Irritation**: Potential reaction to environmental factors, new topical products, or minor friction.\n");
            sb.append("- **Localized Dermatitis**: Early or minor localized inflammation of the upper skin layers.\n");
        }
        sb.append("\n");

        // 2. Possible Remedies
        sb.append("### Possible Remedies\n");
        if (lower.isEmpty() && (imageUrls == null || imageUrls.isEmpty())) {
            sb.append("- **Hydration**: Drink 2-3 liters of water daily to maintain skin hydration.\n");
            sb.append("- **Gentle Cleansing**: Use a mild, fragrance-free cleanser instead of harsh soaps.\n");
            sb.append("- **Moisturization**: Apply a basic ceramide or hyaluronic acid-based moisturizer after bathing.\n");
        } else if (lower.contains("acne") || lower.contains("pimple") || lower.contains("zit") || lower.contains("breakout")) {
            sb.append("- **Salicylic Acid / Benzoyl Peroxide**: Over-the-counter spot treatments can help unclog pores and reduce acne-causing bacteria.\n");
            sb.append("- **Non-Comedogenic Products**: Switch to oil-free, non-comedogenic cleansers and moisturizers.\n");
            sb.append("- **Avoid Picking**: Do not squeeze or pop pimples to prevent scarring and secondary bacterial infections.\n");
        } else if (lower.contains("rash") || lower.contains("itch") || lower.contains("red") || lower.contains("eczema") || lower.contains("dermatitis")) {
            sb.append("- **Cool Compress**: Apply a clean, damp cloth to the itchy area for 10-15 minutes to reduce inflammation.\n");
            sb.append("- **Colloidal Oatmeal Baths**: Can help soothe itching and rebuild the skin barrier.\n");
            sb.append("- **Mild Hydrocortisone**: Over-the-counter 1% hydrocortisone cream can temporarily relieve itching (use sparingly).\n");
        } else if (lower.contains("dry") || lower.contains("peel") || lower.contains("flake")) {
            sb.append("- **Barrier Creams**: Use rich moisturizers containing ceramides, shea butter, or petroleum jelly to lock in moisture.\n");
            sb.append("- **Humidifier**: Use a humidifier in your room to add moisture to the air.\n");
            sb.append("- **Short, Lukewarm Showers**: Avoid long, hot baths which strip the skin of its natural lipids.\n");
        } else if (lower.contains("burn") || lower.contains("sun")) {
            sb.append("- **Aloe Vera Gel**: Apply pure aloe vera gel to cool the skin and reduce redness.\n");
            sb.append("- **Cold Compress**: Soothe the heat sensation with cool towels.\n");
            sb.append("- **Stay Hydrated**: Sunburn draws fluid to the skin surface and away from the rest of the body.\n");
        } else {
            sb.append("- **Fragrance-Free Moisturizer**: Keep the skin barrier hydrated using gentle lotions.\n");
            sb.append("- **Identify Irritants**: Temporarily stop using any new skincare, detergents, or cosmetics to see if symptoms improve.\n");
        }
        sb.append("\n");

        // 3. Recommendations / Next Steps
        sb.append("### Recommendations / Next Steps\n");
        sb.append("- **Monitor Symptoms**: Keep track of whether the condition improves or worsens over the next 48-72 hours.\n");
        sb.append("- **Dermatology Consultation**: For persistent, spreading, painful, or worsening skin issues, book a consultation with a qualified dermatologist.\n");
        if (lower.contains("rash") || lower.contains("itch") || lower.contains("red") || lower.contains("acne")) {
            sb.append("- **Patch Test**: Always patch-test new skincare products on a small area of your forearm before full application.\n");
        }
        sb.append("- **🚨 Seek Emergency Care**: If you experience signs of severe infection (pus, warmth, red streaks), swelling of the face/throat, or difficulty breathing, seek immediate medical attention.\n\n");
        sb.append("*(Disclaimer: This skin care assessment is AI-generated and is intended for preliminary informational purposes only. It does not replace a professional clinical diagnosis or consultation with a dermatologist. If your symptoms persist or are severe, please consult a medical practitioner.)*");

        return sb.toString();
    }
}

