import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingAPI, aiAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  FiMic, FiMicOff, FiPhoneOff, FiCpu, 
  FiCopy, FiDownload, FiUser, FiActivity, FiGlobe, FiChevronLeft, FiExternalLink
} from 'react-icons/fi';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function ConsultationRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Speech Scribe States
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState('en-US'); // 'en-US' or 'hi-IN'
  const [recognition, setRecognition] = useState(null);
  const [micActive, setMicActive] = useState(true);
  
  // Post-Consultation Report States
  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const transcriptEndRef = useRef(null);
  const autoRedirected = useRef(false);

  // Fetch Booking Details
  useEffect(() => {
    const fetchBooking = async () => {
      try {
        setLoading(true);
        const res = await bookingAPI.getById(bookingId);
        setBooking(res.data);
      } catch (err) {
        toast.error('Failed to load consultation details');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
  }, [bookingId, navigate]);

  // Automatically open the meeting link in a new tab when page loads
  useEffect(() => {
    if (booking && !autoRedirected.current) {
      autoRedirected.current = true;
      const link = booking.meetingLink;
      if (!link || !link.trim()) {
        toast.error('No meeting link found! Redirecting...');
        navigate(user?.role === 'DOCTOR' ? '/doctor/dashboard' : '/dashboard');
        return;
      }
      const url = link.startsWith('http') ? link : `https://${link}`;
      
      toast.success('Launching Google Meet / Zoom in a new window... 🎥');
      setTimeout(() => {
        window.open(url, '_blank');
      }, 800);
    }
  }, [booking, bookingId, navigate, user?.role]);

  // Initialize Speech Recognition (Web Speech API)
  useEffect(() => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    
    rec.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setTranscript((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Microphone permission denied! Background scribe deactivated.');
        setMicActive(false);
      }
    };

    rec.onend = () => {
      // Auto-restart if mic is still toggle-active
      if (micActive) {
        try {
          rec.start();
        } catch (err) {
          console.error('Failed to restart speech recognition:', err);
        }
      }
    };

    setRecognition(rec);
  }, [micActive]);

  // Listen language changes
  useEffect(() => {
    if (recognition) {
      recognition.lang = language;
    }
  }, [language, recognition]);

  // Auto-start transcription when booking loads
  useEffect(() => {
    if (recognition && micActive && !loading) {
      try {
        recognition.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
    return () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
      }
    };
  }, [recognition, loading]);

  const toggleMic = () => {
    if (micActive) {
      setMicActive(false);
      if (recognition) recognition.stop();
      toast.success('Microphone transcription paused');
    } else {
      setMicActive(true);
      toast.success('Microphone transcription resumed');
    }
  };

  const handleOpenMeeting = () => {
    if (booking && booking.meetingLink) {
      const link = booking.meetingLink;
      const url = link.startsWith('http') ? link : `https://${link}`;
      window.open(url, '_blank');
      toast.success('Re-opening Google Meet / Zoom window...');
    } else {
      toast.error('No meeting link configured.');
    }
  };

  const handleEndConsultation = async () => {
    setMicActive(false);
    if (recognition) recognition.stop();

    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText) {
      toast.success('Consultation ended. No speech recorded.');
      navigate(user.role === 'DOCTOR' ? '/doctor/dashboard' : '/dashboard');
      return;
    }

    // 2. Generate report
    setShowReportModal(true);
    setReportLoading(true);
    try {
      const res = await aiAPI.analyzeConsultation(
        fullText, 
        booking?.patientName || 'Patient', 
        booking?.doctorName || 'Doctor'
      );
      if (res.data.success) {
        const generatedReport = res.data.report;
        setReport(generatedReport);
        
        // 3. Save report to database!
        await bookingAPI.updateAiReport(bookingId, generatedReport);
        toast.success(`Clinical summary generated & saved to database successfully! 🩺`);
      } else {
        toast.error(res.data.error || 'Failed to generate report');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to analyze consultation speech.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    toast.success('Report copied to clipboard! 📋');
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([report], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Clinical_Report_${(booking?.patientName || 'Patient').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Report downloaded successfully! 💾');
  };

  const handleCloseReport = () => {
    setShowReportModal(false);
    navigate(user.role === 'DOCTOR' ? '/doctor/dashboard' : '/dashboard');
  };

  // Helper to parse markdown bold and list points
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', margin: '24px 0 12px 0', fontSize: '1.4rem' }}>{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} style={{ color: 'var(--primary)', margin: '20px 0 10px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '6px' }}>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} style={{ color: 'var(--text-primary)', margin: '16px 0 8px 0', fontSize: '1.02rem' }}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('- ')) {
        const rawContent = line.replace('- ', '');
        return (
          <li key={idx} style={{ marginLeft: '16px', marginBottom: '6px', listStyleType: 'disc', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            {parseBoldText(rawContent)}
          </li>
        );
      }
      if (line.trim() === '') return <div key={idx} style={{ height: '8px' }}></div>;
      return <p key={idx} style={{ marginBottom: '8px', color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.88rem' }}>{parseBoldText(line)}</p>;
    });
  };

  const parseBoldText = (text) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{part}</strong>;
      }
      return part;
    });
  };

  if (loading) {
    return (
      <div className="page-container flex-center" style={{ height: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0, 217, 166, 0.2)', borderTop: '3px solid #00D9A6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ color: 'var(--text-secondary)' }}>Opening background transcription portal...</p>
      </div>
    );
  }

  return (
    <div className="page-container section flex-center" style={{ minHeight: '80vh', padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Visualizer and pulse animations */}
      <style>{`
        .companion-card {
          width: 100%;
          max-width: 650px;
          background: rgba(30, 41, 59, 0.65);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          padding: 40px 32px;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
        .visualizer-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 80px;
          margin: 16px 0;
        }
        .visualizer-bar {
          width: 4px;
          height: 20px;
          background: var(--primary);
          border-radius: 99px;
          animation: bar-bounce 1s infinite ease-in-out;
        }
        .visualizer-bar:nth-child(1) { height: 30px; animation-delay: 0.1s; }
        .visualizer-bar:nth-child(2) { height: 45px; animation-delay: 0.2s; }
        .visualizer-bar:nth-child(3) { height: 60px; animation-delay: 0.3s; }
        .visualizer-bar:nth-child(4) { height: 75px; animation-delay: 0.4s; background: #00D9A6; }
        .visualizer-bar:nth-child(5) { height: 60px; animation-delay: 0.5s; }
        .visualizer-bar:nth-child(6) { height: 45px; animation-delay: 0.6s; }
        .visualizer-bar:nth-child(7) { height: 30px; animation-delay: 0.7s; }
        
        @keyframes bar-bounce {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1.1); }
        }
        .scribe-pulse {
          width: 12px;
          height: 12px;
          background: #00D9A6;
          border-radius: 50%;
          display: inline-block;
          animation: pulse-glow 1.6s infinite;
        }
        @keyframes pulse-glow {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 217, 166, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 217, 166, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 217, 166, 0); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 99px;
        }
      `}</style>

      <div className="companion-card animate-fade-in">
        
        {/* Scribe Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 217, 166, 0.15)', color: '#00D9A6', padding: '6px 16px', borderRadius: '99px', fontSize: '0.82rem', fontWeight: 'bold' }}>
          <span className="scribe-pulse"></span>
          <span>AI Consultation scribe Active</span>
        </div>

        {/* Info */}
        <div>
          <h2 className="heading-sm" style={{ margin: 0, fontSize: '1.4rem' }}>MedAstraX AI Consultation Co-Pilot</h2>
          <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.5' }}>
            Meeting between <strong>Dr. {booking?.doctorName}</strong> and <strong>{booking?.patientName}</strong> is running in a separate tab.
            Keep this tab open in the background to transcribe the conversation.
          </p>
        </div>

        {/* Equalizer Visualizer */}
        {micActive ? (
          <div className="visualizer-container">
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
          </div>
        ) : (
          <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', margin: '16px 0' }}>
            🎙️ Mic Scribe Paused
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
          <button 
            onClick={toggleMic}
            className="btn btn-outline"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {micActive ? (
              <>
                <FiMicOff /> Pause Transcription
              </>
            ) : (
              <>
                <FiMic /> Resume Transcription
              </>
            )}
          </button>
          
          <button 
            onClick={handleOpenMeeting}
            className="btn btn-outline"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <FiExternalLink /> Re-Open Video Call
          </button>
        </div>

        <div style={{ width: '100%', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', margin: '8px 0' }}></div>

        {/* Language & Scribe Guide */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiGlobe />
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="en-US" style={{ background: '#1e293b' }}>English (US)</option>
              <option value="hi-IN" style={{ background: '#1e293b' }}>Hindi/Hinglish</option>
            </select>
          </div>

          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Web Speech API is running in the background.
          </span>
        </div>

        {/* End Meeting & Generate Report */}
        <button 
          onClick={handleEndConsultation}
          className="btn btn-primary"
          style={{
            width: '100%',
            height: '50px',
            fontSize: '0.95rem',
            background: '#ef4444',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
            marginTop: '12px'
          }}
        >
          <FiPhoneOff /> End Meeting & Generate Report
        </button>
      </div>

      {/* Full-Screen Report Overlay Modal */}
      {showReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.95)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="glass-card animate-scale-up" style={{
            width: '100%',
            maxWidth: '700px',
            height: '80vh',
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCpu /> MedAstraX AI Consultation Report
                </h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  Scribe report generated for patient <strong>{booking?.patientName}</strong>.
                </p>
              </div>
            </div>

            {/* Content Display */}
            <div 
              className="custom-scrollbar"
              style={{
                flex: 1,
                padding: '24px',
                overflowY: 'auto',
                background: 'rgba(15, 23, 42, 0.3)'
              }}
            >
              {reportLoading ? (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid rgba(0, 217, 166, 0.2)', borderTop: '3px solid #00D9A6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <div style={{ textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Analyzing Scribe transcript...</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Extracting complaints, diagnosis, and prescription details.</p>
                  </div>
                </div>
              ) : report ? (
                <div style={{ color: 'var(--text-secondary)' }}>
                  {renderMarkdown(report)}
                </div>
              ) : (
                <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '24px' }}>
                  Failed to generate report summary.
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleDownload} 
                  disabled={reportLoading || !report}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiDownload /> Download Report (.txt)
                </button>
                <button 
                  onClick={handleCopy} 
                  disabled={reportLoading || !report}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiCopy /> Copy Report
                </button>
              </div>

              <button 
                onClick={handleCloseReport}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none' }}
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
