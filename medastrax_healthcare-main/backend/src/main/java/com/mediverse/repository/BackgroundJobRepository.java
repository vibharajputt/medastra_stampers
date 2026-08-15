package com.mediverse.repository;

import com.mediverse.model.BackgroundJob;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BackgroundJobRepository extends JpaRepository<BackgroundJob, Long> {
    Page<BackgroundJob> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    List<BackgroundJob> findByStatusOrderByCreatedAtAsc(BackgroundJob.JobStatus status);
    List<BackgroundJob> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, BackgroundJob.JobStatus status);
}
