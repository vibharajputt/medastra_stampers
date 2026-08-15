import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hospitalAPI, bookingAPI, paymentAPI, authAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, 
  FiArrowRight, 
  FiCalendar, 
  FiCheckCircle, 
  FiCreditCard, 
  FiInfo, 
  FiPhone, 
  FiClock, 
  FiUser, 
  FiActivity, 
  FiFileText, 
  FiShield,
  FiMapPin
} from 'react-icons/fi';
import toast from 'react-hot-toast';



export default function BookingPage() {
  const { hospitalId } = useParams();
  const navigate = useNavigate();
  const { user, activeProfile } = useAuth();
  
  const [hospital, setHospital] = useState(null);
  const [loadingHospital, setLoadingHospital] = useState(true);
  const [step, setStep] = useState(1);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showMockRazorpay, setShowMockRazorpay] = useState(false);
  const [mockRzpOptions, setMockRzpOptions] = useState(null);
  
  // Card Flip State
  const [isFlipped, setIsFlipped] = useState(false);
  const [upiVerified, setUpiVerified] = useState(false);
  const [verifyingUpi, setVerifyingUpi] = useState(false);
  const [verifiedName, setVerifiedName] = useState('');
  const [verifiedBank, setVerifiedBank] = useState('');

  // Doctor Selection States
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    patientName: user?.name || '',
    patientPhone: user?.phone || '',
    age: '',
    gender: '',
    bookingDate: '',
    timeSlot: '',
    type: 'OFFLINE', // default to offline visit
    notes: '',
    symptoms: '',
    duration: '',
    allergies: 'None',
    medications: 'None',
    firstTime: 'yes',
    paymentMethod: 'CASH', // CASH or ONLINE
    onlineMethod: 'CARD', // CARD or UPI
    upiProvider: 'GPAY', // GPAY, PAYTM, PHONEPE
    upiId: '',
    upiPhone: '',
    cardName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  });

  useEffect(() => {
    fetchHospitalDetails();
    fetchPatientProfile();
  }, [hospitalId]);

  const fetchPatientProfile = async () => {
    if (activeProfile) {
      setFormData(prev => ({
        ...prev,
        patientName: activeProfile.name || '',
        patientPhone: activeProfile.phone || '',
        age: activeProfile.age !== undefined && activeProfile.age !== null ? activeProfile.age.toString() : '',
        gender: activeProfile.gender || '',
        allergies: activeProfile.allergies || 'None',
        medications: activeProfile.currentMedication || 'None',
        firstTime: 'yes'
      }));
      return;
    }

    try {
      const res = await authAPI.getProfile();
      const profile = res.data;
      if (profile) {
        setFormData(prev => ({
          ...prev,
          patientName: profile.name || prev.patientName,
          patientPhone: profile.phone || prev.patientPhone,
          age: profile.age !== undefined && profile.age !== null ? profile.age.toString() : '',
          gender: profile.gender || '',
          allergies: profile.allergies || 'None',
          medications: profile.currentMedication || 'None',
          firstTime: profile.isFirstTimeUser === false ? 'no' : 'yes'
        }));
      }
    } catch (error) {
      console.error('Failed to load patient profile details', error);
    }
  };

  const getDoctorBusyStorageKey = (doctorId) => `mediverse_doctor_busy_${doctorId}`;

  const getDoctorBusyStatus = (doctorId) => {
    if (!doctorId) return { mode: 'NONE', date: '' };
    try {
      const stored = window.localStorage.getItem(getDoctorBusyStorageKey(doctorId));
      if (!stored) return { mode: 'NONE', date: '' };
      const parsed = JSON.parse(stored);
      return parsed && parsed.mode ? parsed : { mode: 'NONE', date: '' };
    } catch (error) {
      return { mode: 'NONE', date: '' };
    }
  };

  const parseSlotHour = (slot) => {
    if (!slot || typeof slot !== 'string') return null;
    const parts = slot.split(' ');
    if (parts.length < 2) return null;
    const [time, ampm] = parts;
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    let parsedHour = hour % 12;
    if (ampm.toUpperCase() === 'PM') parsedHour += 12;
    return parsedHour + minute / 60;
  };

  const parseTimeInputHour = (value) => {
    if (!value || typeof value !== 'string') return null;
    const [hourStr, minuteStr] = value.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return hour + minute / 60;
  };

  const isAfternoonSlot = (slot) => {
    const hour = parseSlotHour(slot);
    return hour !== null && hour >= 12;
  };

  const isSlotInTimeRange = (slot, startTime, endTime) => {
    const slotHour = parseSlotHour(slot);
    const startHour = parseTimeInputHour(startTime);
    const endHour = parseTimeInputHour(endTime);
    if (slotHour === null || startHour === null || endHour === null) return false;
    return slotHour >= startHour && slotHour < endHour;
  };

  const addLocalNotification = (role, note) => {
    try {
      const key = `mediverse_notifications_${role}`;
      const stored = window.localStorage.getItem(key);
      let list = [];
      if (stored) {
        list = JSON.parse(stored) || [];
      }
      // Ensure unique id and keep recent first
      const id = Date.now();
      const item = { id, ...note, read: false };
      list.unshift(item);
      // Keep list bounded to 50 entries
      if (list.length > 50) list = list.slice(0, 50);
      window.localStorage.setItem(key, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to add local notification', err);
    }
  };

  const filterBookedSlotsForBusyDoctor = (slots) => {
    const activeDocId = selectedDoctorId || hospital?.doctorId;
    if (!activeDocId || !formData.bookingDate) return slots;
    const busyStatus = getDoctorBusyStatus(activeDocId);
    if (busyStatus.mode === 'NONE' || busyStatus.date !== formData.bookingDate) return slots;
    if (busyStatus.mode === 'TODAY' || busyStatus.mode === 'ALL_DAY') return [];
    if (busyStatus.mode === 'AFTERNOON') return slots.filter(slot => !isAfternoonSlot(slot));
    if (busyStatus.mode === 'TIME_RANGE') {
      if (!busyStatus.startTime || !busyStatus.endTime) return slots;
      return slots.filter(slot => !isSlotInTimeRange(slot, busyStatus.startTime, busyStatus.endTime));
    }
    return slots;
  };

  useEffect(() => {
    if (formData.bookingDate && (selectedDoctorId || hospital?.doctorId)) {
      fetchAvailableSlots();
    } else {
      setAvailableSlots([]);
      setFormData(prev => ({ ...prev, timeSlot: '' }));
    }
  }, [formData.bookingDate, selectedDoctorId, hospital]);

  const fetchHospitalDetails = async () => {
    try {
      setLoadingHospital(true);
      const res = await hospitalAPI.getById(hospitalId);
      setHospital(res.data);

      try {
        setLoadingDoctors(true);
        const docsRes = await hospitalAPI.getDoctors(hospitalId);
        setDoctors(docsRes.data || []);
        if (docsRes.data && docsRes.data.length > 0) {
          setSelectedDoctorId(docsRes.data[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load doctors for hospital', err);
      } finally {
        setLoadingDoctors(false);
      }
    } catch (error) {
      toast.error('Failed to load hospital details');
      navigate('/dashboard');
    } finally {
      setLoadingHospital(false);
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      const activeDocId = selectedDoctorId || hospital.doctorId;
      const res = await bookingAPI.getAvailableSlots(activeDocId, formData.bookingDate);
      let filteredSlots = filterBookedSlotsForBusyDoctor(res.data || []);
      
      // Filter out past slots if the selected date is today
      if (formData.bookingDate === getTodayString()) {
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        filteredSlots = filteredSlots.filter(slot => {
          const slotHour = parseSlotHour(slot);
          return slotHour !== null && slotHour > currentHour;
        });
      }

      setAvailableSlots(filteredSlots);
      // Reset selected slot if it's not in the new available list
      if (!filteredSlots.includes(formData.timeSlot)) {
        setFormData(prev => ({ ...prev, timeSlot: '' }));
      }
    } catch (error) {
      toast.error('Failed to load time slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'upiId') {
      setUpiVerified(false);
      setVerifiedName('');
      setVerifiedBank('');
    }
  };

  const handleVerifyUpi = async () => {
    if (!formData.upiId.trim()) {
      toast.error('Please enter a UPI ID first');
      return;
    }
    if (!formData.upiId.includes('@')) {
      toast.error('Invalid UPI ID format (must contain @)');
      return;
    }
    
    setVerifyingUpi(true);
    setUpiVerified(false);
    setVerifiedName('');
    setVerifiedBank('');
    
    try {
      // Simulate realistic bank verification delay
      await new Promise(resolve => setTimeout(resolve, 1200));
      const res = await authAPI.verifyUpi(formData.upiId);
      const { name, bankName, verified } = res.data;
      
      if (verified && name) {
        setVerifyingUpi(false);
        setUpiVerified(true);
        setVerifiedName(name);
        setVerifiedBank(bankName || 'UPI Bank');
        toast.success(`UPI verified — Account holder: ${name}`);
      } else {
        setVerifyingUpi(false);
        toast.error('Could not verify this UPI ID. Please check and try again.');
      }
    } catch (error) {
      setVerifyingUpi(false);
      toast.error('UPI Verification failed. Please try again.');
    }
  };

  // Card Number Formatting
  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    const formattedValue = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    setFormData(prev => ({ ...prev, cardNumber: formattedValue }));
  };

  // Expiry Date Formatting (MM/YY)
  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length > 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    setFormData(prev => ({ ...prev, cardExpiry: value }));
  };

  // CVV Change
  const handleCvvChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 3) value = value.slice(0, 3);
    setFormData(prev => ({ ...prev, cardCvv: value }));
  };

  const validateStep1 = () => {
    if (!formData.patientName.trim()) return 'Patient name is required';
    if (!formData.patientPhone.trim()) return 'Phone number is required';
    if (!formData.age || parseInt(formData.age) <= 0) return 'Please enter a valid age';
    if (!formData.gender) return 'Please select a gender';
    if (!formData.bookingDate) return 'Please choose a date';
    if (formData.bookingDate < getTodayString()) return 'Booking date cannot be in the past';
    if (!formData.timeSlot) return 'Please choose a time slot';

    // Validate that timeSlot has not already passed
    if (formData.bookingDate === getTodayString()) {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const slotHour = parseSlotHour(formData.timeSlot);
      if (slotHour !== null && slotHour <= currentHour) {
        return 'Selected time slot has already passed';
      }
    }
    return null;
  };

  const validateStep2 = () => {
    if (!formData.symptoms.trim()) return 'Please describe your symptoms';
    if (!formData.duration) return 'Please specify the duration';
    return null;
  };

  const validateStep3 = () => {
    if (formData.type === 'ONLINE' && formData.paymentMethod === 'CASH') {
      return 'Pay at Reception is not available for online consultations. Please choose Pay Online.';
    }

    if (formData.paymentMethod === 'ONLINE') {
      if (formData.onlineMethod === 'CARD') {
        if (!formData.cardName.trim()) return 'Cardholder name is required';
        if (formData.cardNumber.replace(/\s/g, '').length !== 16) return 'Invalid Card Number (must be 16 digits)';
        
        const expiryParts = formData.cardExpiry.split('/');
        if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) {
          return 'Expiry must be in MM/YY format';
        }
        
        const month = parseInt(expiryParts[0]);
        const year = parseInt('20' + expiryParts[1]);
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        if (month < 1 || month > 12) return 'Invalid expiry month';
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
          return 'Card has expired';
        }

        if (formData.cardCvv.length !== 3) return 'CVV must be 3 digits';
      } else if (formData.onlineMethod === 'UPI') {
        if (!formData.upiId.trim()) return 'UPI ID is required';
        if (!formData.upiId.includes('@')) return 'Invalid UPI ID format (must contain @)';
        if (!upiVerified) return 'Please verify your UPI ID before proceeding';
      }
    }
    return null;
  };

  const handleNextStep = () => {
    let error = null;
    if (step === 1) {
      error = validateStep1();
      if (!error && formData.type === 'ONLINE') {
        setFormData(prev => ({ ...prev, paymentMethod: 'ONLINE' }));
      }
    } else if (step === 2) {
      error = validateStep2();
    }

    if (error) {
      toast.error(error);
      return;
    }
    
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };  const handleConfirmBooking = async () => {
    const error = validateStep3();
    if (error) {
      toast.error(error);
      return;
    }

    try {
      setSubmitting(true);
      
      const actualMethodName = formData.paymentMethod === 'ONLINE' 
        ? (formData.onlineMethod === 'UPI' ? formData.upiProvider : 'CARD') 
        : 'CASH';

      const activeDocId = selectedDoctorId || hospital?.doctorId;
      const activeDocObj = doctors.find(d => d.id.toString() === activeDocId.toString());
      const activeDoctorName = activeDocObj ? activeDocObj.name : (hospital?.doctorName || 'Doctor');
      
      if (formData.paymentMethod === 'ONLINE') {
        const orderToast = toast.loading('Initializing secure checkout order...');
        
        // 1. Call Backend to create Order
        const orderResponse = await paymentAPI.createOrder({
          hospitalId: hospital.id,
          amount: parseFloat(hospital.consultationRate)
        });
        
        const { orderId, amount, keyId } = orderResponse.data;
        toast.dismiss(orderToast);
        
        // 2. Configure and Open Razorpay Checkout Dialog
        const options = {
          key: keyId, // public key from backend
          amount: amount * 100, // amount in paise
          currency: "INR",
          name: "MedAstraX Care",
          description: `Consultation Booking at ${hospital.name}`,
          order_id: orderId,
          handler: async function (response) {
            const verifyToast = toast.loading('Verifying transaction details...');
            try {
              // 3. Verify Payment on Backend and Create Booking
              const verifyPayload = {
                hospitalId: hospital.id,
                doctorId: activeDocId,
                bookingDate: formData.bookingDate,
                timeSlot: formData.timeSlot,
                type: formData.type,
                notes: `Assessment details - Duration: ${formData.duration}. Allergies: ${formData.allergies}. Medications: ${formData.medications}. First time: ${formData.firstTime}. Patient Notes: ${formData.notes}`,
                patientName: formData.patientName,
                patientPhone: formData.patientPhone,
                age: parseInt(formData.age),
                gender: formData.gender,
                symptoms: formData.symptoms,
                paymentMethod: actualMethodName,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
                familyMemberId: activeProfile ? activeProfile.id : null
              };
              
              await paymentAPI.verifyPayment(verifyPayload);
              toast.success('Payment verified & Booking Confirmed!', { id: verifyToast });
              // Add local notifications for doctor and patient
              try {
                const patientNote = {
                  title: 'Booking Confirmed',
                  message: `Your booking with ${activeDoctorName} is confirmed for ${formData.bookingDate} ${formData.timeSlot}.`,
                  time: 'Just now'
                };
                const doctorNote = {
                  title: 'New Booking',
                  message: `${formData.patientName} booked ${formData.bookingDate} ${formData.timeSlot} at ${hospital.name}.`,
                  time: 'Just now'
                };
                addLocalNotification('PATIENT', patientNote);
                addLocalNotification('DOCTOR', doctorNote);
              } catch (e) {
                console.warn('Notification creation failed', e);
              }
              navigate('/my-bookings');
            } catch (err) {
              toast.dismiss(verifyToast);
              const errMsg = err.response?.data?.message || 'Verification failed';
              toast.error(errMsg);
            } finally {
              setSubmitting(false);
              setShowMockRazorpay(false);
            }
          },
          prefill: {
            name: formData.patientName,
            contact: formData.patientPhone,
            email: user?.email || ''
          },
          notes: {
            hospital_name: hospital.name,
            doctor_name: activeDoctorName
          },
          theme: {
            color: "#00D9A6"
          },
          modal: {
            ondismiss: function() {
              toast.error('Payment checkout cancelled.');
              setSubmitting(false);
              setShowMockRazorpay(false);
            }
          }
        };
        
        if (orderId && orderId.startsWith("order_mock_")) {
          setMockRzpOptions(options);
          setShowMockRazorpay(true);
          setSubmitting(false);
        } else {
          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      } else {
        // Cash Flow
        const loadingToast = toast.loading('Confirming your booking...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const packedNotes = `Assessment details - Duration: ${formData.duration}. Allergies: ${formData.allergies}. Medications: ${formData.medications}. First time: ${formData.firstTime}. Patient Notes: ${formData.notes}`;

        const bookingPayload = {
          hospitalId: hospital.id,
          doctorId: activeDocId,
          bookingDate: formData.bookingDate,
          timeSlot: formData.timeSlot,
          type: formData.type,
          notes: packedNotes,
          patientName: formData.patientName,
          patientPhone: formData.patientPhone,
          age: parseInt(formData.age),
          gender: formData.gender,
          symptoms: formData.symptoms,
          paymentMethod: 'CASH',
          paymentStatus: 'PENDING',
          familyMemberId: activeProfile ? activeProfile.id : null
        };

        await bookingAPI.create(bookingPayload);
        toast.success('Booking confirmed successfully!', { id: loadingToast });
        try {
          const patientNote = {
            title: 'Booking Confirmed',
            message: `Your booking with ${activeDoctorName} is confirmed for ${formData.bookingDate} ${formData.timeSlot}.`,
            time: 'Just now'
          };
          const doctorNote = {
            title: 'New Booking',
            message: `${formData.patientName} booked ${formData.bookingDate} ${formData.timeSlot} at ${hospital.name}.`,
            time: 'Just now'
          };
          addLocalNotification('PATIENT', patientNote);
          addLocalNotification('DOCTOR', doctorNote);
        } catch (e) {
          console.warn('Notification creation failed', e);
        }
        navigate('/my-bookings');
      }
    } catch (error) {
      toast.dismiss();
      const errorMsg = error.response?.data?.message || 'Failed to initialize booking';
      toast.error(errorMsg);
      setSubmitting(false);
    }
  };

  const getCardBrand = (number) => {
    const cleanNumber = number.replace(/\D/g, '');
    if (cleanNumber.startsWith('4')) return 'VISA';
    if (cleanNumber.startsWith('5')) return 'MASTERCARD';
    if (cleanNumber.startsWith('3')) return 'AMEX';
    if (cleanNumber.startsWith('6')) return 'RUPAY';
    return 'CARD';
  };

  // Get Today's date string formatted as YYYY-MM-DD for date limits
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  if (loadingHospital) {
    return (
      <div className="page-container section flex-center" style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton-loader" style={{ width: '100%', maxWidth: '800px', height: '450px', borderRadius: 'var(--radius-lg)' }}></div>
      </div>
    );
  }

  return (
    <div className="page-container section" style={{ minHeight: '90vh' }}>
      
      {/* Styles local to this page to make card checkout extremely beautiful */}
      <style>{`
        .booking-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 32px;
          align-items: start;
        }

        .booking-steps-nav {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          position: relative;
        }

        .booking-steps-nav::before {
          content: '';
          position: absolute;
          top: 20px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--border-color);
          z-index: 1;
        }

        .step-indicator {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 120px;
        }

        .step-bubble {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--text-muted);
          transition: all 0.3s ease;
          font-family: var(--font-display);
        }

        .step-indicator.active .step-bubble {
          background: var(--bg-primary);
          border-color: var(--primary);
          color: var(--primary);
          box-shadow: var(--shadow-glow);
        }

        .step-indicator.completed .step-bubble {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--bg-primary);
        }

        .step-label {
          margin-top: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-align: center;
        }

        .step-indicator.active .step-label {
          color: var(--text-primary);
        }

        .step-indicator.completed .step-label {
          color: var(--primary);
        }

        /* Radio cards */
        .radio-card-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .radio-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 16px;
          cursor: pointer;
          transition: all var(--transition-normal);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .radio-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--border-light);
        }

        .radio-card.selected {
          background: rgba(0, 217, 166, 0.05);
          border-color: var(--primary);
          box-shadow: 0 0 10px rgba(0, 217, 166, 0.1);
        }

        .radio-card-title {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-primary);
        }

        .radio-card-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        /* Doctors Grid styling */
        .doctors-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 12px;
          margin-bottom: 24px;
        }

        @media (max-width: 1024px) {
          .doctors-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .doctors-grid {
            grid-template-columns: 1fr;
          }
        }

        .doctor-grid-card {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
        }

        .doctor-grid-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border-light);
          transform: translateY(-1px);
        }

        .doctor-grid-card.selected {
          background: rgba(0, 217, 166, 0.03);
          border: 2px solid var(--primary);
          box-shadow: 0 4px 20px rgba(0, 217, 166, 0.08);
        }

        .doctor-grid-avatar-wrapper {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .doctor-grid-avatar {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .doctor-grid-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .doctor-grid-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 0.95rem;
        }

        .doctor-grid-specialty {
          font-size: 0.82rem;
          color: var(--text-secondary);
        }

        .doctor-grid-rating {
          font-size: 0.8rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
        }

        .doctor-grid-star {
          color: #FFC107;
          font-weight: bold;
        }

        .doctor-grid-check {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--primary);
          font-size: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Credit card 3d design */
        .credit-card-wrapper {
          perspective: 1000px;
          width: 100%;
          max-width: 320px;
          height: 190px;
          margin: 0 auto 24px;
        }

        .credit-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: left;
          transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-style: preserve-3d;
        }

        .credit-card-wrapper.flipped .credit-card-inner {
          transform: rotateY(180deg);
        }

        .credit-card-front, .credit-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: var(--shadow-lg);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .credit-card-front {
          background: linear-gradient(135deg, #1d2671 0%, #c33764 100%);
        }

        .credit-card-back {
          background: linear-gradient(135deg, #c33764 0%, #1d2671 100%);
          transform: rotateY(180deg);
          padding: 20px 0;
        }

        .card-chip {
          width: 40px;
          height: 30px;
          background: linear-gradient(135deg, #ffd700, #b8860b);
          border-radius: 4px;
        }

        .card-brand-logo {
          font-family: var(--font-display);
          font-weight: 800;
          font-style: italic;
          font-size: 1.2rem;
          color: white;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .card-display-number {
          font-family: 'Courier New', Courier, monospace;
          font-size: 1.15rem;
          letter-spacing: 2px;
          word-spacing: 4px;
          color: white;
          margin: 20px 0 10px;
        }

        .card-display-info {
          display: flex;
          justify-content: space-between;
        }

        .card-display-label {
          font-size: 0.6rem;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .card-display-val {
          font-size: 0.8rem;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
        }

        .card-magnetic-stripe {
          width: 100%;
          height: 40px;
          background: #111;
        }

        .card-signature-area {
          background: white;
          margin: 10px 20px 0;
          height: 35px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 10px;
        }

        .card-display-cvv {
          font-family: 'Courier New', Courier, monospace;
          font-weight: 700;
          font-style: italic;
          color: #333;
        }

        .slots-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 10px;
          margin-top: 8px;
        }

        .slot-pill {
          padding: 10px;
          border-radius: var(--radius-sm);
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          text-align: center;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .slot-pill:hover:not(.disabled) {
          border-color: var(--primary-light);
          background: rgba(0, 217, 166, 0.02);
        }

        .slot-pill.selected {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--bg-primary);
          font-weight: 600;
        }

        .slot-pill.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        @media (max-width: 900px) {
          .booking-layout {
            grid-template-columns: 1fr;
          }
        }

        /* select option color override */
        select.form-input option {
          background-color: #FFFFFF !important;
          color: #0F172A !important;
        }

        /* Mock Razorpay Modal Styles */
        .mock-rzp-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(11, 15, 26, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }

        .mock-rzp-modal {
          width: 100%;
          max-width: 440px;
          background: #171c2f;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          animation: scaleIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .mock-rzp-header {
          background: #0f1322;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .mock-rzp-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .mock-rzp-logo {
          font-family: var(--font-display);
          font-weight: 800;
          font-style: italic;
          font-size: 1.3rem;
          color: #00d9a6;
          letter-spacing: -0.5px;
        }

        .mock-rzp-badge {
          background: rgba(0, 217, 166, 0.1);
          color: #00d9a6;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .mock-rzp-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .mock-rzp-amount-section {
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 16px;
          border: 1px dashed rgba(255, 255, 255, 0.08);
        }

        .mock-rzp-amount {
          font-size: 1.8rem;
          font-weight: 700;
          color: #fff;
        }

        .mock-rzp-orderid {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 4px;
          font-family: monospace;
        }

        .mock-rzp-details {
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 0.85rem;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          padding: 12px;
        }

        .mock-rzp-row {
          display: flex;
          justify-content: space-between;
        }

        .mock-rzp-label {
          color: var(--text-secondary);
        }

        .mock-rzp-val {
          color: #fff;
          font-weight: 500;
        }

        .mock-rzp-warning {
          background: rgba(255, 179, 0, 0.05);
          border: 1px solid rgba(255, 179, 0, 0.15);
          border-radius: 8px;
          padding: 12px;
          font-size: 0.8rem;
          color: var(--warning);
          display: flex;
          gap: 8px;
          line-height: 1.4;
        }

        .mock-rzp-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }

        .mock-rzp-btn-success {
          background: var(--primary);
          color: var(--bg-primary);
          font-weight: 700;
          border: none;
          padding: 14px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.95rem;
          box-shadow: 0 4px 12px rgba(0, 217, 166, 0.2);
        }

        .mock-rzp-btn-success:hover {
          background: var(--primary-light);
          box-shadow: 0 6px 16px rgba(0, 217, 166, 0.35);
          transform: translateY(-1px);
        }

        .mock-rzp-btn-fail {
          background: rgba(255, 82, 82, 0.1);
          color: #ff5252;
          font-weight: 500;
          border: 1px solid rgba(255, 82, 82, 0.2);
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
        }

        .mock-rzp-btn-fail:hover {
          background: rgba(255, 82, 82, 0.18);
          border-color: #ff5252;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="btn btn-ghost btn-icon"
          style={{ width: '40px', height: '40px', borderRadius: '50%' }}
        >
          <FiArrowLeft />
        </button>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '6px' }}>Booking intake</span>
          <h1 className="heading-md" style={{ margin: 0 }}>Book consultation</h1>
        </div>
      </div>

      <div className="booking-layout">
        
        {/* Main Booking Panel */}
        <div className="glass-card animate-slide-up" style={{ padding: '32px' }}>
          
          {/* Progress Indicators */}
          <div className="booking-steps-nav">
            <div className={`step-indicator ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
              <div className="step-bubble">{step > 1 ? '✓' : '1'}</div>
              <span className="step-label">Patient Details</span>
            </div>
            <div className={`step-indicator ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
              <div className="step-bubble">{step > 2 ? '✓' : '2'}</div>
              <span className="step-label">Symptom Assessment</span>
            </div>
            <div className={`step-indicator ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
              <div className="step-bubble">3</div>
              <span className="step-label">Payment Options</span>
            </div>
          </div>

          <div className="divider"></div>

          {/* Form Step Switcher */}
          <AnimatePresence mode="wait">
            
            {/* STEP 1: PATIENT DETAILS */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="heading-sm" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiUser color="var(--primary)" /> Demographics & Date selection
                </h3>

                {/* Auto-filled Patient Info Header */}
                <div style={{ 
                  background: 'rgba(0, 217, 166, 0.04)', 
                  border: '1px solid rgba(0, 217, 166, 0.15)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '16px 20px', 
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(0, 217, 166, 0.1)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.1rem'
                  }}>
                    {formData.patientName ? formData.patientName.charAt(0).toUpperCase() : 'P'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      Booking for {formData.patientName || 'Patient'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {formData.gender ? `${formData.gender}, ` : ''}{formData.age ? `Age ${formData.age}` : ''} {formData.patientPhone ? `• Phone: ${formData.patientPhone}` : ''}
                    </div>
                  </div>
                </div>

                {/* Doctor Selection */}
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label className="form-label" style={{ fontWeight: '600', marginBottom: '12px' }}>Select Consulting Doctor *</label>
                  {loadingDoctors ? (
                    <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-sm)' }}></div>
                  ) : doctors.length === 0 ? (
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                      No doctors available at this hospital.
                    </div>
                  ) : (
                    <>
                      <div className="doctors-grid">
                        {doctors.map(doc => {
                          const isSelected = selectedDoctorId.toString() === doc.id.toString();
                          return (
                            <div 
                              key={doc.id} 
                              className={`doctor-grid-card ${isSelected ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedDoctorId(doc.id.toString());
                                setFormData(prev => ({ ...prev, timeSlot: '' })); // reset time slot on doctor change
                              }}
                            >
                              <div className="doctor-grid-avatar-wrapper">
                                <img 
                                  src={doc.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${doc.name.replace(" ", "")}`} 
                                  alt={doc.name} 
                                  className="doctor-grid-avatar"
                                />
                              </div>
                              <div className="doctor-grid-info">
                                <div className="doctor-grid-name">{doc.name}</div>
                                <div className="doctor-grid-specialty">{doc.specialization || 'General Physician'}</div>
                                <div className="doctor-grid-rating">
                                  <span className="doctor-grid-star">★</span> {doc.rating ? doc.rating.toFixed(1) : '4.5'} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Rating</span>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="doctor-grid-check">
                                  <FiCheckCircle />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Active Doctor Details Quick Info */}
                      {(() => {
                        const activeDoc = doctors.find(d => d.id.toString() === selectedDoctorId.toString());
                        if (!activeDoc) return null;
                        return (
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.01)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            fontSize: '0.82rem',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginTop: '-12px',
                            marginBottom: '24px'
                          }}>
                            <span>📅 Schedule: <strong>{activeDoc.workingDays || 'Mon-Fri'}</strong> ({activeDoc.workingHours || '09:00 AM - 05:00 PM'})</span>
                            <span>💵 Consultation Fee: <strong>₹{activeDoc.fees || hospital?.consultationRate || '500'}</strong></span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Preferred Appointment Date</label>
                  <div className="form-input-icon">
                    <FiCalendar className="icon" />
                    <input 
                      type="date" 
                      className="form-input" 
                      name="bookingDate"
                      value={formData.bookingDate}
                      onChange={handleInputChange}
                      min={getTodayString()}
                    />
                  </div>
                </div>

                {/* Available Slots Section */}
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Available Time Slots {loadingSlots && <span className="text-gradient" style={{ fontSize: '0.8rem', marginLeft: '8px' }}>(Loading...)</span>}</label>
                  
                  {!formData.bookingDate ? (
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <FiInfo style={{ marginRight: '6px' }} /> Please select an appointment date first to see available slots.
                    </div>
                  ) : loadingSlots ? (
                    <div className="slots-grid">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="skeleton" style={{ height: '42px', borderRadius: 'var(--radius-sm)' }}></div>
                      ))}
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div style={{ background: 'rgba(255,82,82,0.02)', border: '1px dashed var(--danger)', borderRadius: 'var(--radius-md)', padding: '20px', textAlign: 'center', color: 'var(--danger)' }}>
                      {(() => {
                        const busyStatus = getDoctorBusyStatus(hospital?.doctorId);
                        if ((busyStatus.mode === 'TODAY' || busyStatus.mode === 'ALL_DAY') && busyStatus.date === formData.bookingDate) {
                          return 'This doctor is busy all day on the selected date. Please choose another date or try again later.';
                        }
                        if (busyStatus.mode === 'AFTERNOON' && busyStatus.date === formData.bookingDate) {
                          return 'This doctor is busy this afternoon. Only morning slots are available if you choose a different morning date.';
                        }
                        return 'No available slots found for the chosen date. Try selecting another date.';
                      })()}
                    </div>
                  ) : (
                    <div className="slots-grid">
                      {availableSlots.map(slot => (
                        <div 
                          key={slot}
                          className={`slot-pill ${formData.timeSlot === slot ? 'selected' : ''}`}
                          onClick={() => setFormData(prev => ({ ...prev, timeSlot: slot }))}
                        >
                          {slot}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginTop: '24px' }}>
                  <label className="form-label">Consultation Type</label>
                  <div className="radio-card-group">
                    <div 
                      className={`radio-card ${formData.type === 'OFFLINE' ? 'selected' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, type: 'OFFLINE' }))}
                    >
                      <span className="radio-card-title">In-Person Checkup</span>
                      <span className="radio-card-desc">Visit the physical hospital for direct consultation.</span>
                    </div>
                    <div 
                      className={`radio-card ${formData.type === 'ONLINE' ? 'selected' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, type: 'ONLINE' }))}
                    >
                      <span className="radio-card-title">Online Video Consultation</span>
                      <span className="radio-card-desc">Consult the doctor securely from your home via browser video.</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
                  <button onClick={handleNextStep} className="btn btn-primary">
                    Next Step <FiArrowRight />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: INTAKE QUESTIONS */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="heading-sm" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiActivity color="var(--primary)" /> Symptom Assessment
                </h3>

                {/* Auto-filled Medical History Info */}
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '14px 18px', 
                  marginBottom: '24px',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '0.75rem' }}>
                    Linked Health Profile Details (From Signup)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Known Allergies:</span> <span style={{ color: 'var(--text-primary)' }}>{formData.allergies || 'None'}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Active Medications:</span> <span style={{ color: 'var(--text-primary)' }}>{formData.medications || 'None'}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>First Time Visit:</span> <span style={{ color: 'var(--text-primary)' }}>{formData.firstTime === 'yes' ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">What symptoms are you experiencing?</label>
                  <textarea 
                    className="form-input" 
                    name="symptoms"
                    rows="3"
                    value={formData.symptoms}
                    onChange={handleInputChange}
                    placeholder="Describe what symptoms you feel, their severity, etc."
                  ></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">How long have you had these symptoms?</label>
                  <select 
                    className="form-input" 
                    name="duration"
                    value={formData.duration}
                    onChange={handleInputChange}
                  >
                    <option value="">Choose Duration</option>
                    <option value="Less than 24 hours">Less than 24 hours</option>
                    <option value="1 to 3 days">1 to 3 days</option>
                    <option value="4 to 7 days">4 to 7 days</option>
                    <option value="1 to 2 weeks">1 to 2 weeks</option>
                    <option value="More than 2 weeks">More than 2 weeks</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Additional notes for the doctor (Optional)</label>
                  <textarea 
                    className="form-input" 
                    name="notes"
                    rows="2"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any extra details you wish to share..."
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                  <button onClick={handlePrevStep} className="btn btn-ghost">
                    <FiArrowLeft /> Back
                  </button>
                  <button onClick={handleNextStep} className="btn btn-primary">
                    Next Step <FiArrowRight />
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: PAYMENT METHOD */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="heading-sm" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCreditCard color="var(--primary)" /> Confirm payment & booking
                </h3>

                <div className="form-group">
                  <label className="form-label">Select Payment Preference</label>
                  <div className="radio-card-group" style={{ marginBottom: '24px' }}>
                    {formData.type !== 'ONLINE' && (
                      <div 
                        className={`radio-card ${formData.paymentMethod === 'CASH' ? 'selected' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'CASH' }))}
                      >
                        <span className="radio-card-title">Pay at Hospital Reception</span>
                        <span className="radio-card-desc">Pay by cash, card, or UPI when you arrive for checkup.</span>
                      </div>
                    )}
                    <div 
                      className={`radio-card ${formData.paymentMethod === 'ONLINE' ? 'selected' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'ONLINE' }))}
                    >
                      <span className="radio-card-title">Pay Online Now</span>
                      <span className="radio-card-desc">Prepay securely now to get immediate booking confirmation.</span>
                    </div>
                  </div>
                </div>

                {formData.paymentMethod === 'CASH' ? (
                  <div className="animate-fade-in" style={{ 
                    background: 'rgba(255, 179, 0, 0.05)', 
                    border: '1px solid rgba(255, 179, 0, 0.2)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: '24px',
                    marginBottom: '32px'
                  }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', margin: '0 0 8px 0', fontSize: '1rem' }}>
                      <FiInfo /> Pay at Reception Guidelines
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      Your booking will be logged in our system as **PENDING PAYMENT**. You must arrive at the hospital counter 15 minutes before your time slot (<strong>{formData.timeSlot}</strong>) on <strong>{formData.bookingDate}</strong> to clear the consultation charge of <strong>₹{hospital.consultationRate}</strong> and secure your token.
                    </p>
                  </div>
                ) : (
                  <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '32px' }}>
                    
                    {/* Sub-tabs selector for Online Method */}
                    <div style={{ display: 'flex', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', margin: '0 auto', maxWidth: '320px', width: '100%' }}>
                      <button 
                        type="button"
                        className={`btn btn-sm ${formData.onlineMethod === 'CARD' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, borderRadius: 'var(--radius-full)', padding: '8px 12px' }}
                        onClick={() => setFormData(prev => ({ ...prev, onlineMethod: 'CARD' }))}
                      >
                        <FiCreditCard /> Card
                      </button>
                      <button 
                        type="button"
                        className={`btn btn-sm ${formData.onlineMethod === 'UPI' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, borderRadius: 'var(--radius-full)', padding: '8px 12px' }}
                        onClick={() => setFormData(prev => ({ ...prev, onlineMethod: 'UPI' }))}
                      >
                        UPI
                      </button>
                    </div>

                    {/* Conditional Online Forms */}
                    {formData.onlineMethod === 'CARD' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Interactive Glassmorphic Card Mockup */}
                        <div className={`credit-card-wrapper ${isFlipped ? 'flipped' : ''}`}>
                          <div className="credit-card-inner">
                            {/* Front View */}
                            <div className="credit-card-front">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="card-chip"></div>
                                <div className="card-brand-logo">{getCardBrand(formData.cardNumber)}</div>
                              </div>
                              <div className="card-display-number">
                                {formData.cardNumber || '•••• •••• •••• ••••'}
                              </div>
                              <div className="card-display-info">
                                <div>
                                  <div className="card-display-label">Card Holder</div>
                                  <div className="card-display-val">{formData.cardName || 'YOUR NAME'}</div>
                                </div>
                                <div>
                                  <div className="card-display-label">Expires</div>
                                  <div className="card-display-val">{formData.cardExpiry || 'MM/YY'}</div>
                                </div>
                              </div>
                            </div>
                            {/* Back View */}
                            <div className="credit-card-back">
                              <div className="card-magnetic-stripe"></div>
                              <div>
                                <div className="card-signature-area">
                                  <span className="card-display-cvv">{formData.cardCvv || '•••'}</span>
                                </div>
                                <div style={{ padding: '0 20px', marginTop: '10px' }}>
                                  <div className="card-display-label" style={{ textAlign: 'right' }}>Security Code</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Fields Form */}
                        <div className="grid grid-2">
                          <div className="form-group">
                            <label className="form-label">Cardholder Name</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              name="cardName"
                              value={formData.cardName}
                              onChange={handleInputChange}
                              onFocus={() => setIsFlipped(false)}
                              placeholder="e.g. Rahul Sharma"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Card Number</label>
                            <div className="form-input-icon">
                              <FiCreditCard className="icon" />
                              <input 
                                type="text" 
                                className="form-input" 
                                name="cardNumber"
                                value={formData.cardNumber}
                                onChange={handleCardNumberChange}
                                onFocus={() => setIsFlipped(false)}
                                placeholder="4532 0124 5874 9632"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-2">
                          <div className="form-group">
                            <label className="form-label">Expiration Date (MM/YY)</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              name="cardExpiry"
                              value={formData.cardExpiry}
                              onChange={handleExpiryChange}
                              onFocus={() => setIsFlipped(false)}
                              placeholder="12/28"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Security CVV (3 Digits)</label>
                            <input 
                              type="password" 
                              className="form-input" 
                              name="cardCvv"
                              value={formData.cardCvv}
                              onChange={handleCvvChange}
                              onFocus={() => setIsFlipped(true)}
                              onBlur={() => setIsFlipped(false)}
                              placeholder="***"
                              maxLength="3"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {formData.onlineMethod === 'UPI' && (
                      <div className="animate-fade-in" style={{ 
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '32px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px'
                      }}>
                        {/* Sub-providers select: GPay, Paytm, PhonePe */}
                        <div>
                          <label className="form-label" style={{ marginBottom: '10px' }}>Select UPI App</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              type="button"
                              className={`slot-pill ${formData.upiProvider === 'GPAY' ? 'selected' : ''}`}
                              style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                              onClick={() => setFormData(prev => ({ ...prev, upiProvider: 'GPAY' }))}
                            >
                              Google Pay
                            </button>
                            <button
                              type="button"
                              className={`slot-pill ${formData.upiProvider === 'PAYTM' ? 'selected' : ''}`}
                              style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                              onClick={() => setFormData(prev => ({ ...prev, upiProvider: 'PAYTM' }))}
                            >
                              Paytm
                            </button>
                            <button
                              type="button"
                              className={`slot-pill ${formData.upiProvider === 'PHONEPE' ? 'selected' : ''}`}
                              style={{ flex: 1, padding: '10px', fontSize: '0.85rem' }}
                              onClick={() => setFormData(prev => ({ ...prev, upiProvider: 'PHONEPE' }))}
                            >
                              PhonePe
                            </button>
                          </div>
                        </div>

                        {/* UPI ID entry with Verify Action */}
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">Enter UPI ID</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <div className="form-input-icon" style={{ flex: 1 }}>
                              <FiUser className="icon" />
                              <input 
                                type="text" 
                                className="form-input" 
                                name="upiId"
                                value={formData.upiId}
                                onChange={handleInputChange}
                                placeholder="username@bankname"
                                style={{ paddingRight: '12px' }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleVerifyUpi}
                              className={`btn ${upiVerified ? 'btn-ghost' : 'btn-primary'}`}
                              disabled={verifyingUpi || !formData.upiId.trim()}
                              style={{ 
                                minWidth: '100px', 
                                height: '50px',
                                border: upiVerified ? '1px solid var(--success)' : '',
                                color: upiVerified ? 'var(--success)' : '',
                                background: upiVerified ? 'transparent' : ''
                              }}
                            >
                              {verifyingUpi ? 'Verifying...' : upiVerified ? '✓ Verified' : 'Verify'}
                            </button>
                          </div>

                          {/* Verification result below the field */}
                          {verifyingUpi && (
                            <div className="animate-fade-in" style={{ 
                              fontSize: '0.82rem', 
                              color: 'var(--text-secondary)', 
                              marginTop: '10px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              padding: '12px 16px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '10px'
                            }}>
                              <div style={{
                                width: '16px', height: '16px', borderRadius: '50%',
                                border: '2px solid var(--primary)', borderTopColor: 'transparent',
                                animation: 'spin 0.8s linear infinite'
                              }}></div>
                              <span>Verifying with NPCI... Fetching account holder details</span>
                            </div>
                          )}

                          {upiVerified && verifiedName && (
                            <div className="animate-fade-in" style={{ 
                              marginTop: '12px', 
                              padding: '16px 18px', 
                              background: 'rgba(0, 217, 166, 0.04)', 
                              border: '1px solid rgba(0, 217, 166, 0.2)', 
                              borderRadius: '12px',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <FiCheckCircle color="var(--success)" size={18} />
                                <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  NPCI Verified
                                </span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Account Holder Name</span>
                                  <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '700' }}>
                                    {verifiedName}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Linked Bank</span>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                                    {verifiedBank}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>UPI ID</span>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500', fontFamily: 'monospace' }}>
                                    {formData.upiId}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {!upiVerified && !verifyingUpi && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                              Enter your UPI ID and click Verify. The real account holder name linked to this UPI will be shown.
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem', justifyContent: 'center' }}>
                      <FiShield color="var(--success)" /> Fully encrypted, secure 256-bit SSL transaction gateway.
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
                  <button onClick={handlePrevStep} className="btn btn-ghost" disabled={submitting}>
                    <FiArrowLeft /> Back
                  </button>
                  <button 
                    onClick={handleConfirmBooking} 
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      'Processing...'
                    ) : formData.paymentMethod === 'ONLINE' ? (
                      `Pay ₹${hospital.consultationRate} & Confirm`
                    ) : (
                      'Confirm Booking'
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar Summary Widget */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 className="heading-sm" style={{ margin: '0 0 4px 0' }}>{hospital.name}</h3>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiMapPin /> {hospital.city}, {hospital.state}
            </span>
          </div>

          <div className="divider" style={{ margin: '8px 0' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span className="form-label" style={{ margin: 0 }}>Consulting Practitioner</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="avatar">{hospital.doctorName?.charAt(0).toUpperCase()}</div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>{hospital.doctorName}</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Resident Doctor</span>
              </div>
            </div>
          </div>

          <div className="divider" style={{ margin: '8px 0' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Consultation fee:</span>
              <strong style={{ color: 'var(--primary)' }}>₹{hospital.consultationRate}</strong>
            </div>

            {formData.bookingDate && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><FiCalendar /> Date:</span>
                <span>{formData.bookingDate}</span>
              </div>
            )}

            {formData.timeSlot && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><FiClock /> Time:</span>
                <span>{formData.timeSlot}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><FiFileText /> Type:</span>
              <span>{formData.type === 'ONLINE' ? 'Video call' : 'Physical Visit'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Mock Razorpay Gateway Sandbox Modal */}
      {showMockRazorpay && mockRzpOptions && (
        <div className="mock-rzp-overlay">
          <div className="mock-rzp-modal">
            <div className="mock-rzp-header">
              <div className="mock-rzp-brand">
                <span className="mock-rzp-logo">Razorpay</span>
                <span className="mock-rzp-badge">Sandbox Simulator</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                <FiShield color="#00d9a6" /> Secure
              </div>
            </div>
            <div className="mock-rzp-body">
              <div className="mock-rzp-amount-section">
                <div className="mock-rzp-amount">₹{mockRzpOptions.amount / 100}</div>
                <div className="mock-rzp-orderid">Order ID: {mockRzpOptions.order_id}</div>
              </div>

              <div className="mock-rzp-details">
                <div className="mock-rzp-row">
                  <span className="mock-rzp-label">Beneficiary:</span>
                  <span className="mock-rzp-val">{mockRzpOptions.name}</span>
                </div>
                <div className="mock-rzp-row">
                  <span className="mock-rzp-label">Description:</span>
                  <span className="mock-rzp-val" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mockRzpOptions.description}
                  </span>
                </div>
                <div className="mock-rzp-row">
                  <span className="mock-rzp-label">Patient Contact:</span>
                  <span className="mock-rzp-val">{mockRzpOptions.prefill?.contact}</span>
                </div>
                <div className="mock-rzp-row">
                  <span className="mock-rzp-label">Online Method:</span>
                  <span className="mock-rzp-val" style={{ textTransform: 'uppercase', color: '#00d9a6' }}>
                    {formData.onlineMethod}
                  </span>
                </div>
              </div>

              <div className="mock-rzp-warning">
                <FiInfo style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Sandbox Mode:</strong> Real Razorpay credentials are not configured. Click "Confirm Payment" to confirm your booking.
                </span>
              </div>

              <div className="mock-rzp-actions">
                <button 
                  type="button" 
                  className="mock-rzp-btn-success"
                  onClick={() => {
                    mockRzpOptions.handler({
                      razorpay_payment_id: 'pay_mock_' + Math.random().toString(36).substring(2, 11),
                      razorpay_order_id: mockRzpOptions.order_id,
                      razorpay_signature: 'sig_mock_' + Math.random().toString(36).substring(2, 11)
                    });
                  }}
                >
                  <FiCheckCircle /> Confirm Payment
                </button>
                <button 
                  type="button" 
                  className="mock-rzp-btn-fail"
                  onClick={() => {
                    mockRzpOptions.modal.ondismiss();
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
