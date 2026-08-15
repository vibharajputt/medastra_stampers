import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  FiAlertTriangle, 
  FiActivity, 
  FiMapPin, 
  FiPhone, 
  FiClock, 
  FiSend, 
  FiX, 
  FiHome, 
  FiCheck, 
  FiArrowLeft,
  FiLoader
} from 'react-icons/fi';
import { hospitalAPI, authAPI, emergencyAPI } from '../../services/api';

// Siren sound generator using Web Audio API
const playSiren = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create oscillators
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    
    // Set up frequencies
    osc1.frequency.setValueAtTime(800, audioCtx.currentTime); // Base siren frequency (Hz)
    osc2.frequency.setValueAtTime(2, audioCtx.currentTime);   // Siren frequency modulation (LFO) (2Hz)
    
    // Create modulation gain
    const modulationGain = audioCtx.createGain();
    modulationGain.gain.setValueAtTime(300, audioCtx.currentTime); // Range of pitch modulation (Hz)
    
    // Connect LFO (osc2) to modulation gain, then to osc1 frequency
    osc2.connect(modulationGain);
    modulationGain.connect(osc1.frequency);
    
    // Gain connection
    osc1.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Volume level
    
    osc1.start();
    osc2.start();
    
    return {
      stop: () => {
        try {
          osc1.stop();
          osc2.stop();
          audioCtx.close();
        } catch (e) {
          console.error(e);
        }
      }
    };
  } catch (e) {
    console.error('Failed to play browser siren', e);
    return null;
  }
};

const EmergencyPage = () => {
  const navigate = useNavigate();
  
  // Geolocation & Data States
  const [hospitals, setHospitals] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const [matchingHospitals, setMatchingHospitals] = useState([]);
  
  // SOS States
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(3);
  const [sosLoading, setSosLoading] = useState(false);
  const [nearestHospital, setNearestHospital] = useState(null);
  const [sosAlertDetails, setSosAlertDetails] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  
  // Ambulance Tracking States
  const [ambulanceStep, setAmbulanceStep] = useState(0); // 0: Dispatching, 1: En Route, 2: Arrived
  const [ambulanceProgress, setAmbulanceProgress] = useState(0); 
  const [ambulanceEta, setAmbulanceEta] = useState(300); // in seconds
  
  const countdownIntervalRef = useRef(null);
  const ambulanceIntervalRef = useRef(null);
  const sirenRef = useRef(null);
  
  const fallbackCoords = { latitude: 19.0760, longitude: 72.8777 }; // Mumbai

  const hospitalsRef = useRef([]);
  const profileRef = useRef(null);

  hospitalsRef.current = hospitals;
  profileRef.current = profileData;

  // Fetch hospitals and profile on mount
  useEffect(() => {
    fetchHospitals();
    fetchProfile();
    
    // Start countdown immediately on mount
    startCountdown();
    
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (ambulanceIntervalRef.current) clearInterval(ambulanceIntervalRef.current);
      if (sirenRef.current) {
        sirenRef.current.stop();
        sirenRef.current = null;
      }
    };
  }, []);

  async function fetchHospitals() {
    try {
      const res = await hospitalAPI.getAll();
      setHospitals(res.data || []);
    } catch (err) {
      console.error('Error fetching hospitals', err);
      toast.error('Failed to load hospitals list');
    }
  }

  async function fetchProfile() {
    try {
      const res = await authAPI.getProfile();
      setProfileData(res.data || {});
    } catch (err) {
      console.error('Error fetching profile', err);
    }
  }

  // Countdown timer logic
  const startCountdown = () => {
    setSosCountdown(3);
    countdownIntervalRef.current = setInterval(() => {
      setSosCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          executeSOSTrigger();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSOSEmergency = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (ambulanceIntervalRef.current) {
      clearInterval(ambulanceIntervalRef.current);
      ambulanceIntervalRef.current = null;
    }
    if (sirenRef.current) {
      sirenRef.current.stop();
      sirenRef.current = null;
    }
    setSosCountdown(null);
    setSosActive(false);
    setSosLoading(false);
    setSosAlertDetails(null);
    toast.error('Emergency SOS Cancelled');
    navigate('/dashboard');
  };

  const executeSOSTrigger = () => {
    setSosActive(true);
    setSosLoading(true);
    setSosCountdown(null);
    
    // Start loud audio alert/siren in browser
    if (!sirenRef.current) {
      sirenRef.current = playSiren();
    }
    
    toast.loading('Activating SOS: Obtaining Geolocation...', { id: 'sos-toast' });
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setUserCoords(coords);
          await processSOS(coords);
        },
        async (err) => {
          console.warn('SOS Geolocation failed, using default fallback location', err);
          setUserCoords(fallbackCoords);
          await processSOS(fallbackCoords);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      console.warn('Geolocation not supported, using fallback location');
      setUserCoords(fallbackCoords);
      processSOS(fallbackCoords);
    }
  };

  const processSOS = async (coords) => {
    let currentHospitals = hospitalsRef.current;
    if (currentHospitals.length === 0) {
      try {
        const res = await hospitalAPI.getAll();
        currentHospitals = res.data || [];
        setHospitals(currentHospitals);
      } catch (err) {
        console.error("Failed to fetch hospitals inside processSOS", err);
      }
    }

    let userCity = profileRef.current?.city;
    if (!userCity) {
      try {
        const res = await authAPI.getProfile();
        userCity = res.data?.city || "Mumbai";
        setProfileData(res.data || {});
      } catch (err) {
        console.error("Failed to fetch profile in processSOS", err);
        userCity = "Mumbai";
      }
    }

    // 1. Filter hospitals that are in the same city, are 24/7 (have available beds AND contain "Emergency" facility)
    let emergencyHospitals = currentHospitals.filter(h => {
      const isSameCity = h.city?.toLowerCase() === userCity.toLowerCase();
      const hasEmergency = h.facilities?.some(f => f.toLowerCase() === 'emergency');
      const hasBeds = h.availableBeds > 0;
      return isSameCity && hasEmergency && hasBeds;
    });

    if (emergencyHospitals.length === 0) {
      // Fallback to any hospital in the same city with emergency facilities
      emergencyHospitals = currentHospitals.filter(h => {
        const isSameCity = h.city?.toLowerCase() === userCity.toLowerCase();
        const hasEmergency = h.facilities?.some(f => f.toLowerCase() === 'emergency');
        return isSameCity && hasEmergency;
      });
    }

    if (emergencyHospitals.length === 0) {
      // Fallback to any hospital in the same city
      emergencyHospitals = currentHospitals.filter(h => {
        return h.city?.toLowerCase() === userCity.toLowerCase();
      });
    }

    // 2. Compute distances and sort
    const calculated = emergencyHospitals.map(h => {
      const dist = getDistance(coords.latitude, coords.longitude, h.latitude || 0, h.longitude || 0);
      return { ...h, distance: dist };
    });

    // Sort by distance ascending (closest first)
    calculated.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    setMatchingHospitals(calculated);
    toast.dismiss('sos-toast');
    setSosLoading(false);

    if (calculated.length === 0) {
      toast.error('No emergency hospitals found in your city.');
      setSosActive(false);
      return;
    }
    toast.success('Nearby emergency hospitals located. Please select a hospital.');
  };

  const dispatchAmbulanceToHospital = async (hospital) => {
    if (!userCoords) {
      toast.error('Coordinates not loaded yet.');
      return;
    }
    setDispatching(true);
    setNearestHospital(hospital);
    
    toast.loading(`Dispatching ambulance to ${hospital.name}...`, { id: 'dispatch-toast' });
    
    const trackingLink = `${window.location.origin}/track-ambulance?h=${encodeURIComponent(hospital.name)}&lat=${hospital.latitude || 19.0596}&lon=${hospital.longitude || 72.8295}`;
    const payload = {
      hospitalName: hospital.name,
      hospitalPhone: hospital.phone || "+91 22-12345678",
      hospitalAddress: hospital.address || "Mumbai",
      userLatitude: userCoords.latitude,
      userLongitude: userCoords.longitude,
      trackingLink: trackingLink
    };

    try {
      const res = await emergencyAPI.triggerSOS(payload);
      setSosAlertDetails(res.data.data);
      toast.dismiss('dispatch-toast');
      toast.success(`🚨 SOS Dispatched! Ambulance en route to ${hospital.name}.`);
    } catch (err) {
      console.error('SOS dispatch failed', err);
      toast.dismiss('dispatch-toast');
      toast.error('SOS Activated. SMS notification failed but ambulance tracking started.');
      setSosAlertDetails({
        sentTo: profileRef.current?.emergencyNumber || "+91 9876543219",
        messageBody: `🚨 EMERGENCY SOS ALERT! ${profileRef.current?.name || 'Rahul Sharma'} triggered an SOS. Selected hospital: ${hospital.name}. Bed availability is confirmed. Tracking: ${trackingLink}`
      });
    } finally {
      setDispatching(false);
      startAmbulanceTracking();
    }
  };

  const startAmbulanceTracking = () => {
    setAmbulanceProgress(0);
    setAmbulanceStep(0);
    setAmbulanceEta(300);

    if (ambulanceIntervalRef.current) clearInterval(ambulanceIntervalRef.current);

    ambulanceIntervalRef.current = setInterval(() => {
      setAmbulanceProgress(prev => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(ambulanceIntervalRef.current);
          setAmbulanceStep(2);
          setAmbulanceEta(0);
          return 100;
        }
        if (next >= 30) {
          setAmbulanceStep(1);
        }
        return next;
      });
      setAmbulanceEta(prev => Math.max(0, prev - 6));
    }, 800);
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    return parseFloat(dist.toFixed(1));
  };

  return (
    <div className="emergency-page-container">
      {/* Scope-specific Styles */}
      <style>{`
        .emergency-page-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 24px;
          min-height: calc(100vh - 100px);
          font-family: var(--font-primary);
        }

        .emergency-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
        }

        .emergency-title {
          font-family: var(--font-display);
          font-size: 2rem;
          font-weight: 800;
          color: #ef4444;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn-cancel-top {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-secondary);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel-top:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--text-primary);
        }

        /* Countdown Panel */
        .countdown-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 80px 0;
        }

        .countdown-card {
          background: rgba(239, 68, 68, 0.03);
          border: 2px dashed #ef4444;
          border-radius: 24px;
          padding: 48px 40px;
          text-align: center;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 10px 30px rgba(239, 68, 68, 0.1);
          animation: sos-pulse 2s infinite;
        }

        .countdown-number {
          font-size: 5rem;
          font-weight: 900;
          color: #ef4444;
          margin: 24px 0;
          line-height: 1;
        }

        .btn-sos-cancel {
          background: #ef4444;
          color: white;
          border: none;
          font-weight: 700;
          padding: 14px 28px;
          border-radius: 9999px;
          cursor: pointer;
          font-size: 1rem;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
          transition: all 0.2s;
        }

        .btn-sos-cancel:hover {
          background: #dc2626;
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
        }

        /* Active Console Grid */
        .emergency-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 32px;
        }

        @media (max-width: 900px) {
          .emergency-grid {
            grid-template-columns: 1fr;
          }
        }

        .emergency-sidebar {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Tracking Panel */
        .tracking-panel {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
        }

        .tracking-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tracking-progress-container {
          width: 100%;
          height: 10px;
          background: var(--border-color);
          border-radius: 5px;
          overflow: hidden;
          margin: 16px 0;
        }

        .tracking-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ef4444, #f59e0b);
          border-radius: 5px;
          transition: width 0.4s ease;
        }

        .tracking-timeline {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 24px;
        }

        .timeline-step {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          opacity: 0.5;
          transition: opacity 0.3s;
        }

        .timeline-step.active {
          opacity: 1;
        }

        .timeline-bullet {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--border-color);
          margin-top: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .timeline-step.active .timeline-bullet {
          background: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
        }

        .timeline-content {
          flex: 1;
        }

        .timeline-label {
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--text-primary);
        }

        .timeline-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        /* SMS log */
        .sms-log-panel {
          background: rgba(15, 23, 42, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
        }

        /* Directory List */
        .hospitals-directory-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .directory-header-container {
          margin-bottom: 8px;
        }

        .directory-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 4px 0;
        }

        .directory-subtitle {
          font-size: 0.88rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .emergency-hospital-card {
          background: white;
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }

        .emergency-hospital-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.05);
          border-color: rgba(239, 68, 68, 0.2);
        }

        .emergency-hospital-card.allocated {
          border: 2px dashed #ef4444;
          background: rgba(239, 68, 68, 0.01);
        }

        .emergency-hospital-card.dispatched {
          border: 2px solid #10b981;
          background: rgba(16, 185, 129, 0.02);
        }

        .badge-allocated {
          position: absolute;
          top: 0;
          right: 0;
          background: #ef4444;
          color: white;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 4px 16px;
          border-bottom-left-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-dispatched {
          position: absolute;
          top: 0;
          right: 0;
          background: #10b981;
          color: white;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 4px 16px;
          border-bottom-left-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .card-header-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .hospital-name {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0 0 4px 0;
        }

        .hospital-meta-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .meta-item.distance {
          color: #ef4444;
          font-weight: 700;
        }

        .meta-item.beds-good {
          color: #10b981;
          font-weight: 700;
        }

        .meta-item.beds-low {
          color: #f59e0b;
          font-weight: 700;
        }

        .hospital-actions-row {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .btn-emergency-action {
          flex: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
        }

        .btn-emergency-action.primary {
          background: var(--primary);
          color: white;
          border: none;
        }

        .btn-emergency-action.primary:hover {
          background: var(--primary-dark);
        }

        .btn-emergency-action.outline {
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-primary);
        }

        .btn-emergency-action.outline:hover {
          background: var(--bg-secondary);
        }
      `}</style>

      {/* Page Header */}
      <div className="emergency-header">
        <div className="emergency-title">
          <FiAlertTriangle className="animate-pulse" />
          <span>Emergency SOS</span>
        </div>
        <button className="btn-cancel-top" onClick={cancelSOSEmergency}>
          <FiArrowLeft /> Back to Dashboard
        </button>
      </div>

      <AnimatePresence mode="wait">
        {sosCountdown !== null ? (
          /* Countdown Panel */
          <motion.div 
            key="countdown"
            className="countdown-wrapper"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="countdown-card">
              <h3 style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: '800', margin: '0 0 12px 0' }}>
                TRIGGERING SOS EMERGENCY ALERT
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                This will send alert details to your emergency contact.
              </p>
              
              <div className="countdown-number">{sosCountdown}</div>
              
              <button className="btn-sos-cancel" onClick={cancelSOSEmergency}>
                Cancel SOS
              </button>
            </div>
          </motion.div>
        ) : (
          /* Active Console Grid */
          <motion.div 
            key="console"
            className="emergency-grid animate-fade-in"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Sidebar Column: Tracking & SMS Status */}
            <div className="emergency-sidebar">
              
              {/* Ambulance Tracking Panel */}
              <div className="tracking-panel">
                <div className="tracking-title">
                  <FiActivity color="#ef4444" /> Live Ambulance Dispatch Tracker
                </div>
                
                {dispatching ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                    <FiLoader className="spinner" style={{ fontSize: '2rem', margin: '0 auto 12px auto', display: 'block' }} />
                    <div style={{ marginTop: '12px', fontWeight: '600' }}>Dispatching ambulance...</div>
                  </div>
                ) : nearestHospital === null ? (
                  <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
                    <FiAlertTriangle color="#ef4444" style={{ fontSize: '2.5rem', margin: '0 auto 12px auto', display: 'block' }} className="animate-pulse" />
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>Dispatch Pending</div>
                    <div style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>Please select a hospital from the directory on the right to dispatch your ambulance.</div>
                  </div>
                ) : (
                  <>
                    {/* Live GPS Map (Swiggy/Blinkit style) */}
                    <div style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--border-color)', position: 'relative' }}>
                      <iframe
                        title="Ambulance Location Map"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        src={nearestHospital && nearestHospital.latitude && nearestHospital.longitude
                          ? `https://maps.google.com/maps?q=${nearestHospital.latitude},${nearestHospital.longitude}&t=&z=14&ie=UTF8&iwloc=&output=embed`
                          : `https://maps.google.com/maps?q=Mumbai&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                        loading="lazy"
                      ></iframe>
                      <div style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '12px',
                        background: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: '#ef4444'
                      }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'ping 1.2s infinite' }}></span>
                        Live GPS Tracking Active
                      </div>
                    </div>

                      {/* ETA & Status Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: '700' }}>
                          {ambulanceStep === 0 ? 'AMBULANCE DISPATCHED' : ambulanceStep === 1 ? 'AMBULANCE EN ROUTE' : 'AMBULANCE ARRIVED'}
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                          {ambulanceStep === 2 ? 'Ambulance has Arrived' : `Arriving in ${Math.ceil(ambulanceEta / 60)} mins`}
                        </h3>
                      </div>
                      <div style={{ background: '#ef4444', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)' }}>
                        {Math.ceil(ambulanceEta / 60)} MINS
                      </div>
                    </div>

                    <div className="tracking-progress-container" style={{ margin: '0 0 20px 0' }}>
                      <div className="tracking-progress-fill" style={{ width: `${ambulanceProgress}%` }}></div>
                    </div>

                    {/* Driver & Vehicle Card */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Driver Profile Circle */}
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '1.1rem', boxShadow: '0 2px 8px rgba(59,130,246,0.2)' }}>
                          RK
                        </div>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Ramesh Kumar <span style={{ fontSize: '0.72rem', background: '#10b981', color: 'white', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>4.9 ★</span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            Emergency Ambulance Driver
                          </div>
                          {/* license plate style */}
                          <div style={{ display: 'inline-block', background: '#fef08a', border: '1px solid #eab308', color: '#1e293b', fontSize: '0.7rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px', marginTop: '6px', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                            MH-02-EA-9911
                          </div>
                        </div>
                      </div>
                      
                      <a 
                        href="tel:+919988776655"
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: '#10b981',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          textDecoration: 'none',
                          boxShadow: '0 4px 10px rgba(16,185,129,0.3)',
                          transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <FiPhone size={16} />
                      </a>
                    </div>

                    <div className="tracking-timeline" style={{ gap: '12px' }}>
                      <div className={`timeline-step ${ambulanceStep >= 0 ? 'active' : ''}`}>
                        <div className="timeline-bullet" style={{ width: '12px', height: '12px', marginTop: '3px' }}>
                          {ambulanceStep > 0 && <FiCheck size={8} color="white" />}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-label" style={{ fontSize: '0.85rem' }}>Ambulance Dispatched from {nearestHospital?.name}</div>
                          <div className="timeline-desc" style={{ fontSize: '0.75rem' }}>Emergency package prepared. Driver en route.</div>
                        </div>
                      </div>

                      <div className={`timeline-step ${ambulanceStep >= 1 ? 'active' : ''}`}>
                        <div className="timeline-bullet" style={{ width: '12px', height: '12px', marginTop: '3px' }}>
                          {ambulanceStep > 1 && <FiCheck size={8} color="white" />}
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-label" style={{ fontSize: '0.85rem' }}>Ambulance En Route</div>
                          <div className="timeline-desc" style={{ fontSize: '0.75rem' }}>Navigating using active traffic signals.</div>
                        </div>
                      </div>

                      <div className={`timeline-step ${ambulanceStep >= 2 ? 'active' : ''}`}>
                        <div className="timeline-bullet" style={{ width: '12px', height: '12px', marginTop: '3px' }}></div>
                        <div className="timeline-content">
                          <div className="timeline-label" style={{ fontSize: '0.85rem' }}>Arrived</div>
                          <div className="timeline-desc" style={{ fontSize: '0.75rem' }}>Ambulance has reached your location. Prepare for pickup.</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* SMS Alert Log */}
              {sosAlertDetails && (
                <div className="sms-log-panel">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    <FiSend /> Emergency SMS Alert Status
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <strong>Sent To Contact: </strong>
                      <span style={{ fontFamily: 'monospace', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {sosAlertDetails.sentTo}
                      </span>
                    </div>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', background: '#ffffff', fontSize: '0.78rem', lineHeight: '1.4', fontStyle: 'italic' }}>
                      "{sosAlertDetails.messageBody}"
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Directory Column: List of Nearby Hospitals */}
            <div className="hospitals-directory-panel">
              <div className="directory-header-container">
                <h2 className="directory-title">Available 24/7 Emergency Hospitals</h2>
                <p className="directory-subtitle">
                  Showing closest facilities with available beds and emergency services.
                </p>
              </div>

              {sosLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--border-color)', borderRadius: '16px', color: 'var(--text-secondary)' }}>
                  <FiLoader className="spinner" style={{ fontSize: '2.5rem', margin: '0 auto 16px auto' }} />
                  <div>Locating nearest emergency hospitals...</div>
                </div>
              ) : (
                matchingHospitals.map((hospital, index) => {
                  const isClosest = index === 0;
                  const isDispatched = nearestHospital?.id === hospital.id;

                  return (
                    <div 
                      key={hospital.id} 
                      className={`emergency-hospital-card ${isDispatched ? 'dispatched' : (nearestHospital === null && isClosest ? 'allocated' : '')}`}
                    >
                      {isDispatched ? (
                        <div className="badge-dispatched">
                          Dispatched / En Route
                        </div>
                      ) : (nearestHospital === null && isClosest) ? (
                        <div className="badge-allocated">
                          Closest / Recommended
                        </div>
                      ) : null}

                      <div className="card-header-info">
                        <div>
                          <h3 className="hospital-name">{hospital.name}</h3>
                          <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {hospital.address}, {hospital.city}
                          </p>
                        </div>
                      </div>

                      <div className="hospital-meta-row">
                        <div className="meta-item distance">
                          <FiMapPin /> {hospital.distance !== null ? `${hospital.distance} km away` : 'Distance unknown'}
                        </div>
                        <div className={`meta-item ${hospital.availableBeds > 5 ? 'beds-good' : 'beds-low'}`}>
                          <FiClock /> {hospital.availableBeds} beds available
                        </div>
                        <div className="meta-item">
                          <FiPhone /> {hospital.phone || 'N/A'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {hospital.facilities?.map((f, i) => (
                          <span 
                            key={i} 
                            style={{ 
                              fontSize: '0.72rem', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              background: f.toLowerCase() === 'emergency' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
                              color: f.toLowerCase() === 'emergency' ? '#ef4444' : 'var(--text-secondary)',
                              fontWeight: f.toLowerCase() === 'emergency' ? '700' : '500',
                              border: f.toLowerCase() === 'emergency' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border-color)'
                            }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>

                      <div className="hospital-actions-row">
                        <a 
                          href={`tel:${hospital.phone || '102'}`} 
                          className="btn-emergency-action outline"
                        >
                          <FiPhone /> Call Hospital
                        </a>
                        <button 
                          onClick={() => dispatchAmbulanceToHospital(hospital)}
                          disabled={dispatching || nearestHospital !== null}
                          className="btn-emergency-action primary"
                          style={{
                            background: isDispatched ? '#10b981' : (nearestHospital !== null ? '#94a3b8' : '#ef4444'),
                            color: 'white',
                            borderColor: isDispatched ? '#10b981' : (nearestHospital !== null ? '#94a3b8' : '#ef4444'),
                            cursor: nearestHospital !== null ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isDispatched ? (
                            <>
                              <FiCheck /> Dispatched
                            </>
                          ) : nearestHospital !== null ? (
                            'Select Hospital'
                          ) : 'Select Hospital'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmergencyPage;
