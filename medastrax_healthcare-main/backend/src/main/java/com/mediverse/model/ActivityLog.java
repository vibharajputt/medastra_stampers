package com.mediverse.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "activity_logs")
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventType eventType;

    @Column(length = 500)
    private String summary;

    private Long entityId;
    private String entityType;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum EventType {
        AI_QUERY,
        BOOKING_CREATED,
        BOOKING_CANCELLED,
        PRESCRIPTION_UPLOADED,
        PRESCRIPTION_VIEWED,
        LAB_BOOKED,
        MEDICINE_ORDERED,
        SOS_TRIGGERED,
        LOGIN,
        PROFILE_UPDATED,
        PAYMENT_MADE,
        REPORT_GENERATED,
        WORKFLOW_STARTED,
        WORKFLOW_APPROVED,
        WORKFLOW_REJECTED
    }

    public ActivityLog() {}

    public ActivityLog(Long userId, EventType eventType, String summary, Long entityId, String entityType) {
        this.userId = userId;
        this.eventType = eventType;
        this.summary = summary;
        this.entityId = entityId;
        this.entityType = entityType;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public EventType getEventType() { return eventType; }
    public void setEventType(EventType eventType) { this.eventType = eventType; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
