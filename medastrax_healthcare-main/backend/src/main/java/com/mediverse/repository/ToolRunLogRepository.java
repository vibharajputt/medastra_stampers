package com.mediverse.repository;

import com.mediverse.model.ToolRunLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface ToolRunLogRepository extends JpaRepository<ToolRunLog, Long> {
    Page<ToolRunLog> findAllByOrderByRunTimestampDesc(Pageable pageable);
    Page<ToolRunLog> findByUserIdOrderByRunTimestampDesc(Long userId, Pageable pageable);
    Page<ToolRunLog> findByToolNameOrderByRunTimestampDesc(String toolName, Pageable pageable);

    @Query("SELECT COUNT(t) FROM ToolRunLog t WHERE t.isSuccess = false")
    long countFailures();

    @Query("SELECT COUNT(t) FROM ToolRunLog t WHERE t.isSuccess = true")
    long countSuccesses();

    @Query("SELECT AVG(t.latencyMs) FROM ToolRunLog t WHERE t.latencyMs IS NOT NULL")
    Double avgLatency();
}
