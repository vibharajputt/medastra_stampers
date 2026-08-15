import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { fileAPI, authAPI, prescriptionAPI, labAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiUpload, FiSettings, FiActivity, FiUser, FiCheck, FiFileText, FiClock, FiEye, FiX, FiCopy } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function LabDashboard() {
  const { user, login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [prescriptions, setPrescriptions] = useState([]);
  const [activeTab, setActiveTab] = useState('tests'); // tests, history, profile
  const [uploading, setUploading] = useState(null); // ID being uploaded
  
  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // AI Summary Modal States
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [selectedPatientName, setSelectedPatientName] = useState('');
  const [selectedTests, setSelectedTests] = useState('');
  const [summaryTab, setSummaryTab] = useState('patient'); // patient, doctor, technician

  const formatStatus = (status) => {
    if (!status) return 'Pending Sample';
    switch (status) {
      case 'PENDING': return 'Pending Sample';
      case 'CONFIRMED': return 'Agent Dispatched';
      case 'SAMPLE_COLLECTED': return 'Sample Collected';
      case 'REPORT_GENERATED': return 'Report Generated';
      case 'COMPLETED': return 'Completed';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return { bg: 'rgba(255,193,7,0.1)', text: 'var(--warning)' };
      case 'CONFIRMED': return { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' };
      case 'SAMPLE_COLLECTED': return { bg: 'rgba(168,85,247,0.1)', text: '#a855f7' };
      case 'REPORT_GENERATED': return { bg: 'rgba(236,72,153,0.1)', text: '#ec4899' };
      case 'COMPLETED': return { bg: 'rgba(40,167,69,0.1)', text: 'var(--success)' };
      default: return { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-secondary)' };
    }
  };

  const getDisplayTests = (testsStr) => {
    if (!testsStr) return [];
    if (testsStr.startsWith('[')) {
      try {
        const parsed = JSON.parse(testsStr);
        return Array.isArray(parsed) ? parsed.map(t => typeof t === 'object' && t !== null ? (t.testName || '') : t) : [];
      } catch (e) {
        return [testsStr];
      }
    }
    return [testsStr];
  };

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const res = await labAPI.getLabBookings();
      setPrescriptions(res.data || []);
    } catch (error) {
      toast.error('Failed to load lab diagnostic requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const uploadRes = await fileAPI.upload(file);
      const imageUrl = uploadRes.data.message;
      await authAPI.updateAvatar(imageUrl);
      
      const updatedUser = { ...user, avatarUrl: imageUrl };
      login({
        token: localStorage.getItem('medastrax_token'),
        ...updatedUser
      });
      toast.success('Lab profile picture updated!');
    } catch (error) {
      toast.error('Failed to upload picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUploadReports = async (prescriptionId, fileList) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(prescriptionId);
    try {
      const formData = new FormData();
      formData.append('requestId', prescriptionId);
      for (let i = 0; i < fileList.length; i++) {
        formData.append('files', fileList[i]);
      }

      await api.post('/lab/reports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Diagnostic reports uploaded & AI Clinical Summary generated successfully!');
      await fetchPrescriptions();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to upload reports');
    } finally {
      setUploading(null);
    }
  };

  const handleCopySummary = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Summary copied to clipboard!');
  };

  // Helper parser for Astra clinical summary output
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
    
    // Fallback if AI didn't format with markers
    if (!technician && !doctor && !patient) {
      return { technician: text, doctor: text, patient: text };
    }
    
    return { technician, doctor, patient };
  };

  const openSummaryModal = (prescription) => {
    setSelectedSummary(prescription.aiSummary || '');
    setSelectedPatientName(prescription.patientName);
    
    const testNames = getDisplayTests(prescription.tests).join(', ');
    setSelectedTests(testNames || 'Routine Diagnostics');
    setSummaryTab('patient'); // Default to Patient tab
  };

  const parsedSections = parseSummary(selectedSummary);

  // Filter lists based on status
  const pendingRequests = prescriptions.filter(p => p.status !== 'COMPLETED');
  const completedHistory = prescriptions.filter(p => p.status === 'COMPLETED');

  return (
    <div className="page-container section" style={{ minHeight: '85vh' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', padding: '32px', marginBottom: '40px', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            overflow: 'hidden',
            border: '3px solid var(--primary)',
            background: '#121620',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <FiUser size={48} color="var(--text-secondary)" />
            )}
          </div>
          <label style={{ 
            position: 'absolute', 
            bottom: '0', 
            right: '0', 
            background: 'var(--primary)', 
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '2px solid #0a0d14'
          }} title="Upload Logo">
            <FiUpload size={16} />
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={uploadingAvatar} />
          </label>
        </div>

        <div style={{ flex: 1 }}>
          <span className="badge badge-primary" style={{ marginBottom: '8px' }}>Diagnostic Center</span>
          <h1 className="heading-lg" style={{ marginBottom: '8px', marginTop: 0 }}>
            Welcome, <span className="text-gradient">{user.name}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Licensed & Certified Testing Center</p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
              <strong>License:</strong> {user.licenseNo || 'Verified'}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
              <strong>City:</strong> {user.city || 'Mumbai'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '32px' }}>
        <button
          onClick={() => setActiveTab('tests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: activeTab === 'tests' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
            color: activeTab === 'tests' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'tests' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
          }}
        >
          <FiActivity /> Diagnostic Test Requests
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: activeTab === 'history' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
            color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
          }}
        >
          <FiClock /> Test History
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: activeTab === 'profile' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
            color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'all 0.2s',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
          }}
        >
          <FiSettings /> Lab Settings
        </button>
      </div>

      {/* Content tabs */}
      {activeTab === 'tests' && (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
          <h2 className="heading-md" style={{ marginBottom: '20px' }}>Testing Requests Queue</h2>
          
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="spinner"></div>
            </div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <FiFileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>No pending diagnostic test requests found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Patient Name</th>
                    <th style={{ padding: '12px' }}>Doctor Name</th>
                    <th style={{ padding: '12px' }}>Prescribed Tests</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label="Patient Name" style={{ padding: '16px 12px', fontWeight: 600 }}>{p.patientName}</td>
                      <td data-label="Doctor Name" style={{ padding: '16px 12px' }}>{p.doctorName}</td>
                      <td data-label="Prescribed Tests" style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {getDisplayTests(p.tests).length > 0 ? (
                            getDisplayTests(p.tests).map((t, idx) => (
                              <span key={idx} className="badge badge-ghost" style={{ fontSize: '0.8rem' }}>{t}</span>
                            ))
                          ) : (
                            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Routine Checkup</span>
                          )}
                        </div>
                      </td>
                      <td data-label="Status" style={{ padding: '16px 12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: getStatusColor(p.status).bg,
                          color: getStatusColor(p.status).text
                        }}>
                          {formatStatus(p.status)}
                        </span>
                      </td>
                      <td data-label="Actions" style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                            <FiUpload /> Upload Reports
                            <input 
                              type="file" 
                              multiple 
                              accept=".pdf,.png,.jpg,.jpeg"
                              style={{ display: 'none' }} 
                              onChange={(e) => handleUploadReports(p.prescriptionId, e.target.files)}
                              disabled={uploading === p.prescriptionId}
                            />
                          </label>
                          {uploading === p.prescriptionId && <div className="spinner spinner-sm"></div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="glass-card animate-fade-in" style={{ padding: '32px' }}>
          <h2 className="heading-md" style={{ marginBottom: '20px' }}>Completed Diagnostic Tests History</h2>
          
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
              <div className="spinner"></div>
            </div>
          ) : completedHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <FiClock size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>No completed test history found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Patient Name</th>
                    <th style={{ padding: '12px' }}>Doctor Name</th>
                    <th style={{ padding: '12px' }}>Prescribed Tests</th>
                    <th style={{ padding: '12px' }}>Uploaded Files</th>
                    <th style={{ padding: '12px' }}>AI Summary</th>
                    <th style={{ padding: '12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {completedHistory.map(p => {
                    // Normalize reportUrls list (support both reportUrls and old reportUrl field)
                    const fileUrls = p.reportUrls && p.reportUrls.length > 0 
                      ? p.reportUrls 
                      : (p.reportUrl ? [p.reportUrl] : []);

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td data-label="Patient Name" style={{ padding: '16px 12px', fontWeight: 600 }}>{p.patientName}</td>
                        <td data-label="Doctor Name" style={{ padding: '16px 12px' }}>{p.doctorName}</td>
                        <td data-label="Prescribed Tests" style={{ padding: '16px 12px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {getDisplayTests(p.tests).length > 0 ? (
                              getDisplayTests(p.tests).map((t, idx) => (
                                <span key={idx} className="badge badge-ghost" style={{ fontSize: '0.8rem' }}>{t}</span>
                              ))
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Routine Checkup</span>
                            )}
                          </div>
                        </td>
                        <td data-label="Uploaded Files" style={{ padding: '16px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {fileUrls.length > 0 ? (
                              fileUrls.map((url, idx) => {
                                const fileName = url.substring(url.lastIndexOf('/') + 1);
                                const shortName = fileName.length > 18 
                                  ? fileName.substring(0, 10) + '...' + fileName.substring(fileName.lastIndexOf('.')) 
                                  : fileName;
                                return (
                                  <a 
                                    key={idx} 
                                    href={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${url}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    style={{ 
                                      color: 'var(--primary)', 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      textDecoration: 'underline', 
                                      fontSize: '0.85rem' 
                                    }}
                                    title={fileName}
                                  >
                                    <FiFileText size={14} /> {shortName}
                                  </a>
                                );
                              })
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No files</span>
                            )}
                          </div>
                        </td>
                        <td data-label="AI Summary" style={{ padding: '16px 12px' }}>
                          {p.aiSummary ? (
                            <button 
                              className="btn btn-secondary btn-sm"
                              onClick={() => openSummaryModal(p)}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '0.85rem' }}
                            >
                              <FiEye /> View AI Summary
                            </button>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Not generated</span>
                          )}
                        </td>
                        <td data-label="Status" style={{ padding: '16px 12px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            background: 'rgba(40,167,69,0.1)',
                            color: 'var(--success)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <FiCheck /> Done
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="glass-card animate-fade-in" style={{ padding: '32px', maxWidth: '600px' }}>
          <h2 className="heading-md" style={{ marginBottom: '24px' }}>Lab Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="form-label">Lab Name</label>
              <input type="text" className="form-input" value={user.name} readOnly />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input type="text" className="form-input" value={user.email} readOnly />
            </div>
            <div>
              <label className="form-label">Address</label>
              <textarea className="form-input" value={user.address || 'Colaba, Mumbai'} readOnly />
            </div>
            <div>
              <label className="form-label">Supported Diagnostics</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {['Blood Pathology', 'X-Ray Imaging', 'MRI & CT Scan', 'Urine Analysis', 'Biochemistry'].map(test => (
                  <span key={test} className="badge badge-primary">{test}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tri-Audience AI Summary Modal */}
      <AnimatePresence>
        {selectedSummary !== null && (
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
          }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              style={{
                background: '#0e121a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                maxWidth: '720px',
                width: '100%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
              }}
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
                  <span className="badge badge-primary" style={{ marginBottom: '4px', fontSize: '0.75rem' }}>Astra AI Analysis</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                    Report Summary: <span className="text-gradient">{selectedPatientName}</span>
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#b0bac5' }}>
                    Tests: {selectedTests}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSummary(null)}
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
                  { id: 'patient', label: "Patient's View", color: '#28a745', rgb: '40, 167, 69' },
                  { id: 'doctor', label: "Doctor's View", color: '#8a2be2', rgb: '138, 43, 226' },
                  { id: 'technician', label: "Technician's View", color: '#007bff', rgb: '0, 123, 255' }
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
                      background: t.color,
                      boxShadow: summaryTab === t.id ? `0 0 8px ${t.color}` : 'none'
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
                      <div style={{ color: '#28a745', fontWeight: 700, marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>❤️</span> Patient-Friendly Summary
                      </div>
                      {parsedSections.patient || 'Loading summary detail...'}
                    </div>
                  )}
                  {summaryTab === 'doctor' && (
                    <div>
                      <div style={{ color: '#c084fc', fontWeight: 700, marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🩺</span> Doctor's Clinical Overview
                      </div>
                      {parsedSections.doctor || 'Loading summary detail...'}
                    </div>
                  )}
                  {summaryTab === 'technician' && (
                    <div>
                      <div style={{ color: '#60a5fa', fontWeight: 700, marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🔬</span> Technical Lab Insights
                      </div>
                      {parsedSections.technician || 'Loading summary detail...'}
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
                  onClick={() => handleCopySummary(selectedSummary)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  <FiCopy /> Copy Full Summary
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setSelectedSummary(null)}
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
