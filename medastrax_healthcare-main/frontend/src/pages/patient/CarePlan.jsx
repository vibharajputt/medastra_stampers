import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { aiAPI, prescriptionAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  FiChevronDown, 
  FiChevronUp, 
  FiActivity, 
  FiCpu, 
  FiFileText, 
  FiDownload, 
  FiRefreshCw, 
  FiInfo 
} from 'react-icons/fi';
import { jsPDF } from 'jspdf';

export default function CarePlan() {
  const [activeTab, setActiveTab] = useState('plan'); // 'plan' | 'comparison'
  const [carePlan, setCarePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [medicineHelpQuery, setMedicineHelpQuery] = useState('');
  const [medicineHelpResponse, setMedicineHelpResponse] = useState('');
  const [medicineHelpLoading, setMedicineHelpLoading] = useState(false);
  const [reminderPermission, setReminderPermission] = useState('default');
  const reminderTimers = useRef([]);
  
  // Report Comparison States
  const [prescriptions, setPrescriptions] = useState([]);
  const [previousReport, setPreviousReport] = useState(null);
  const [currentReport, setCurrentReport] = useState(null);
  const [prevInputMode, setPrevInputMode] = useState('system'); // 'system' | 'text'
  const [currInputMode, setCurrInputMode] = useState('system'); // 'system' | 'text'
  const [prevReportText, setPrevReportText] = useState('');
  const [currReportText, setCurrReportText] = useState('');
  const [comparisonAnalysis, setComparisonAnalysis] = useState('');
  const [analyzingComparison, setAnalyzingComparison] = useState(false);

  const defaultCarePlan = {
    summary: 'Your personalized care plan is ready. It includes a daily diet guideline, a medication schedule, and an exercise routine to support your recovery and wellness.',
    diet: [
      'Breakfast: Oatmeal with fruits and a glass of warm water.',
      'Mid-morning snack: A handful of nuts or a fruit smoothie.',
      'Lunch: Lean protein, vegetables, and whole grains.',
      'Evening snack: Green tea and roasted chickpeas.',
      'Dinner: Light soup or steamed vegetables with a small portion of protein.',
    ],
    exercise: [
      'Morning walk for 20-30 minutes.',
      'Stretching routine after work.',
      'Breathing exercises before bed.',
      'Light strength training twice a week.',
    ],
    medicines: [
      { name: 'Multivitamin', dose: '1 tablet', time: '08:00', notes: 'After breakfast.' },
      { name: 'Metformin', dose: '500 mg', time: '20:00', notes: 'With dinner.' },
      { name: 'Vitamin D', dose: '1 capsule', time: '21:30', notes: 'Before sleep.' },
    ],
  };

  const askNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setReminderPermission(permission);
    } else {
      setReminderPermission(Notification.permission);
    }
  };

  const createMedicationReminder = (medicine) => {
    if (typeof window === 'undefined' || !medicine?.time) return;
    const [hour, minute] = medicine.time.split(':').map((value) => Number(value));
    if (Number.isNaN(hour) || Number.isNaN(minute)) return;

    const now = new Date();
    const trigger = new Date(now);
    trigger.setHours(hour, minute, 0, 0);
    if (trigger <= now) {
      trigger.setDate(trigger.getDate() + 1);
    }

    const delay = trigger.getTime() - now.getTime();
    if (delay < 0 || delay > 24 * 60 * 60 * 1000) return;

    const timer = window.setTimeout(() => {
      const message = `${medicine.name} ${medicine.dose} - ${medicine.notes || 'Take as directed.'}`;
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Medicine Reminder', {
          body: message,
        });
      }
      toast.success(message, { duration: 6000 });
    }, delay);

    reminderTimers.current.push(timer);
  };

  const clearMedicationReminders = () => {
    reminderTimers.current.forEach((timer) => window.clearTimeout(timer));
    reminderTimers.current = [];
  };

  const loadCarePlan = async () => {
    setLoading(true);
    try {
      const res = await aiAPI.getCarePlan();
      if (res?.data?.carePlan) {
        setCarePlan({ ...defaultCarePlan, summary: res.data.carePlan });
      } else {
        setCarePlan(defaultCarePlan);
      }
    } catch (err) {
      setCarePlan(defaultCarePlan);
    } finally {
      setLoading(false);
    }
  };

  const handleAskMedicineHelp = async () => {
    if (!medicineHelpQuery.trim()) return;
    setMedicineHelpLoading(true);
    setMedicineHelpResponse('');
    try {
      const res = await aiAPI.chat(`Explain the following medicine details in simple terms: ${medicineHelpQuery}`);
      const reply = res.data?.reply || 'Sorry, I could not fetch the explanation at this time.';
      setMedicineHelpResponse(reply);
    } catch (err) {
      console.error(err);
      setMedicineHelpResponse('⚠️ Unable to reach MedAstraX. Please try again later.');
    } finally {
      setMedicineHelpLoading(false);
    }
  };

  const loadPrescriptions = async () => {
    try {
      // In Desktop project the api.js has getPatientPrescriptions (which takes activeProfile id)
      // Let's get prescriptions for patient
      const storedUser = localStorage.getItem('medastrax_user');
      let userId = null;
      if (storedUser) {
        try {
          userId = JSON.parse(storedUser).id;
        } catch (e) {}
      }
      const res = await prescriptionAPI.getPatientPrescriptions(userId);
      if (res?.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.prescriptions || [];
        setPrescriptions(list);
        if (list.length >= 2) {
          setCurrentReport(list[0]);
          setPreviousReport(list[1]);
        } else if (list.length === 1) {
          setCurrentReport(list[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
    }
  };

  const parseJson = (str) => {
    try {
      return JSON.parse(str || '[]');
    } catch (e) {
      return [];
    }
  };

  const handleCompareReports = async () => {
    let prevText = '';
    let currText = '';

    if (prevInputMode === 'system') {
      if (!previousReport) {
        toast.error('Please select a previous prescription/report');
        return;
      }
      const medicines = parseJson(previousReport.medicines);
      const medsStr = medicines.map(m => `${m.name} (${m.dosage}) - ${m.frequency} for ${m.duration}`).join(', ');
      prevText = `Diagnosis: ${previousReport.diagnosis}\nDate: ${previousReport.createdAt ? new Date(previousReport.createdAt).toLocaleDateString() : 'N/A'}\nMedicines: ${medsStr}\nNotes/Observations: ${previousReport.notes || 'None'}`;
    } else {
      if (!prevReportText.trim()) {
        toast.error('Please enter details or copy/paste your previous report');
        return;
      }
      prevText = prevReportText.trim();
    }

    if (currInputMode === 'system') {
      if (!currentReport) {
        toast.error('Please select a current prescription/report');
        return;
      }
      const medicines = parseJson(currentReport.medicines);
      const medsStr = medicines.map(m => `${m.name} (${m.dosage}) - ${m.frequency} for ${m.duration}`).join(', ');
      currText = `Diagnosis: ${currentReport.diagnosis}\nDate: ${currentReport.createdAt ? new Date(currentReport.createdAt).toLocaleDateString() : 'N/A'}\nMedicines: ${medsStr}\nNotes/Observations: ${currentReport.notes || 'None'}`;
    } else {
      if (!currReportText.trim()) {
        toast.error('Please enter details or copy/paste your current report');
        return;
      }
      currText = currReportText.trim();
    }

    setAnalyzingComparison(true);
    setComparisonAnalysis('');
    try {
      const res = await aiAPI.compareReports(prevText, currText);
      const analysis = res.data?.comparison || 'Unable to compare reports at this time.';
      setComparisonAnalysis(analysis);
      toast.success('AI Report comparison completed!');
    } catch (err) {
      console.error(err);
      setComparisonAnalysis('⚠️ Unable to compare reports. Please try again later.');
      toast.error('Failed to compare reports');
    } finally {
      setAnalyzingComparison(false);
    }
  };

  const handleDownloadComparisonPDF = () => {
    if (!comparisonAnalysis) return;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 20;

    const checkPageOffset = (neededHeight) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`MedAstraX AI Report Comparison`, margin, 10);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, 12, pageWidth - margin, 12);
        y = 20;
      }
    };

    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(124, 58, 237); // Purple theme
    doc.text('AI MEDICAL REPORT COMPARISON', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Content
    const lines = comparisonAnalysis.split('\n');
    lines.forEach((line) => {
      if (!line.trim()) {
        y += 4;
        return;
      }

      checkPageOffset(6);

      if (line.startsWith('# ')) {
        const cleanLine = line.replace('# ', '');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40);
        doc.text(cleanLine, margin, y);
        y += 7;
      } else if (line.startsWith('## ')) {
        const cleanLine = line.replace('## ', '');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(124, 58, 237);
        doc.text(cleanLine, margin, y);
        y += 6;
      } else if (line.startsWith('### ')) {
        const cleanLine = line.replace('### ', '');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(50, 50, 50);
        doc.text(cleanLine, margin, y);
        y += 6;
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);

        let cleanText = line;
        if (line.startsWith('- ')) {
          cleanText = '• ' + line.replace('- ', '');
        }

        const availableWidth = pageWidth - (margin * 2);
        const splitTextList = doc.splitTextToSize(cleanText, availableWidth);

        splitTextList.forEach((splitLine) => {
          checkPageOffset(6);
          const subParts = splitLine.split('**');
          let subX = margin;
          
          subParts.forEach((subPart, subIdx) => {
            const isBoldPart = subIdx % 2 === 1;
            doc.setFont('Helvetica', isBoldPart ? 'bold' : 'normal');
            doc.setTextColor(isBoldPart ? 40 : 80, isBoldPart ? 40 : 80, isBoldPart ? 40 : 80);
            doc.text(subPart, subX, y);
            subX += doc.getTextWidth(subPart);
          });
          y += 5.5;
        });
      }
    });

    // Footer
    y += 10;
    checkPageOffset(15);
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This is an AI-generated medical report comparison and is for informational review.', margin, y);
    y += 4;
    doc.text('Powered by MedAstraX Clinical Intelligence.', margin, y);

    doc.save(`Medical_Report_Comparison.pdf`);
  };

  useEffect(() => {
    loadCarePlan();
    loadPrescriptions();
    askNotificationPermission();
  }, []);

  useEffect(() => {
    clearMedicationReminders();
    if (carePlan?.medicines?.length) {
      carePlan.medicines.forEach(createMedicationReminder);
    }
    return clearMedicationReminders;
  }, [carePlan, reminderPermission]);

  const parseMarkdown = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, index) => {
      let content = line;
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemText = line.trim().substring(2);
        return (
          <li key={index} style={{ marginLeft: '16px', marginBottom: '4px' }}
              dangerouslySetInnerHTML={{ __html: itemText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
        );
      }

      if (/^\d+\.\s/.test(line.trim())) {
        const itemText = line.trim().replace(/^\d+\.\s/, '');
        return (
          <li key={index} style={{ marginLeft: '16px', marginBottom: '4px', listStyleType: 'decimal' }}
              dangerouslySetInnerHTML={{ __html: itemText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
        );
      }

      if (line.trim() === '') {
        return <div key={index} style={{ height: '8px' }} />;
      }

      return (
        <p key={index} style={{ margin: '0 0 6px 0', lineHeight: '1.5' }}
           dangerouslySetInnerHTML={{ __html: content }} />
      );
    });
  };

  return (
    <div className="page-container section" style={{ maxWidth: '1080px', margin: '0 auto', padding: '26px 18px 60px' }}>
      
      {/* Top Header Block */}
      <div style={{ marginBottom: '28px', padding: '22px 28px', borderRadius: '24px', background: 'rgba(255,255,255,0.98)', boxShadow: '0 20px 60px rgba(15,23,42,0.08)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <p className="text-muted" style={{ marginBottom: '6px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Personal Care Tracker</p>
            <h1 className="heading-lg" style={{ margin: 0 }}>MedAstraX Care & Recovery Hub</h1>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              Access your personalized diet guides, daily medication schedules, and clinical progress reports. Compare old and new reports with AI to track your healing.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link to="/dashboard" className="btn btn-outline" style={{ borderRadius: '999px' }}>Back to Dashboard</Link>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="tab-group" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '28px', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('plan')}
          className={`btn ${activeTab === 'plan' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '999px', padding: '10px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FiActivity /> Care Plan & Daily Schedule
        </button>
        <button
          onClick={() => setActiveTab('comparison')}
          className={`btn ${activeTab === 'comparison' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '999px', padding: '10px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <FiCpu /> AI Medical Report Comparison
        </button>
      </div>

      {/* TAB CONTENT 1: CARE PLAN */}
      {activeTab === 'plan' && (
        <div className="care-plan-card animate-fade-in" style={{ padding: '28px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.95)', boxShadow: '0 28px 70px rgba(15, 23, 42, 0.08)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <h2 className="heading-md" style={{ margin: 0 }}>Daily Care Guidelines</h2>
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Your customized guidelines for healthy diet, active exercise, and medicine timing.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--primary-dark)', fontWeight: '600' }}>
                {reminderPermission === 'granted' ? '🔔 Browser notifications active' : '🔕 Notifications inactive'}
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ borderRadius: '999px' }}
                onClick={askNotificationPermission}
              >
                Enable Reminders
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
              Generating care plan details...
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                
                {/* Diet Card */}
                <div style={{ padding: '24px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(0,217,166,0.02))', border: '1px solid var(--border-color)', minHeight: '220px' }}>
                  <h3 className="heading-sm" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>🥗 Healthy Diet Guidelines</h3>
                  <ul style={{ paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.88rem' }}>
                    {carePlan?.diet?.map((item, index) => (
                      <li key={index} style={{ marginBottom: '10px' }}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Exercise Card */}
                <div style={{ padding: '24px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(99,102,241,0.02))', border: '1px solid var(--border-color)', minHeight: '220px' }}>
                  <h3 className="heading-sm" style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>🏃‍♂️ Active Exercise & Routine</h3>
                  <ul style={{ paddingLeft: '18px', color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '0.88rem' }}>
                    {carePlan?.exercise?.map((item, index) => (
                      <li key={index} style={{ marginBottom: '10px' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Medicine Schedule */}
              <div style={{ padding: '24px', borderRadius: '18px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <h3 className="heading-sm" style={{ margin: 0 }}>💊 Active Medicine Dosage</h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Browser reminders will trigger daily at the listed times.</span>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {carePlan?.medicines?.map((medicine) => (
                    <div key={medicine.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '18px', borderRadius: '16px', background: 'white', border: '1px solid rgba(15, 23, 42, 0.06)' }}>
                      <div>
                        <strong style={{ fontSize: '0.98rem', color: 'var(--text-primary)' }}>{medicine.name}</strong>
                        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}><strong>Dose:</strong> {medicine.dose} | ⏰ {medicine.time}</p>
                        {medicine.notes && <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>* {medicine.notes}</p>}
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ whiteSpace: 'nowrap', borderRadius: '999px', fontSize: '0.8rem' }}
                        onClick={() => setMedicineHelpQuery(`${medicine.name} (${medicine.dose}) scheduled at ${medicine.time}`)}
                      >
                        Explain medicine
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ask MedAstraX Assistant */}
              <div style={{ padding: '24px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(124,58,237,0.03))', border: '1px solid var(--border-color)' }}>
                <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>🤖 Ask MedAstraX AI Medicine Helper</h3>
                <p style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6' }}>
                  Not sure why you are taking a specific medicine or need to verify potential food interactions? Ask MedAstraX for a simple explanation.
                </p>
                <div style={{ marginTop: '18px', display: 'grid', gap: '14px' }}>
                  <textarea
                    value={medicineHelpQuery}
                    onChange={(e) => setMedicineHelpQuery(e.target.value)}
                    rows={3}
                    placeholder="Type the medicine name, dose, or paste details here..."
                    style={{ width: '100%', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '14px', resize: 'vertical', fontSize: '0.92rem', color: 'var(--text-primary)', background: '#FFFFFF' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAskMedicineHelp}
                    disabled={medicineHelpLoading || !medicineHelpQuery.trim()}
                    style={{ width: 'fit-content', borderRadius: '999px', padding: '10px 24px' }}
                  >
                    {medicineHelpLoading ? 'Asking MedAstraX...' : 'Ask MedAstraX'}
                  </button>
                  {medicineHelpResponse && (
                    <div style={{ padding: '20px', borderRadius: '16px', background: '#FFFFFF', border: '1px solid rgba(15, 23, 42, 0.08)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ fontWeight: '700', color: 'var(--primary-dark)', marginBottom: '8px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}><FiInfo /> MedAstraX Explanation</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.7' }}>
                        {parseMarkdown(medicineHelpResponse)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: REPORT COMPARISON */}
      {activeTab === 'comparison' && (
        <div className="care-plan-card animate-fade-in" style={{ padding: '28px', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.95)', boxShadow: '0 28px 70px rgba(15, 23, 42, 0.08)', border: '1px solid var(--border-color)' }}>
          <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '20px', marginBottom: '24px' }}>
            <h2 className="heading-md" style={{ margin: 0 }}>AI Medical Report Comparison</h2>
            <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.6' }}>
              Submit your older medical prescription/report alongside your latest one. The MedAstraX AI will analyze both, compare your recovery progress, vital signs, and medication adjustments side-by-side.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '24px' }}>
            
            {/* Split Input Panels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              
              {/* Previous Report Input */}
              <div style={{ padding: '20px', borderRadius: '18px', background: 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem' }}>📂 Previous/Older Report</label>
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.8)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button 
                      onClick={() => setPrevInputMode('system')} 
                      className={`btn btn-xs ${prevInputMode === 'system' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', height: '24px', borderRadius: '6px' }}
                    >
                      System
                    </button>
                    <button 
                      onClick={() => setPrevInputMode('text')} 
                      className={`btn btn-xs ${prevInputMode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', height: '24px', borderRadius: '6px' }}
                    >
                      Paste Text
                    </button>
                  </div>
                </div>

                {prevInputMode === 'system' ? (
                  <select
                    value={previousReport?.id || ''}
                    onChange={(e) => {
                      const selected = prescriptions.find(p => String(p.id) === String(e.target.value));
                      setPreviousReport(selected);
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                  >
                    <option value="">Select previous prescription...</option>
                    {prescriptions.map((rx) => (
                      <option key={rx.id} value={rx.id}>
                        {rx.diagnosis} - {rx.doctorName || 'Self'} ({new Date(rx.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    value={prevReportText}
                    onChange={(e) => setPrevReportText(e.target.value)}
                    rows={6}
                    placeholder="Paste diagnosis, symptoms, medicines, lab vitals from previous report..."
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                )}
                
                {prevInputMode === 'system' && previousReport && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.03)' }}>
                    <strong>Details:</strong> Diagnosed with <em>{previousReport.diagnosis}</em>. Medicines prescribed: {parseJson(previousReport.medicines).length} item(s).
                  </div>
                )}
              </div>

              {/* Current Report Input */}
              <div style={{ padding: '20px', borderRadius: '18px', background: 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem' }}>📂 Current/Latest Report</label>
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.8)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button 
                      onClick={() => setCurrInputMode('system')} 
                      className={`btn btn-xs ${currInputMode === 'system' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', height: '24px', borderRadius: '6px' }}
                    >
                      System
                    </button>
                    <button 
                      onClick={() => setCurrInputMode('text')} 
                      className={`btn btn-xs ${currInputMode === 'text' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.75rem', padding: '2px 8px', height: '24px', borderRadius: '6px' }}
                    >
                      Paste Text
                    </button>
                  </div>
                </div>

                {currInputMode === 'system' ? (
                  <select
                    value={currentReport?.id || ''}
                    onChange={(e) => {
                      const selected = prescriptions.find(p => String(p.id) === String(e.target.value));
                      setCurrentReport(selected);
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                  >
                    <option value="">Select current prescription...</option>
                    {prescriptions.map((rx) => (
                      <option key={rx.id} value={rx.id}>
                        {rx.diagnosis} - {rx.doctorName || 'Self'} ({new Date(rx.createdAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    value={currReportText}
                    onChange={(e) => setCurrReportText(e.target.value)}
                    rows={6}
                    placeholder="Paste diagnosis, symptoms, medicines, lab vitals from current/new report..."
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', color: 'var(--text-primary)', fontSize: '0.88rem', resize: 'vertical' }}
                  />
                )}

                {currInputMode === 'system' && currentReport && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.03)' }}>
                    <strong>Details:</strong> Diagnosed with <em>{currentReport.diagnosis}</em>. Medicines prescribed: {parseJson(currentReport.medicines).length} item(s).
                  </div>
                )}
              </div>

            </div>

            {/* Action Trigger Button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCompareReports}
              disabled={analyzingComparison}
              style={{ borderRadius: '999px', width: 'fit-content', padding: '12px 32px', margin: '10px auto 0', display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', border: 'none' }}
            >
              {analyzingComparison ? (
                <>
                  <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  Comparing Reports with AI...
                </>
              ) : (
                <>
                  <FiCpu /> Compare Reports with AI
                </>
              )}
            </button>

            {/* Comparative Analysis Result Output */}
            {comparisonAnalysis && (
              <div className="animate-fade-in" style={{ padding: '28px', borderRadius: '18px', background: '#FFFFFF', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-dark)', fontWeight: 'bold' }}>
                    <FiCpu /> MedAstraX AI Clinical Comparison Report
                  </div>
                  <button 
                    onClick={handleDownloadComparisonPDF} 
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                  >
                    <FiDownload /> Download Report PDF
                  </button>
                </div>

                <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.8' }}>
                  {parseMarkdown(comparisonAnalysis)}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
