package com.mediverse.service;

import java.time.LocalDate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.mediverse.model.Booking;

@Service
public class ReminderService {

    @Autowired
    private TwilioSmsService twilioSmsService;

    /**
     * Very small heuristic:
     * - If booking.aiReport mentions "medicine" => send medicine reminder.
     * - If booking.aiReport mentions "exercise" => send exercise reminder.
     *
     * Reminder time is derived from Booking.bookingDate + Booking.timeSlot.
     */
    public void sendMedicineAndExerciseRemindersIfDue(Booking booking) {
        if (booking == null || booking.getPatientPhone() == null) return;

        String ai = booking.getAiReport();
        if (ai == null) return;

        String lower = ai.toLowerCase();
        boolean wantsMedicine = containsAny(lower, "medicine", "medication", "dose", "take medicine");
        boolean wantsExercise = containsAny(lower, "exercise", "workout", "stretch");

        if (!wantsMedicine && !wantsExercise) return;

        String toE164 = normalizeToE164(booking.getPatientPhone());
        if (toE164 == null) return;

        // SMS content uses booking date + timeSlot; actual due-time scheduling
        // is intentionally kept minimal (triggered when AI report updated).
        LocalDate d = booking.getBookingDate();
        String dateStr = d != null ? d.toString() : "";
        String slot = booking.getTimeSlot() != null ? booking.getTimeSlot() : "";

        if (wantsMedicine) {
            String msg = String.format("Medicine time hai. Date: %s, Time: %s. Please take your medicine as prescribed.", dateStr, slot);
            twilioSmsService.sendSms(toE164, msg);
        }

        if (wantsExercise) {
            String msg = String.format("Exercise time hai. Date: %s, Time: %s. Please do your exercise as advised.", dateStr, slot);
            twilioSmsService.sendSms(toE164, msg);
        }
    }

    private boolean containsAny(String haystack, String... needles) {
        if (haystack == null) return false;
        for (String n : needles) {
            if (n != null && !n.trim().isEmpty() && haystack.contains(n.toLowerCase())) return true;
        }
        return false;
    }

    /**
     * If number starts with +, keep as-is.
     * Otherwise assume it is an Indian number and prefix with +91.
     */
    private String normalizeToE164(String phone) {
        String p = phone.trim();
        if (p.isEmpty()) return null;
        if (p.startsWith("+")) return p;
        // basic cleanup
        p = p.replaceAll("\\s+", "");
        p = p.replaceAll("[^0-9]", "");
        if (p.isEmpty()) return null;
        // default: India
        return "+91" + p;
    }
}

