package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.model.Notification;
import com.mediverse.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @GetMapping
    public List<Notification> getNotifications(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Long userId) {
        if (userId != null) {
            return notificationService.getByUserId(userId);
        }
        if (role != null && !role.trim().isEmpty()) {
            return notificationService.getByRole(role);
        }
        return List.of();
    }
}
