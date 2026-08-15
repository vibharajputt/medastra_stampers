package com.mediverse.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.mediverse.model.Notification;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRoleOrderByCreatedAtDesc(String role);

    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
}
