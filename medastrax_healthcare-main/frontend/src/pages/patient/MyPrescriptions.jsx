import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { prescriptionAPI, authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiFileText, 
  FiUser, 
  FiCalendar, 
  FiCpu, 
  FiX, 
  FiFolder,
  FiInfo,
  FiChevronRight,
  FiShoppingBag,
  FiArrowRight,
  FiEye,
  FiCopy,
  FiActivity
} from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function MyPrescriptions() {
  const navigate = useNavigate();
  const { activeProfile } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loadingAnalysisId, setLoadingAnalysisId] = useState(null);
  const [prescriptionReportUrl, setPrescriptionReportUrl] = useState(null);
  const [selectedLabSummary, setSelectedLabSummary] = useState(null);
  const [selectedLabPatient, setSelectedLabPatient] = useState('');
  const [selectedLabTests, setSelectedLabTests] = useState('');
  const [summaryTab, setSummaryTab] = useState('patient');

  const parseSummary = (text) => {
    if (!text) return { technician: '', doctor: '', patient: '' };
    let technician = '';
    let doctor = '';
    let patient = '';
    const techMarker = "### 1. Lab Technician Overview";
    const docMarker = "### 2. Doctor's Clinical Summary";
    const patMarker = "### 3. Patient-Friendly Translation";
    let techIndex = text.indexOf(techMarker);
    let docIndex = text.indexOf(docMarker);
    let patIndex = text.indexOf(patMarker);
    if (techIndex !== -1) {
      let end = docIndex !== -1 ? docIndex : (patIndex !== -1 ? patIndex : text.length);
      technician = text.substring(techIndex + techMarker.length, end).trim();
    }
    if (docIndex !== -1) {
      let end = patIndex !== -1 ? patIndex : text.length;
      doctor = text.substring(docIndex + docMarker.length, end).trim();
    }
    if (patIndex !== -1) {
      patient = text.substring(patIndex + patMarker.length).trim();
    }
    if (!technician && !doctor && !patient) {
      return { technician: text, doctor: text, patient: text };
    }
    return { technician, doctor, patient };
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [activeProfile]);

  async function fetchPrescriptions() {
    try {
      setLoading(true);
      const res = await prescriptionAPI.getPatientPrescriptions(activeProfile ? activeProfile.id : null);
      setPrescriptions(res.data);

      if (!activeProfile) {
        try {
          const profileRes = await authAPI.getProfile();
          setPrescriptionReportUrl(profileRes.data.prescriptionReportUrl || null);
        } catch (err) {
          console.error("Failed to load patient profile for prescription report URL", err);
        }
      } else {
        setPrescriptionReportUrl(null);
      }
    } catch (error) {
      toast.error('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzePrescription = async (id) => {
    try {
      setLoadingAnalysisId(id);
      const res = await prescriptionAPI.analyze(id);
      setAnalysisResult(res.data.data);
    } catch (error) {
      toast.error('Failed to analyze prescription');
    } finally {
      setLoadingAnalysisId(null);
    }
  };

  const parseJson = (str) => {
    try {
      return JSON.parse(str || '[]');
    } catch (e) {
      return [];
    }
  };

  return (
    <div className="page-container section" style={{ minHeight: '85vh' }}>
      
      {/* Styles local to this page */}
      <style>{`
        .prescriptions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .prescription-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-left: 4px solid var(--primary);
        }

        .prescription-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .med-item {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          padding: 6px 0;
          border-bottom: 1px dashed var(--border-color);
        }

        .med-item:last-child {
          border-bottom: none;
        }

        .test-item {
          font-size: 0.85rem;
          padding: 4px 0;
          color: var(--text-secondary);
        }

        .ai-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, rgba(0, 217, 166, 0.1), rgba(0, 229, 255, 0.1));
          border: 1px solid rgba(0, 217, 166, 0.2);
          color: var(--primary);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
        }

        @media (max-width: 640px) {
          .prescriptions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 className="heading-lg">My <span className="text-gradient">Prescriptions</span></h1>
        <p className="auth-subtitle" style={{ marginTop: '8px' }}>
          Access your digital health cards, diagnoses, recommended tests, and prescriptions.
        </p>
      </div>

      <div className="divider"></div>

      {loading ? (
        <div className="prescriptions-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card skeleton" style={{ height: '280px' }}></div>
          ))}
        </div>
      ) : (prescriptions.length === 0 && !prescriptionReportUrl) ? (
        <div className="empty-state glass-card" style={{ padding: '80px 24px' }}>
          <FiFolder className="icon" />
          <h3>No Prescriptions Found</h3>
          <p style={{ maxWidth: '400px', margin: '8px auto 24px auto' }}>
            No prescriptions or test results have been registered for this profile yet.
          </p>
        </div>
      ) : (
        <>
          {/* Order Medicines Banner */}
          <div style={{ background: 'rgba(0,217,166,0.06)', border: '1px solid rgba(0,217,166,0.2)', borderRadius: '14px', padding: '16px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FiShoppingBag color="var(--primary)" size={22} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Ready to order medicines?</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Click <strong>"Order Medicines"</strong> on any prescription card below to pick a pharmacy and get home delivery.</div>
              </div>
            </div>
          </div>

          <div className="prescriptions-grid">
            {prescriptionReportUrl && (
            <div className="glass-card prescription-card" style={{ borderLeft: '4px solid #7C3AED' }}>
              <div className="prescription-card-header">
                <div>
                  <h3 className="heading-sm" style={{ margin: '0 0 4px 0' }}>Previous Hospital Prescription</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiUser /> External Consultation (Self-Uploaded)
                  </span>
                </div>
                <span className="ai-badge" style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(0, 229, 255, 0.1))', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#a78bfa' }}>
                  <FiFolder /> Registration File
                </span>
              </div>
              
              <div className="divider" style={{ margin: '4px 0' }}></div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  This prescription report was uploaded from another hospital during your account setup or profile update.
                </p>
              </div>
              
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)', gap: '10px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Self-Uploaded</span>
                <a 
                  href={prescriptionReportUrl.startsWith('http') ? prescriptionReportUrl : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${prescriptionReportUrl}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '6px 12px', height: '32px', fontSize: '0.8rem', borderRadius: '4px', background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none' }}
                >
                  <FiFileText /> View File
                </a>
              </div>
            </div>
          )}
          <AnimatePresence>
            {prescriptions.map((p, idx) => {
              const medicines = parseJson(p.medicines);
              const tests = parseJson(p.tests);
              const isExternal = p.diagnosis === "External Consultation History";
              const hasAttachment = p.notes && p.notes.includes('/uploads/');
              const attachmentUrl = hasAttachment ? p.notes.substring(p.notes.indexOf('/uploads/')) : '';

              return (
                <motion.div
                  key={p.id}
                  className="glass-card prescription-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {/* Card Header */}
                  <div className="prescription-card-header">
                    <div>
                      <h3 className="heading-sm" style={{ margin: '0 0 4px 0' }}>{p.diagnosis}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiUser /> {isExternal ? "By: External Doctor (Self-Uploaded)" : `By Doc: ${p.doctorName}`}
                      </span>
                    </div>
                    <span className="ai-badge">
                      <FiCpu /> AI Routed
                    </span>
                  </div>

                  <div className="divider" style={{ margin: '4px 0' }}></div>

                  {/* Body Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <div className="card-detail-item" style={{ display: 'flex', gap: '8px', fontSize: '0.85rem' }}>
                      <FiCalendar className="icon" color="var(--primary)" />
                      <span><strong>Date:</strong> {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>

                    {/* Medicines Section */}
                    {medicines.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Medicines Prescribed</strong>
                        {medicines.map((med, i) => (
                          <div key={i} className="med-item">
                            <span><strong>{med.name}</strong> ({med.dosage})</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{med.frequency} | {med.duration}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tests Section */}
                    {tests.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Diagnostic Tests</strong>
                        {tests.map((test, i) => (
                          <div key={i} className="test-item">
                            • <strong>{test.testName}</strong> - <span style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>{test.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {p.status === 'COMPLETED' && ((p.reportUrls && p.reportUrls.length > 0) || p.reportUrl) && (
                      <div style={{ background: 'rgba(0, 217, 166, 0.03)', border: '1px solid rgba(0, 217, 166, 0.15)', borderRadius: '8px', padding: '12px' }}>
                        <strong style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>🔬 Lab Diagnostic Reports</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(p.reportUrls && p.reportUrls.length > 0 ? p.reportUrls : [p.reportUrl]).map((url, idx) => {
                            const fileName = url.substring(url.lastIndexOf('/') + 1);
                            const shortName = fileName.length > 20 ? fileName.substring(0, 12) + '...' + fileName.substring(fileName.lastIndexOf('.')) : fileName;
                            return (
                              <a 
                                key={idx} 
                                href={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${url}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'underline', fontSize: '0.85rem' }}
                              >
                                <FiFileText size={12} /> {shortName}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {p.notes && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        * Notes: {p.notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-color)', gap: '10px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{p.id}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {hasAttachment && (
                        <a 
                          href={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${attachmentUrl}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '6px 12px', height: '32px', fontSize: '0.8rem', borderRadius: '4px' }}
                        >
                          <FiFileText /> View File
                        </a>
                      )}
                      {p.aiSummary && (
                        <button 
                          onClick={() => {
                            setSelectedLabSummary(p.aiSummary);
                            setSelectedLabPatient(p.patientName || activeProfile?.name || 'Patient');
                            setSelectedLabTests(p.tests ? (p.tests.startsWith('[') ? JSON.parse(p.tests).join(', ') : p.tests) : 'Diagnostics');
                            setSummaryTab('patient');
                          }}
                          className="btn btn-outline btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'rgba(0,217,166,0.3)' }}
                        >
                          <FiEye /> Lab Summary
                        </button>
                      )}
                      <button 
                        onClick={() => handleAnalyzePrescription(p.id)}
                        className="btn btn-outline btn-sm"
                        disabled={loadingAnalysisId === p.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', fontSize: '0.8rem' }}
                      >
                        <FiCpu /> {loadingAnalysisId === p.id ? 'Analyzing...' : 'AI Report'}
                      </button>
                      {medicines.length > 0 && (
                        <button 
                          onClick={() => navigate(`/order-prescription/${p.id}`)}
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', fontSize: '0.8rem', background: 'var(--primary)', fontWeight: 700 }}
                        >
                          <FiShoppingBag size={13} /> Order Medicines
                        </button>
                      )}
                      {tests.length > 0 && (
                        <button 
                          onClick={() => navigate(`/book-diagnostic/${p.id}`)}
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', fontSize: '0.8rem', background: '#ec4899', border: 'none', color: '#fff', fontWeight: 700 }}
                        >
                          <FiActivity size={13} /> Contact Diagnostic Lab
                        </button>
                      )}
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        </>
      )}

      {/* AI Analysis Modal */}
      {analysisResult && (
        <div className="modal-overlay" onClick={() => setAnalysisResult(null)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, rgba(0, 217, 166, 0.05), rgba(0, 229, 255, 0.05))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FiCpu color="var(--primary)" size={24} />
                <h3 className="heading-sm" style={{ margin: 0 }}>MedAstraX AI Report</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAnalysisResult(null)} style={{ padding: '4px' }}>
                <FiX size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Diagnosis Confirmed</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {analysisResult.diagnosis}
                </div>
              </div>
              
              <div style={{ padding: '16px', background: 'rgba(0, 217, 166, 0.05)', border: '1px solid rgba(0, 217, 166, 0.1)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <FiInfo /> Recommendation
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                  {analysisResult.recommendation}
                </p>
              </div>

              <div>
                <span className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Automated Care Route</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    PATIENT PROFILE
                  </span>
                  <FiChevronRight color="var(--text-muted)" />
                  <span className={`badge ${analysisResult.nextStep === 'PHARMACY' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                    {analysisResult.nextStep} CHAMBER
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setAnalysisResult(null)}>
                Acknowledge Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tri-Audience AI Lab Summary Modal for Patient */}
      <AnimatePresence>
        {selectedLabSummary !== null && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 7, 12, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }} onClick={() => setSelectedLabSummary(null)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              style={{
                background: '#0e121a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.01)'
              }}>
                <div>
                  <span className="badge badge-primary" style={{ marginBottom: '4px', fontSize: '0.75rem' }}>Astra AI Summary</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                    Lab Summary: <span className="text-gradient">{selectedLabPatient}</span>
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#b0bac5' }}>
                    Prescribed: {selectedLabTests}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedLabSummary(null)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Audience Selector Tabs */}
              <div style={{
                display: 'flex',
                padding: '12px 24px 0 24px',
                background: 'rgba(255,255,255,0.005)',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }}>
                {[
                  { id: 'patient', label: "Patient's View", color: '#28a745' },
                  { id: 'doctor', label: "Doctor's View", color: '#8a2be2' },
                  { id: 'technician', label: "Technician's View", color: '#007bff' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSummaryTab(t.id)}
                    style={{
                      flex: 1,
                      padding: '12px 8px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: summaryTab === t.id ? `3px solid ${t.color}` : '3px solid transparent',
                      color: summaryTab === t.id ? '#fff' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ 
                      display: 'inline-block', 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: t.color
                    }}></span>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1,
                fontSize: '0.95rem',
                lineHeight: 1.6
              }}>
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  minHeight: '180px',
                  background: summaryTab === 'patient' 
                    ? 'rgba(40, 167, 69, 0.03)' 
                    : summaryTab === 'doctor' 
                      ? 'rgba(138, 43, 226, 0.03)' 
                      : 'rgba(0, 123, 255, 0.03)',
                  border: summaryTab === 'patient' 
                    ? '1px solid rgba(40, 167, 69, 0.12)' 
                    : summaryTab === 'doctor' 
                      ? '1px solid rgba(138, 43, 226, 0.12)' 
                      : '1px solid rgba(0, 123, 255, 0.12)',
                  whiteSpace: 'pre-line',
                  color: '#ffffff'
                }}>
                  {summaryTab === 'patient' && (
                    <div>
                      <div style={{ color: '#28a745', fontWeight: 700, marginBottom: '12px', fontSize: '1rem' }}>
                        ❤️ Patient-Friendly Summary
                      </div>
                      {parseSummary(selectedLabSummary).patient || 'Loading summary...'}
                    </div>
                  )}
                  {summaryTab === 'doctor' && (
                    <div>
                      <div style={{ color: '#c084fc', fontWeight: 700, marginBottom: '12px', fontSize: '1rem' }}>
                        🩺 Doctor's Clinical Overview
                      </div>
                      {parseSummary(selectedLabSummary).doctor || 'Loading summary...'}
                    </div>
                  )}
                  {summaryTab === 'technician' && (
                    <div>
                      <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '12px', fontSize: '1rem' }}>
                        🔬 Technical Lab Insights
                      </div>
                      {parseSummary(selectedLabSummary).technician || 'Loading summary...'}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'rgba(255,255,255,0.01)'
              }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedLabSummary);
                    toast.success('Summary copied!');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  <FiCopy /> Copy Full Summary
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setSelectedLabSummary(null)}
                  style={{ padding: '8px 20px', fontSize: '0.9rem' }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
