package com.mediverse.service;

import com.mediverse.model.ToolRunLog;
import com.mediverse.repository.ToolRunLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class ToolRunLogService {

    @Autowired
    private ToolRunLogRepository repo;

    public ToolRunLog logRun(Long userId, String toolName, String input,
                              String output, Long latencyMs, boolean success,
                              String error, String decision) {
        try {
            ToolRunLog log = new ToolRunLog(userId, toolName,
                    truncate(input, 1000), truncate(output, 2000),
                    latencyMs, success, error, decision);
            return repo.save(log);
        } catch (Exception ex) {
            System.err.println("ToolRunLog save failed: " + ex.getMessage());
            return null;
        }
    }

    public Page<ToolRunLog> getAllRuns(int page, int size) {
        return repo.findAllByOrderByRunTimestampDesc(PageRequest.of(page, size));
    }

    public Page<ToolRunLog> getUserRuns(Long userId, int page, int size) {
        return repo.findByUserIdOrderByRunTimestampDesc(userId, PageRequest.of(page, size));
    }

    public Map<String, Object> getStats() {
        long total = repo.count();
        long failures = repo.countFailures();
        long successes = repo.countSuccesses();
        Double avgLatency = repo.avgLatency();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRuns", total);
        stats.put("failures", failures);
        stats.put("successes", successes);
        stats.put("errorRate", total == 0 ? 0.0 : Math.round((double) failures / total * 1000.0) / 10.0);
        stats.put("avgLatencyMs", avgLatency != null ? Math.round(avgLatency) : 0);
        return stats;
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() > maxLen ? s.substring(0, maxLen) + "..." : s;
    }
}
