import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

import Navbar from './components/common/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import GlobalQueryBot from './components/common/GlobalQueryBot';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import HelpCenterPage from './pages/HelpCenterPage';
import SupportPage from './pages/SupportPage';
import FAQPage from './pages/FAQPage';

import PatientDashboard from './pages/patient/PatientDashboard';
import CarePlan from './pages/patient/CarePlan';
import BookingPage from './pages/patient/BookingPage';
import MyBookings from './pages/patient/MyBookings';
import MyPrescriptions from './pages/patient/MyPrescriptions';
import PharmacyOrderFlow from './pages/patient/PharmacyOrderFlow';
import DiagnosticOrderFlow from './pages/patient/DiagnosticOrderFlow';
import EmergencyPage from './pages/patient/EmergencyPage';
import TrackAmbulancePage from './pages/patient/TrackAmbulancePage';

import DoctorDashboard from './pages/doctor/DoctorDashboard';

import ActivityHistoryPage from './pages/patient/ActivityHistoryPage';
import BackgroundJobsPage from './pages/patient/BackgroundJobsPage';
import WorkflowsPage from './pages/patient/WorkflowsPage';
import ObservabilityDashboard from './pages/admin/ObservabilityDashboard';
import HealthRecordsPage from './pages/patient/HealthRecordsPage';
import RiskDashboardPage from './pages/patient/RiskDashboardPage';

import ConsultationRoom from './pages/ConsultationRoom';
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
import LabDashboard from './pages/lab/LabDashboard';
import HospitalDashboard from './pages/hospital/HospitalDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

// banner that shows system-wide messages from admin
function BroadcastBanner() {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const checkMsg = () => {
      const active = localStorage.getItem('medastrax_global_broadcast');
      setMsg(active || '');
    };

    checkMsg();
    window.addEventListener('storage', checkMsg);
    const timer = setInterval(checkMsg, 2500);

    return () => {
      window.removeEventListener('storage', checkMsg);
      clearInterval(timer);
    };
  }, []);

  if (!msg) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #EF4444, #F59E0B)',
      color: '#FFFFFF',
      padding: '10px 16px',
      fontSize: '0.88rem',
      fontWeight: '700',
      textAlign: 'center',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.25)',
      position: 'relative',
      zIndex: 99999,
      fontFamily: 'sans-serif',
      letterSpacing: '0.3px',
    }}>
      <span>⚠️ SYSTEM ANNOUNCEMENT: {msg}</span>
      <button
        onClick={() => {
          localStorage.removeItem('medastrax_global_broadcast');
          setMsg('');
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.25)',
          border: 'none',
          color: '#FFFFFF',
          borderRadius: '50%',
          width: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.4)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'}
      >
        ✕
      </button>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#FFFFFF',
                color: '#0F172A',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: '12px',
                boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
              },
              success: {
                iconTheme: {
                  primary: '#0D9488',
                  secondary: '#fff',
                },
              },
            }}
          />
          <BroadcastBanner />
          <Navbar />

          <main className="main-content">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help" element={<HelpCenterPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/track-ambulance" element={<TrackAmbulancePage />} />

              <Route path="/dashboard" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <PatientDashboard />
                </ProtectedRoute>
              } />
              <Route path="/emergency" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <EmergencyPage />
                </ProtectedRoute>
              } />
              <Route path="/care-plan" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <CarePlan />
                </ProtectedRoute>
              } />
              <Route path="/book/:hospitalId" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <BookingPage />
                </ProtectedRoute>
              } />
              <Route path="/my-bookings" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <MyBookings />
                </ProtectedRoute>
              } />
              <Route path="/my-prescriptions" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <MyPrescriptions />
                </ProtectedRoute>
              } />
              <Route path="/order-prescription/:prescriptionId" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <PharmacyOrderFlow />
                </ProtectedRoute>
              } />
              <Route path="/book-diagnostic/:prescriptionId" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <DiagnosticOrderFlow />
                </ProtectedRoute>
              } />

              <Route path="/consultation/:bookingId" element={
                <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR']}>
                  <ConsultationRoom />
                </ProtectedRoute>
              } />

              <Route path="/activity" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <ActivityHistoryPage />
                </ProtectedRoute>
              } />
              <Route path="/background-jobs" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <BackgroundJobsPage />
                </ProtectedRoute>
              } />
              <Route path="/workflows" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <WorkflowsPage />
                </ProtectedRoute>
              } />
              <Route path="/observability" element={
                <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR']}>
                  <ObservabilityDashboard />
                </ProtectedRoute>
              } />
              <Route path="/health-records" element={
                <ProtectedRoute allowedRoles={['PATIENT', 'DOCTOR', 'ADMIN', 'REVIEWER']}>
                  <HealthRecordsPage />
                </ProtectedRoute>
              } />
              <Route path="/risk-dashboard" element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <RiskDashboardPage />
                </ProtectedRoute>
              } />

              <Route path="/doctor/dashboard" element={
                <ProtectedRoute allowedRoles={['DOCTOR']}>
                  <DoctorDashboard />
                </ProtectedRoute>
              } />

              <Route path="/pharmacy/dashboard" element={
                <ProtectedRoute allowedRoles={['PHARMACY']}>
                  <PharmacyDashboard />
                </ProtectedRoute>
              } />

              <Route path="/lab/dashboard" element={
                <ProtectedRoute allowedRoles={['LAB']}>
                  <LabDashboard />
                </ProtectedRoute>
              } />

              <Route path="/hospital/dashboard" element={
                <ProtectedRoute allowedRoles={['HOSPITAL']}>
                  <HospitalDashboard />
                </ProtectedRoute>
              } />

              <Route path="/admin/dashboard" element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>

          <GlobalQueryBot />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
