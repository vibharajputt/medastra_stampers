package com.mediverse.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
import jakarta.annotation.PostConstruct;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {

    @Value("${razorpay.key.id}")
    private String keyId;

    @Value("${razorpay.key.secret}")
    private String keySecret;

    private RazorpayClient client;

    @PostConstruct
    public void init() {
        try {
            // Only instantiate if it's not a placeholder
            if (!keyId.contains("placeholder") && !keyId.startsWith("your-")) {
                client = new RazorpayClient(keyId, keySecret);
            }
        } catch (Exception e) {
            System.err.println("⚠️ Could not initialize Razorpay SDK Client: " + e.getMessage());
        }
    }

    public String createOrder(double amount) {
        // Fallback to mock order if client is not configured or fails
        if (client == null) {
            System.out.println("ℹ️ Razorpay client not configured. Generating mock sandbox order ID.");
            return "order_mock_" + System.currentTimeMillis();
        }
        try {
            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", (int) (amount * 100)); // amount in paise
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", "rcpt_txn_" + System.currentTimeMillis());

            Order order = client.orders.create(orderRequest);
            return order.get("id");
        } catch (Exception e) {
            System.err.println("⚠️ Razorpay order creation failed, falling back to mock mode: " + e.getMessage());
            return "order_mock_" + System.currentTimeMillis();
        }
    }

    public boolean verifySignature(String orderId, String paymentId, String signature) {
        // Bypass verification if it's a simulated order
        if (orderId != null && orderId.startsWith("order_mock_")) {
            return true;
        }
        try {
            JSONObject attributes = new JSONObject();
            attributes.put("razorpay_order_id", orderId);
            attributes.put("razorpay_payment_id", paymentId);
            attributes.put("razorpay_signature", signature);
            return Utils.verifyPaymentSignature(attributes, keySecret);
        } catch (Exception e) {
            System.err.println("⚠️ Razorpay checksum verification failed: " + e.getMessage());
            return false;
        }
    }
}
