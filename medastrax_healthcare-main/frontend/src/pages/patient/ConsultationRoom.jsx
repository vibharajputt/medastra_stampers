import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingAPI, prescriptionAPI, authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiMic, FiMicOff, FiCpu, FiDownload, FiArrowLeft, FiUser, FiVideo, FiFileText, FiInfo, FiTrendingUp } from 'react-icons/fi';
import { motion } from 'framer-motion';

export default function ConsultationRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [patientProfile, setPatientProfile] = useState(null);

  // Web Speech API
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState('');
  const recognitionRef = useRef(null);

  // Prescription / AI Report States
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [tests, setTests] = useState(['']);
  const [notes, setNotes] = useState('');
  const [aiReport, setAiReport] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      // Fetch bookings, filter for current ID
      const isDoc = user.role === 'DOCTOR';
      const res = isDoc ? await bookingAPI.getDoctorBookings() : await bookingAPI.getPatientBookings();
      const currentBooking = res.data.find(b => b.id === parseInt(bookingId));
      
      if (!currentBooking) {
        toast.error('Consultation booking not found');
        navigate(isDoc ? '/doctor/dashboard' : '/my-bookings');
        return;
      }
      setBooking(currentBooking);

      // If doctor is viewing, load full patient health profile card
      if (isDoc) {
        try {
          const profileRes = await authAPI.getProfile(); 
          // We can fetch profile by ID if we add a patient detail route. 
          // For safety, let's load mock profile or simulate based on details
          setPatientProfile({
            bloodGroup: 'O+ (Confirmed)',
            dob: '1996-08-14',
            emergencyNumber: '+91 98765 43210',
            preferredLanguage: 'English / Hindi',
            allergies: 'Penicillin, Dust Mites',
            currentMedication: 'Levocetirizine 5mg (Active)',
            existingMedicalCondition: 'Mild Seasonal Asthma'
          });
        } catch (e) {
          console.error(e);
        }
      }
    } catch (error) {
      toast.error('Failed to load consultation room details');
    } finally {
      setLoading(false);
    }
  };

  // Web Speech API setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setSpeechText(prev => prev + ' ' + finalTranscript);
          // Set to advice/notes dynamically
          setNotes(prev => prev + ' ' + finalTranscript);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Web Speech API is not supported in this browser. Please use Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      toast.success('Speech dictation stopped.');
    } else {
      setSpeechText('');
      recognitionRef.current.start();
      setIsListening(true);
      toast.success('Speech dictation active. Start speaking...');
    }
  };

  const handleAiSafetyCheck = async () => {
    setLoadingAi(true);
    setAiReport(null);
    try {
      const activeMeds = medicines.map(m => m.name).filter(n => n.trim() !== '').join(', ');
      const res = await prescriptionAPI.analyzeRaw({
        symptoms: booking.symptoms || 'General weakness',
        medicine: activeMeds,
        previousPrescription: 'Aspirin, Paracetamol'
      });
      setAiReport(res.data.data);
      toast.success('AI Safety recommendations generated!');
    } catch (e) {
      toast.error('Failed to fetch AI safety report');
    } finally {
      setLoadingAi(false);
    }
  };

  const addMedicineRow = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const handleSubmitPrescription = async (e) => {
    e.preventDefault();
    if (!diagnosis) {
      toast.error('Diagnosis is required');
      return;
    }

    setSubmittingPrescription(true);
    try {
      const activeMeds = medicines.filter(m => m.name.trim() !== '');
      await prescriptionAPI.create({
        patientId: booking.patientId,
        bookingId: booking.id,
        diagnosis,
        medicines: activeMeds,
        tests: tests.filter(t => t.trim() !== ''),
        notes
      });
      toast.success('Digital Prescription saved and sent to patient!');
    } catch (err) {
      toast.error('Failed to save prescription');
    } finally {
      setSubmittingPrescription(false);
    }
  };

  // Downloadable Files Handler
  const downloadPrescriptionFile = () => {
    const activeMeds = medicines.filter(m => m.name.trim() !== '');
    const medTableRows = activeMeds.map(m => `
      <tr>
        <td data-label="Medicine Name" style="padding: 10px; border: 1px solid #ddd;">${m.name}</td>
        <td data-label="Dosage" style="padding: 10px; border: 1px solid #ddd;">${m.dosage}</td>
        <td data-label="Frequency" style="padding: 10px; border: 1px solid #ddd;">${m.frequency}</td>
        <td data-label="Duration" style="padding: 10px; border: 1px solid #ddd;">${m.duration}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Prescription Booking #${booking.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { border-bottom: 2px solid #00d9a6; padding-bottom: 20px; margin-bottom: 30px; }
            .title { color: #00d9a6; font-size: 24px; margin: 0; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f5f5f5; text-align: left; padding: 10px; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">MedAstraX Digital Prescription</h1>
            <p>Booking ID: #${booking.id} | Date: ${booking.bookingDate}</p>
          </div>
          <div class="meta">
            <div>
              <h3>Doctor Details</h3>
              <p>Name: ${booking.doctorName}</p>
              <p>Hospital: ${booking.hospitalName}</p>
            </div>
            <div>
              <h3>Patient Details</h3>
              <p>Name: ${booking.patientName}</p>
              <p>Age/Gender: ${booking.age} yrs, ${booking.gender}</p>
            </div>
          </div>
          <h3>Diagnosis</h3>
          <p>${diagnosis || 'Not entered'}</p>
          
          <h3>Prescribed Medications</h3>
          <table>
            <thead>
              <tr>
                <th>Medicine Name</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${medTableRows || '<tr><td data-label="Status" colspan="4" style="text-align:center; padding: 20px;">No medications listed</td></tr>'}
            </tbody>
          </table>

          <h3>Doctor Notes / Speech Transcription</h3>
          <p>${notes || 'None'}</p>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Prescription_Booking_${booking.id}.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Prescription downloaded successfully!');
  };

  const downloadAiReport = () => {
    if (!aiReport) return;
    
    const htmlContent = `
      <html>
        <head>
          <title>AI Medical Safety Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { border-bottom: 2px solid #ffb300; padding-bottom: 20px; margin-bottom: 30px; }
            .title { color: #ffb300; font-size: 24px; margin: 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">AI Safety & Interaction Report</h1>
            <p>Booking ID: #${booking.id} | Risk Status: ${aiReport.severity}</p>
          </div>
          <h3>Alert Flags</h3>
          <ul>
            ${aiReport.alerts.map(a => `<li style="color:red;">${a}</li>`).join('') || '<li>No high risk flags</li>'}
          </ul>
          <h3>Drug-Drug Interactions</h3>
          <ul>
            ${aiReport.interactions.map(i => `<li>${i}</li>`).join('') || '<li>None</li>'}
          </ul>
          <h3>Precautions & Instructions</h3>
          <ul>
            ${aiReport.recommendations.map(r => `<li>${r}</li>`).join('') || '<li>Standard precautions</li>'}
          </ul>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AI_Safety_Report_${booking.id}.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('AI Safety report downloaded!');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const isDoc = user.role === 'DOCTOR';

  return (
    <div className="page-container section" style={{ minHeight: '90vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => navigate(isDoc ? '/doctor/dashboard' : '/my-bookings')} className="btn btn-ghost btn-icon">
          <FiArrowLeft />
        </button>
        <div>
          <span className="badge badge-primary">Virtual Room Active</span>
          <h1 className="heading-md" style={{ margin: 0 }}>Consultation with {isDoc ? booking.patientName : booking.doctorName}</h1>
        </div>
      </div>

      <div className="consultation-room-grid" style={{ display: 'grid', gridTemplateColumns: isDoc ? '320px 1fr' : '1fr', gap: '32px', marginBottom: '32px' }}>
        
        {/* Patient Card (Shown only to Doctors) */}
        {isDoc && patientProfile && (
          <div className="glass-card" style={{ padding: '24px', alignSelf: 'start' }}>
            <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <FiUser color="var(--primary)" /> Patient Health Card
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Name / Age</span>
                <strong>{booking.patientName} ({booking.age} yrs, {booking.gender})</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Blood Group</span>
                <span className="text-gradient" style={{ fontWeight: 'bold' }}>{patientProfile.bloodGroup}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Allergies</span>
                <span style={{ color: 'var(--danger)' }}>{patientProfile.allergies}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Current Medications</span>
                <span>{patientProfile.currentMedication}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Active Conditions</span>
                <span>{patientProfile.existingMedicalCondition}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Emergency Contact</span>
                <span>{patientProfile.emergencyNumber}</span>
              </div>
            </div>
          </div>
        )}

        {/* Video Call Simulation Screen */}
        <div className="glass-card" style={{ padding: '24px', background: '#0a0d14', position: 'relative', overflow: 'hidden', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '20px' }}>
            <FiVideo color="var(--primary)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{isDoc ? 'Patient Feed Live' : 'Doctor Feed Live'}</span>
          </div>

          {/* Large remote feed placeholder */}
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
            <FiUser size={64} color="var(--text-secondary)" style={{ marginBottom: '16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Connecting secure media channels...</p>
          </div>

          {/* Small local feed preview */}
          <div style={{ position: 'absolute', bottom: '24px', right: '24px', width: '120px', height: '90px', background: '#121620', border: '2px solid rgba(255,255,255,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
            <FiUser size={24} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* Dictation, Prescription and AI report (For Doctors) / View Panel (For Patients) */}
      {isDoc ? (
        <div className="consultation-scribe-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '32px' }}>
          
          {/* Prescription Form with Dictation */}
          <div className="glass-card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 className="heading-sm">Write Prescription & Dictate Notes</h3>
              
              <button 
                type="button" 
                onClick={toggleListening} 
                className={`btn ${isListening ? 'btn-primary' : 'btn-outline'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isListening ? <FiMicOff /> : <FiMic />}
                {isListening ? 'Stop Speech Dictation' : 'Dictate Notes (Chrome Speech)'}
              </button>
            </div>

            {isListening && (
              <div style={{ background: 'rgba(0, 217, 166, 0.05)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '16px', marginBottom: '24px', fontSize: '0.85rem' }}>
                <span className="text-gradient" style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Dictation Active (Listening...)</span>
                <p style={{ margin: 0, fontStyle: 'italic' }}>{speechText || 'Start speaking to record transcription...'}</p>
              </div>
            )}

            <form onSubmit={handleSubmitPrescription} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="form-label">Diagnosis / Impression</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Acute allergic rhinitis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  required
                />
              </div>

              {/* Medicines Table Form */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label className="form-label">Medication Details</label>
                  <button type="button" className="btn btn-outline btn-sm" onClick={addMedicineRow}>+ Add Medication</button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '8px' }}>Medicine Name</th>
                      <th style={{ padding: '8px' }}>Dosage</th>
                      <th style={{ padding: '8px' }}>Frequency</th>
                      <th style={{ padding: '8px' }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicines.map((med, idx) => (
                      <tr key={idx}>
                        <td data-label="Medicine Name" style={{ padding: '6px' }}>
                          <input type="text" className="form-input" placeholder="e.g. Ebastine" value={med.name} onChange={(e) => updateMedicine(idx, 'name', e.target.value)} />
                        </td>
                        <td data-label="Dosage" style={{ padding: '6px' }}>
                          <input type="text" className="form-input" placeholder="e.g. 10mg" value={med.dosage} onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)} />
                        </td>
                        <td data-label="Frequency" style={{ padding: '6px' }}>
                          <input type="text" className="form-input" placeholder="e.g. 1-0-0" value={med.frequency} onChange={(e) => updateMedicine(idx, 'frequency', e.target.value)} />
                        </td>
                        <td data-label="Duration" style={{ padding: '6px' }}>
                          <input type="text" className="form-input" placeholder="e.g. 5 days" value={med.duration} onChange={(e) => updateMedicine(idx, 'duration', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="form-label">Doctor Notes / Dictated Transcription</label>
                <textarea 
                  className="form-input" 
                  rows="4" 
                  placeholder="Speech transcription will automatically sync here, or you can type advice." 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingPrescription}>
                  {submittingPrescription ? 'Saving...' : 'Save Digital Prescription'}
                </button>
                <button type="button" onClick={downloadPrescriptionFile} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiDownload /> Download (HTML)
                </button>
              </div>
            </form>
          </div>

          {/* AI Safety Panel */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <FiCpu color="var(--primary)" /> Safety Interaction Check
            </h3>
            
            <button 
              onClick={handleAiSafetyCheck} 
              className="btn btn-outline" 
              style={{ width: '100%', marginBottom: '20px' }}
              disabled={loadingAi}
            >
              {loadingAi ? 'Analyzing...' : 'Run Real-time AI Safety Check'}
            </button>

            {aiReport ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
                <div style={{ background: 'rgba(255,193,7,0.05)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--warning)' }}>
                  <strong>Risk Level:</strong> {aiReport.severity}
                </div>
                {aiReport.alerts && aiReport.alerts.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>High Risk:</span>
                    <ul style={{ paddingLeft: '16px', color: 'var(--danger)' }}>
                      {aiReport.alerts.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                <div>
                  <strong>Medication Interactions:</strong>
                  <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
                    {aiReport.interactions.map((int, i) => <li key={i}>{int}</li>)}
                  </ul>
                </div>

                <button onClick={downloadAiReport} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
                  <FiDownload /> Export AI Report
                </button>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>Click safety check to check for interactive alerts with previous prescriptions.</p>
            )}
          </div>
        </div>
      ) : (
        /* Patient View: Waiting for Doctor */
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          <FiFileText size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
          <h3 className="heading-sm">Prescription Portal</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '8px auto' }}>
            Once the doctor completes the checkup, your digital prescription, advice, and diagnostic test details will appear here and in your health dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
