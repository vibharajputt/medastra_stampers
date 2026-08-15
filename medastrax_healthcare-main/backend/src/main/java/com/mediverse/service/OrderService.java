package com.mediverse.service;

import com.mediverse.model.Order;
import com.mediverse.model.User;
import com.mediverse.repository.OrderRepository;
import com.mediverse.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private UserRepository userRepository;

    public Order createOrder(Long patientId, String pharmacyName, String medicinesJson, String deliveryAddress,
                             Double medicineAmount, Double deliveryCharges, Double totalAmount) {
        Optional<User> patientOpt = userRepository.findById(patientId);
        if (!patientOpt.isPresent()) {
            throw new RuntimeException("Patient not found");
        }
        Order order = new Order();
        order.setPatient(patientOpt.get());
        order.setPharmacyName(pharmacyName);
        order.setMedicinesJson(medicinesJson);
        order.setDeliveryAddress(deliveryAddress);
        order.setStatus("PENDING");
        order.setMedicineAmount(medicineAmount);
        order.setDeliveryCharges(deliveryCharges);
        order.setTotalAmount(totalAmount);
        return orderRepository.save(order);
    }

    public List<Order> getOrdersByPatient(Long patientId) {
        return orderRepository.findByPatientId(patientId);
    }

    public List<Order> getOrdersByPharmacy(String pharmacyName) {
        return orderRepository.findByPharmacyName(pharmacyName);
    }

    public Order updateStatus(Long orderId, String status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found"));
        order.setStatus(status);
        return orderRepository.save(order);
    }
}
