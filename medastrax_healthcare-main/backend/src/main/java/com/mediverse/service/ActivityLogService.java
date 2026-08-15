package com.mediverse.service;

import com.mediverse.model.ActivityLog;
import com.mediverse.repository.ActivityLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ActivityLogService {

    @Autowired
    private ActivityLogRepository repo;

    public void log(Long userId, ActivityLog.EventType eventType, String summary) {
        log(userId, eventType, summary, null, null);
    }

    public void log(Long userId, ActivityLog.EventType eventType, String summary, Long entityId, String entityType) {
        try {
            ActivityLog log = new ActivityLog(userId, eventType, summary, entityId, entityType);
            repo.save(log);
        } catch (Exception ex) {
            // non-blocking — we don't want logging to break main flow
            System.err.println("ActivityLog save failed: " + ex.getMessage());
        }
    }

    public void logWithMeta(Long userId, ActivityLog.EventType eventType, String summary, String metadata) {
        try {
            ActivityLog log = new ActivityLog(userId, eventType, summary, null, null);
            log.setMetadata(metadata);
            repo.save(log);
        } catch (Exception ex) {
            System.err.println("ActivityLog save failed: " + ex.getMessage());
        }
    }

    public Page<ActivityLog> getUserHistory(Long userId, int page, int size) {
        return repo.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, size));
    }

    public Page<ActivityLog> getUserHistoryByType(Long userId, ActivityLog.EventType type, int page, int size) {
        return repo.findByUserIdAndEventTypeOrderByCreatedAtDesc(userId, type, PageRequest.of(page, size));
    }

    public List<ActivityLog> getRecentFive(Long userId) {
        return repo.findTop5ByUserIdOrderByCreatedAtDesc(userId);
    }
}
