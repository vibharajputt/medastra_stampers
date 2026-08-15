import React, { useState, useEffect } from 'react';
import { bookingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { 
  FiFileText, FiUser, FiActivity, FiArrowLeft, 
  FiDownload, FiSave, FiCheckCircle, FiClock, FiCpu 
} from 'react-icons/fi';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import './HealthRecordsPage.css';

export default function HealthRecordsPage() {
  const { user } = useAuth();
  
  // Scoping options
  const roles = [
    { value: 'PATIENT', label: 'Patient View' },
    { value: 'DOCTOR', label: 'Doctor / Clinician View' },
    { value: 'ADMIN', label: 'Admin View' },
    { value: 'REVIEWER', label: 'Reviewer / Investigator' }
  ];

  const statuses = [
    { value: 'ALL', label: 'All Records' },
    { value: 'NONE', label: 'No Follow-up' },
    { value: 'PENDING', label: 'Pending Follow-up' },
    { value: 'SCHEDULED', label: 'Scheduled Follow-up' },
    { value: 'COMPLETED', label: 'Completed Follow-up' }
  ];

  const [currentRole, setCurrentRole] = useState('PATIENT');
  const [currentStatus, setCurrentStatus] = useState('ALL');
  const [records, setRecords] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, scheduled: 0, completed: 0, none: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Edit fields for clinician/doctor
  const [followUpStatus, setFollowUpStatus] = useState('NONE');
  const [clinicianNote, setClinicianNote] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Default the active tab to Doctor or Admin if the user holds that role
    if (user?.role === 'DOCTOR') {
      setCurrentRole('DOCTOR');
    } else if (user?.role === 'ADMIN') {
      setCurrentRole('ADMIN');
    }
  }, [user]);

  useEffect(() => {
    fetchRecords();
  }, [currentRole, currentStatus]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await bookingAPI.getRoleRecords(currentRole, currentStatus);
      if (res.data && res.data.success) {
        const payload = res.data.data;
        setRecords(payload.records || []);
        setCounts(payload.counts || { total: 0, pending: 0, scheduled: 0, completed: 0, none: 0 });
      }
    } catch (e) {
      toast.error('Failed to load health records');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecord = (record) => {
    setSelectedRecord(record);
    setFollowUpStatus(record.followUpStatus || 'NONE');
    setClinicianNote(record.clinicianNote || '');
    setAiRecommendations(record.aiRecommendations || '');
  };

  const handleUpdateFollowUp = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;

    setUpdating(true);
    try {
      const res = await bookingAPI.updateFollowUp(selectedRecord.id, {
        followUpStatus,
        clinicianNote,
        aiRecommendations
      });
      if (res.data && res.data.success) {
        toast.success('Record follow-up details saved!');
        
        // Update selected record state & main list
        const updated = res.data.data.data;
        setSelectedRecord(updated);
        setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
        
        // Refresh counts
        fetchRecords();
      }
    } catch (err) {
      toast.error('Failed to save follow-up details');
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const downloadPDFReport = (record) => {
    if (!record) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = 20;

    const checkPageBreak = (neededHeight) => {
      if (currentY + neededHeight > pageHeight - margin) {
        doc.addPage();
        currentY = margin;
        
        // Running page header
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`MedAstraX Report - Patient: ${record.patientName}`, margin, 10);
        doc.line(margin, 12, pageWidth - margin, 12);
        currentY = 20;
      }
    };

    // Main Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0, 217, 166); // primary mediverse theme color
    doc.text('MEDASTRAX HEALTH RECORD SUMMARY', pageWidth / 2, currentY, { align: 'center' });
    currentY += 8;

    doc.setDrawColor(0, 217, 166);
    doc.setLineWidth(0.6);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 10;

    // Metadata details
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    // Grid Layout for info
    doc.setFont('Helvetica', 'bold');
    doc.text('Patient Name:', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(record.patientName || 'N/A', margin + 35, currentY);

    doc.setFont('Helvetica', 'bold');
    doc.text('Clinician / Doctor:', pageWidth / 2, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(record.doctorName || 'N/A', pageWidth / 2 + 35, currentY);
    currentY += 6;

    doc.setFont('Helvetica', 'bold');
    doc.text('Age / Gender:', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${record.age || 'N/A'} / ${record.gender || 'N/A'}`, margin + 35, currentY);

    doc.setFont('Helvetica', 'bold');
    doc.text('Facility:', pageWidth / 2, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(record.hospitalName || 'N/A', pageWidth / 2 + 35, currentY);
    currentY += 6;

    doc.setFont('Helvetica', 'bold');
    doc.text('Date of Record:', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(new Date(record.bookingDate).toLocaleDateString() || 'N/A', margin + 35, currentY);

    doc.setFont('Helvetica', 'bold');
    doc.text('Follow-up Status:', pageWidth / 2, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(record.followUpStatus || 'NONE', pageWidth / 2 + 35, currentY);
    currentY += 12;

    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 8;

    // Chief Complaint/Symptoms
    checkPageBreak(30);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Chief Complaint & Symptoms:', margin, currentY);
    currentY += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    const symptomsText = doc.splitTextToSize(record.symptoms || 'No symptoms registered.', pageWidth - 2 * margin);
    doc.text(symptomsText, margin, currentY);
    currentY += symptomsText.length * 5 + 6;

    // AI Clinical Summary
    if (record.aiReport) {
      checkPageBreak(50);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('AI Clinical Summary:', margin, currentY);
      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      const aiReportText = doc.splitTextToSize(record.aiReport, pageWidth - 2 * margin);
      doc.text(aiReportText, margin, currentY);
      currentY += aiReportText.length * 5 + 6;
    }

    // AI Recommendations
    if (record.aiRecommendations) {
      checkPageBreak(50);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 217, 166);
      doc.text('AI Health Recommendations (Patients Only):', margin, currentY);
      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const aiRecsText = doc.splitTextToSize(record.aiRecommendations, pageWidth - 2 * margin);
      doc.text(aiRecsText, margin, currentY);
      currentY += aiRecsText.length * 5 + 6;
    }

    // Clinician Notes
    checkPageBreak(40);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Clinician Consultation Notes:', margin, currentY);
    currentY += 6;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    const notesText = doc.splitTextToSize(record.clinicianNote || 'No custom clinician notes recorded.', pageWidth - 2 * margin);
    doc.text(notesText, margin, currentY);
    currentY += notesText.length * 5 + 10;

    // Footer signature line
    checkPageBreak(25);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This is an authorized health report generated by the MedAstraX portal.', margin, currentY);

    doc.save(`HealthRecord_Summary_${record.id}.pdf`);
    toast.success('Clinical PDF exported!');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return '#f59e0b';
      case 'SCHEDULED': return '#4f9eff';
      case 'COMPLETED': return '#10b981';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="health-records-page">
      <div className="records-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="records-title-icon"><FiFileText size={24} /></div>
          <div>
            <h1 className="records-title">Health Records & Follow-up Center</h1>
            <p className="records-subtitle">Access your clinical summaries, doctor notes, and follow-up states</p>
          </div>
        </div>
      </div>

      {/* Role Picker (Role-aware tabs) */}
      <div className="role-selector-bar">
        <span className="selector-label"><FiUser /> Viewing Context:</span>
        <div className="role-tabs">
          {roles.map(r => (
            <button
              key={r.value}
              className={`role-tab-btn ${currentRole === r.value ? 'active' : ''}`}
              onClick={() => {
                setCurrentRole(r.value);
                setSelectedRecord(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="records-layout-grid">
        
        {/* Left Side: Records List & Status Counts */}
        <div className="records-list-panel">
          
          {/* Status count badges */}
          <div className="status-badges-row">
            <div className="status-badge-card" onClick={() => setCurrentStatus('ALL')}>
              <span className="count-label">All</span>
              <span className="count-value">{counts.total}</span>
            </div>
            <div className="status-badge-card" style={{ borderColor: getStatusColor('PENDING') }} onClick={() => setCurrentStatus('PENDING')}>
              <span className="count-label" style={{ color: getStatusColor('PENDING') }}>Pending</span>
              <span className="count-value" style={{ color: getStatusColor('PENDING') }}>{counts.pending}</span>
            </div>
            <div className="status-badge-card" style={{ borderColor: getStatusColor('SCHEDULED') }} onClick={() => setCurrentStatus('SCHEDULED')}>
              <span className="count-label" style={{ color: getStatusColor('SCHEDULED') }}>Scheduled</span>
              <span className="count-value" style={{ color: getStatusColor('SCHEDULED') }}>{counts.scheduled}</span>
            </div>
            <div className="status-badge-card" style={{ borderColor: getStatusColor('COMPLETED') }} onClick={() => setCurrentStatus('COMPLETED')}>
              <span className="count-label" style={{ color: getStatusColor('COMPLETED') }}>Completed</span>
              <span className="count-value" style={{ color: getStatusColor('COMPLETED') }}>{counts.completed}</span>
            </div>
          </div>

          {/* Quick status list tab */}
          <div className="status-filter-pills">
            {statuses.map(st => (
              <button
                key={st.value}
                className={`status-pill ${currentStatus === st.value ? 'active' : ''}`}
                onClick={() => setCurrentStatus(st.value)}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* List display */}
          <div className="records-list-wrapper">
            {loading ? (
              <div className="records-loading">Fetching records...</div>
            ) : records.length === 0 ? (
              <div className="records-empty">No clinical records found for the selected view.</div>
            ) : (
              records.map(record => (
                <div 
                  key={record.id}
                  className={`record-item-card ${selectedRecord?.id === record.id ? 'active' : ''}`}
                  onClick={() => handleSelectRecord(record)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <span className="record-patient">{record.patientName}</span>
                    <span 
                      className="followup-badge" 
                      style={{ background: `${getStatusColor(record.followUpStatus)}15`, color: getStatusColor(record.followUpStatus) }}
                    >
                      {record.followUpStatus || 'NONE'}
                    </span>
                  </div>
                  <div className="record-doc">Doctor: {record.doctorName}</div>
                  <div className="record-facility">{record.hospitalName}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    <span>Record #{record.id}</span>
                    <span>{new Date(record.bookingDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Detailed clinical review & edit notes */}
        <div className="records-detail-panel">
          {selectedRecord ? (
            <div className="record-details-card">
              <div className="record-detail-header">
                <div>
                  <h2>Health Record Detail</h2>
                  <p>Consultation with Dr. {selectedRecord.doctorName}</p>
                </div>
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={() => downloadPDFReport(selectedRecord)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiDownload /> Download PDF
                </button>
              </div>

              <div className="details-body">
                
                {/* Condition Badge and Meta */}
                <div className="details-row-meta">
                  <div className="detail-meta-item">
                    <span className="meta-lbl">Triage / Severity:</span>
                    <span className={`severity-badge ${selectedRecord.conditionBadge || 'GREEN'}`}>
                      {selectedRecord.conditionBadge || 'GREEN'}
                    </span>
                  </div>
                  <div className="detail-meta-item">
                    <span className="meta-lbl">Follow-up status:</span>
                    <span style={{ color: getStatusColor(selectedRecord.followUpStatus), fontWeight: 'bold' }}>
                      {selectedRecord.followUpStatus || 'NONE'}
                    </span>
                  </div>
                </div>

                {/* Symptoms */}
                <div className="detail-section">
                  <h3>Chief Symptoms & Complaint</h3>
                  <div className="detail-text-box">{selectedRecord.symptoms || 'No symptoms registered.'}</div>
                </div>

                {/* AI Summary */}
                {selectedRecord.aiReport && (
                  <div className="detail-section">
                    <h3><FiCpu /> AI Clinical Summary</h3>
                    <div className="detail-text-box markdown-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {selectedRecord.aiReport}
                    </div>
                  </div>
                )}

                {/* AI Recommendations */}
                {selectedRecord.aiRecommendations && (
                  <div className="detail-section highlight">
                    <h3>💡 AI Health Recommendations (Patient Guidance)</h3>
                    <div className="detail-text-box markdown-text" style={{ whiteSpace: 'pre-wrap' }}>
                      {selectedRecord.aiRecommendations}
                    </div>
                  </div>
                )}

                {/* Clinician Notes Viewer (For all) */}
                <div className="detail-section">
                  <h3>Clinician Consultation Notes</h3>
                  <div className="detail-text-box note-view">
                    {selectedRecord.clinicianNote || 'No clinician notes recorded for this record.'}
                  </div>
                </div>

                {/* Clinician Editor panel (visible to Doctor & Admin contexts) */}
                {(currentRole === 'DOCTOR' || currentRole === 'ADMIN') && (
                  <form onSubmit={handleUpdateFollowUp} className="followup-edit-form">
                    <h3>✏️ Clinician Update Panel</h3>
                    <p className="hint-text">Add follow-up requirements, instructions, and update recommendations below.</p>
                    
                    <div className="form-group">
                      <label>Set Follow-up Status</label>
                      <select 
                        value={followUpStatus}
                        onChange={e => setFollowUpStatus(e.target.value)}
                        className="form-select"
                      >
                        <option value="NONE">No Follow-up Required</option>
                        <option value="PENDING">Pending Follow-up</option>
                        <option value="SCHEDULED">Scheduled Follow-up</option>
                        <option value="COMPLETED">Completed / Recovered</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Clinician Consultation Note</label>
                      <textarea
                        value={clinicianNote}
                        onChange={e => setClinicianNote(e.target.value)}
                        placeholder="Add professional follow-up guidelines, medicine instructions, or clinician observations..."
                        rows={4}
                        className="form-textarea"
                      />
                    </div>

                    <div className="form-group">
                      <label>Edit AI Recommendations Summary</label>
                      <textarea
                        value={aiRecommendations}
                        onChange={e => setAiRecommendations(e.target.value)}
                        placeholder="Customize recommendations that the patient sees in their app..."
                        rows={4}
                        className="form-textarea"
                      />
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" disabled={updating}>
                      <FiSave /> {updating ? 'Saving Details...' : 'Save Follow-up & Recommendations'}
                    </button>
                  </form>
                )}

              </div>
            </div>
          ) : (
            <div className="no-record-selected">
              <FiFileText size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <h3>No Record Selected</h3>
              <p>Select a health record from the left list to review diagnosis, AI summary, and update follow-up notes.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
