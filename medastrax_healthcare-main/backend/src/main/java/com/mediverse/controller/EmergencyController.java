package com.mediverse.controller;

import com.mediverse.dto.ApiResponse;
import com.mediverse.model.PatientProfile;
import com.mediverse.model.User;
import com.mediverse.security.JwtTokenProvider;
import com.mediverse.service.AuthService;
import com.mediverse.service.TwilioSmsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class EmergencyController {

    @Autowired
    private AuthService authService;

    @Autowired
    private TwilioSmsService twilioSmsService;

    @Autowired
    private JwtTokenProvider tokenProvider;

    private final java.util.concurrent.ScheduledExecutorService scheduler =
            java.util.concurrent.Executors.newScheduledThreadPool(1);

    @PostMapping("/sos")
    public ResponseEntity<?> triggerSOS(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody SosRequest request) {
        try {
            String token = authHeader.replace("Bearer ", "");
            String email = tokenProvider.getEmailFromToken(token);
            User user = authService.getUserByEmail(email);

            PatientProfile profile = authService.getPatientProfile(user.getId());
            String emergencyContact = (profile != null) ? profile.getEmergencyNumber() : null;

            if (emergencyContact == null || emergencyContact.trim().isEmpty()) {
                emergencyContact = user.getPhone();
            }

            String trackingLink = request.getTrackingLink();
            if (trackingLink != null) {
                String localIp = getLocalIpAddress();
                trackingLink = trackingLink
                        .replace("localhost", localIp)
                        .replace("127.0.0.1", localIp);
            }

            String hospitalName = request.getHospitalName() != null
                    ? request.getHospitalName() : "Nearest Hospital";
            String trackingText = trackingLink != null ? trackingLink : "Location unavailable";

            String messageBody = String.format(
                    "MedAstraX EMERGENCY ALERT 🚨\n" +
                    "Patient: %s\n" +
                    "Hospital: %s\n" +
                    "Live Tracking: %s\n" +
                    "Act immediately!",
                    user.getName(), hospitalName, trackingText
            );

            if (emergencyContact != null && !emergencyContact.trim().isEmpty()) {
                twilioSmsService.sendSms(emergencyContact, messageBody);

                try {
                    String voiceMsg = String.format(
                            "This is an urgent emergency alert from MedAstraX. %s needs immediate medical help. " +
                            "They have been dispatched to %s. " +
                            "Please check your text messages immediately for the live ambulance tracking link and take action now.",
                            user.getName(),
                            request.getHospitalName() != null ? request.getHospitalName() : "the nearest hospital"
                    );
                    twilioSmsService.makeVoiceCall(emergencyContact, voiceMsg);
                } catch (Exception ex) {
                    System.err.println("Failed to initiate voice call: " + ex.getMessage());
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("sentTo", emergencyContact);
            result.put("messageBody", messageBody);
            result.put("status", "SUCCESS");

            return ResponseEntity.ok(ApiResponse.success("SOS Alert dispatched successfully!", result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Failed to trigger SOS alert: " + e.getMessage()));
        }
    }

    private String getLocalIpAddress() {
        try {
            java.util.Enumeration<java.net.NetworkInterface> interfaces =
                    java.net.NetworkInterface.getNetworkInterfaces();
            String fallback = null;

            while (interfaces.hasMoreElements()) {
                java.net.NetworkInterface iface = interfaces.nextElement();
                if (iface.isLoopback() || !iface.isUp()) continue;

                String displayName = iface.getDisplayName().toLowerCase();
                String name = iface.getName().toLowerCase();

                boolean isVirtual = false;
                for (String kw : new String[]{"virtual", "switch", "wsl", "vmware", "virtualbox",
                        "host-only", "docker", "vbox", "vpn", "bluetooth"}) {
                    if (displayName.contains(kw) || name.contains(kw)) {
                        isVirtual = true;
                        break;
                    }
                }

                java.util.Enumeration<java.net.InetAddress> addrs = iface.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    java.net.InetAddress addr = addrs.nextElement();
                    if (addr instanceof java.net.Inet4Address) {
                        String ip = addr.getHostAddress();
                        if (isVirtual) {
                            if (fallback == null) fallback = ip;
                        } else {
                            if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
                                return ip;
                            }
                        }
                    }
                }
            }

            if (fallback != null) return fallback;
            return java.net.InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            return "127.0.0.1";
        }
    }

    public static class SosRequest {
        private String hospitalName;
        private String hospitalPhone;
        private String hospitalAddress;
        private Double userLatitude;
        private Double userLongitude;
        private String trackingLink;

        public SosRequest() {}

        public String getHospitalName() { return hospitalName; }
        public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

        public String getHospitalPhone() { return hospitalPhone; }
        public void setHospitalPhone(String hospitalPhone) { this.hospitalPhone = hospitalPhone; }

        public String getHospitalAddress() { return hospitalAddress; }
        public void setHospitalAddress(String hospitalAddress) { this.hospitalAddress = hospitalAddress; }

        public Double getUserLatitude() { return userLatitude; }
        public void setUserLatitude(Double userLatitude) { this.userLatitude = userLatitude; }

        public Double getUserLongitude() { return userLongitude; }
        public void setUserLongitude(Double userLongitude) { this.userLongitude = userLongitude; }

        public String getTrackingLink() { return trackingLink; }
        public void setTrackingLink(String trackingLink) { this.trackingLink = trackingLink; }
    }
}
