import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { authAPI, otpAPI, hospitalAPI, fileAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiArrowLeft, FiUser, FiPhone, FiMapPin, FiCheck, FiShield, FiRefreshCw } from 'react-icons/fi';
import { FaHeartbeat, FaUserMd, FaUser, FaStore, FaHospital, FaFlask } from 'react-icons/fa';
import './Auth.css';
import logo from '../assets/medastrax-logo.png';

const cleanPhoneNumber = (val) => {
  if (!val) return '';
  return val.replace(/\D/g, '').slice(0, 10);
};

export default function SignupPage() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', role: 'PATIENT', address: '', city: '',
    hospitalId: '', specialization: '', specializationOther: '', licenseNo: '', workingHours: '09:00 - 18:00', workingDays: [], inPersonConsultation: true, onlineConsultation: false, fees: '',
    hospitalType: [], hospitalTypeOther: '',
    ambulanceNumber: '', driverName: '', driverPhone: '', ambulanceRegistrationId: '',
    hospitalPreference: [],
    shopName: '', location: '',
    // Pharmacy specific
    providesDelivery: false,
    deliveryCharges: '',
    pharmacyType: 'INDEPENDENT', // or 'ASSOCIATED'
    pharmacyHospitalId: '',
    pharmacyPhoto: null,
    profilePhoto: '',
    // Patient specific
    dob: '',
    age: '',
    gender: '',
    bloodGroup: '',
    emergencyNumber: '',
    preferredLanguage: '',
    existingMedicalCondition: '',
    idProof: '',
    allergies: '',
    currentMedication: '',
    prescriptionReportUrl: '',
    hasConsultedBefore: false,
  });
  const [uploadingPrescription, setUploadingPrescription] = useState(false);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otherSpeciality, setOtherSpeciality] = useState('');
  const [otherFacility, setOtherFacility] = useState('');

  // T&C states
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(false);

  // Captcha states
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const captchaCanvasRef = useRef(null);

  // OTP states
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', '']);
  const [phoneOtp, setPhoneOtp] = useState(['', '', '', '', '', '']);
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [phoneResendTimer, setPhoneResendTimer] = useState(0);
  const [licenseVerified, setLicenseVerified] = useState(false);
  const [licenseVerifying, setLicenseVerifying] = useState(false);
  const licenseCheckTimeout = useRef(null);
  const [pharmacyLicenseVerified, setPharmacyLicenseVerified] = useState(false);
  const [pharmacyLicenseVerifying, setPharmacyLicenseVerifying] = useState(false);
  const pharmacyLicenseCheckTimeout = useRef(null);

  const emailOtpRefs = useRef([]);
  const phoneOtpRefs = useRef([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Countdown timers
  useEffect(() => {
    if (emailResendTimer > 0) {
      const timer = setTimeout(() => setEmailResendTimer(emailResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailResendTimer]);

  useEffect(() => {
    if (phoneResendTimer > 0) {
      const timer = setTimeout(() => setPhoneResendTimer(phoneResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneResendTimer]);

  const checkPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (pwd.length >= 10 && score > 0) score = Math.min(score + 1, 4);

    let label = 'Weak';
    let color = '#ff5252'; // Red
    if (score === 2) {
      label = 'Fair';
      color = '#ff9800'; // Orange
    } else if (score === 3) {
      label = 'Good';
      color = '#ffeb3b'; // Yellow
    } else if (score >= 4) {
      label = 'Strong';
      color = '#00d9a6'; // Emerald/Green
    }
    return { score, label, color };
  };

  // Captcha and T&C helpers
  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaCode(code);
    setCaptchaInput('');
  };

  useEffect(() => {
    if (step === 1) {
      generateCaptcha();
    }
  }, [step, formData.role]);

  useEffect(() => {
    if (captchaCode && captchaCanvasRef.current) {
      const canvas = captchaCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background noise
      ctx.fillStyle = 'rgba(0, 217, 166, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw lines
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `rgba(0, 217, 166, ${Math.random() * 0.4 + 0.1})`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
      }

      // Draw random characters
      ctx.textBaseline = 'middle';
      for (let i = 0; i < captchaCode.length; i++) {
        const char = captchaCode[i];
        ctx.font = `bold ${24 + Math.random() * 6}px Courier New`;
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2 + 0.8})`;
        
        const x = 16 + i * 26 + (Math.random() - 0.5) * 4;
        const y = canvas.height / 2 + (Math.random() - 0.5) * 8;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 0.4);
        ctx.fillText(char, 0, 0);
        ctx.restore();
      }
    }
  }, [captchaCode, step]);

  const handleOpenTerms = async () => {
    setShowTermsModal(true);
    setLoadingTerms(true);
    try {
      const roleLower = formData.role.toLowerCase();
      const filename = `/terms-conditions-${roleLower}.txt`;
      const res = await fetch(filename);
      if (!res.ok) throw new Error();
      const text = await res.text();
      setTermsContent(text);
    } catch (err) {
      setTermsContent("MedAstraX Terms and Conditions:\n\nFailed to load terms file. Please try again later.");
    } finally {
      setLoadingTerms(false);
    }
  };

  // License verification on input change (debounced)
  const verifyLicenseInRealTime = (licenseNo) => {
    if (licenseCheckTimeout.current) {
      clearTimeout(licenseCheckTimeout.current);
    }

    if (!licenseNo || licenseNo.length === 0) {
      setLicenseVerified(false);
      setLicenseVerifying(false);
      return;
    }

    setLicenseVerifying(true);
    licenseCheckTimeout.current = setTimeout(async () => {
      try {
        const res = await authAPI.verifyLicense(licenseNo);
        if (res.data.success) {
          setLicenseVerified(true);
          toast.success('Doctor license verified! ✅');
        } else {
          setLicenseVerified(false);
          toast.error('Invalid license number.');
        }
      } catch (error) {
        setLicenseVerified(false);
        toast.error('License verification failed.');
      } finally {
        setLicenseVerifying(false);
      }
    }, 800);
  };

  const verifyPharmacyInRealTime = (licenseNo) => {
    if (pharmacyLicenseCheckTimeout.current) {
      clearTimeout(pharmacyLicenseCheckTimeout.current);
    }

    if (!licenseNo || licenseNo.length === 0) {
      setPharmacyLicenseVerified(false);
      setPharmacyLicenseVerifying(false);
      return;
    }

    setPharmacyLicenseVerifying(true);
    pharmacyLicenseCheckTimeout.current = setTimeout(async () => {
      try {
        const res = await authAPI.verifyPharmacyLicense(licenseNo);
        if (res.data.success) {
          setPharmacyLicenseVerified(true);
          toast.success('Pharmacy license verified! ✅');
        } else {
          setPharmacyLicenseVerified(false);
          toast.error('Invalid pharmacy license number.');
        }
      } catch (error) {
        setPharmacyLicenseVerified(false);
        toast.error('Pharmacy license verification failed.');
      } finally {
        setPharmacyLicenseVerifying(false);
      }
    }, 800);
  };

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await hospitalAPI.getAll();
        setHospitals(res.data);
      } catch (error) {
        toast.error('Unable to load hospitals');
      }
    };
    fetchHospitals();
  }, []);

  const updateField = (field, value) => {
    setFormData((prev) => {
      if (field === 'specialization' && value !== 'Other') {
        return { ...prev, [field]: value, specializationOther: '' };
      }
      if (field === 'hospitalType' && value !== 'Other') {
        return { ...prev, [field]: value, hospitalTypeOther: '' };
      }
      return { ...prev, [field]: value };
    });
  };

  const toggleWorkingDay = (day) => {
    setFormData((prev) => {
      const workingDays = prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays };
    });
  };

  const filteredHospitals = hospitals.filter((hospital) => {
    if (!hospitalSearch) return true;
    return hospital.name.toLowerCase().includes(hospitalSearch.toLowerCase())
      || hospital.city.toLowerCase().includes(hospitalSearch.toLowerCase())
      || hospital.state.toLowerCase().includes(hospitalSearch.toLowerCase());
  });

  const selectHospital = (hospital) => {
    setSelectedHospital(hospital);
    setFormData(prev => ({ ...prev, hospitalId: hospital.id }));
    setHospitalSearch(hospital.name);
  };

  // OTP input handler
  const handleOtpChange = (index, value, otpArray, setOtpArray, refs) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpArray];
    newOtp[index] = value.slice(-1);
    setOtpArray(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e, otpArray, setOtpArray, refs) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e, setOtpArray, refs) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpArray(pasted.split(''));
      refs.current[5]?.focus();
    }
  };

  // Send Email OTP
  const sendEmailOtp = async () => {
    if (!formData.email) {
      toast.error('Please enter your email first');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setEmailSending(true);
    try {
      await otpAPI.sendOtp(formData.email, 'EMAIL');
      setEmailOtpSent(true);
      setEmailResendTimer(60);
      toast.success('OTP sent to your email! 📧');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setEmailSending(false);
    }
  };

  // Verify Email OTP
  const verifyEmailOtp = async () => {
    const otp = emailOtp.join('');
    if (otp.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setEmailVerifying(true);
    try {
      await otpAPI.verifyOtp(formData.email, 'EMAIL', otp);
      setEmailVerified(true);
      toast.success('Email verified successfully! ✅');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid OTP');
      setEmailOtp(['', '', '', '', '', '']);
      emailOtpRefs.current[0]?.focus();
    } finally {
      setEmailVerifying(false);
    }
  };

  // Send Phone OTP
  const sendPhoneOtp = async () => {
    if (!formData.phone) {
      toast.error('Please enter your phone number first');
      return;
    }
    if (formData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setPhoneSending(true);
    try {
      await otpAPI.sendOtp(formData.phone, 'PHONE');
      setPhoneOtpSent(true);
      setPhoneResendTimer(60);
      toast.success('OTP sent to your phone! 📱 (Check backend logs)');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setPhoneSending(false);
    }
  };

  // Verify Phone OTP
  const verifyPhoneOtp = async () => {
    const otp = phoneOtp.join('');
    if (otp.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setPhoneVerifying(true);
    try {
      await otpAPI.verifyOtp(formData.phone, 'PHONE', otp);
      setPhoneVerified(true);
      toast.success('Phone verified successfully! ✅');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid OTP');
      setPhoneOtp(['', '', '', '', '', '']);
      phoneOtpRefs.current[0]?.focus();
    } finally {
      setPhoneVerifying(false);
    }
  };

  // Step navigation
  const handleNext = () => {
    if (step === 1) {
      if (!formData.name) {
        toast.error('Please enter your name.');
        return;
      }
      if (formData.role === 'PATIENT') {
        if (!formData.city) {
          toast.error('Please enter your city.');
          return;
        }
        if (!formData.address) {
          toast.error('Please enter your address.');
          return;
        }
        if (!formData.dob) {
          toast.error('Please enter your date of birth.');
          return;
        }
        if (!formData.age) {
          toast.error('Please enter your age.');
          return;
        }
        if (!formData.gender) {
          toast.error('Please select your gender.');
          return;
        }
        if (!formData.bloodGroup) {
          toast.error('Please select your blood group.');
          return;
        }
        if (!formData.emergencyNumber) {
          toast.error('Please enter emergency contact number.');
          return;
        }
        if (formData.emergencyNumber.length !== 10) {
          toast.error('Emergency contact number must be exactly 10 digits.');
          return;
        }
        if (!formData.preferredLanguage) {
          toast.error('Please enter preferred language.');
          return;
        }
        if (!formData.idProof) {
          toast.error('Please enter ID proof details.');
          return;
        }
        if (formData.hasConsultedBefore && !formData.prescriptionReportUrl) {
          toast.error('Please upload your prescription.');
          return;
        }
        if (!formData.hospitalPreference || formData.hospitalPreference.length === 0) {
          toast.error('Please select at least one preferred hospital type.');
          return;
        }
      }

      if (formData.role === 'HOSPITAL') {
        if (!formData.registrationNo) {
          toast.error('Please enter registration number.');
          return;
        }
        if (!formData.hospitalType || formData.hospitalType.length === 0) {
          toast.error('Please select hospital type.');
          return;
        }
        if ((Array.isArray(formData.hospitalType) ? formData.hospitalType.includes('Other') : formData.hospitalType === 'Other') && !formData.hospitalTypeOther) {
          toast.error('Please specify hospital type.');
          return;
        }
        if (!formData.address) {
          toast.error('Please enter hospital address.');
          return;
        }
        if (!formData.city) {
          toast.error('Please enter city.');
          return;
        }
        if (!formData.state) {
          toast.error('Please enter state.');
          return;
        }
        if (!formData.pincode) {
          toast.error('Please enter pincode.');
          return;
        }
        if (!formData.totalBeds) {
          toast.error('Please enter total beds.');
          return;
        }
        if (formData.availableBeds === undefined || formData.availableBeds === '') {
          toast.error('Please enter available beds.');
          return;
        }
        if (!formData.images || formData.images.length === 0) {
          toast.error('Please upload a hospital photo.');
          return;
        }
      }

      if (formData.role === 'DOCTOR') {
        if (!formData.hospitalId) {
          toast.error('Please select your hospital or clinic.');
          return;
        }
        if (!formData.specialization) {
          toast.error('Please select your specialization.');
          return;
        }
        if (formData.specialization === 'Other' && !formData.specializationOther) {
          toast.error('Please specify your specialization.');
          return;
        }
        if (!formData.licenseNo) {
          toast.error('Please enter your license number.');
          return;
        }
        if (!licenseVerified) {
          toast.error('Please use a valid license number.');
          return;
        }
        if (!formData.workingHours) {
          toast.error('Please enter your working hours.');
          return;
        }
        if (formData.workingDays.length === 0) {
          toast.error('Please select at least one working day.');
          return;
        }
        if (!formData.inPersonConsultation && !formData.onlineConsultation) {
          toast.error('Please choose at least one consultation type.');
          return;
        }
        if (!formData.fees) {
          toast.error('Please enter your consultation fee.');
          return;
        }
      }
      if (formData.role === 'PHARMACY') {
        if (!formData.licenseNo) {
          toast.error('Please enter your pharmacy license number.');
          return;
        }
        if (!pharmacyLicenseVerified) {
          toast.error('Please use a valid pharmacy license number.');
          return;
        }
        if (formData.pharmacyType === 'INDEPENDENT') {
          if (!formData.shopName) {
            toast.error('Please enter your pharmacy shop name.');
            return;
          }
          if (!formData.location) {
            toast.error('Please enter pharmacy address.');
            return;
          }
        } else if (formData.pharmacyType === 'ASSOCIATED') {
          if (!formData.pharmacyHospitalId && !formData.hospitalId) {
            toast.error('Please select the associated hospital.');
            return;
          }
        }
        if (formData.providesDelivery && !formData.deliveryCharges) {
          toast.error('Please enter delivery charges.');
          return;
        }
      }

      // Profile Photo check (for PATIENT, DOCTOR, PHARMACY)
      if (formData.role !== 'HOSPITAL' && !formData.profilePhoto) {
        toast.error('Please upload your profile photo.');
        return;
      }

      // Terms & Conditions check
      if (!agreeToTerms) {
        toast.error('You must agree to the terms and conditions of MedAstraX to continue.');
        return;
      }

      // Captcha check
      if (!captchaInput) {
        toast.error('Please enter the captcha code.');
        return;
      }
      if (captchaInput.toLowerCase() !== captchaCode.toLowerCase()) {
        toast.error('Incorrect captcha code. Please try again.');
        generateCaptcha();
        return;
      }
    }
    if (step === 2) {
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        toast.error('Please fill in all required fields.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters.');
        return;
      }
      if (formData.phone && formData.phone.length !== 10) {
        toast.error('Phone number must be exactly 10 digits.');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formData.role === 'DOCTOR') {
        if (!formData.hospitalId) {
          throw new Error('Please select the hospital where you work.');
        }
        if (!formData.specialization) {
          throw new Error('Please select your specialization.');
        }
        if (formData.specialization === 'Other' && !formData.specializationOther) {
          throw new Error('Please specify your specialization.');
        }
        if (!formData.licenseNo) {
          throw new Error('Please enter your license number.');
        }
        if (!formData.workingHours) {
          throw new Error('Please enter your working hours.');
        }
        if (!formData.workingDays.length) {
          throw new Error('Please select at least one working day.');
        }
        if (!formData.inPersonConsultation && !formData.onlineConsultation) {
          throw new Error('Please select at least one consultation type.');
        }
        if (!formData.fees) {
          throw new Error('Please set your consultation fees.');
        }
      }

      const response = await authAPI.signup({
        ...formData,
        hospitalType: Array.isArray(formData.hospitalType) 
          ? (formData.hospitalType.includes('Other') ? formData.hospitalTypeOther || 'Other' : formData.hospitalType.join(',')) 
          : (formData.hospitalType === 'Other' ? formData.hospitalTypeOther : formData.hospitalType),
        hospitalPreference: Array.isArray(formData.hospitalPreference) ? formData.hospitalPreference.join(',') : formData.hospitalPreference,
        specialization: formData.specialization === 'Other' ? formData.specializationOther : formData.specialization,
        workingDays: Array.isArray(formData.workingDays) ? formData.workingDays.join(',') : formData.workingDays,
      });
      login(response.data);
      toast.success('Account created successfully! 🎉');

      const role = response.data.role;
      if (role === 'DOCTOR') navigate('/doctor/dashboard');
      else if (role === 'PHARMACY') navigate('/pharmacy/dashboard');
      else if (role === 'HOSPITAL') navigate('/hospital/dashboard');
      else if (role === 'LAB') navigate('/lab/dashboard');
      else navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Signup failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { key: 'PATIENT', label: 'Patient', icon: <FaUser />, desc: 'Book consultations & manage health' },
    { key: 'DOCTOR', label: 'Doctor', icon: <FaUserMd />, desc: 'Manage hospital & prescriptions' },
    { key: 'PHARMACY', label: 'Pharmacy', icon: <FaStore />, desc: 'View prescriptions & set prices' },
    { key: 'HOSPITAL', label: 'Hospital', icon: <FaHospital />, desc: 'Register a hospital and manage listings' },
    { key: 'LAB', label: 'Diagnostic Lab', icon: <FaFlask />, desc: 'Manage tests & process reports' },
  ];

  const stepLabels = ['Role', 'Details', 'Account', 'Verify'];
  const totalSteps = 4;

  // OTP input renderer
  const renderOtpInputs = (otpArray, setOtpArray, refs, verified, verifying, onVerify) => (
    <div className="otp-input-group">
      <div className="otp-boxes">
        {otpArray.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (refs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className={`otp-box ${digit ? 'filled' : ''} ${verified ? 'verified' : ''}`}
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value, otpArray, setOtpArray, refs)}
            onKeyDown={(e) => handleOtpKeyDown(index, e, otpArray, setOtpArray, refs)}
            onPaste={(e) => handleOtpPaste(e, setOtpArray, refs)}
            disabled={verified}
            autoComplete="one-time-code"
          />
        ))}
      </div>
      {!verified && (
        <button
          type="button"
          className="btn btn-primary btn-sm otp-verify-btn"
          onClick={onVerify}
          disabled={verifying || otpArray.join('').length !== 6}
        >
          {verifying ? <div className="spinner spinner-sm"></div> : <><FiCheck /> Verify</>}
        </button>
      )}
      {verified && (
        <motion.div
          className="otp-verified-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <FiCheck /> Verified
        </motion.div>
      )}
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-bg-effects">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
        <div className="floating-icons">
          {['💊', '🏥', '🩺', '❤️', '🧬', '💉'].map((icon, i) => (
            <span key={i} className="floating-icon" style={{
              left: `${15 + i * 15}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${6 + i}s`
            }}>{icon}</span>
          ))}
        </div>
      </div>

      <motion.div
        className="auth-card signup-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="auth-header">
          <Link to="/" className="auth-logo">
            <img src={logo} alt="MedAstraX Logo" className="auth-logo-img" />
            <div className="brand-text-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
              <span className="brand-text"><span className="brand-med">Med</span><span className="brand-astra">Astra</span><span className="brand-x">X</span></span>
              <span className="brand-tagline" style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.4px', marginTop: '1px' }}>Innovate • Heal • Evolve</span>
            </div>
          </Link>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join the healthcare revolution</p>
        </div>

        {/* Progress Steps */}
        <div className="signup-progress">
          {Array.from({ length: totalSteps }).map((_, s) => (
            <div key={s} className={`progress-step ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}>
              <div className="step-number">
                {step > s ? <FiCheck size={14} /> : s + 1}
              </div>
              <span className="step-label">{stepLabels[s]}</span>
            </div>
          ))}
          <div className="progress-line">
            <div className="progress-fill" style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          <AnimatePresence mode="wait">
            {/* Step 0: Role Selection */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <div className="role-grid">
                  {roles.map((role) => (
                    <motion.div
                      key={role.key}
                      className={`role-card grid-card ${formData.role === role.key ? 'selected' : ''}`}
                      onClick={() => { updateField('role', role.key); setStep(1); }}
                      whileHover={{ y: -8, scale: 1.02 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <div className="role-icon">{role.icon}</div>
                      <div className="role-info">
                        <h3>{role.label}</h3>
                        <p>{role.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 1: Details */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="form-input-icon">
                    <FiUser className="icon" />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter your full name"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      autoComplete="off"
                      name="new-name"
                    />
                  </div>
                </div>

                {formData.role === 'PATIENT' && (
                  <>
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ margin: 0 }}>City</label>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '0.8rem' }}
                          onClick={() => {
                            if (!navigator.geolocation) {
                              toast.error('Geolocation is not supported by your browser');
                              return;
                            }
                            const toastId = toast.loading('Fetching GPS coordinates...');
                            navigator.geolocation.getCurrentPosition(
                              async (position) => {
                                const lat = position.coords.latitude;
                                const lng = position.coords.longitude;
                                updateField('latitude', lat);
                                updateField('longitude', lng);
                                toast.success(`GPS Coords: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, { id: toastId });

                                // Reverse Geocode
                                try {
                                  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                                    headers: { 'Accept-Language': 'en' }
                                  });
                                  const data = await response.json();
                                  if (data && data.address) {
                                    const addr = data.display_name || '';
                                    const city = data.address.city || data.address.town || data.address.village || '';

                                    updateField('address', addr);
                                    updateField('city', city);
                                    toast.success('Address auto-filled using GPS! 📍');
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                              },
                              (error) => {
                                toast.error('Error fetching location: ' + error.message, { id: toastId });
                              }
                            );
                          }}
                        >
                          📍 Get GPS Location
                        </button>
                      </div>
                      <div className="form-input-icon">
                        <FiMapPin className="icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter your city"
                          value={formData.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          autoComplete="off"
                          name="new-city"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <div className="form-input-icon">
                        <FiMapPin className="icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter your address"
                          value={formData.address}
                          onChange={(e) => updateField('address', e.target.value)}
                          autoComplete="off"
                          name="new-address"
                        />
                      </div>
                    </div>


                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        className="form-input"
                        value={formData.dob}
                        onChange={(e) => {
                          updateField('dob', e.target.value);
                          if (e.target.value) {
                            const birthDate = new Date(e.target.value);
                            const today = new Date();
                            let age = today.getFullYear() - birthDate.getFullYear();
                            const m = today.getMonth() - birthDate.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                              age--;
                            }
                            updateField('age', age);
                          }
                        }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Age</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Enter your age"
                        value={formData.age}
                        onChange={(e) => updateField('age', e.target.value)}
                        min="0"
                        max="120"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select
                        className="form-input"
                        value={formData.gender}
                        onChange={(e) => updateField('gender', e.target.value)}
                      >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Blood Group</label>
                      <select
                        className="form-input"
                        value={formData.bloodGroup}
                        onChange={(e) => updateField('bloodGroup', e.target.value)}
                      >
                        <option value="">Select Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Emergency Phone Number</label>
                      <div className="form-input-icon">
                        <FiPhone className="icon" />
                        <input
                          type="tel"
                          className="form-input"
                          placeholder="Emergency contact number"
                          value={formData.emergencyNumber}
                          onChange={(e) => updateField('emergencyNumber', cleanPhoneNumber(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Preferred Language</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. English, Hindi, Spanish"
                        value={formData.preferredLanguage}
                        onChange={(e) => updateField('preferredLanguage', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">ID Proof (Aadhar / DL / Passport)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter ID proof details"
                        value={formData.idProof}
                        onChange={(e) => updateField('idProof', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Existing Medical Conditions</label>
                      <textarea
                        className="form-input"
                        placeholder="Describe any existing medical conditions (optional)"
                        value={formData.existingMedicalCondition}
                        onChange={(e) => updateField('existingMedicalCondition', e.target.value)}
                        style={{ minHeight: '80px', padding: '12px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Allergies</label>
                      <textarea
                        className="form-input"
                        placeholder="Describe any allergies you have (optional)"
                        value={formData.allergies}
                        onChange={(e) => updateField('allergies', e.target.value)}
                        style={{ minHeight: '80px', padding: '12px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Current Medication</label>
                      <textarea
                        className="form-input"
                        placeholder="List medications you are currently taking (optional)"
                        value={formData.currentMedication}
                        onChange={(e) => updateField('currentMedication', e.target.value)}
                        style={{ minHeight: '80px', padding: '12px' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label className="form-label">Preferred Hospital Type * (Select one or more)</label>
                      <div className="checkbox-grid">
                        {['Government Hospital', 'Private Hospital', 'NGO-run Hospital', 'Clinic'].map((type) => {
                          const list = formData.hospitalPreference || [];
                          const isChecked = list.includes(type);

                          return (
                            <label key={type} className={`checkbox-pill ${isChecked ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const updated = isChecked
                                    ? list.filter(t => t !== type)
                                    : [...list, type];
                                  updateField('hospitalPreference', updated);
                                }}
                              />
                              {type}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label className="checkbox-pill" style={{ display: 'inline-flex', padding: '8px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '24px', cursor: 'pointer', gap: '8px', width: '100%' }}>
                        <input
                          type="checkbox"
                          checked={formData.hasConsultedBefore}
                          onChange={(e) => {
                            updateField('hasConsultedBefore', e.target.checked);
                            if (!e.target.checked) {
                              updateField('prescriptionReportUrl', '');
                            }
                          }}
                        />
                        Have you consulted a doctor before coming to our website?
                      </label>
                    </div>

                    {formData.hasConsultedBefore && (
                      <div className="form-group" style={{ padding: '16px', border: '1px dashed var(--primary)', borderRadius: '12px', background: 'rgba(0, 217, 166, 0.02)', marginTop: '16px' }}>
                        <label className="form-label">Upload Prescription</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              setUploadingPrescription(true);
                              const uploadToast = toast.loading('Uploading prescription...');
                              try {
                                const res = await fileAPI.upload(file);
                                if (res.data.success) {
                                  updateField('prescriptionReportUrl', res.data.message);
                                  toast.success('Prescription uploaded successfully! ✅', { id: uploadToast });
                                } else {
                                  toast.error(res.data.message || 'Upload failed', { id: uploadToast });
                                }
                              } catch (error) {
                                toast.error('File upload failed. Please try again.', { id: uploadToast });
                              } finally {
                                setUploadingPrescription(false);
                              }
                            }}
                            style={{ display: 'none' }}
                            id="prescription-upload-file"
                          />
                          <label
                            htmlFor="prescription-upload-file"
                            className="btn btn-outline"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}
                          >
                            {uploadingPrescription ? 'Uploading...' : 'Choose Prescription File'}
                          </label>

                          {formData.prescriptionReportUrl && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#10b981', marginTop: '4px' }}>
                              <FiCheck /> Uploaded prescription file: {formData.prescriptionReportUrl.split('/').pop()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {formData.role === 'HOSPITAL' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Hospital Registration Number *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter official registration/license number"
                        value={formData.registrationNo || ''}
                        onChange={(e) => updateField('registrationNo', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Hospital Type * (Select one or more)</label>
                      <div className="checkbox-grid">
                        {['Government Hospital', 'Private Hospital', 'NGO-run Hospital', 'Clinic', 'Other'].map((type) => {
                          const list = Array.isArray(formData.hospitalType) ? formData.hospitalType : (formData.hospitalType ? [formData.hospitalType] : []);
                          const isChecked = list.includes(type);

                          return (
                            <label key={type} className={`checkbox-pill ${isChecked ? 'checked' : ''}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const updated = isChecked
                                    ? list.filter(t => t !== type)
                                    : [...list, type];
                                  updateField('hospitalType', updated);
                                }}
                              />
                              {type}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {((Array.isArray(formData.hospitalType) ? formData.hospitalType.includes('Other') : formData.hospitalType === 'Other')) && (
                      <div className="form-group" style={{ marginTop: '12px' }}>
                        <label className="form-label">Specify Hospital Type *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter hospital type"
                          value={formData.hospitalTypeOther}
                          onChange={(e) => updateField('hospitalTypeOther', e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Hospital Location *</label>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '0.8rem' }}
                          onClick={() => {
                            if (!navigator.geolocation) {
                              toast.error('Geolocation is not supported by your browser');
                              return;
                            }
                            const toastId = toast.loading('Fetching GPS coordinates...');
                            navigator.geolocation.getCurrentPosition(
                              async (position) => {
                                const lat = position.coords.latitude;
                                const lng = position.coords.longitude;
                                updateField('latitude', lat);
                                updateField('longitude', lng);
                                toast.success(`GPS Coords: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, { id: toastId });

                                // Reverse Geocode
                                try {
                                  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                                    headers: { 'Accept-Language': 'en' }
                                  });
                                  const data = await response.json();
                                  if (data && data.address) {
                                    const addr = data.display_name || '';
                                    const city = data.address.city || data.address.town || data.address.village || '';
                                    const state = data.address.state || '';
                                    const pincode = data.address.postcode || '';

                                    updateField('address', addr);
                                    updateField('city', city);
                                    updateField('state', state);
                                    updateField('pincode', pincode);
                                    toast.success('Address auto-filled using GPS! 📍');
                                  }
                                } catch (e) {
                                  console.error(e);
                                }
                              },
                              (error) => {
                                toast.error('Error fetching location: ' + error.message, { id: toastId });
                              }
                            );
                          }}
                        >
                          📍 Get GPS Location
                        </button>
                      </div>
                      <textarea
                        className="form-input"
                        placeholder="Street Address (GPS will fill this automatically)"
                        value={formData.address || ''}
                        onChange={(e) => updateField('address', e.target.value)}
                        style={{ minHeight: '60px', padding: '10px' }}
                        required
                      />
                    </div>

                    <div className="grid grid-2">
                      <div className="form-group">
                        <label className="form-label">City *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="City"
                          value={formData.city || ''}
                          onChange={(e) => updateField('city', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">State *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="State"
                          value={formData.state || ''}
                          onChange={(e) => updateField('state', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-3">
                      <div className="form-group">
                        <label className="form-label">Pincode *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Pincode"
                          value={formData.pincode || ''}
                          onChange={(e) => updateField('pincode', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Total Beds *</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Total beds"
                          value={formData.totalBeds || ''}
                          onChange={(e) => {
                            updateField('totalBeds', parseInt(e.target.value) || 0);
                            if (!formData.availableBeds) {
                              updateField('availableBeds', parseInt(e.target.value) || 0);
                            }
                          }}
                          min="1"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Available Beds *</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Available beds"
                          value={formData.availableBeds || ''}
                          onChange={(e) => updateField('availableBeds', parseInt(e.target.value) || 0)}
                          min="0"
                          max={formData.totalBeds || 9999}
                          required
                        />
                      </div>
                    </div>

                    {formData.latitude && formData.longitude && (
                      <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', gap: '16px' }}>
                        <span>Latitude: <strong>{formData.latitude.toFixed(6)}</strong></span>
                        <span>Longitude: <strong>{formData.longitude.toFixed(6)}</strong></span>
                      </div>
                    )}


                    <div className="checkbox-grid">
                      {['General Physician', 'Cardiologist', 'Neurologist', 'Orthopedic', 'Pediatrician', 'Dermatologist', 'ENT Specialist', 'Ophthalmologist', 'Gynecologist', 'Urologist', 'Other'].map((spec) => {
                        const list = formData.doctorTypes || [];
                        const isChecked = list.includes(spec);

                        return (
                          <label key={spec} className={`checkbox-pill ${isChecked ? 'checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const updated = isChecked
                                  ? list.filter(s => s !== spec)
                                  : [...list, spec];

                                updateField('doctorTypes', updated);
                              }}
                            />
                            {spec}
                          </label>
                        );
                      })}
                    </div>

                    {formData.doctorTypes?.includes('Other') && (
                      <input
                        type="text"
                        className="form-input mt-2"
                        placeholder="Enter other speciality"
                        value={otherSpeciality}
                        onChange={(e) => setOtherSpeciality(e.target.value)}
                      />
                    )}


                    <div className="form-group">
                      <label className="form-label">
                        Facilities Available (Select all that apply)
                      </label>

                      <div className="checkbox-grid">
                        {[
                          'Emergency',
                          'Maternity',
                          'ICU',
                          'OPD',
                          'Pharmacy',
                          'Lab',
                          'Radiology',
                          'Surgery',
                          'Pediatric ICU',
                          'Physiotherapy',
                          'Other'
                        ].map((fac) => {
                          const list = formData.facilities || [];
                          const isChecked = list.includes(fac);

                          return (
                            <label
                              key={fac}
                              className={`checkbox-pill ${isChecked ? 'checked' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const updated = isChecked
                                    ? list.filter(f => f !== fac)
                                    : [...list, fac];

                                  updateField('facilities', updated);
                                }}
                              />
                              {fac}
                            </label>
                          );
                        })}
                      </div>

                      {formData.facilities?.includes('Other') && (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter other facility"
                          value={otherFacility}
                          onChange={(e) => setOtherFacility(e.target.value)}
                          style={{ marginTop: '12px' }}
                        />
                      )}
                    </div>

                    <div className="form-group" style={{ padding: '16px', border: '1px dashed var(--primary)', borderRadius: '12px', background: 'rgba(0, 217, 166, 0.02)' }}>
                      <label className="form-label">Hospital Photo *</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const uploadToast = toast.loading('Uploading hospital photo...');
                            try {
                              const res = await fileAPI.upload(file);
                              if (res.data.success) {
                                updateField('images', [res.data.message]);
                                toast.success('Photo uploaded successfully! 📸', { id: uploadToast });
                              } else {
                                toast.error('Upload failed', { id: uploadToast });
                              }
                            } catch (error) {
                              toast.error('Upload failed', { id: uploadToast });
                            }
                          }}
                          style={{ display: 'none' }}
                          id="hospital-photo-upload"
                        />
                        <label
                          htmlFor="hospital-photo-upload"
                          className="btn btn-outline"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}
                        >
                          Choose Hospital Photo
                        </label>
                        {formData.images?.[0] && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#10b981', marginTop: '4px' }}>
                            <FiCheck /> Uploaded: {formData.images[0].split('/').pop()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: '20px', marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '16px', color: 'var(--primary)' }}>🚨 Ambulance Service Details {formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7') ? '(Required)' : '(Optional)'}</h3>
                      
                      <div className="grid grid-2">
                        <div className="form-group">
                          <label className="form-label">Ambulance Number {formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7') ? '*' : ''}</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. MH-02-EA-9911"
                            value={formData.ambulanceNumber || ''}
                            onChange={(e) => updateField('ambulanceNumber', e.target.value)}
                            required={formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7')}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Ambulance Registration ID {formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7') ? '*' : ''}</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. TX-9911-AMB"
                            value={formData.ambulanceRegistrationId || ''}
                            onChange={(e) => updateField('ambulanceRegistrationId', e.target.value)}
                            required={formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7')}
                          />
                        </div>
                      </div>

                      <div className="grid grid-2" style={{ marginTop: '12px' }}>
                        <div className="form-group">
                          <label className="form-label">Driver Name {formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7') ? '*' : ''}</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Driver Name"
                            value={formData.driverName || ''}
                            onChange={(e) => updateField('driverName', e.target.value)}
                            required={formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7')}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Driver Phone Number {formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7') ? '*' : ''}</label>
                          <div className="form-input-icon">
                            <FiPhone className="icon" />
                            <input
                              type="tel"
                              className="form-input"
                              placeholder="Driver Phone"
                              value={formData.driverPhone || ''}
                              onChange={(e) => updateField('driverPhone', cleanPhoneNumber(e.target.value))}
                              required={formData.facilities?.includes('Emergency') || formData.facilities?.includes('24/7')}
                              maxLength={10}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {formData.role === 'DOCTOR' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Hospital / Clinic</label>
                      <div className="form-input-icon">
                        <FaHospital className="icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Search hospital by name or city"
                          value={hospitalSearch}
                          onChange={(e) => {
                            setHospitalSearch(e.target.value);
                            setSelectedHospital(null);
                            updateField('hospitalId', '');
                          }}
                          autoComplete="off"
                          name="new-hospital-search"
                        />
                      </div>
                      {selectedHospital && (
                        <div className="selected-hospital-card">
                          <strong>{selectedHospital.name}</strong>
                          <span>{selectedHospital.city}, {selectedHospital.state}</span>
                        </div>
                      )}
                      {hospitalSearch && !selectedHospital && (
                        <div className="hospital-results">
                          {filteredHospitals.length > 0 ? (
                            filteredHospitals.slice(0, 6).map((hospital) => (
                              <button
                                key={hospital.id}
                                type="button"
                                className="hospital-result-item"
                                onClick={() => selectHospital(hospital)}
                              >
                                <div>
                                  <strong>{hospital.name}</strong>
                                  <p>{hospital.city}, {hospital.state}</p>
                                </div>
                                <span>{hospital.availableBeds ?? 'Beds N/A'}</span>
                              </button>
                            ))
                          ) : (
                            <div className="hospital-empty">No matching hospitals found.</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Specialization</label>
                      <select
                        className="form-input"
                        value={formData.specialization}
                        onChange={(e) => updateField('specialization', e.target.value)}
                        disabled={!formData.hospitalId}
                      >
                        <option value="">
                          {formData.hospitalId ? "Select specialization" : "Please select a hospital first"}
                        </option>
                        <option value="General Physician">General Physician</option>
                        <option value="Cardiologist">Cardiologist</option>
                        <option value="Neurologist">Neurologist</option>
                        <option value="Orthopedic">Orthopedic</option>
                        <option value="Pediatrician">Pediatrician</option>
                        <option value="Dermatologist">Dermatologist</option>
                        <option value="ENT">ENT Specialist</option>
                        <option value="Ophthalmologist">Ophthalmologist</option>
                        <option value="Gynecologist">Gynecologist</option>
                        <option value="Urologist">Urologist</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    {formData.specialization === 'Other' && (
                      <div className="form-group">
                        <label className="form-label">Other Specialization</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Describe your specialty"
                          value={formData.specializationOther}
                          onChange={(e) => updateField('specializationOther', e.target.value)}
                          autoComplete="off"
                          name="new-specialization-other"
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">License Number</label>
                      <div className="form-input-icon">
                        <FiShield className="icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="5-digit license number"
                          value={formData.licenseNo}
                          onChange={(e) => {
                            updateField('licenseNo', e.target.value);
                            verifyLicenseInRealTime(e.target.value);
                          }}
                          autoComplete="off"
                          name="new-license"
                          maxLength="5"
                        />
                        {licenseVerifying && <div className="spinner spinner-sm" style={{ position: 'absolute', right: '12px' }}></div>}
                        {!licenseVerifying && licenseVerified && formData.licenseNo && (
                          <FiCheck className="icon" style={{ color: '#10b981', position: 'absolute', right: '12px' }} />
                        )}
                      </div>
                      {formData.licenseNo && !licenseVerifying && !licenseVerified && (
                        <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>Invalid license number</p>
                      )}
                      {licenseVerified && formData.licenseNo && (
                        <p style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '4px' }}>License verified ✓</p>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Working Hours</label>
                      <input type="text" className="form-input" placeholder="09:00 - 18:00"
                        value={formData.workingHours} onChange={(e) => updateField('workingHours', e.target.value)}
                        autoComplete="off" name="new-working-hours" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Working Days</label>
                      <div className="checkbox-grid">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                          <label key={day} className={`checkbox-pill ${formData.workingDays.includes(day) ? 'checked' : ''}`}>
                            <input type="checkbox" checked={formData.workingDays.includes(day)}
                              onChange={() => toggleWorkingDay(day)} />
                            {day}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Consultation Types</label>
                      <div className="checkbox-grid">
                        <label className="checkbox-pill">
                          <input type="checkbox" checked={formData.inPersonConsultation}
                            onChange={() => updateField('inPersonConsultation', !formData.inPersonConsultation)} />
                          In-person
                        </label>
                        <label className="checkbox-pill">
                          <input type="checkbox" checked={formData.onlineConsultation}
                            onChange={() => updateField('onlineConsultation', !formData.onlineConsultation)} />
                          Online
                        </label>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Consultation Fee</label>
                      <div className="form-input-icon">
                        <FiShield className="icon" />
                        <input type="number" className="form-input" placeholder="Fee per consultation"
                          value={formData.fees} onChange={(e) => updateField('fees', e.target.value)}
                          autoComplete="off" name="new-fees" min="0" />
                      </div>
                    </div>
                  </>
                )}

                {formData.role === 'PHARMACY' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Pharmacist License Number</label>
                      <div className="form-input-icon">
                        <FiShield className="icon" />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="5-digit license number"
                          value={formData.licenseNo}
                          onChange={(e) => {
                            updateField('licenseNo', e.target.value);
                            verifyPharmacyInRealTime(e.target.value);
                          }}
                          autoComplete="off"
                          name="pharmacy-license"
                          maxLength="5"
                        />
                        {pharmacyLicenseVerifying && <div className="spinner spinner-sm" style={{ position: 'absolute', right: '12px' }}></div>}
                        {!pharmacyLicenseVerifying && pharmacyLicenseVerified && formData.licenseNo && (
                          <FiCheck className="icon" style={{ color: '#10b981', position: 'absolute', right: '12px' }} />
                        )}
                      </div>
                      {formData.licenseNo && !pharmacyLicenseVerifying && !pharmacyLicenseVerified && (
                        <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>Invalid pharmacy license number</p>
                      )}
                      {pharmacyLicenseVerified && formData.licenseNo && (
                        <p style={{ color: '#10b981', fontSize: '0.8rem', marginTop: '4px' }}>Pharmacy license verified ✓</p>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Delivery Service</label>
                      <div className="checkbox-grid">
                        <label className="checkbox-pill">
                          <input type="checkbox" checked={formData.providesDelivery}
                            onChange={() => updateField('providesDelivery', !formData.providesDelivery)} />
                          Provides Delivery
                        </label>
                      </div>
                    </div>

                    {formData.providesDelivery && (
                      <div className="form-group">
                        <label className="form-label">Delivery Charges</label>
                        <input type="number" className="form-input" placeholder="Delivery charge in INR"
                          value={formData.deliveryCharges} onChange={(e) => updateField('deliveryCharges', e.target.value)} min="0" />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Pharmacy Type</label>
                      <div className="checkbox-grid">
                        <label className={`checkbox-pill ${formData.pharmacyType === 'INDEPENDENT' ? 'checked' : ''}`}>
                          <input type="radio" name="pharmacyType" checked={formData.pharmacyType === 'INDEPENDENT'}
                            onChange={() => updateField('pharmacyType', 'INDEPENDENT')} />
                          Independent
                        </label>
                        <label className={`checkbox-pill ${formData.pharmacyType === 'ASSOCIATED' ? 'checked' : ''}`}>
                          <input type="radio" name="pharmacyType" checked={formData.pharmacyType === 'ASSOCIATED'}
                            onChange={() => updateField('pharmacyType', 'ASSOCIATED')} />
                          Associated with Hospital
                        </label>
                      </div>
                    </div>

                    {formData.pharmacyType === 'INDEPENDENT' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Pharmacy Name</label>
                          <input type="text" className="form-input" placeholder="Enter pharmacy name"
                            value={formData.shopName} onChange={(e) => updateField('shopName', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Address</label>
                          <textarea className="form-input" placeholder="Pharmacy address"
                            value={formData.location} onChange={(e) => updateField('location', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Photo</label>
                          <input type="file" accept="image/*" onChange={(e) => updateField('pharmacyPhoto', e.target.files[0])} />
                        </div>
                      </>
                    )}

                    {formData.pharmacyType === 'ASSOCIATED' && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Hospital / Clinic</label>
                          <div className="form-input-icon">
                            <FaHospital className="icon" />
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Search hospital by name or city"
                              value={hospitalSearch}
                              onChange={(e) => {
                                setHospitalSearch(e.target.value);
                                setSelectedHospital(null);
                                updateField('pharmacyHospitalId', '');
                              }}
                              autoComplete="off"
                              name="pharmacy-hospital-search"
                            />
                          </div>
                          {selectedHospital && (
                            <div className="selected-hospital-card">
                              <strong>{selectedHospital.name}</strong>
                              <span>{selectedHospital.city}, {selectedHospital.state}</span>
                            </div>
                          )}
                          {hospitalSearch && !selectedHospital && (
                            <div className="hospital-results">
                              {filteredHospitals.length > 0 ? (
                                filteredHospitals.slice(0, 6).map((hospital) => (
                                  <button
                                    key={hospital.id}
                                    type="button"
                                    className="hospital-result-item"
                                    onClick={() => { selectHospital(hospital); updateField('pharmacyHospitalId', hospital.id); }}
                                  >
                                    <div>
                                      <strong>{hospital.name}</strong>
                                      <p>{hospital.city}, {hospital.state}</p>
                                    </div>
                                    <span>{hospital.availableBeds ?? 'Beds N/A'}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="hospital-empty">No matching hospitals found.</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Photo</label>
                          <input type="file" accept="image/*" onChange={(e) => updateField('pharmacyPhoto', e.target.files[0])} />
                        </div>
                      </>
                    )}
                  </>
                )}
                {/* Profile Photo upload */}
                {formData.role !== 'HOSPITAL' && (
                  <div className="form-group" style={{ padding: '16px', border: '1px dashed var(--primary)', borderRadius: '12px', background: 'rgba(0, 217, 166, 0.02)', marginTop: '24px' }}>
                    <label className="form-label">Profile Photo *</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const uploadToast = toast.loading('Uploading profile photo...');
                          try {
                            const res = await fileAPI.upload(file);
                            if (res.data.success) {
                              updateField('profilePhoto', res.data.message);
                              toast.success('Photo uploaded successfully! 📸', { id: uploadToast });
                            } else {
                              toast.error('Upload failed', { id: uploadToast });
                            }
                          } catch (error) {
                            toast.error('Upload failed', { id: uploadToast });
                          }
                        }}
                        style={{ display: 'none' }}
                        id="profile-photo-upload"
                      />
                      <label
                        htmlFor="profile-photo-upload"
                        className="btn btn-outline"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}
                      >
                        Choose Profile Photo
                      </label>
                      {formData.profilePhoto && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#10b981', marginTop: '4px' }}>
                          <FiCheck /> Uploaded: {formData.profilePhoto.split('/').pop()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Terms and conditions Checkbox */}
                <div className="form-group" style={{ marginTop: '24px', marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span>
                      By continuing, I agree to the{' '}
                      <span
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenTerms();
                        }}
                        style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: 600, cursor: 'pointer' }}
                      >
                        terms and conditions
                      </span>{' '}
                      of MedAstraX.
                    </span>
                  </label>
                </div>

                {/* Captcha */}
                <div className="form-group" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', marginTop: '16px', marginBottom: '24px' }}>
                  <label className="form-label">Security Check (Captcha) *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', display: 'inline-block', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                      <canvas
                        ref={captchaCanvasRef}
                        width="180"
                        height="50"
                        style={{ display: 'block', background: 'var(--bg-secondary)' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={generateCaptcha}
                      className="btn btn-outline btn-sm"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: '8px', width: '40px', height: '40px' }}
                      title="Refresh Captcha"
                    >
                      <FiRefreshCw />
                    </button>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1, minWidth: '120px', padding: '10px' }}
                      placeholder="Enter captcha text"
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="step-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}>
                    <FiArrowLeft /> Back
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleNext}>
                    Next Step <FiArrowRight />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Account Info */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="form-input-icon">
                    <FiMail className="icon" />
                    <input type="email" className="form-input" placeholder="Enter your email"
                      value={formData.email} onChange={(e) => updateField('email', e.target.value)}
                      autoComplete="off" name="new-email" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div className="form-input-icon">
                    <FiPhone className="icon" />
                    <input type="tel" className="form-input" placeholder="+91 XXXXXXXXXX"
                      value={formData.phone} onChange={(e) => updateField('phone', cleanPhoneNumber(e.target.value))}
                      autoComplete="off" name="new-phone" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="form-input-icon">
                    <FiLock className="icon" />
                    <input type={showPassword ? 'text' : 'password'} className="form-input"
                      placeholder="Create a password (min 6 chars)"
                      value={formData.password} onChange={(e) => updateField('password', e.target.value)}
                      style={{ paddingRight: '48px' }} autoComplete="new-password" name="new-password" />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                  {formData.password && (
                    <div style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Password Strength:</span>
                        <span style={{ color: checkPasswordStrength(formData.password).color, fontWeight: '700' }}>
                          {checkPasswordStrength(formData.password).label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        {[1, 2, 3, 4].map(idx => (
                          <div 
                            key={idx} 
                            style={{ 
                              flex: 1, 
                              height: '100%', 
                              background: idx <= checkPasswordStrength(formData.password).score ? checkPasswordStrength(formData.password).color : 'transparent',
                              transition: 'all 0.3s ease'
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <div className="form-input-icon">
                    <FiLock className="icon" />
                    <input type="password" className="form-input" placeholder="Confirm your password"
                      value={formData.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)}
                      autoComplete="new-password" name="new-confirm-password" />
                  </div>
                </div>

                <div className="step-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                    <FiArrowLeft /> Back
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleNext}>
                    Next Step <FiArrowRight />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: OTP Verification */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
              >
                <div className="otp-section">
                  <div className="otp-section-header">
                    <div className="otp-icon-wrap email">
                      <FiMail size={20} />
                    </div>
                    <div>
                      <h3 className="otp-section-title">Email Verification</h3>
                      <p className="otp-section-desc">{formData.email}</p>
                    </div>
                    {emailVerified && (
                      <motion.div className="verified-tag" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <FiShield /> Verified
                      </motion.div>
                    )}
                  </div>

                  {!emailOtpSent && !emailVerified && (
                    <button
                      type="button"
                      className="btn btn-outline btn-send-otp"
                      onClick={sendEmailOtp}
                      disabled={emailSending}
                    >
                      {emailSending ? (
                        <><div className="spinner spinner-sm"></div> Sending...</>
                      ) : (
                        <><FiMail /> Send OTP to Email</>
                      )}
                    </button>
                  )}

                  {emailOtpSent && !emailVerified && (
                    <div className="otp-entry-area">
                      <p className="otp-instruction">Enter the 6-digit code sent to your email</p>
                      {renderOtpInputs(emailOtp, setEmailOtp, emailOtpRefs, emailVerified, emailVerifying, verifyEmailOtp)}
                      <div className="otp-resend">
                        {emailResendTimer > 0 ? (
                          <span className="resend-timer">Resend in {emailResendTimer}s</span>
                        ) : (
                          <button type="button" className="btn-link" onClick={sendEmailOtp} disabled={emailSending}>
                            Resend OTP
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {formData.phone && (
                  <div className="otp-section">
                    <div className="otp-section-header">
                      <div className="otp-icon-wrap phone">
                        <FiPhone size={20} />
                      </div>
                      <div>
                        <h3 className="otp-section-title">Phone Verification</h3>
                        <p className="otp-section-desc">{formData.phone}</p>
                      </div>
                      {phoneVerified && (
                        <motion.div className="verified-tag" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                          <FiShield /> Verified
                        </motion.div>
                      )}
                    </div>

                    {!phoneOtpSent && !phoneVerified && (
                      <button
                        type="button"
                        className="btn btn-outline btn-send-otp"
                        onClick={sendPhoneOtp}
                        disabled={phoneSending}
                      >
                        {phoneSending ? (
                          <><div className="spinner spinner-sm"></div> Sending...</>
                        ) : (
                          <><FiPhone /> Send OTP to Phone</>
                        )}
                      </button>
                    )}

                    {phoneOtpSent && !phoneVerified && (
                      <div className="otp-entry-area">
                        <p className="otp-instruction">Enter the 6-digit code (check backend console)</p>
                        {renderOtpInputs(phoneOtp, setPhoneOtp, phoneOtpRefs, phoneVerified, phoneVerifying, verifyPhoneOtp)}
                        <div className="otp-resend">
                          {phoneResendTimer > 0 ? (
                            <span className="resend-timer">Resend in {phoneResendTimer}s</span>
                          ) : (
                            <button type="button" className="btn-link" onClick={sendPhoneOtp} disabled={phoneSending}>
                              Resend OTP
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!formData.phone && (
                  <div className="otp-no-phone">
                    <FiPhone />
                    <p>Phone verification skipped — no phone number provided</p>
                  </div>
                )}

                <div className="step-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                    <FiArrowLeft /> Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!emailVerified || (formData.phone && !phoneVerified) || loading}
                  >
                    {loading ? <div className="spinner"></div> : <>Create Account <FiArrowRight /></>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login" className="auth-link">Sign In</Link></p>
        </div>
      </motion.div>

      {/* Terms and Conditions Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTermsModal(false)}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                position: 'relative',
                background: '#1A1829',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '32px',
                width: '100%',
                maxWidth: '540px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                color: '#FFFFFF',
                zIndex: 10
              }}
            >
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', color: 'var(--primary)' }}>
                Terms & Conditions for {formData.role ? formData.role.charAt(0) + formData.role.slice(1).toLowerCase() + 's' : 'Users'}
              </h3>
              
              <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '8px', fontSize: '0.95rem', color: '#D2D0DD', lineHeight: '1.6', marginBottom: '24px', whiteSpace: 'pre-line', textAlign: 'left' }}>
                {loadingTerms ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                    <div className="spinner" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}></div>
                  </div>
                ) : (
                  termsContent
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="btn btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div >
  );
}
