package com.mediverse.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.mediverse.model.Notification;
import com.mediverse.repository.NotificationRepository;

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    public Notification createNotification(String role, Long userId, String title, String message) {
        Notification n = new Notification();
        n.setRole(role);
        n.setUserId(userId);
        n.setTitle(title);
        n.setMessage(message);
        n.setReadFlag(false);
        return notificationRepository.save(n);
    }

    public List<Notification> getByRole(String role) {
        return notificationRepository.findByRoleOrderByCreatedAtDesc(role);
    }

    public List<Notification> getByUserId(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
}
