import { useState, useEffect, useRef } from 'react';
import { aiAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiMic, FiMicOff, FiCpu, FiCopy, FiDownload, FiTrash2, FiX, FiFileText, FiGlobe } from 'react-icons/fi';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function ConsultationScribe({ isOpen, onClose, patientName = 'Patient', doctorName = 'Doctor' }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [language, setLanguage] = useState('en-US'); // 'en-US' or 'hi-IN'
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [recognition, setRecognition] = useState(null);
  
  const transcriptEndRef = useRef(null);

  // Initialize Speech Recognition
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
        toast.error('Microphone permission denied!');
        setIsListening(false);
      }
    };

    rec.onend = () => {
      // Restart if listening should still be active
      if (isListening) {
        try {
          rec.start();
        } catch (err) {
          console.error('Failed to restart speech recognition:', err);
        }
      }
    };

    setRecognition(rec);
  }, [isListening]);

  // Adjust language dynamically
  useEffect(() => {
    if (recognition) {
      recognition.lang = language;
    }
  }, [language, recognition]);

  // Scroll to bottom of transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimTranscript]);

  if (!isOpen) return null;

  const handleToggleListening = () => {
    if (!SpeechRecognition) {
      toast.error('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      if (recognition) {
        recognition.stop();
      }
      toast.success('Live transcription paused.');
    } else {
      setIsListening(true);
      setInterimTranscript('');
      if (recognition) {
        try {
          recognition.start();
          toast.success('🎙️ Live scribe listening...');
        } catch (err) {
          console.error('Failed to start recognition:', err);
        }
      }
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the transcript?')) {
      setTranscript('');
      setInterimTranscript('');
      setReport('');
      toast.success('Transcript cleared.');
    }
  };

  const handleInsertDemo = () => {
    const demoDialogue = `Doctor: Hello ${patientName}, how are you feeling today?
Patient: Hello Doctor. I have had a severe cough and mild fever for the past three days. My chest also feels a bit heavy when I cough.
Doctor: I see. Are you experiencing any shortness of breath or pain in your chest when you breathe normally?
Patient: No, it only hurts a bit when I cough hard. The fever is around 100 degrees.
Doctor: Understood. Do you have any allergies to medications?
Patient: No known allergies.
Doctor: Okay. I will prescribe you a cough syrup for the throat congestion and chest heaviness. Also, take Paracetamol 650mg if your temperature goes above 99 degrees. Try to drink warm water and get plenty of rest for the next 3 days.
Patient: Sure doctor. Should I avoid cold drinks?
Doctor: Yes, absolutely. Avoid cold drinks, oily foods, and do warm salt-water gargles thrice daily. If your fever persists beyond 3 days, please come for a physical checkup.
Patient: Thank you, doctor. I will follow that.`;

    setTranscript(demoDialogue);
    toast.success('Demo conversation transcript loaded! ✨');
  };

  const handleGenerateReport = async () => {
    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText) {
      toast.error('Please record or type some conversation first!');
      return;
    }

    setLoading(true);
    setReport('');
    try {
      const res = await aiAPI.analyzeConsultation(fullText, patientName, doctorName);
      if (res.data.success) {
        setReport(res.data.report);
        toast.success(`Clinical report generated successfully via ${res.data.model}! 🩺`);
      } else {
        toast.error(res.data.error || 'Failed to generate report');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to connect to AI engine.');
    } finally {
      setLoading(false);
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
    element.download = `Consultation_Report_${patientName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Report downloaded! 💾');
  };

  // Helper to parse markdown-like bold syntax and list points
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="report-h1" style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', margin: '24px 0 12px 0', fontSize: '1.4rem' }}>{line.replace('# ', '')}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="report-h2" style={{ color: 'var(--primary)', margin: '20px 0 10px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '6px' }}>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="report-h3" style={{ color: 'var(--text-primary)', margin: '16px 0 8px 0', fontSize: '1.02rem' }}>{line.replace('### ', '')}</h3>;
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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      {/* Styles Injected for animations and elements */}
      <style>{`
        .scribe-container {
          width: 100%;
          max-width: 1050px;
          height: 85vh;
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }
        .pulse-mic-wave {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 20px;
        }
        .pulse-mic-bar {
          width: 3px;
          height: 100%;
          background: #00D9A6;
          border-radius: 99px;
          animation: wave-bounce 1.2s infinite ease-in-out;
        }
        .pulse-mic-bar:nth-child(2) { animation-delay: 0.2s; }
        .pulse-mic-bar:nth-child(3) { animation-delay: 0.4s; }
        .pulse-mic-bar:nth-child(4) { animation-delay: 0.6s; }
        @keyframes wave-bounce {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
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
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      <div className="scribe-container animate-fade-in">
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.4)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiCpu color="var(--primary)" size={20} />
              <h2 className="heading-sm" style={{ margin: 0, fontSize: '1.2rem' }}>MedVerse AI Consultation Co-Pilot</h2>
            </div>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Live scribe recording and analyzing conversation between <strong>Dr. {doctorName}</strong> and <strong>{patientName}</strong>.
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left: Scribe / Speech input */}
          <div style={{
            flex: 1.1,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎙️ Transcription Stream
                {isListening && (
                  <span style={{ fontSize: '0.75rem', color: '#00D9A6', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="pulse-mic-wave">
                      <span className="pulse-mic-bar"></span>
                      <span className="pulse-mic-bar"></span>
                      <span className="pulse-mic-bar"></span>
                      <span className="pulse-mic-bar"></span>
                    </span>
                    Listening...
                  </span>
                )}
              </h3>

              {/* Language selection & demo */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <FiGlobe size={13} />
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.8rem', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="en-US" style={{ background: '#1e293b' }}>English (US)</option>
                    <option value="hi-IN" style={{ background: '#1e293b' }}>Hindi/Hinglish (IN)</option>
                  </select>
                </div>
                
                <button 
                  onClick={handleInsertDemo}
                  className="btn btn-outline btn-sm"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', border: '1px dashed var(--primary)', color: 'var(--primary)' }}
                >
                  ✨ Insert Demo Talk
                </button>
              </div>
            </div>

            {/* Transcript Display Area */}
            <div 
              className="custom-scrollbar"
              style={{
                flex: 1,
                background: 'rgba(15, 23, 42, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {!SpeechRecognition && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--danger)', fontSize: '0.85rem' }}>
                  ⚠️ Web Speech API is not supported in this browser. Please open this page in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> to use live voice transcription. In the meantime, you can use the <strong>Insert Demo Talk</strong> button to test the AI report generation.
                </div>
              )}
              {transcript.trim() === '' && interimTranscript.trim() === '' ? (
                <div style={{
                  margin: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '24px'
                }}>
                  <FiMic size={32} style={{ opacity: 0.4 }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No dialogue recorded yet</h4>
                    <p style={{ margin: 0, fontSize: '0.78rem', maxWidth: '300px' }}>
                      Click "Start Transcription" and speak, or load the demo dialogue to begin.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {transcript}
                    {interimTranscript && (
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                        {interimTranscript}
                      </span>
                    )}
                  </div>
                  <div ref={transcriptEndRef} />
                </>
              )}
            </div>

            {/* Transcription Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <button 
                onClick={handleToggleListening}
                className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: isListening ? '#ef4444' : 'linear-gradient(135deg, #00D9A6, #7C3AED)',
                  border: 'none'
                }}
              >
                {isListening ? (
                  <>
                    <FiMicOff size={16} /> Pause Scribe
                  </>
                ) : (
                  <>
                    <FiMic size={16} /> Start Transcription
                  </>
                )}
              </button>

              <button 
                onClick={handleClear}
                disabled={!transcript && !interimTranscript}
                className="btn btn-outline"
                style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FiTrash2 size={16} /> Clear
              </button>
            </div>
          </div>

          {/* Right: AI Clinical Report output */}
          <div style={{
            flex: 1,
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            background: 'rgba(15, 23, 42, 0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiFileText color="var(--primary)" /> AI Clinical Report
              </h3>

              {report && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={handleCopy} 
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <FiCopy size={13} /> Copy
                  </button>
                  <button 
                    onClick={handleDownload} 
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <FiDownload size={13} /> Download
                  </button>
                </div>
              )}
            </div>

            {/* Report Display Container */}
            <div 
              className="custom-scrollbar"
              style={{
                flex: 1,
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '20px',
                overflowY: 'auto'
              }}
            >
              {loading ? (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(0, 217, 166, 0.2)',
                    borderTop: '3px solid #00D9A6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <div style={{ textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>Analyzing Medical Transcript...</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Astra is parsing symptoms, diagnoses, and plan recommendations.
                    </p>
                  </div>
                </div>
              ) : report ? (
                <div className="report-content" style={{ color: 'var(--text-secondary)' }}>
                  {renderMarkdown(report)}
                </div>
              ) : (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '24px'
                }}>
                  <FiCpu size={32} style={{ opacity: 0.4 }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Awaiting Analysis</h4>
                    <p style={{ margin: 0, fontSize: '0.78rem', maxWidth: '280px' }}>
                      Once you have recorded your dialogue, click "Generate AI Report" below to analyze it.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button 
              onClick={handleGenerateReport}
              disabled={loading || (!transcript && !interimTranscript)}
              className="btn btn-primary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #7C3AED, #00D9A6)',
                border: 'none',
                boxShadow: (!transcript && !interimTranscript) ? 'none' : '0 4px 12px rgba(124, 58, 237, 0.25)'
              }}
            >
              <FiCpu size={16} /> {report ? 'Regenerate AI Report' : 'Generate AI Clinical Report'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
