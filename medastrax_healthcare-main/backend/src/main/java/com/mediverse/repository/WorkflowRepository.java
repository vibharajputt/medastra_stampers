package com.mediverse.repository;

import com.mediverse.model.WorkflowInstance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkflowRepository extends JpaRepository<WorkflowInstance, Long> {
    Page<WorkflowInstance> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    List<WorkflowInstance> findByUserIdAndStatus(Long userId, WorkflowInstance.WorkflowStatus status);
    long countByUserIdAndStatus(Long userId, WorkflowInstance.WorkflowStatus status);
}
