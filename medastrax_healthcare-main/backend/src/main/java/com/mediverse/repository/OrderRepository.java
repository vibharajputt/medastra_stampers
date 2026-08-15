package com.mediverse.repository;

import com.mediverse.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    public List<Order> findByPatientId(Long patientId);

    public List<Order> findByPharmacyName(String pharmacyName);
}
