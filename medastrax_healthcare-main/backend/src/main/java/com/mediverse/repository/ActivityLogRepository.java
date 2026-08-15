package com.mediverse.repository;

import com.mediverse.model.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    Page<ActivityLog> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<ActivityLog> findByUserIdAndEventTypeOrderByCreatedAtDesc(Long userId, ActivityLog.EventType eventType, Pageable pageable);
    List<ActivityLog> findTop5ByUserIdOrderByCreatedAtDesc(Long userId);
}
