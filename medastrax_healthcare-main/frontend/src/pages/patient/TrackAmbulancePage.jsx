import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiActivity, 
  FiMapPin, 
  FiPhone, 
  FiClock, 
  FiCheck,
  FiAlertTriangle
} from 'react-icons/fi';

const TrackAmbulancePage = () => {
  const [searchParams] = useSearchParams();
  
  // Simulated tracking states
  const [ambulanceStep, setAmbulanceStep] = useState(0); // 0: Dispatched, 1: En Route, 2: Arrived
  const [ambulanceProgress, setAmbulanceProgress] = useState(0);
  const [ambulanceEta, setAmbulanceEta] = useState(300); // 5 minutes in seconds
  
  const timerRef = useRef(null);

  // Parse parameters if provided, otherwise default to demo patient/hospital
  const patientName = searchParams.get('patient') || "Rahul Sharma";
  const hospitalName = searchParams.get('h') || "City Care Hospital";

  // Coordinates lookup mapping for demo hospitals
  const hospitalCoords = {
    "city care hospital": { lat: "19.0596", lon: "72.8295" },
    "lifeline medical center": { lat: "28.6315", lon: "77.2167" },
    "green valley hospital": { lat: "18.9322", lon: "72.8264" }
  };

  const coords = hospitalCoords[hospitalName.toLowerCase()] || { lat: "19.0596", lon: "72.8295" };
  const lat = searchParams.get('lat') || coords.lat;
  const lon = searchParams.get('lon') || coords.lon;

  useEffect(() => {
    // Start tracking simulation immediately
    setAmbulanceProgress(0);
    setAmbulanceStep(0);
    setAmbulanceEta(300);

    timerRef.current = setInterval(() => {
      setAmbulanceProgress(prev => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(timerRef.current);
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
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="public-tracker-container">
      <style>{`
        .public-tracker-container {
          max-width: 600px;
          margin: 0 auto;
          min-height: 100vh;
          background: #f8fafc;
          font-family: var(--font-primary, sans-serif);
          display: flex;
          flex-direction: column;
        }

        .tracker-header {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white;
          padding: 20px;
          text-align: center;
          font-weight: bold;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .tracker-header-title {
          font-size: 1.2rem;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .map-section {
          width: 100%;
          height: 300px;
          border-bottom: 1px solid #e2e8f0;
          position: relative;
        }

        .map-iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }

        .gps-badge {
          position: absolute;
          bottom: 16px;
          left: 16px;
          background: white;
          padding: 6px 12px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          font-size: 0.8rem;
          font-weight: bold;
          color: #ef4444;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .gps-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          animation: ping 1.2s infinite;
        }

        .info-section {
          padding: 24px;
          background: white;
          border-top-left-radius: 24px;
          border-top-right-radius: 24px;
          margin-top: -20px;
          position: relative;
          z-index: 10;
          flex: 1;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.04);
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .status-badge {
          background: #fef2f2;
          color: #ef4444;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
        }

        .eta-badge {
          background: #ef4444;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
        }

        .progress-bar-container {
          width: 100%;
          height: 10px;
          background: #e2e8f0;
          border-radius: 5px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ef4444, #f59e0b);
          border-radius: 5px;
          transition: width 0.4s ease;
        }

        .driver-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 16px;
          border-radius: 16px;
          margin-bottom: 24px;
        }

        .driver-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 1.1rem;
        }

        .license-plate {
          display: inline-block;
          background: #fef08a;
          border: 1px solid #eab308;
          color: #1e293b;
          font-size: 0.72rem;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 4px;
          margin-top: 6px;
          font-family: monospace;
        }

        .btn-call {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-step {
          display: flex;
          gap: 16px;
          opacity: 0.4;
          transition: opacity 0.3s;
        }

        .timeline-step.active {
          opacity: 1;
        }

        .timeline-dot {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #cbd5e1;
          margin-top: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .timeline-step.active .timeline-dot {
          background: #ef4444;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
        }

        .timeline-label {
          font-weight: bold;
          font-size: 0.9rem;
          color: #1e293b;
        }

        .timeline-desc {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 2px;
        }
      `}</style>

      {/* Title Header */}
      <header className="tracker-header">
        <h1 className="tracker-header-title">
          <FiAlertTriangle className="animate-pulse" />
          <span>MedAstraX Emergency Tracker</span>
        </h1>
      </header>

      {/* Map Section */}
      <div className="map-section">
        <iframe
          className="map-iframe"
          title="Ambulance Live Location"
          src={`https://maps.google.com/maps?q=${lat},${lon}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
          loading="lazy"
        ></iframe>
        <div className="gps-badge">
          <span className="gps-dot"></span>
          Live GPS Tracking Active
        </div>
      </div>

      {/* Bottom Sheet Details */}
      <div className="info-section">
        <div className="status-header">
          <div>
            <span className="status-badge">
              {ambulanceStep === 0 ? 'Dispatched' : ambulanceStep === 1 ? 'En Route' : 'Arrived'}
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '6px 0 0 0', color: '#1e293b' }}>
              Ambulance for {patientName}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Destination: {hospitalName}
            </p>
          </div>
          <div className="eta-badge">
            {ambulanceStep === 2 ? 'ARRIVED' : `${Math.ceil(ambulanceEta / 60)} MINS`}
          </div>
        </div>

        {/* Progress bar */}
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${ambulanceProgress}%` }}></div>
        </div>

        {/* Driver Details */}
        <div className="driver-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="driver-avatar">RK</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>
                Ramesh Kumar <span style={{ fontSize: '0.75rem', background: '#10b981', color: 'white', padding: '1px 5px', borderRadius: '4px' }}>4.9 ★</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                Emergency Ambulance Driver
              </div>
              <div className="license-plate">MH-02-EA-9911</div>
            </div>
          </div>
          <a href="tel:+919988776655" className="btn-call">
            <FiPhone size={18} />
          </a>
        </div>

        {/* Journey Timeline */}
        <div className="timeline">
          <div className={`timeline-step ${ambulanceStep >= 0 ? 'active' : ''}`}>
            <div className="timeline-dot">
              {ambulanceStep > 0 && <FiCheck size={10} color="white" />}
            </div>
            <div>
              <div className="timeline-label">Ambulance Dispatched</div>
              <div className="timeline-desc">Departed from {hospitalName}. Medical team prepped.</div>
            </div>
          </div>

          <div className={`timeline-step ${ambulanceStep >= 1 ? 'active' : ''}`}>
            <div className="timeline-dot">
              {ambulanceStep > 1 && <FiCheck size={10} color="white" />}
            </div>
            <div>
              <div className="timeline-label">En Route to Location</div>
              <div className="timeline-desc">Navigating using active traffic signals.</div>
            </div>
          </div>

          <div className={`timeline-step ${ambulanceStep >= 2 ? 'active' : ''}`}>
            <div className="timeline-dot"></div>
            <div>
              <div className="timeline-label">Arrived at Destination</div>
              <div className="timeline-desc">Ambulance has reached your location. prepare for pickup.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackAmbulancePage;
