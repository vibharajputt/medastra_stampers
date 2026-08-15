import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../../context/AuthContext';
import { hospitalAPI, bookingAPI, prescriptionAPI, fileAPI, authAPI, aiAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiSettings, FiUsers, FiActivity, FiClock, FiCalendar, FiVideo, FiUser, FiCheckCircle, FiCheck, FiCpu, FiDownload, FiCopy, FiTrash2, FiUpload, FiFileText, FiAlertTriangle, FiInfo, FiEdit2, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function DoctorDashboard() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const formatDateToDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const [hospitals, setHospitals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hospitals'); // 'hospitals' or 'appointments'
  const [currentTime, setCurrentTime] = useState(new Date());
  const notifiedAppts = useRef(new Set());
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [tempLinks, setTempLinks] = useState({});
  const [selectedReportBooking, setSelectedReportBooking] = useState(null);
  const [selectedSummaryBooking, setSelectedSummaryBooking] = useState(null);
  const [viewingPrescription, setViewingPrescription] = useState(null);

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [tests, setTests] = useState(['']);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submittingPrescription, setSubmittingPrescription] = useState(false);

  const [patientProfile, setPatientProfile] = useState(null);

  const [aiSymptoms, setAiSymptoms] = useState('');
  const [aiMedicine, setAiMedicine] = useState('');
  const [aiPrevPrescription, setAiPrevPrescription] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzerMode, setAnalyzerMode] = useState('manual');
  const [reportFile, setReportFile] = useState(null);
  const [reportNewMedicine, setReportNewMedicine] = useState('');
  const [analyzingDoc, setAnalyzingDoc] = useState(false);

  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [editingHospitalId, setEditingHospitalId] = useState(null);
  const [hospitalForm, setHospitalForm] = useState({
    registrationNo: '',
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    totalBeds: 0,
    availableBeds: 0,
    consultationRate: '',
    description: '',
    facilities: '',
    doctorTypes: '',
    latitude: '',
    longitude: ''
  });
  const [submittingHospital, setSubmittingHospital] = useState(false);
  const [bedsModalHospitalId, setBedsModalHospitalId] = useState(null);
  const [bedsInputValue, setBedsInputValue] = useState(0);
  const [updatingBedsValue, setUpdatingBedsValue] = useState(false);

  // Report Comparison State
  const [showComparisonPanel, setShowComparisonPanel] = useState(false);
  const [selectedPatientForComparison, setSelectedPatientForComparison] = useState(null);
  const [patientPrescriptions, setPatientPrescriptions] = useState([]);
  const [previousReport, setPreviousReport] = useState(null);
  const [currentReport, setCurrentReport] = useState(null);
  const [comparisonAnalysis, setComparisonAnalysis] = useState('');
  const [analyzingComparison, setAnalyzingComparison] = useState(false);


  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const hospitalsRes = await hospitalAPI.getByDoctor(user.id);
      setHospitals(hospitalsRes.data);
      
      const bookingsRes = await bookingAPI.getDoctorBookings();
      setAppointments(bookingsRes.data);

      const prescriptionsRes = await prescriptionAPI.getDoctorPrescriptions();
      setPrescriptions(prescriptionsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user.id]);

  // Update current time every 10 seconds to auto-refresh Join button states
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedPatientId) {
      setPatientProfile(null);
      return;
    }
    const matchingBooking = appointments.find(b => b.patientId === parseInt(selectedPatientId));
    const fetchPatientProfile = async () => {
      try {
        const res = await authAPI.getPatientProfileForDoctor(selectedPatientId);
        const p = res.data;
        setPatientProfile({
          name: p.name || matchingBooking?.patientName || "Patient #" + selectedPatientId,
          age: p.age || matchingBooking?.age || 30,
          gender: p.gender || matchingBooking?.gender || "Not Specified",
          bloodGroup: p.bloodGroup || 'O+ (Confirmed)',
          allergies: p.allergies || 'Penicillin, Dust Mites',
          currentMedication: p.currentMedication || 'None',
          existingMedicalCondition: p.existingMedicalCondition || 'None',
          emergencyNumber: p.emergencyNumber || '+91 98765 43210',
          healthBadge: p.healthBadge || null
        });
      } catch (err) {
        setPatientProfile({
          name: matchingBooking?.patientName || "Patient #" + selectedPatientId,
          age: matchingBooking?.age || 30,
          gender: matchingBooking?.gender || "Not Specified",
          bloodGroup: 'O+ (Confirmed)',
          allergies: 'Penicillin, Dust Mites',
          currentMedication: 'Levocetirizine 5mg (Active)',
          existingMedicalCondition: 'Mild Seasonal Asthma',
          emergencyNumber: '+91 98765 43210',
          healthBadge: null
        });
      }
    };
    fetchPatientProfile();
  }, [selectedPatientId, appointments]);


  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadRes = await fileAPI.upload(file);
      const imageUrl = uploadRes.data.message; // backend returns path in message field or URL
      
      // Update on backend user table
      await authAPI.updateAvatar(imageUrl);
      
      // Update local context
      const updatedUser = { ...user, avatarUrl: imageUrl };
      login({
        token: localStorage.getItem('medastrax_token'),
        ...updatedUser
      });
      toast.success('Profile picture updated successfully!');
    } catch (error) {
      toast.error('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleOpenHospitalModal = (hospital = null) => {
    if (hospital) {
      setEditingHospitalId(hospital.id);
      setHospitalForm({
        registrationNo: hospital.registrationNo || '',
        name: hospital.name || '',
        address: hospital.address || '',
        city: hospital.city || '',
        state: hospital.state || '',
        pincode: hospital.pincode || '',
        phone: hospital.phone || '',
        email: hospital.email || '',
        totalBeds: hospital.totalBeds || 0,
        availableBeds: hospital.availableBeds || 0,
        consultationRate: hospital.consultationRate || '',
        description: hospital.description || '',
        facilities: (hospital.facilities || []).join(', '),
        doctorTypes: (hospital.doctorTypes || []).join(', '),
        latitude: hospital.latitude || '',
        longitude: hospital.longitude || ''
      });
    } else {
      setEditingHospitalId(null);
      setHospitalForm({
        registrationNo: '',
        name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        email: '',
        totalBeds: 0,
        availableBeds: 0,
        consultationRate: '',
        description: '',
        facilities: '',
        doctorTypes: '',
        latitude: '',
        longitude: ''
      });
    }
    setShowHospitalModal(true);
  };

  const closeHospitalModal = () => {
    setShowHospitalModal(false);
    setEditingHospitalId(null);
  };

  const handleHospitalFormChange = (e) => {
    const { name, value } = e.target;
    let cleanedValue = value;
    if (name === 'phone') {
      cleanedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    setHospitalForm(prev => ({ ...prev, [name]: cleanedValue }));
  };

  const submitHospitalForm = async (e) => {
    e.preventDefault();
    if (hospitalForm.phone && hospitalForm.phone.length !== 10) {
      toast.error('Hospital phone number must be exactly 10 digits');
      return;
    }
    setSubmittingHospital(true);
    try {
      const payload = {
        registrationNo: hospitalForm.registrationNo,
        name: hospitalForm.name,
        address: hospitalForm.address,
        city: hospitalForm.city,
        state: hospitalForm.state,
        pincode: hospitalForm.pincode,
        phone: hospitalForm.phone,
        email: hospitalForm.email,
        totalBeds: Number(hospitalForm.totalBeds) || 0,
        availableBeds: Number(hospitalForm.availableBeds) || 0,
        consultationRate: Number(hospitalForm.consultationRate) || 0,
        description: hospitalForm.description,
        facilities: hospitalForm.facilities.split(',').map(item => item.trim()).filter(Boolean),
        doctorTypes: hospitalForm.doctorTypes.split(',').map(item => item.trim()).filter(Boolean),
        latitude: hospitalForm.latitude ? Number(hospitalForm.latitude) : null,
        longitude: hospitalForm.longitude ? Number(hospitalForm.longitude) : null
      };

      if (editingHospitalId) {
        await hospitalAPI.update(editingHospitalId, payload);
        toast.success('Hospital updated successfully');
      } else {
        await hospitalAPI.create(payload);
        toast.success('Hospital added successfully');
      }

      closeHospitalModal();
      fetchDashboardData();
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Failed to save hospital';
      toast.error(errMsg);
    } finally {
      setSubmittingHospital(false);
    }
  };

  const openUpdateBedsModal = (hospital) => {
    setBedsModalHospitalId(hospital.id);
    setBedsInputValue(hospital.availableBeds || 0);
  };

  const closeBedsModal = () => {
    setBedsModalHospitalId(null);
    setBedsInputValue(0);
  };

  const submitBedsUpdate = async (e) => {
    e.preventDefault();
    if (bedsInputValue < 0) {
      toast.error('Available beds cannot be negative');
      return;
    }

    setUpdatingBedsValue(true);
    try {
      await hospitalAPI.updateBeds(bedsModalHospitalId, bedsInputValue);
      toast.success('Bed availability updated');
      closeBedsModal();
      fetchDashboardData();
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Failed to update beds';
      toast.error(errMsg);
    } finally {
      setUpdatingBedsValue(false);
    }
  };

  const handleAiAnalysis = async (e) => {
    e.preventDefault();
    if (!aiSymptoms) {
      toast.error('Symptoms description is required for AI analysis');
      return;
    }

    setAnalyzing(true);
    setAiResult(null);
    try {
      const res = await prescriptionAPI.analyzeRaw({
        symptoms: aiSymptoms,
        medicine: aiMedicine,
        previousPrescription: aiPrevPrescription
      });
      setAiResult(res.data.data);
      toast.success('AI Safety Analysis completed!');
    } catch (error) {
      toast.error('AI Analysis failed. Make sure backend is running.');
    } finally {
      setAnalyzing(false);
    }
  };


  const handleDownloadAIReportPDF = () => {
    if (!aiResult) return;
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(29, 158, 117);
    doc.text('AI Medical Safety Analyzer Report', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Severity: ${aiResult.severity || 'N/A'}`, margin, y);
    y += 8;

    if (aiResult.alerts && aiResult.alerts.length > 0) {
      doc.setTextColor(220, 53, 69);
      doc.text('High Risk Alerts:', margin, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      aiResult.alerts.forEach(alert => {
        const lines = doc.splitTextToSize(`- ${alert}`, pageWidth - 2 * margin);
        doc.text(lines, margin, y);
        y += 5 * lines.length;
      });
      y += 4;
    }

    if (aiResult.interactions && aiResult.interactions.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 152, 0);
      doc.text('Drug Interactions:', margin, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      aiResult.interactions.forEach(interaction => {
        const lines = doc.splitTextToSize(`- ${interaction}`, pageWidth - 2 * margin);
        doc.text(lines, margin, y);
        y += 5 * lines.length;
      });
      y += 4;
    }

    if (aiResult.recommendations && aiResult.recommendations.length > 0) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(29, 158, 117);
      doc.text('Recommendations:', margin, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      aiResult.recommendations.forEach(rec => {
        const lines = doc.splitTextToSize(`- ${rec}`, pageWidth - 2 * margin);
        doc.text(lines, margin, y);
        y += 5 * lines.length;
      });
    }

    doc.save('AI_Safety_Report.pdf');
  };

  const handleDownloadHistoryPrescriptionPDF = (appt) => {
    const p = prescriptions.find(pres => pres.bookingId === appt.id);
    if (!p) {
      toast.error('No prescription found for this appointment.');
      return;
    }
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(29, 158, 117);
    doc.text('MedAstraX Digital Prescription', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Doctor: Dr. ${p.doctorName || user?.name || 'Unknown'}`, margin, y);
    doc.text(`Patient: ${p.patientName || appt.patientName || 'N/A'}`, pageWidth / 2, y);
    y += 10;
    doc.text(`Diagnosis: ${p.diagnosis}`, margin, y);
    y += 15;

    doc.setFontSize(14);
    doc.setTextColor(29, 158, 117);
    doc.text('Prescribed Medicines', margin, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    
    // Parse medicines
    let meds = [];
    try {
      meds = JSON.parse(p.medicines) || [];
    } catch(e) {
      meds = [];
    }

    if (meds.length === 0) {
      doc.text('None', margin, y);
      y += 8;
    } else {
      meds.forEach(m => {
        doc.text(`- ${m.name} (${m.dosage}) - ${m.frequency} for ${m.duration}`, margin, y);
        y += 6;
      });
      y += 4;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(29, 158, 117);
    doc.text('Lab Tests', margin, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);

    // Parse tests
    let tsts = [];
    try {
      tsts = JSON.parse(p.tests) || [];
    } catch(e) {
      tsts = [];
    }

    if (tsts.length === 0) {
      doc.text('None', margin, y);
      y += 8;
    } else {
      tsts.forEach(t => {
        const testName = typeof t === 'string' ? t : t.testName;
        doc.text(`- ${testName}`, margin, y);
        y += 6;
      });
      y += 4;
    }

    if (p.notes) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(29, 158, 117);
      doc.text('Notes', margin, y);
      y += 8;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      const noteLines = doc.splitTextToSize(p.notes, pageWidth - 2 * margin);
      doc.text(noteLines, margin, y);
    }

    doc.save(`Prescription_${appt.patientName || 'Patient'}.pdf`);
  };

  const handleDownloadPrescriptionPDF = () => {
    if (!diagnosis) {
      toast.error('Please add a diagnosis before downloading.');
      return;
    }
    const doc = new jsPDF();
    const margin = 14;
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(29, 158, 117);
    doc.text('MedAstraX Digital Prescription', pageWidth / 2, y, { align: 'center' });
    y += 15;

    doc.setFontSize(12);
    doc.setTextColor(50, 50, 50);
    doc.text(`Doctor: Dr. ${user.name || 'Unknown'}`, margin, y);
    doc.text(`Patient ID: ${selectedPatientId || 'N/A'}`, pageWidth / 2, y);
    y += 10;
    doc.text(`Diagnosis: ${diagnosis}`, margin, y);
    y += 15;

    doc.setFontSize(14);
    doc.setTextColor(29, 158, 117);
    doc.text('Prescribed Medicines', margin, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    const activeMedicines = medicines.filter(m => m.name.trim() !== '');
    if (activeMedicines.length === 0) {
      doc.text('None', margin, y);
      y += 8;
    } else {
      activeMedicines.forEach(m => {
        doc.text(`- ${m.name} (${m.dosage}) - ${m.frequency} for ${m.duration}`, margin, y);
        y += 6;
      });
      y += 4;
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(29, 158, 117);
    doc.text('Lab Tests', margin, y);
    y += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    const activeTests = tests.filter(t => t.trim() !== '');
    if (activeTests.length === 0) {
      doc.text('None', margin, y);
      y += 8;
    } else {
      activeTests.forEach(t => {
        doc.text(`- ${t}`, margin, y);
        y += 6;
      });
      y += 4;
    }

    if (notes) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(29, 158, 117);
      doc.text('Notes', margin, y);
      y += 8;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      const noteLines = doc.splitTextToSize(notes, pageWidth - 2 * margin);
      doc.text(noteLines, margin, y);
    }

    doc.save(`Prescription_${selectedPatientId || 'Patient'}.pdf`);
  };

  const handleDocAnalysis = async (e) => {
    e.preventDefault();
    if (!reportFile) {
      toast.error('Please select a report or prescription document to upload');
      return;
    }

    setAnalyzingDoc(true);
    setAiResult(null);
    try {
      const uploadRes = await fileAPI.upload(reportFile);
      const fileUrl = uploadRes.data.message;

      const res = await prescriptionAPI.analyzeReportDocument({
        fileUrl,
        newMedicine: reportNewMedicine
      });
      setAiResult(res.data.data);
      toast.success('Document safety analysis completed!');
    } catch (error) {
      toast.error('Document analysis failed. Make sure backend is running.');
    } finally {
      setAnalyzingDoc(false);
    }
  };

  const addMedicineRow = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const removeMedicineRow = (index) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const addTestRow = () => {
    setTests([...tests, '']);
  };

  const removeTestRow = (index) => {
    setTests(tests.filter((_, i) => i !== index));
  };

  const updateTest = (index, value) => {
    const updated = [...tests];
    updated[index] = value;
    setTests(updated);
  };

  const handleCreatePrescription = async (e) => {
    e.preventDefault();
    if (!selectedPatientId || !diagnosis) {
      toast.error('Patient and Diagnosis fields are required');
      return;
    }

    setSubmittingPrescription(true);
    try {
      const activeMedicines = medicines.filter(m => m.name.trim() !== '');
      const activeTests = tests.filter(t => t.trim() !== '');

      const payload = {
        patientId: parseInt(selectedPatientId),
        bookingId: selectedBookingId ? parseInt(selectedBookingId) : null,
        diagnosis,
        medicines: activeMedicines,
        tests: activeTests.map(t => ({ testName: t, reason: 'Prescribed by doctor' })),
        notes
      };

      await prescriptionAPI.create(payload);
      toast.success('Prescription created and sent to patient!');
      
      // Reset form
      setDiagnosis('');
      setMedicines([{ name: '', dosage: '', frequency: '', duration: '' }]);
      setTests(['']);
      setNotes('');
      setSelectedPatientId('');
      setSelectedBookingId('');
      setActiveTab('appointments');
    } catch (error) {
      toast.error('Failed to create prescription');
    } finally {
      setSubmittingPrescription(false);
    }
  };

  const getAppointmentStartDateTime = (bookingDateStr, timeSlotStr) => {
    if (!bookingDateStr || !timeSlotStr) return null;
    try {
      const [datePart] = bookingDateStr.split('T');
      const match = timeSlotStr.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return null;
      let [_, hoursStr, minutesStr, ampm] = match;
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day, hours, minutes, 0);
    } catch (e) {
      console.error("Failed to parse date/time slot", e);
      return null;
    }
  };

  const getJoinButtonState = (bookingDateStr, timeSlotStr) => {
    const apptTime = getAppointmentStartDateTime(bookingDateStr, timeSlotStr);
    if (!apptTime) return { isEnabled: false, timeDiffText: '' };
    
    const diffMinutes = (apptTime.getTime() - currentTime.getTime()) / (1000 * 60);
    
    // Enable 5 mins before and up to 5 mins after start
    const isEnabled = diffMinutes <= 5 && diffMinutes >= -5;
    
    let timeDiffText = '';
    if (diffMinutes > 5) {
      const hours = Math.floor(diffMinutes / 60);
      const mins = Math.floor(diffMinutes % 60);
      if (hours > 0) {
        timeDiffText = `Starts in ${hours}h ${mins}m`;
      } else {
        timeDiffText = `Starts in ${mins}m`;
      }
    } else if (diffMinutes < -5) {
      timeDiffText = 'Expired / Completed';
    } else {
      timeDiffText = 'Active Now';
    }
    
    return { isEnabled, timeDiffText };
  };

  useEffect(() => {
    appointments.forEach(appt => {
      if (appt.status === 'CONFIRMED' || appt.status === 'PENDING') {
        const apptTime = getAppointmentStartDateTime(appt.bookingDate, appt.timeSlot);
        if (apptTime) {
          const diffMinutes = (apptTime.getTime() - currentTime.getTime()) / (1000 * 60);
          if (diffMinutes > 9 && diffMinutes <= 10 && !notifiedAppts.current.has(appt.id)) {
            toast(`Reminder: Your appointment with ${appt.patientName} is in 10 minutes.`, {
              icon: '⏰',
              duration: 10000,
            });
            notifiedAppts.current.add(appt.id);
          }
        }
      }
    });
  }, [currentTime, appointments]);
 
  const handleJoinCall = (apptId) => {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt || !appt.meetingLink || !appt.meetingLink.trim()) {
      toast.error('Please add and save a Google Meet or Zoom link first!');
      setEditingLinkId(apptId);
      setTempLinks(prev => ({ ...prev, [apptId]: '' }));
      return;
    }
    toast.success('Entering consultation room... 🎧');
    setTimeout(() => {
      navigate(`/consultation/${apptId}`);
    }, 1000);
  };

  const handleSaveMeetingLink = async (bookingId) => {
    try {
      const link = tempLinks[bookingId] || '';
      await bookingAPI.updateMeetingLink(bookingId, link);
      toast.success('Meeting link updated successfully! 🔗');
      setEditingLinkId(null);
      // Refresh list
      const bookingsRes = await bookingAPI.getDoctorBookings();
      setAppointments(bookingsRes.data);
    } catch (error) {
      toast.error('Failed to update meeting link');
    }
  };

  const handleStatusUpdate = async (apptId, newStatus) => {
    try {
      await bookingAPI.updateStatus(apptId, newStatus);
      toast.success(`Appointment status updated to ${newStatus}`);
      // Refresh list
      const bookingsRes = await bookingAPI.getDoctorBookings();
      setAppointments(bookingsRes.data);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleOpenWritePrescription = (appt) => {
    setWritingPrescriptionAppt(appt);
    setPrescriptionForm({
      diagnosis: '',
      notes: '',
      medicines: [{ name: '', dosage: '', frequency: '', duration: '' }],
      tests: [{ testName: '', reason: '' }]
    });
  };

  const loadPatientPrescriptions = async (patientId) => {
    try {
      // Fetch patient prescriptions to compare
      const res = await prescriptionAPI.getPatientPrescriptions(patientId);
      if (res?.data) {
        const prescList = Array.isArray(res.data) ? res.data : res.data.prescriptions || [];
        setPatientPrescriptions(prescList);
        if (prescList.length >= 2) {
          setCurrentReport(prescList[0]);
          setPreviousReport(prescList[1]);
        }
      }
    } catch (err) {
      console.error('Failed to load patient prescriptions:', err);
      toast.error('Failed to load patient reports');
    }
  };

  const handleComparePatientReports = async () => {
    if (!previousReport || !currentReport) {
      toast.error('Please select both previous and current reports to compare');
      return;
    }

    setAnalyzingComparison(true);
    setComparisonAnalysis('');
    try {
      const prevText = previousReport?.notes || previousReport?.medicine || JSON.stringify(previousReport);
      const currText = currentReport?.notes || currentReport?.medicine || JSON.stringify(currentReport);
      
      const res = await aiAPI.chat(
        `Compare these two medical reports for patient health tracking and provide detailed analysis:\n\nPrevious Report:\n${prevText}\n\nCurrent Report:\n${currText}\n\nPlease highlight the key differences, improvements or concerns, medication changes, test result trends, and any recommended clinical actions.`
      );
      
      const analysis = res.data?.reply || 'Unable to analyze comparison at this time.';
      setComparisonAnalysis(analysis);
      toast.success('Report comparison completed');
    } catch (err) {
      console.error(err);
      setComparisonAnalysis('⚠️ Unable to compare reports. Please try again later.');
      toast.error('Failed to compare reports');
    } finally {
      setAnalyzingComparison(false);
    }
  };

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
        const itemText = line.trim().substring(line.trim().indexOf(' ') + 1);
        return (
          <li key={index} style={{ marginLeft: '16px', marginBottom: '4px' }}
              dangerouslySetInnerHTML={{ __html: itemText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }} />
        );
      }

      return (
        <p key={index} style={{ marginBottom: '8px' }}
           dangerouslySetInnerHTML={{ __html: content }} />
      );
    });
  };

  ;

  ;

  ;

  ;

  ;

  ;

  const parseJsonStr = (str) => {
    if (typeof str !== 'string') return str || [];
    try {
      return JSON.parse(str || '[]');
    } catch (e) {
      return [];
    }
  };

  const handleDownloadReportPDF = (appt) => {
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
        doc.text(`MedAstraX Report - Patient: ${appt.patientName}`, margin, 10);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, 12, pageWidth - margin, 12);
        y = 20;
      }
    };

    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(29, 158, 117);
    doc.text('MEDASTRAX REPORT', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Metadata Section
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    // Row 1
    doc.setFont('Helvetica', 'bold');
    doc.text('Patient Name:', margin, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.patientName || 'N/A', margin + 28, y);

    doc.setFont('Helvetica', 'bold');
    doc.text('Doctor Name:', pageWidth / 2, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.doctorName || 'N/A', pageWidth / 2 + 28, y);
    y += 6;

    // Row 2
    doc.setFont('Helvetica', 'bold');
    doc.text('Age / Gender:', margin, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${appt.age || 'N/A'} / ${appt.gender || 'N/A'}`, margin + 28, y);

    doc.setFont('Helvetica', 'bold');
    doc.text('Hospital Name:', pageWidth / 2, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.hospitalName || 'N/A', pageWidth / 2 + 28, y);
    y += 6;

    // Row 3
    doc.setFont('Helvetica', 'bold');
    doc.text('Date:', margin, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.bookingDate || 'N/A', margin + 28, y);

    doc.setFont('Helvetica', 'bold');
    doc.text('Time Slot:', pageWidth / 2, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.timeSlot || 'N/A', pageWidth / 2 + 28, y);
    y += 10;

    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Clinical Summary Content
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(29, 158, 117);
    doc.text('Clinical Summary & Insights', margin, y);
    y += 8;

    const reportLines = appt.aiReport ? appt.aiReport.split('\n') : [];
    
    reportLines.forEach((line) => {
      if (!line.trim()) {
        y += 4;
        return;
      }

      checkPageOffset(6);

      if (line.startsWith('# ')) {
        const cleanLine = line.replace('# ', '');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(40, 40, 40);
        doc.text(cleanLine, margin, y);
        y += 7;
      } else if (line.startsWith('## ')) {
        const cleanLine = line.replace('## ', '');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(29, 158, 117);
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
          cleanText = 'ΓÇó ' + line.replace('- ', '');
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
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This is an AI-generated consultation report and is intended for clinical review.', margin, y);
    y += 4;
    doc.text(`Generated on ${new Date().toLocaleDateString()} by MedAstraX Scribe companion.`, margin, y);

    const filename = `Clinical_Report_${(appt.patientName || 'Patient').replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    toast.success('Report downloaded as PDF! 📄');
  };

  const handleDownloadSummaryPDF = (appt) => {
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
        doc.text(`MedAstraX Previous Prescription Summary - Patient: ${appt.patientName}`, margin, 10);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, 12, pageWidth - margin, 12);
        y = 20;
      }
    };

    // Header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(29, 158, 117);
    doc.text('MEDASTRAX PRESCRIPTION SUMMARY', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setDrawColor(29, 158, 117);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Metadata Section
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);

    // Row 1
    doc.setFont('Helvetica', 'bold');
    doc.text('Patient Name:', margin, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.patientName || 'N/A', margin + 28, y);

    doc.setFont('Helvetica', 'bold');
    doc.text('Doctor Name:', pageWidth / 2, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.doctorName || 'N/A', pageWidth / 2 + 28, y);
    y += 6;

    // Row 2
    doc.setFont('Helvetica', 'bold');
    doc.text('Age / Gender:', margin, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${appt.age || 'N/A'} / ${appt.gender || 'N/A'}`, margin + 28, y);

    doc.setFont('Helvetica', 'bold');
    doc.text('Hospital Name:', pageWidth / 2, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.hospitalName || 'N/A', pageWidth / 2 + 28, y);
    y += 6;

    // Row 3
    doc.setFont('Helvetica', 'bold');
    doc.text('Date:', margin, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.bookingDate || 'N/A', margin + 28, y);

    doc.setFont('Helvetica', 'bold');
    doc.text('Time Slot:', pageWidth / 2, y);
    doc.setFont('Helvetica', 'normal');
    doc.text(appt.timeSlot || 'N/A', pageWidth / 2 + 28, y);
    y += 10;

    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Summary Content
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(29, 158, 117);
    doc.text('AI Previous Prescription Summary', margin, y);
    y += 8;

    const reportLines = appt.previousPrescriptionSummary ? appt.previousPrescriptionSummary.split('\n') : [];
    
    reportLines.forEach((line) => {
      if (!line.trim()) {
        y += 4;
        return;
      }

      checkPageOffset(6);

      if (line.startsWith('# ')) {
        const cleanLine = line.replace('# ', '');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(40, 40, 40);
        doc.text(cleanLine, margin, y);
        y += 7;
      } else if (line.startsWith('## ')) {
        const cleanLine = line.replace('## ', '');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(29, 158, 117);
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
          cleanText = 'ΓÇó ' + line.replace('- ', '');
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
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('This is an AI-generated analysis of the patient\'s uploaded prescription and is intended for clinical review.', margin, y);
    y += 4;
    doc.text(`Generated on ${new Date().toLocaleDateString()} by MedAstraX Scribe companion.`, margin, y);

    const filename = `Prev_Prescription_Summary_${(appt.patientName || 'Patient').replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    toast.success('Summary downloaded as PDF! 📄');
  };


  // Stats Calculations
  const todayString = new Date().toISOString().split('T')[0];
  const todayAppointments = (appointments || []).filter(appt => {
    const [datePart] = appt.bookingDate.split('T');
    return datePart === todayString;
  });
  const pendingAppointments = (appointments || []).filter(appt => appt.status === 'PENDING');

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

  const getConditionBadgeStyle = (badge) => {
    switch ((badge || '').toUpperCase()) {
      case 'RED':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' };
      case 'ORANGE':
        return { background: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.35)' };
      case 'YELLOW':
        return { background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.35)' };
      case 'GREEN':
      default:
        return { background: 'rgba(0, 217, 166, 0.15)', color: '#34d399', border: '1px solid rgba(0, 217, 166, 0.35)' };
    }
  };

  const getConditionBadge = (appt) => {
    const badge = appt?.conditionBadge;
    if (!badge) return null;

    const reason = appt?.conditionBadgeReason || '';
    const style = getConditionBadgeStyle(badge);

    return (
      <div className="condition-badge-wrapper">
        <span
          className="badge"
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '999px',
            background: style.background,
            color: style.color,
            border: style.border,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'help'
          }}
        >
          {badge === 'RED' ? '🔴' : badge === 'ORANGE' ? '🟠' : badge === 'YELLOW' ? '🟡' : '🟢'} Condition
        </span>
        <div className="condition-tooltip">
          <div style={{ fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
            Patient Condition Severity: {badge}
          </div>
          <div>{reason || "No high-risk signals detected in report or history"}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container section">
      {/* Styles Injection */}
      <style>{`
        .doctor-tabs {
          display: flex;
          gap: 16px;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 32px;
        }
        @media (max-width: 768px) {
          .doctor-tabs {
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
            gap: 12px;
            scrollbar-width: none;
          }
          .doctor-tabs::-webkit-scrollbar {
            display: none;
          }
          .doctor-tab-btn {
            flex-shrink: 0;
          }
        }
        .doctor-tab-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 1.05rem;
          font-weight: 600;
          padding: 12px 16px;
          cursor: pointer;
          position: relative;
          transition: color 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          user-select: none;
          -webkit-user-select: none;
        }
        .doctor-tab-btn:hover {
          color: var(--text-primary);
        }
        .doctor-tab-btn.active {
          color: var(--primary);
        }
        .doctor-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--primary);
        }
        .doctor-tab-badge {
          background: var(--primary);
          color: var(--bg-primary);
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 99px;
          font-weight: 700;
        }
        .appt-queue-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .appt-card {
          border-left: 4px solid var(--primary);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .appt-card.status-pending {
          border-left-color: var(--warning);
        }
        .appt-card.status-cancelled {
          border-left-color: var(--danger);
          opacity: 0.8;
        }
        .appt-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }
        .join-btn-container {
          position: relative;
          display: inline-block;
        }
        .join-btn-disabled {
          background: rgba(255, 255, 255, 0.03) !important;
          color: var(--text-muted) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          cursor: not-allowed !important;
          box-shadow: none !important;
          pointer-events: auto !important;
        }
        .join-btn-container:hover .tooltip-text {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .tooltip-text {
          visibility: hidden;
          width: 260px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(8px);
          color: #f1f5f9;
          text-align: center;
          border-radius: 10px;
          padding: 10px 14px;
          position: absolute;
          z-index: 10;
          bottom: 140%;
          left: 50%;
          transform: translateX(-50%) translateY(8px);
          opacity: 0;
          transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.78rem;
          line-height: 1.4;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          pointer-events: none;
          font-weight: 500;
        }
        .tooltip-text::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 6px;
          border-style: solid;
          border-color: rgba(15, 23, 42, 0.95) transparent transparent transparent;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          background-color: #00D9A6;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(0, 217, 166, 0.7);
          animation: pulse-glow 1.6s infinite;
        }
        @keyframes pulse-glow {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(0, 217, 166, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(0, 217, 166, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(0, 217, 166, 0);
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .condition-badge-wrapper {
          position: relative;
          display: inline-block;
        }
        .condition-badge-wrapper:hover .condition-tooltip {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .condition-tooltip {
          visibility: hidden;
          width: 280px;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(8px);
          color: #f1f5f9;
          text-align: left;
          border-radius: 8px;
          padding: 10px 14px;
          position: absolute;
          z-index: 100;
          bottom: 130%;
          left: 50%;
          transform: translateX(-50%) translateY(8px);
          opacity: 0;
          transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 0.78rem;
          line-height: 1.4;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          pointer-events: none;
          font-weight: 500;
        }
        .condition-tooltip::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 6px;
          border-style: solid;
          border-color: rgba(15, 23, 42, 0.95) transparent transparent transparent;
        }
      `}</style>

      {/* Doctor Header Card */}
      <div className="glass-card doctor-header-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', padding: '32px', marginBottom: '40px', alignItems: 'center' }}>
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
          }} title="Upload Photo">
            <FiUpload size={16} />
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </div>

        <div style={{ flex: 1 }}>
          <h1 className="heading-lg" style={{ marginBottom: '8px' }}>
            Welcome, <span className="text-gradient">{user.name}</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>{user.specialization || 'General Medical Practice'}</p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
              <strong>License No:</strong> {user.licenseNo || 'Verified'}
            </span>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px' }}>
              <strong>City:</strong> {user.city || 'Not specified'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-4 animate-fade-in" style={{ marginBottom: '48px' }}>
        <div className="glass-card stat-card">
          <div className="stat-value text-gradient">{hospitals.length}</div>
          <div className="stat-label">Hospitals Managed</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value text-gradient">{todayAppointments.length}</div>
          <div className="stat-label">Today's Appointments</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value text-gradient">{pendingAppointments.length}</div>
          <div className="stat-label">Pending Bookings</div>
        </div>
        <div className="glass-card stat-card">
          <div className="stat-value text-gradient">4.8</div>
          <div className="stat-label">Average Rating</div>
        </div>
      </div>

      {/* Tab Switcher Navigation */}
      <div className="doctor-tabs">
        <button 
          className={`doctor-tab-btn ${activeTab === 'hospitals' ? 'active' : ''}`}
          onClick={() => setActiveTab('hospitals')}
        >
          <FiActivity /> My Hospitals
        </button>
        <button 
          className={`doctor-tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          <FiUsers /> Appointment Queue 
          {(appointments || []).filter(appt => appt.status === 'PENDING' || appt.status === 'CONFIRMED').length > 0 && (
            <span className="doctor-tab-badge">
              {(appointments || []).filter(appt => appt.status === 'PENDING' || appt.status === 'CONFIRMED').length}
            </span>
          )}
        </button>
        <button 
          className={`doctor-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <FiClock /> Appointment History
          {(appointments || []).filter(appt => appt.status === 'COMPLETED' || appt.status === 'CANCELLED').length > 0 && (
            <span className="doctor-tab-badge" style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)' }}>
              {(appointments || []).filter(appt => appt.status === 'COMPLETED' || appt.status === 'CANCELLED').length}
            </span>
          )}
        </button>
        <button 
          className={`doctor-tab-btn ${activeTab === 'ai-analyzer' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai-analyzer')}
        >
          <FiCpu /> AI Safety & Interaction Analyzer
        </button>
        <button 
          className={`doctor-tab-btn ${activeTab === 'prescribe' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescribe')}
        >
          <FiFileText /> Write Prescription
        </button>
      </div>

      {/* Content Rendering based on Active Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'hospitals' && (
          <motion.div
            key="hospitals"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 className="heading-md">My Hospitals</h2>
              <button className="btn btn-primary btn-sm" onClick={() => handleOpenHospitalModal()}><FiPlus /> Add Hospital</button>
            </div>

            {loading ? (
              <div className="grid grid-2">
                <div className="glass-card skeleton" style={{ height: '200px' }}></div>
              </div>
            ) : hospitals.length === 0 ? (
              <div className="empty-state glass-card">
                <FiSettings className="icon" />
                <h3>No Hospitals Setup Yet</h3>
                <p>Create your first hospital profile to start receiving bookings.</p>
                <button className="btn btn-primary" style={{ marginTop: '16px' }}><FiPlus /> Create Hospital Profile</button>
              </div>
            ) : (
              <div className="grid grid-2">
                {(hospitals || []).map((hospital, index) => (
                  <motion.div 
                    key={hospital.id}
                    className="glass-card doctor-hospital-card"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    style={{ display: 'flex', gap: '24px', padding: '24px' }}
                  >
                    <div style={{ 
                      width: '140px', 
                      height: '140px', 
                      borderRadius: 'var(--radius-md)',
                      background: `url(${hospital.images?.[0] || 'https://via.placeholder.com/150'}) center/cover`
                    }}></div>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h3 className="heading-sm" style={{ marginBottom: '4px' }}>{hospital.name}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                        {hospital.city}, {hospital.state}
                      </p>
                      
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <FiUsers color="var(--primary)" /> {hospital.totalBeds} Total Beds
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                          <FiActivity color="var(--success)" /> {hospital.availableBeds} Available
                        </div>
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleOpenHospitalModal(hospital)}>Manage Settings</button>
                        <button className="btn btn-primary btn-sm" onClick={() => openUpdateBedsModal(hospital)}>Update Beds</button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )} {activeTab === 'appointments' && (
          <motion.div
            key="appointments"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            <div className="section-header" style={{ marginBottom: '24px' }}>
              <h2 className="heading-md">Appointment Queue</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
                Manage patient checkups, update statuses, and join online video consultations.
              </p>
            </div>

            {loading ? (
              <div className="appt-queue-grid">
                {[1, 2, 3].map(i => (
                  <div key={i} className="glass-card skeleton" style={{ height: '150px' }}></div>
                ))}
              </div>
            ) : (appointments || []).filter(appt => appt.status === 'PENDING' || appt.status === 'CONFIRMED').length === 0 ? (
              <div className="empty-state glass-card">
                <FiUsers className="icon" />
                <h3>No Appointments Booked</h3>
                <p>Appointments booked by patients will appear here in real time.</p>
              </div>
            ) : (
              <div className="appt-queue-grid">
                {(appointments || []).filter(appt => appt.status === 'PENDING' || appt.status === 'CONFIRMED').map((appt, index) => {
                  const isOnline = appt.type === 'ONLINE';
                  const { isEnabled, timeDiffText } = getJoinButtonState(appt.bookingDate, appt.timeSlot);
                  
                  return (
                    <motion.div
                      key={appt.id}
                      className={`glass-card appt-card status-${appt.status?.toLowerCase()}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      {/* Left: Patient Details */}
                      <div style={{ flex: 1, paddingRight: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span className="badge badge-ghost" style={{ textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 'bold' }}>
                            {appt.hospitalName}
                          </span>
                          <span className={`badge ${appt.status === 'CONFIRMED' ? 'badge-success' : appt.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.68rem' }}>
                            {appt.status}
                          </span>
                          {isOnline ? (
                            <span className="badge badge-primary" style={{ fontSize: '0.68rem', background: 'rgba(124, 58, 237, 0.15)', color: '#a78bfa' }}>
                              <FiVideo style={{ marginRight: '4px' }} /> Online Video
                            </span>
                          ) : (
                            <span className="badge badge-primary" style={{ fontSize: '0.68rem', background: 'rgba(0, 217, 166, 0.15)', color: '#34d399' }}>
                              Physical Visit
                            </span>
                          )}
                          {getConditionBadge(appt)}
                        </div>

                        <h3 className="heading-sm" style={{ margin: '0 0 4px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FiUser size={16} /> {appt.patientName}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                            ({appt.gender || 'N/A'}, Age {appt.age || 'N/A'})
                          </span>
                        </h3>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 12px 0' }}>
                          Phone: <strong>{appt.patientPhone}</strong> | Payment: <strong style={{ color: appt.paymentStatus === 'PAID' ? 'var(--success)' : 'var(--warning)' }}>{appt.paymentStatus}</strong> ({appt.paymentMethod})
                        </p>

                        {appt.symptoms && (
                          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>Symptoms:</strong> {appt.symptoms}
                          </div>
                        )}

                        {isOnline && (
                          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {editingLinkId === appt.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="Paste Google Meet or Zoom link here..."
                                  value={tempLinks[appt.id] !== undefined ? tempLinks[appt.id] : (appt.meetingLink || '')}
                                  onChange={(e) => setTempLinks(prev => ({ ...prev, [appt.id]: e.target.value }))}
                                  style={{
                                    fontSize: '0.8rem',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    color: 'white',
                                    width: '280px',
                                    outline: 'none'
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveMeetingLink(appt.id)}
                                  className="btn btn-sm btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingLinkId(null)}
                                  className="btn btn-sm btn-ghost"
                                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Video Link:</span>
                                {appt.meetingLink ? (
                                  <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer" style={{ color: '#00D9A6', textDecoration: 'underline', fontWeight: '500' }}>
                                    {appt.meetingLink.length > 32 ? `${appt.meetingLink.substring(0, 32)}...` : appt.meetingLink}
                                  </a>
                                ) : (
                                  <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Not added yet</span>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingLinkId(appt.id);
                                    setTempLinks(prev => ({ ...prev, [appt.id]: appt.meetingLink || '' }));
                                  }}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.72rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <FiEdit2 /> Edit Link
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Appointment Time Slot & Call to Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px', minWidth: '220px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                            <FiCalendar /> {formatDateToDDMMYYYY(appt.bookingDate)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', justifyContent: 'flex-end' }}>
                            <FiClock /> {appt.timeSlot}
                          </div>
                        </div>

                        {/* Video Join Button or Location Badge */}
                        {isOnline ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <div className="join-btn-container">
                              <button
                                onClick={() => handleJoinCall(appt.id)}
                                className={`btn btn-sm ${!isEnabled ? 'join-btn-disabled' : 'btn-primary'}`}
                                style={{
                                  padding: '8px 16px',
                                  fontSize: '0.85rem',
                                  borderRadius: '99px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: isEnabled ? 'linear-gradient(135deg, #00D9A6, #7C3AED)' : '',
                                  border: 'none',
                                  boxShadow: isEnabled ? '0 4px 12px rgba(0, 217, 166, 0.25)' : '',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <FiVideo /> Join Call
                              </button>
                              {!isEnabled ? (
                                <span className="tooltip-text">
                                  🔒 Join button will activate 5 minutes before the appointment.
                                </span>
                              ) : !appt.meetingLink || !appt.meetingLink.trim() ? (
                                <span className="tooltip-text" style={{ background: '#7f1d1d', borderColor: '#ef4444' }}>
                                  ΓÜá∩╕Å Please add/save a Zoom or Meet link below first.
                                </span>
                              ) : null}
                            </div>
                            {isEnabled && (
                              <span style={{ fontSize: '0.75rem', color: '#00D9A6', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span className="pulse-dot"></span>
                                {timeDiffText}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-ghost" style={{ border: '1px solid var(--border-color)' }}>
                            In-Person checkup
                          </span>
                        )}

                        {appt.previousPrescriptionSummary && (
                          <button
                            onClick={() => setSelectedSummaryBooking(appt)}
                            className="btn btn-sm"
                            style={{
                              marginTop: '8px',
                              padding: '8px 14px',
                              fontSize: '0.78rem',
                              borderRadius: '99px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'rgba(0, 217, 166, 0.1)',
                              border: '1px solid #00D9A6',
                              color: '#00D9A6',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              width: '100%',
                              justifyContent: 'center',
                              fontWeight: '600'
                            }}
                          >
                            <FiFileText /> Prev Prescription AI Summary
                          </button>
                        )}

                        {/* Status Update Buttons for pending items */}
                        {appt.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button 
                              onClick={() => handleStatusUpdate(appt.id, 'CONFIRMED')}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: 'var(--success)', color: 'var(--success)' }}
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={() => handleStatusUpdate(appt.id, 'CANCELLED')}
                              className="btn btn-outline btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}

                        {appt.status === 'CONFIRMED' && (
                          <button
                            onClick={() => {
                              setSelectedPatientId(appt.patientId ? appt.patientId.toString() : '');
                              setSelectedBookingId(appt.id ? appt.id.toString() : '');
                              setActiveTab('prescribe');
                            }}
                            className="btn btn-sm btn-primary"
                            style={{
                              padding: '8px 16px',
                              fontSize: '0.82rem',
                              borderRadius: '99px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'linear-gradient(135deg, #00D9A6, #7C3AED)',
                              border: 'none',
                              color: 'white',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 12px rgba(0, 217, 166, 0.25)',
                              width: '100%',
                              justifyContent: 'center',
                              marginTop: '4px'
                            }}
                          >
                            <FiFileText /> Prescribe
                          </button>
                        )}



                        {appt.aiReport && (
                          <button
                            onClick={() => setSelectedReportBooking(appt)}
                            className="btn btn-sm btn-primary"
                            style={{
                              padding: '8px 16px',
                              fontSize: '0.82rem',
                              borderRadius: '99px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'linear-gradient(135deg, #00D9A6, #7C3AED)',
                              border: 'none',
                              color: 'white',
                              fontWeight: 'bold',
                              boxShadow: '0 4px 12px rgba(0, 217, 166, 0.25)',
                              marginTop: '8px'
                            }}
                          >
                            <FiCpu /> View AI Report
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            <div className="section-header" style={{ marginBottom: '24px' }}>
              <h2 className="heading-md">Appointment History</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
                View your past and completed consultations.
              </p>
            </div>

            {loading ? (
              <div className="appt-queue-grid">
                {[1, 2, 3].map(i => (
                  <div key={i} className="glass-card skeleton" style={{ height: '150px' }}></div>
                ))}
              </div>
            ) : (appointments || []).filter(appt => appt.status === 'COMPLETED' || appt.status === 'CANCELLED').length === 0 ? (
              <div className="empty-state glass-card">
                <h3>No History Found</h3>
                <p>Your completed or cancelled appointments will appear here.</p>
              </div>
            ) : (
              <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)' }}>Patient Info</th>
                      <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)' }}>Symptoms / Notes</th>
                      <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)' }}>Date & Time</th>
                      <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)' }}>Meeting Info</th>
                      <th style={{ padding: '16px 20px', fontWeight: '600', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(appointments || []).filter(appt => appt.status === 'COMPLETED' || appt.status === 'CANCELLED').map((appt, index) => {
                      return (
                        <tr key={appt.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s', ':hover': { background: 'var(--bg-secondary)' } }}>
                          <td data-label="Patient Info" style={{ padding: '16px 20px' }}>
                            <div className="td-value">
                              <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{appt.patientName}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{appt.gender || 'N/A'}, Age {appt.age || 'N/A'}</div>
                            </div>
                          </td>
                          <td data-label="Symptoms / Notes" style={{ padding: '16px 20px' }}>
                            <div className="td-value">
                              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{appt.symptoms || appt.notes || 'Not Provided'}</div>
                            </div>
                          </td>
                          <td data-label="Date & Time" style={{ padding: '16px 20px' }}>
                            <div className="td-value">
                              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><FiCalendar size={14} /> {formatDateToDDMMYYYY(appt.bookingDate)}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><FiClock size={14} /> {appt.timeSlot}</div>
                            </div>
                          </td>
                          <td data-label="Meeting Info" style={{ padding: '16px 20px' }}>
                            <div className="td-value">
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'inherit' }}>
                                <span className={`badge ${appt.status === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                  {appt.status}
                                </span>
                                {getConditionBadge(appt)}
                              </div>
                              {appt.meetingLink && (
                                <div style={{ fontSize: '0.75rem', marginTop: '6px', color: 'var(--primary)' }}>Meeting Recorded</div>
                              )}
                            </div>
                          </td>
                          <td data-label="Actions" style={{ padding: '16px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                              <button
                                onClick={() => handleDownloadReportPDF(appt)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', width: '120px', justifyContent: 'center' }}
                              >
                                <FiDownload /> AI Report
                              </button>
                              <button
                                onClick={() => handleDownloadHistoryPrescriptionPDF(appt)}
                                className="btn btn-outline btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', width: '120px', justifyContent: 'center' }}
                              >
                                <FiDownload /> Prescription
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
        {activeTab === 'ai-analyzer' && (
          <motion.div
            key="ai-analyzer"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="grid grid-2 animate-fade-in"
            style={{ gap: '32px' }}
          >
            {/* Form */}
            <div className="glass-card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <FiCpu color="var(--primary)" size={24} />
                <h2 className="heading-sm" style={{ margin: 0 }}>AI Medical Safety Analyzer</h2>
              </div>

              {/* Mode Selector Toggle */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: 'var(--radius-md)' }}>
                <button
                  type="button"
                  onClick={() => { setAnalyzerMode('manual'); setAiResult(null); }}
                  className={`btn ${analyzerMode === 'manual' ? 'btn-primary' : ''}`}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    border: 'none',
                    fontWeight: 600,
                    background: analyzerMode === 'manual' ? 'var(--primary)' : 'transparent',
                    color: analyzerMode === 'manual' ? 'var(--text-button, white)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  Manual Entry Mode
                </button>
                <button
                  type="button"
                  onClick={() => { setAnalyzerMode('upload'); setAiResult(null); }}
                  className={`btn ${analyzerMode === 'upload' ? 'btn-primary' : ''}`}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    border: 'none',
                    fontWeight: 600,
                    background: analyzerMode === 'upload' ? 'var(--primary)' : 'transparent',
                    color: analyzerMode === 'upload' ? 'var(--text-button, white)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  Document Upload Mode
                </button>
              </div>
              
              {analyzerMode === 'manual' ? (
                <form onSubmit={handleAiAnalysis} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Active Symptoms <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea
                      className="form-input"
                      style={{ minHeight: '100px', resize: 'vertical' }}
                      placeholder="Describe patient symptoms (e.g. fever, cough, chest pain, difficulty breathing)"
                      value={aiSymptoms}
                      onChange={(e) => setAiSymptoms(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>New Medication Name(s)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Ibuprofen, Paracetamol"
                      value={aiMedicine}
                      onChange={(e) => setAiMedicine(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Previous/Existing Prescriptions</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Aspirin, Acetaminophen"
                      value={aiPrevPrescription}
                      onChange={(e) => setAiPrevPrescription(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg" disabled={analyzing} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '14px', fontWeight: '600', borderRadius: '99px', background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none', color: 'white', cursor: 'pointer' }}>
                    {analyzing ? (
                      <>
                        <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div> Analyzing...
                      </>
                    ) : (
                      <>
                        <FiCpu /> Analyze Safety & Interactions
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleDocAnalysis} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Upload Prescription or Report <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div 
                      style={{
                        border: '2px dashed rgba(255, 255, 255, 0.15)',
                        borderRadius: 'var(--radius-md)',
                        padding: '30px 20px',
                        textAlign: 'center',
                        background: 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s',
                        position: 'relative'
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          setReportFile(e.dataTransfer.files[0]);
                        }
                      }}
                    >
                      <input 
                        type="file" 
                        accept=".txt,.pdf,.png,.jpg,.jpeg" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setReportFile(e.target.files[0]);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer'
                        }}
                      />
                      <FiUpload size={32} style={{ color: 'var(--primary)', marginBottom: '12px', opacity: 0.8 }} />
                      {reportFile ? (
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 4px 0', wordBreak: 'break-all' }}>{reportFile.name}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {(reportFile.size / 1024).toFixed(1)} KB ΓÇö Click or drag to replace
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Drag and drop report/prescription here</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Supports PDF, TXT, PNG, JPG (Max 5MB)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>New Medication Name(s) <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>(Optional)</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Ibuprofen, Aspirin (to check interactions against report)"
                      value={reportNewMedicine}
                      onChange={(e) => setReportNewMedicine(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg" disabled={analyzingDoc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '14px', fontWeight: '600', borderRadius: '99px', background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none', color: 'white', cursor: 'pointer' }}>
                    {analyzingDoc ? (
                      <>
                        <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div> Analyzing Document...
                      </>
                    ) : (
                      <>
                        <FiCpu /> Upload & Analyze Report
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Results */}
            <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 className="heading-sm" style={{ margin: 0 }}>Analysis Report</h2>
                {aiResult && (
                  <button 
                    onClick={handleDownloadAIReportPDF}
                    className="btn btn-outline btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FiDownload /> Download PDF
                  </button>
                )}
              </div>
              
              {!aiResult ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', textAlign: 'center', minHeight: '300px' }}>
                  <FiInfo size={40} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p>Provide patient details and press Analyze to view potential drug-drug interaction warnings and clinical severity reviews.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Severity Level */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: 'var(--radius-md)', borderLeft: `4px solid ${aiResult.severity === 'High' ? 'var(--danger)' : aiResult.severity === 'Medium' ? 'var(--warning)' : 'var(--success)'}` }}>
                    <FiAlertTriangle color={aiResult.severity === 'High' ? 'var(--danger)' : aiResult.severity === 'Medium' ? 'var(--warning)' : 'var(--success)'} size={20} />
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clinical Severity Alert</div>
                      <div style={{ fontWeight: 700, color: aiResult.severity === 'High' ? 'var(--danger)' : aiResult.severity === 'Medium' ? 'var(--warning)' : 'var(--success)' }}>
                        {aiResult.severity} Risk Level
                      </div>
                    </div>
                  </div>

                  {/* Critical Alerts */}
                  {aiResult.alerts && aiResult.alerts.length > 0 && (
                    <div>
                      <h4 style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>High Risk Alerts</h4>
                      {aiResult.alerts.map((alert, i) => (
                        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--danger)', background: 'rgba(220,53,69,0.05)', padding: '8px 12px', borderRadius: '4px', marginBottom: '6px' }}>{alert}</div>
                      ))}
                    </div>
                  )}

                  {/* Extracted Symptoms */}
                  {aiResult.symptoms && aiResult.symptoms.length > 0 && (
                    <div>
                      <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Extracted Symptoms</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {aiResult.symptoms.map((symptom, i) => (
                          <span key={i} style={{ fontSize: '0.85rem', background: 'rgba(0,217,166,0.08)', color: '#00D9A6', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                            {symptom}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Current Medications */}
                  {((aiResult.currentMedication && aiResult.currentMedication.length > 0) || (aiResult.currentMedications && aiResult.currentMedications.length > 0)) && (
                    <div>
                      <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Extracted Current Medications</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(aiResult.currentMedication || aiResult.currentMedications).map((med, i) => (
                          <span key={i} style={{ fontSize: '0.85rem', background: 'rgba(124,58,237,0.08)', color: '#b794f4', padding: '4px 10px', borderRadius: '12px', fontWeight: 500 }}>
                            {med}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drug Interactions */}
                  {aiResult.interactions && aiResult.interactions.length > 0 && (
                    <div>
                      <h4 style={{ color: 'var(--warning)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Drug-Drug Interactions</h4>
                      {aiResult.interactions.map((interaction, i) => (
                        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'rgba(255,193,7,0.05)', padding: '8px 12px', borderRadius: '4px', border: '1px dashed rgba(255,193,7,0.2)', marginBottom: '6px' }}>{interaction}</div>
                      ))}
                    </div>
                  )}

                  {/* AI Recommendations */}
                  {aiResult.recommendations && aiResult.recommendations.length > 0 && (
                    <div>
                      <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Symptomatic Precautions & Recommendations</h4>
                      <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {aiResult.recommendations.map((rec, i) => (
                          <li key={i} style={{ marginBottom: '6px', listStyleType: 'disc' }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Extracted Precautions */}
                  {aiResult.precautions && aiResult.precautions.length > 0 && (
                    <div>
                      <h4 style={{ color: 'var(--warning)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>Report Care Precautions</h4>
                      <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {aiResult.precautions.map((prec, i) => (
                          <li key={i} style={{ marginBottom: '6px', listStyleType: 'disc' }}>{prec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
        {activeTab === 'prescribe' && (
          <motion.div
            key="prescribe"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            style={{ display: 'grid', gridTemplateColumns: selectedPatientId ? '1fr 320px' : '1fr', gap: '32px', maxWidth: '1200px', margin: '0 auto' }}
            className="doctor-prescribe-grid animate-fade-in"
          >
            <div className="glass-card" style={{ padding: '32px' }}>
              <h2 className="heading-sm" style={{ marginBottom: '24px' }}>Generate Digital Prescription</h2>
              
              <form onSubmit={handleCreatePrescription} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="grid grid-2" style={{ gap: '20px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Patient User ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter Patient ID"
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Booking ID (Optional)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Associated Booking ID"
                      value={selectedBookingId}
                      onChange={(e) => setSelectedBookingId(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Diagnosis / Illness <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Acute Viral Bronchitis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    required
                  />
                </div>

                {/* Medications List */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontWeight: '600' }}>Medications</label>
                    <button type="button" className="btn btn-outline btn-sm" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={addMedicineRow}>+ Add Medicine</button>
                  </div>
                  
                  {medicines.map((med, index) => (
                    <div key={index} className="grid grid-4" style={{ gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Medicine Name"
                        value={med.name}
                        onChange={(e) => updateMedicine(index, 'name', e.target.value)}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Dosage (e.g. 500mg)"
                        value={med.dosage}
                        onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Frequency (e.g. 1-0-1)"
                        value={med.frequency}
                        onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Duration"
                          value={med.duration}
                          onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                        />
                        {medicines.length > 1 && (
                          <button type="button" className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'rgba(220,53,69,0.2)', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => removeMedicineRow(index)}>X</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Diagnostic Tests */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontWeight: '600' }}>Prescribed Diagnostic Tests</label>
                    <button type="button" className="btn btn-outline btn-sm" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }} onClick={addTestRow}>+ Add Test</button>
                  </div>
                  
                  {tests.map((test, index) => (
                    <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. CBC, Liver Function Test"
                        value={test}
                        onChange={(e) => updateTest(index, e.target.value)}
                      />
                      {tests.length > 1 && (
                        <button type="button" className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'rgba(220,53,69,0.2)', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => removeTestRow(index)}>X</button>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Doctor Advice / Notes</label>
                  <textarea
                    className="form-input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    placeholder="Special instructions or advice for patient"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button type="button" onClick={handleDownloadPrescriptionPDF} className="btn btn-outline btn-lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '50%', padding: '14px', fontWeight: '600', borderRadius: '99px', color: 'var(--primary)', borderColor: 'var(--primary)', cursor: 'pointer' }}>
                    <FiDownload /> Download PDF
                  </button>
                  <button type="submit" className="btn btn-primary btn-lg" disabled={submittingPrescription} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '50%', padding: '14px', fontWeight: '600', borderRadius: '99px', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', border: 'none', color: 'white', cursor: 'pointer' }}>
                    {submittingPrescription ? <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div> : <><FiCheck /> Create & Send</>}
                  </button>
                </div>
              </form>
            </div>

            {selectedPatientId && patientProfile && (
              <div className="glass-card" style={{ padding: '24px', alignSelf: 'start' }}>
                <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', margin: 0, fontSize: '1.1rem' }}>
                  <FiUser color="var(--primary)" /> Patient Health Card
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem', marginTop: '16px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Name / Age</span>
                    <strong>{patientProfile.name} ({patientProfile.age} yrs, {patientProfile.gender})</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Blood Group</span>
                    <span className="text-gradient" style={{ fontWeight: 'bold' }}>{patientProfile.bloodGroup}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Health Status Badge</span>
                    <span style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      marginTop: '4px',
                      background: patientProfile.healthBadge === 'CRITICAL' ? 'rgba(220,53,69,0.1)' : patientProfile.healthBadge === 'MONITORING' ? 'rgba(255,193,7,0.1)' : 'rgba(40,167,69,0.1)',
                      color: patientProfile.healthBadge === 'CRITICAL' ? '#dc3545' : patientProfile.healthBadge === 'MONITORING' ? '#ffc107' : '#28a745',
                      border: `1px solid ${patientProfile.healthBadge === 'CRITICAL' ? 'rgba(220,53,69,0.2)' : patientProfile.healthBadge === 'MONITORING' ? 'rgba(255,193,7,0.2)' : 'rgba(40,167,69,0.2)'}`
                    }}>
                      {patientProfile.healthBadge === 'CRITICAL' ? '🔴 Critical' : patientProfile.healthBadge === 'MONITORING' ? '🟡 Monitoring' : '🟢 Stable'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Allergies</span>
                    <span style={{ color: 'var(--danger)' }}>{patientProfile.allergies}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Current Medications</span>
                    <span>{patientProfile.currentMedication}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Active Conditions</span>
                    <span>{patientProfile.existingMedicalCondition}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem', marginBottom: '2px' }}>Emergency Contact</span>
                    <span>{patientProfile.emergencyNumber}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

      )}
      </AnimatePresence>
      {/* Full-Screen Report Overlay Modal */}
      {selectedReportBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
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
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCpu /> MedVerse AI Consultation Report
                </h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  Scribe report generated for patient <strong>{selectedReportBooking.patientName}</strong>.
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
                background: 'var(--border-light)'
              }}
            >
              <div style={{ color: 'var(--text-primary)' }}>
                {renderMarkdown(selectedReportBooking.aiReport)}
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handleDownloadReportPDF(selectedReportBooking)} 
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiDownload /> Download Report (PDF)
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedReportBooking.aiReport);
                    toast.success('Report copied to clipboard! 📋');
                  }} 
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiCopy /> Copy Report
                </button>
              </div>

              <button 
                onClick={() => setSelectedReportBooking(null)}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Previous Prescription Summary Overlay Modal */}
      {selectedSummaryBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
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
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiCpu /> MedGemma AI Previous Prescription Summary
                </h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  Previous prescription summary for patient <strong>{selectedSummaryBooking.patientName}</strong>.
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
                background: 'var(--border-light)'
              }}
            >
              <div style={{ color: 'var(--text-primary)' }}>
                {renderMarkdown(selectedSummaryBooking.previousPrescriptionSummary)}
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => handleDownloadSummaryPDF(selectedSummaryBooking)} 
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiDownload /> Download Summary (PDF)
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedSummaryBooking.previousPrescriptionSummary);
                    toast.success('Summary copied to clipboard! 📋');
                  }} 
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiCopy /> Copy Summary
                </button>
              </div>

              <button 
                onClick={() => setSelectedSummaryBooking(null)}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Prescription Modal */}
      {viewingPrescription && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="glass-card animate-scale-up" style={{
            width: '100%',
            maxWidth: '650px',
            height: '75vh',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Prescription Details
                </h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  Patient: <strong>{viewingPrescription.patientName}</strong> | Prescribed By: Doc. {viewingPrescription.doctorName}
                </p>
              </div>
            </div>

            {/* Scrollable content */}
            <div 
              className="custom-scrollbar"
              style={{
                flex: 1,
                padding: '24px',
                overflowY: 'auto',
                background: 'rgba(15, 23, 42, 0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >
              <div>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Diagnosis</strong>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{viewingPrescription.diagnosis}</p>
              </div>

              {viewingPrescription.notes && (
                <div>
                  <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Doctor's Notes / Instructions</strong>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{viewingPrescription.notes}</p>
                </div>
              )}

              {/* Medicines */}
              {(() => {
                const medicines = parseJsonStr(viewingPrescription.medicines);
                if (!medicines || medicines.length === 0) return null;
                return (
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Medicines Prescribed</strong>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      {medicines.map((med, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < medicines.length - 1 ? '1px dashed var(--border-color)' : 'none', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-primary)' }}><strong>{med.name}</strong> ({med.dosage})</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{med.frequency} | {med.duration}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Tests */}
              {(() => {
                const tests = parseJsonStr(viewingPrescription.tests);
                if (!tests || tests.length === 0) return null;
                return (
                  <div>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Diagnostics Recommended</strong>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      {tests.map((test, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderBottom: i < tests.length - 1 ? '1px dashed var(--border-color)' : 'none', fontSize: '0.85rem' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{test.testName}</div>
                          {test.reason && <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px' }}>Reason: {test.reason}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{
              padding: '20px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button 
                onClick={() => setViewingPrescription(null)}
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hospital Settings Modal */}
      {showHospitalModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="glass-card animate-scale-up" style={{
            width: '100%',
            maxWidth: '750px',
            height: '85vh',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiSettings /> {editingHospitalId ? 'Edit Hospital Settings' : 'Add New Hospital'}
                </h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  {editingHospitalId ? 'Update hospital details and capacity.' : 'Create a new hospital profile.'}
                </p>
              </div>
            </div>

            {/* Scrollable form content */}
            <form onSubmit={submitHospitalForm} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div 
                className="custom-scrollbar"
                style={{
                  flex: 1,
                  padding: '24px',
                  overflowY: 'auto',
                  background: 'rgba(15, 23, 42, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Registration Number</label>
                    <input
                      type="text"
                      name="registrationNo"
                      className="form-input"
                      placeholder="e.g. REG12345"
                      value={hospitalForm.registrationNo}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Hospital Name</label>
                    <input
                      type="text"
                      name="name"
                      className="form-input"
                      placeholder="e.g. City Care Hospital"
                      value={hospitalForm.name}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Address</label>
                  <textarea
                    name="address"
                    className="form-input"
                    placeholder="Full Address"
                    rows="2"
                    style={{ height: 'auto', resize: 'vertical' }}
                    value={hospitalForm.address}
                    onChange={handleHospitalFormChange}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>City</label>
                    <input
                      type="text"
                      name="city"
                      className="form-input"
                      placeholder="City"
                      value={hospitalForm.city}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>State</label>
                    <input
                      type="text"
                      name="state"
                      className="form-input"
                      placeholder="State"
                      value={hospitalForm.state}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Pincode</label>
                    <input
                      type="text"
                      name="pincode"
                      className="form-input"
                      placeholder="Pincode"
                      value={hospitalForm.pincode}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Phone Number</label>
                    <input
                      type="text"
                      name="phone"
                      className="form-input"
                      placeholder="Phone"
                      value={hospitalForm.phone}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      className="form-input"
                      placeholder="Email"
                      value={hospitalForm.email}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Total Beds</label>
                    <input
                      type="number"
                      name="totalBeds"
                      className="form-input"
                      placeholder="Total Beds"
                      value={hospitalForm.totalBeds}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Available Beds</label>
                    <input
                      type="number"
                      name="availableBeds"
                      className="form-input"
                      placeholder="Available Beds"
                      value={hospitalForm.availableBeds}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Consultation Fee (₹)</label>
                    <input
                      type="number"
                      name="consultationRate"
                      className="form-input"
                      placeholder="Fee"
                      value={hospitalForm.consultationRate}
                      onChange={handleHospitalFormChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Facilities (Comma separated)</label>
                  <input
                    type="text"
                    name="facilities"
                    className="form-input"
                    placeholder="e.g. ICU, Emergency, Pharmacy, Radiology"
                    value={hospitalForm.facilities}
                    onChange={handleHospitalFormChange}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Doctor Types/Specialties (Comma separated)</label>
                  <input
                    type="text"
                    name="doctorTypes"
                    className="form-input"
                    placeholder="e.g. Cardiologist, Neurologist, General Physician"
                    value={hospitalForm.doctorTypes}
                    onChange={handleHospitalFormChange}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Latitude (Optional)</label>
                    <input
                      type="number"
                      step="any"
                      name="latitude"
                      className="form-input"
                      placeholder="e.g. 19.0596"
                      value={hospitalForm.latitude}
                      onChange={handleHospitalFormChange}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Longitude (Optional)</label>
                    <input
                      type="number"
                      step="any"
                      name="longitude"
                      className="form-input"
                      placeholder="e.g. 72.8295"
                      value={hospitalForm.longitude}
                      onChange={handleHospitalFormChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Description</label>
                  <textarea
                    name="description"
                    className="form-input"
                    placeholder="Description of the hospital, services, specialties, etc."
                    rows="3"
                    style={{ height: 'auto', resize: 'vertical' }}
                    value={hospitalForm.description}
                    onChange={handleHospitalFormChange}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '20px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={closeHospitalModal}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingHospital}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none' }}
                >
                  {submittingHospital ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Beds Modal */}
      {bedsModalHospitalId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="glass-card animate-scale-up" style={{
            width: '100%',
            maxWidth: '450px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '12px'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiActivity /> Update Bed Availability
                </h2>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  Change the number of currently available beds.
                </p>
              </div>
            </div>

            {/* Form content */}
            <form onSubmit={submitBedsUpdate} style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Available Beds</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  value={bedsInputValue}
                  onChange={(e) => setBedsInputValue(Number(e.target.value) || 0)}
                  required
                />
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '10px'
              }}>
                <button
                  type="button"
                  onClick={closeBedsModal}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingBedsValue}
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #00D9A6, #7C3AED)', border: 'none' }}
                >
                  {updatingBedsValue ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
