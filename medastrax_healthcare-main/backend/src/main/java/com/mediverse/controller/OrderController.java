package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.model.Order;
import com.mediverse.model.User;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    @Autowired
    private OrderService orderService;

    @Autowired
    private AuthService authService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @PostMapping
    public ResponseEntity<?> createOrder(
            @RequestBody Map<String, Object> payload,
            @RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractUserId(authHeader);
            String pharmacyName = (String) payload.get("pharmacyName");
            String medicinesJson = (String) payload.get("medicinesJson");
            String deliveryAddress = (String) payload.get("deliveryAddress");

            Double medicineAmount = payload.get("medicineAmount") != null
                    ? ((Number) payload.get("medicineAmount")).doubleValue() : null;
            Double deliveryCharges = payload.get("deliveryCharges") != null
                    ? ((Number) payload.get("deliveryCharges")).doubleValue() : null;
            Double totalAmount = payload.get("totalAmount") != null
                    ? ((Number) payload.get("totalAmount")).doubleValue() : null;

            Order order = orderService.createOrder(patientId, pharmacyName, medicinesJson,
                    deliveryAddress, medicineAmount, deliveryCharges, totalAmount);
            return ResponseEntity.ok(ApiResponse.success("Order created successfully", toMap(order)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/patient")
    public ResponseEntity<?> getPatientOrders(@RequestHeader("Authorization") String authHeader) {
        try {
            Long patientId = extractUserId(authHeader);
            List<Order> orders = orderService.getOrdersByPatient(patientId);
            return ResponseEntity.ok(orders.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/pharmacy")
    public ResponseEntity<?> getPharmacyOrders(
            @RequestParam("pharmacyName") String pharmacyName,
            @RequestHeader("Authorization") String authHeader) {
        try {
            List<Order> orders = orderService.getOrdersByPharmacy(pharmacyName);
            return ResponseEntity.ok(orders.stream().map(this::toMap).collect(Collectors.toList()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            @RequestHeader("Authorization") String authHeader) {
        try {
            String status = payload.get("status");
            Order order = orderService.updateStatus(id, status);
            return ResponseEntity.ok(ApiResponse.success("Order status updated", toMap(order)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private Map<String, Object> toMap(Order order) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", order.getId());
        m.put("patientId", order.getPatient().getId());
        m.put("patientName", order.getPatient().getName());
        m.put("pharmacyName", order.getPharmacyName());
        m.put("medicines", order.getMedicinesJson());
        m.put("status", order.getStatus());
        m.put("deliveryAddress", order.getDeliveryAddress());
        m.put("createdAt", order.getCreatedAt().toString());
        m.put("medicineAmount", order.getMedicineAmount());
        m.put("deliveryCharges", order.getDeliveryCharges());
        m.put("totalAmount", order.getTotalAmount());
        return m;
    }

    private Long extractUserId(String authHeader) {
        String token = authHeader.replace("Bearer ", "");
        String email = tokenProvider.getEmailFromToken(token);
        return authService.getUserByEmail(email).getId();
    }
}
