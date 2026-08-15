package com.mediverse.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.rest.api.v2010.account.Call;
import com.twilio.type.PhoneNumber;
import com.twilio.type.Twiml;

@Service
public class TwilioSmsService {

    @Value("${twilio.account-sid:}")
    private String accountSid;

    @Value("${twilio.auth-token:}")
    private String authToken;

    @Value("${twilio.from-number:}")
    private String fromNumber;

    public void sendSms(String toE164, String messageBody) {
        if (accountSid == null || accountSid.trim().isEmpty() ||
            authToken == null || authToken.trim().isEmpty() ||
            fromNumber == null || fromNumber.trim().isEmpty()) {
            System.out.println("⚠️ Twilio not configured. Skipping SMS to=" + toE164 + " body=" + messageBody);
            return;
        }

        if (toE164 == null || toE164.trim().isEmpty()) {
            return;
        }

        // Remove all whitespace, hyphens, and brackets
        String formattedTo = toE164.trim().replaceAll("[\\s\\-\\(\\)]", "");
        if (!formattedTo.startsWith("+")) {
            if (formattedTo.length() == 10) {
                formattedTo = "+91" + formattedTo;
            } else if (formattedTo.length() == 12 && formattedTo.startsWith("91")) {
                formattedTo = "+" + formattedTo;
            }
        }

        try {
            Twilio.init(accountSid.trim(), authToken.trim());

            Message message = Message.creator(
                    new PhoneNumber(formattedTo),
                    new PhoneNumber(fromNumber.trim()),
                    messageBody
            ).create();
            System.out.println("✅ Twilio SMS Status: " + message.getStatus() + " | SID: " + message.getSid() + " | to: " + formattedTo);
        } catch (Exception e) {
            System.err.println("❌ Twilio SMS delivery failed: " + e.getMessage());
            throw new RuntimeException("Twilio dispatch failed: " + e.getMessage(), e);
        }
    }

    public void makeVoiceCall(String toE164, String voiceMessage) {
        if (accountSid == null || accountSid.trim().isEmpty() ||
            authToken == null || authToken.trim().isEmpty() ||
            fromNumber == null || fromNumber.trim().isEmpty()) {
            System.out.println("⚠️ Twilio not configured. Skipping voice call to=" + toE164 + " message=" + voiceMessage);
            return;
        }

        if (toE164 == null || toE164.trim().isEmpty()) {
            return;
        }

        String formattedTo = toE164.trim().replaceAll("[\\s\\-\\(\\)]", "");
        if (!formattedTo.startsWith("+")) {
            if (formattedTo.length() == 10) {
                formattedTo = "+91" + formattedTo;
            } else if (formattedTo.length() == 12 && formattedTo.startsWith("91")) {
                formattedTo = "+" + formattedTo;
            }
        }

        try {
            Twilio.init(accountSid.trim(), authToken.trim());

            // Construct TwiML to speak the message
            String twimlXml = "<Response><Say voice=\"alice\">" + voiceMessage + "</Say></Response>";
            
            Call call = Call.creator(
                    new PhoneNumber(formattedTo),
                    new PhoneNumber(fromNumber.trim()),
                    new Twiml(twimlXml)
            ).create();
            
            System.out.println("✅ Twilio Voice Call Status: " + call.getStatus() + " | SID: " + call.getSid() + " | to: " + formattedTo);
        } catch (Exception e) {
            System.err.println("❌ Twilio Voice Call delivery failed: " + e.getMessage());
            throw new RuntimeException("Twilio Voice Call dispatch failed: " + e.getMessage(), e);
        }
    }
}


