import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { indexedDbHelper } from '../../services/indexedDbHelper';

export default function MedicineReminderManager() {
  const lastNotifiedRef = useRef({});

  useEffect(() => {
    // Request permission on mount if default
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const checkReminders = async () => {
      if (typeof window === 'undefined') return;

      let medicines = [];

      // Try IndexedDB first
      try {
        const cachedPlan = await indexedDbHelper.getCarePlan();
        if (cachedPlan && Array.isArray(cachedPlan.medicines)) {
          medicines = cachedPlan.medicines;
        }
      } catch (dbErr) {
        console.warn('IndexedDB read failed, trying localStorage fallback:', dbErr);
      }

      // Fallback to localStorage
      if (medicines.length === 0) {
        const cachedPlanRaw = localStorage.getItem('medastrax_care_plan');
        if (cachedPlanRaw) {
          try {
            const parsed = JSON.parse(cachedPlanRaw);
            if (parsed && Array.isArray(parsed.medicines)) {
              medicines = parsed.medicines;
            }
          } catch (e) {
            console.error('Error parsing cached care plan from localStorage', e);
          }
        }
      }

      // If no cached plan, use the default schedule
      if (medicines.length === 0) {
        medicines = [
          { name: 'Multivitamin', dose: '1 tablet', time: '08:00', notes: 'After breakfast.' },
          { name: 'Metformin', dose: '500 mg', time: '20:00', notes: 'With dinner.' },
          { name: 'Vitamin D', dose: '1 capsule', time: '21:30', notes: 'Before sleep.' },
        ];
      }

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentMinute = `${hh}:${mm}`;
      const todayKey = now.toDateString(); // e.g. "Sat Jun 13 2026"

      medicines.forEach((med) => {
        if (!med.time) return;

        // Check if the current time matches the scheduled time
        if (med.time === currentMinute) {
          const notificationKey = `${med.name}-${med.time}-${todayKey}`;

          // Check if already notified for this exact minute today
          if (!lastNotifiedRef.current[notificationKey]) {
            lastNotifiedRef.current[notificationKey] = true;

            const message = `💊 Time to take ${med.name} (${med.dose}) - ${med.notes || 'Take as directed.'}`;

            // PWA Notification (runs offline)
            if ('Notification' in window && Notification.permission === 'granted') {
              // Try to show via service worker registration if available for better PWA support
              if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((registration) => {
                  registration.showNotification('Medicine Reminder', {
                    body: message,
                    icon: '/favicon.png',
                    badge: '/favicon.png',
                    tag: med.name,
                    renotify: true
                  });
                });
              } else {
                new Notification('Medicine Reminder', {
                  body: message,
                  icon: '/favicon.png'
                });
              }
            }

            // In-app visual notification
            toast.success(message, { duration: 8000, icon: '💊' });
          }
        }
      });
    };

    // Check every 15 seconds to ensure we capture the minute change correctly
    const interval = setInterval(checkReminders, 15000);
    checkReminders(); // run initial check

    return () => clearInterval(interval);
  }, []);

  return null;
}
