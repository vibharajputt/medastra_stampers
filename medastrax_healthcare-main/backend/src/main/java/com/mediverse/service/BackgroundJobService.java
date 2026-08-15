package com.mediverse.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediverse.model.BackgroundJob;
import com.mediverse.repository.BackgroundJobRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@EnableScheduling
public class BackgroundJobService {

    @Autowired
    private BackgroundJobRepository jobRepo;

    @Value("${app.huggingface.token:}")
    private String hfToken;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public BackgroundJob submitJob(Long userId, BackgroundJob.JobType jobType, String inputPayload) {
        BackgroundJob job = new BackgroundJob();
        job.setUserId(userId);
        job.setJobType(jobType);
        job.setInputPayload(inputPayload);
        job.setStatus(BackgroundJob.JobStatus.PENDING);
        job.setMaxAttempts(3);
        return jobRepo.save(job);
    }

    public Page<BackgroundJob> getUserJobs(Long userId, int page, int size) {
        return jobRepo.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
    }

    public BackgroundJob retryJob(Long jobId) {
        BackgroundJob job = jobRepo.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
        if (job.getStatus() != BackgroundJob.JobStatus.FAILED) {
            throw new IllegalArgumentException("Only FAILED jobs can be retried");
        }
        job.setStatus(BackgroundJob.JobStatus.PENDING);
        job.setErrorMessage(null);
        return jobRepo.save(job);
    }

    @Scheduled(fixedDelay = 6000)
    public void processPendingJobs() {
        List<BackgroundJob> pending = jobRepo.findByStatusOrderByCreatedAtAsc(BackgroundJob.JobStatus.PENDING);
        for (BackgroundJob job : pending) {
            try {
                job.setStatus(BackgroundJob.JobStatus.RUNNING);
                job.setAttemptCount(job.getAttemptCount() + 1);
                jobRepo.save(job);

                String result = executeJob(job);
                job.setStatus(BackgroundJob.JobStatus.COMPLETED);
                job.setResultPayload(result);
                job.setCompletedAt(LocalDateTime.now());
            } catch (Exception ex) {
                job.setErrorMessage(ex.getMessage());
                if (job.getAttemptCount() < job.getMaxAttempts()) {
                    job.setStatus(BackgroundJob.JobStatus.PENDING); // requeue for retry
                } else {
                    job.setStatus(BackgroundJob.JobStatus.FAILED);
                    job.setCompletedAt(LocalDateTime.now());
                }
            }
            jobRepo.save(job);
        }
    }

    private String executeJob(BackgroundJob job) throws Exception {
        Map<String, Object> input;
        try {
            input = objectMapper.readValue(job.getInputPayload(), new TypeReference<>() {});
        } catch (Exception e) {
            input = Map.of("message", job.getInputPayload());
        }

        String prompt = input.getOrDefault("message", "Analyze this health data").toString();
        String contextType = input.getOrDefault("type", job.getJobType().name()).toString();

        String systemContext = switch (job.getJobType()) {
            case AI_DIAGNOSIS -> "You are a medical AI assistant. Analyze the patient's symptoms and provide a detailed health assessment with possible diagnoses and next steps.";
            case PRESCRIPTION_ANALYSIS -> "You are a pharmacist AI. Analyze the given prescription and provide safety info, drug interactions, and instructions.";
            case REPORT_EXPORT -> "You are a medical report summarizer. Create a concise, formatted summary of the provided health data.";
            case LAB_SUMMARY -> "You are a lab results interpreter. Explain the lab results in simple terms and highlight any abnormal values.";
            case SYMPTOM_CHECK -> "You are a triage nurse AI. Assess the described symptoms and provide urgency level and recommended actions.";
        };

        return callHuggingFaceApi(systemContext, prompt);
    }

    private String callHuggingFaceApi(String systemPrompt, String userMessage) throws Exception {
        if (hfToken == null || hfToken.trim().isEmpty()) {
            return "AI analysis completed (offline mode): Based on the provided information, please consult a healthcare professional for personalized advice.";
        }

        String apiUrl = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions";
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "model", "mistralai/Mistral-7B-Instruct-v0.3",
                "messages", List.of(
                        Map.of("role", "system", "content", systemPrompt),
                        Map.of("role", "user", "content", userMessage)
                ),
                "max_tokens", 800,
                "temperature", 0.7
        ));

        HttpURLConnection conn = (HttpURLConnection) new URL(apiUrl).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Authorization", "Bearer " + hfToken.trim());
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(30000);
        conn.setReadTimeout(60000);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(requestBody.getBytes(StandardCharsets.UTF_8));
        }

        int code = conn.getResponseCode();
        InputStream stream = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
        }

        if (code != 200) throw new RuntimeException("HuggingFace API error: " + code);

        Map<?, ?> responseMap = objectMapper.readValue(sb.toString(), Map.class);
        List<?> choices = (List<?>) responseMap.get("choices");
        if (choices != null && !choices.isEmpty()) {
            Map<?, ?> choice = (Map<?, ?>) choices.get(0);
            Map<?, ?> message = (Map<?, ?>) choice.get("message");
            if (message != null) return message.get("content").toString().trim();
        }
        return "Analysis complete. No detailed response generated.";
    }
}
