import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiSearch, 
  FiFilter, 
  FiMapPin, 
  FiStar, 
  FiActivity, 
  FiX, 
  FiCheck, 
  FiSend,
  FiShoppingBag,
  FiCalendar,
  FiFileText,
  FiVideo,
  FiAward,
  FiCpu,
  FiTrendingUp,
  FiAlertTriangle,
  FiPhone,
  FiTruck,
  FiClock,
  FiDownload,
  FiCopy,
  FiUser
} from 'react-icons/fi';
import { hospitalAPI, aiAPI, authAPI, rewardsAPI, emergencyAPI, bookingAPI, activityAPI, jobsAPI, workflowAPI } from '../../services/api';
import { getOfflineAiResponse } from '../../services/offlineAi';
import { useAuth } from '../../context/AuthContext';
import { jsPDF } from 'jspdf';
import toast from 'react-hot-toast';
import aiBotIcon from '../../assets/ai-bot-icon.png';
import BodyMapSymptomFlow from './BodyMapSymptomFlow';
import SkinCareAssessment from './SkinCareAssessment';


export default function PatientDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeProfile } = useAuth();

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

  const [activeTab, setActiveTab] = useState('hospitals'); // 'hospitals' or 'visited-doctors'
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedReportBooking, setSelectedReportBooking] = useState(null);
  const [bookingsFilter, setBookingsFilter] = useState('upcoming'); // 'upcoming', 'completed', 'cancelled'
  const [reschedulingBooking, setReschedulingBooking] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Follow-up Booking States
  const [followUpBooking, setFollowUpBooking] = useState(null);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTimeSlot, setFollowUpTimeSlot] = useState('');
  const [followUpSlots, setFollowUpSlots] = useState([]);
  const [loadingFollowUpSlots, setLoadingFollowUpSlots] = useState(false);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);

  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapUrl, setMapUrl] = useState('');
  const [sortBy, setSortBy] = useState(''); // '', 'rating', 'distance', 'price'
  const [userCoords, setUserCoords] = useState(null);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);



  // Gamification & AI States
  const [profileData, setProfileData] = useState(null);
  const [analyzingReports, setAnalyzingReports] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);

  // Leaderboard states
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  // Bounty Features Widgets States
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [activeJobs, setActiveJobs] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  const fetchPendingApprovals = async () => {
    try {
      const res = await workflowAPI.getPendingCount();
      setPendingApprovalsCount(res.data.pendingApprovals || 0);
    } catch (e) {
      console.warn('Failed to load pending approvals count', e);
    }
  };

  const fetchActiveJobs = async () => {
    try {
      const res = await jobsAPI.getJobs(0, 5);
      setActiveJobs(res.data.data || []);
    } catch (e) {
      console.warn('Failed to load active jobs', e);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const res = await activityAPI.getRecent();
      setRecentActivities(res.data.data || []);
    } catch (e) {
      console.warn('Failed to load recent activities', e);
    }
  };



  // AI Chat States
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatSessionId, setChatSessionId] = useState(null);
  const [chatHistory, setChatHistory] = useState([
    {
      sender: 'ai',
      text: '👋 **Hello! I am Astra, your AI-powered medical assistant.**\n\nI provide evidence-based health guidance and can help you:\n- 🩺 Analyze symptoms with clinical triage\n- 💊 Suggest wellness & prevention tips\n- 👨‍⚕️ Recommend the right specialist doctor\n\n*Tell me what symptoms you\'re experiencing, and I\'ll guide you step by step.*'
    }
  ]);
  const [sendingChat, setSendingChat] = useState(false);

  const quickTags = [
    { label: '🤕 Headache', query: 'I have a headache that started today. Can you help me assess it?' },
    { label: '🌡️ Fever', query: 'I have a fever. What should I check and when should I see a doctor?' },
    { label: '🥗 Diet Plan', query: 'Can you suggest a healthy balanced diet plan for overall wellness?' },
    { label: '📅 Book Doctor', query: 'I want to book a doctor appointment. What specialists are available?' },
    { label: '😷 Cold & Cough', query: 'I have cold and cough symptoms. Is this something serious?' }
  ];

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

  const handleSendChat = async (textToSend) => {
    const msg = textToSend || chatMessage;
    if (!msg.trim() || sendingChat) return;

    setChatHistory(prev => [...prev, { sender: 'user', text: msg }]);
    if (!textToSend) setChatMessage('');
    setSendingChat(true);

    if (!navigator.onLine) {
      setTimeout(async () => {
        try {
          const reply = await getOfflineAiResponse(msg);
          setChatHistory(prev => [...prev, { sender: 'ai', text: reply }]);
        } catch (err) {
          console.error(err);
          setChatHistory(prev => [...prev, { sender: 'ai', text: '⚠️ **Error:** Failed to compute offline reply.' }]);
        } finally {
          setSendingChat(false);
          setTimeout(() => {
            const chatBody = document.getElementById('chat-body');
            if (chatBody) {
              chatBody.scrollTop = chatBody.scrollHeight;
            }
          }, 100);
        }
      }, 500);
      return;
    }

    try {
      const res = await aiAPI.chat(msg, chatSessionId);
      const reply = res.data.reply || 'Sorry, I couldn\'t formulate a reply. Please try again.';
      // Store sessionId from backend for multi-turn conversation
      if (res.data.sessionId) {
        setChatSessionId(res.data.sessionId);
      }
      setChatHistory(prev => [...prev, { sender: 'ai', text: reply }]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { sender: 'ai', text: '⚠️ **Connection Error:** Could not reach Astra. Please check your internet connection and try again.' }]);
    } finally {
      setSendingChat(false);
      setTimeout(() => {
        const chatBody = document.getElementById('chat-body');
        if (chatBody) {
          chatBody.scrollTop = chatBody.scrollHeight;
        }
      }, 100);
    }
  };

  const handleResetChat = async () => {
    try {
      const res = await aiAPI.resetChat(chatSessionId);
      if (res.data.sessionId) {
        setChatSessionId(res.data.sessionId);
      }
    } catch (err) {
      console.error('Reset failed', err);
    }
    setChatHistory([
      {
        sender: 'ai',
        text: '👋 **Conversation reset!** I\'m ready for a fresh consultation.\n\n*Tell me what symptoms you\'re experiencing, and I\'ll guide you step by step.*'
      }
    ]);
  };



  const fetchBookings = async () => {
    try {
      setBookingsLoading(true);
      const res = await bookingAPI.getPatientBookings(activeProfile ? activeProfile.id : null);
      setBookings(res.data || []);
    } catch (error) {
      console.error('Failed to load bookings details', error);
    } finally {
      setBookingsLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      setCancellingId(bookingId);
      const loadingToast = toast.loading('Cancelling appointment...');
      await bookingAPI.updateStatus(bookingId, 'CANCELLED');
      toast.success('Appointment cancelled successfully!', { id: loadingToast });
      setBookings(prevBookings => 
        prevBookings.map(b => 
          b.id === bookingId 
            ? { ...b, status: 'CANCELLED', paymentStatus: b.paymentMethod !== 'CASH' ? 'REFUNDED' : 'CANCELLED' } 
            : b
        )
      );
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to cancel appointment';
      toast.error(errorMsg);
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    const fetchRescheduleSlots = async () => {
      if (!rescheduleDate || !reschedulingBooking) {
        setRescheduleSlots([]);
        return;
      }
      try {
        setLoadingRescheduleSlots(true);
        const res = await bookingAPI.getAvailableSlots(reschedulingBooking.doctorId, rescheduleDate);
        setRescheduleSlots(res.data || []);
      } catch (error) {
        toast.error('Failed to load available slots');
        setRescheduleSlots([]);
      } finally {
        setLoadingRescheduleSlots(false);
      }
    };
    fetchRescheduleSlots();
  }, [rescheduleDate, reschedulingBooking]);

  useEffect(() => {
    const fetchFollowUpSlots = async () => {
      if (!followUpDate || !followUpBooking) {
        setFollowUpSlots([]);
        return;
      }
      try {
        setLoadingFollowUpSlots(true);
        const res = await bookingAPI.getAvailableSlots(followUpBooking.doctorId, followUpDate);
        setFollowUpSlots(res.data || []);
      } catch (error) {
        toast.error('Failed to load available slots');
        setFollowUpSlots([]);
      } finally {
        setLoadingFollowUpSlots(false);
      }
    };
    fetchFollowUpSlots();
  }, [followUpDate, followUpBooking]);

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!reschedulingBooking || !rescheduleDate || !rescheduleTimeSlot) {
      toast.error('Please select both date and time slot');
      return;
    }
    try {
      setSubmittingReschedule(true);
      const loadingToast = toast.loading('Rescheduling appointment...');
      await bookingAPI.reschedule(reschedulingBooking.id, rescheduleDate, rescheduleTimeSlot);
      toast.success('Appointment rescheduled successfully!', { id: loadingToast });
      setReschedulingBooking(null);
      setRescheduleDate('');
      setRescheduleTimeSlot('');
      fetchBookings();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to reschedule appointment';
      toast.error(errorMsg);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!followUpBooking || !followUpDate || !followUpTimeSlot) {
      toast.error('Please select both date and time slot');
      return;
    }

    setSubmittingFollowUp(true);
    const loadingToast = toast.loading('Scheduling your follow-up appointment...');
    try {
      const packedNotes = `Follow-up Visit for previous Booking ID #${followUpBooking.id}. Original Symptoms: ${followUpBooking.symptoms}`;
      
      const payload = {
        hospitalId: followUpBooking.hospitalId,
        doctorId: followUpBooking.doctorId,
        bookingDate: followUpDate,
        timeSlot: followUpTimeSlot,
        type: followUpBooking.type || 'ONLINE',
        notes: packedNotes,
        patientName: followUpBooking.patientName,
        patientPhone: followUpBooking.patientPhone,
        age: parseInt(followUpBooking.age),
        gender: followUpBooking.gender,
        symptoms: followUpBooking.symptoms,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        familyMemberId: activeProfile ? activeProfile.id : null
      };

      await bookingAPI.create(payload);
      toast.success('Follow-up appointment booked successfully!', { id: loadingToast });
      setFollowUpBooking(null);
      setFollowUpDate('');
      setFollowUpTimeSlot('');
      fetchBookings();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to schedule follow-up', { id: loadingToast });
    } finally {
      setSubmittingFollowUp(false);
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
    doc.text(formatDateToDDMMYYYY(appt.bookingDate) || 'N/A', margin + 28, y);

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
  };

  useEffect(() => {
    fetchHospitals();
    fetchProfile();
    fetchLeaderboard();
    fetchBookings();
    fetchPendingApprovals();
    fetchActiveJobs();
    fetchRecentActivities();
    const timer = setInterval(() => {
      fetchActiveJobs();
      fetchPendingApprovals();
    }, 10000);
    return () => clearInterval(timer);
  }, [activeProfile]);


  async function fetchHospitals() {
    try {
      setLoading(true);
      const res = await hospitalAPI.getAll();
      setHospitals(res.data);
    } catch (error) {
      toast.error('Failed to load hospitals');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await authAPI.getProfile();
      setProfileData(res.data);
    } catch (error) {
      console.error('Failed to load profile details', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLeaderboardLoading(true);
      const res = await rewardsAPI.getLeaderboard();
      setLeaderboardData(res.data.data || []);
    } catch (error) {
      console.error('Failed to load leaderboard', error);
      setLeaderboardData([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleChecklistToggle = async (key) => {
    if (!profileData || checklistLoading) return;
    try {
      setChecklistLoading(true);
      const currentVal = !!profileData[key];
      const payload = {
        medsChecked: key === 'medsChecked' ? !currentVal : !!profileData.medsChecked,
        dietChecked: key === 'dietChecked' ? !currentVal : !!profileData.dietChecked,
        exerciseChecked: key === 'exerciseChecked' ? !currentVal : !!profileData.exerciseChecked
      };
      const res = await rewardsAPI.updateChecklist(payload);
      setProfileData(prev => ({
        ...prev,
        ...res.data.data
      }));
      toast.success(res.data.message);
      fetchLeaderboard();
    } catch (err) {
      toast.error('Failed to update daily checklist');
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleAnalyzeReports = async () => {
    try {
      setAnalyzingReports(true);
      const res = await aiAPI.analyzePatientReports();
      setProfileData(prev => ({
        ...prev,
        expPoints: res.data.expPoints,
        healthBadge: res.data.healthBadge,
        lastAnalysis: res.data.comparison,
        carePlan: res.data.carePlan
      }));
      toast.success('AI Health Reports comparison complete!');
      fetchLeaderboard();
    } catch (err) {
      toast.error('AI Report Analysis failed. Check if backend is running.');
    } finally {
      setAnalyzingReports(false);
    }
  };

  // Gamification helper variables
  const currentExp = profileData?.expPoints || 0;
  const userLevel = Math.floor(currentExp / 500) + 1;
  const expProgress = currentExp % 500;
  const expPercentage = Math.min(100, (expProgress / 500) * 100);



  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchHospitals();
      return;
    }
    
    try {
      setLoading(true);
      const res = await hospitalAPI.search(searchQuery);
      setHospitals(res.data);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSortChange = async (value) => {
    if (value === 'distance') {
      if (!userCoords) {
        const loadingToast = toast.loading('Requesting location access...');
        try {
          const pos = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'));
            } else {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
            }
          });
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
          setSortBy('distance');
          toast.dismiss(loadingToast);
          toast.success('Sorted by distance relative to your location!');
        } catch (err) {
          toast.dismiss(loadingToast);
          toast.error('Location access denied or timeout. Unable to sort by distance.');
          console.warn('Geolocation failed', err);
        }
      } else {
        setSortBy('distance');
      }
    } else {
      setSortBy(value);
    }
  };

  const getSortedHospitals = () => {
    let list = [...hospitals];
    
    const userCity = profileData?.city || "Mumbai";
    list = list.filter(h => h.city?.toLowerCase() === userCity.toLowerCase());
    
    if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'price-asc') {
      list.sort((a, b) => (a.consultationRate || 0) - (b.consultationRate || 0));
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => (b.consultationRate || 0) - (a.consultationRate || 0));
    } else if (sortBy === 'distance' && userCoords) {
      list.sort((a, b) => {
        const distA = getDistance(userCoords.latitude, userCoords.longitude, a.latitude || 0, a.longitude || 0);
        const distB = getDistance(userCoords.latitude, userCoords.longitude, b.latitude || 0, b.longitude || 0);
        return (distA || 0) - (distB || 0);
      });
    }
    
    return list;
  };



  const handleViewMap = async (hospital) => {
    if (!hospital) return;
    const loadingToast = toast.loading('Locating hospital & calculating route...');
    const getCurrentPos = () => new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
    });

    const geocodeHospital = async () => {
      if (hospital.latitude && hospital.longitude) {
        return { lat: hospital.latitude, lon: hospital.longitude };
      }
      try {
        const q = encodeURIComponent(`${hospital.address || ''} ${hospital.city || ''}`);
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
        const json = await res.json();
        if (json && json[0]) return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
      } catch (e) {
        console.warn('Geocode failed', e);
      }
      return null;
    };

    try {
      const dest = await geocodeHospital();
      let origin = null;
      try {
        const pos = await getCurrentPos();
        origin = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      } catch (err) {
        console.warn('User denied geolocation or timeout', err);
      }

      toast.dismiss(loadingToast);

      // Open Google Maps directions in a new tab for step-by-step route
      if (origin && dest) {
        const gUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${dest.lat},${dest.lon}&travelmode=driving`;
        window.open(gUrl, '_blank');
      } else if (dest) {
        const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lon}`;
        window.open(gUrl, '_blank');
      } else {
        const addressQuery = encodeURIComponent(`${hospital.address || ''} ${hospital.city || ''}`);
        const gUrl = `https://www.google.com/maps/dir/?api=1&destination=${addressQuery}`;
        window.open(gUrl, '_blank');
      }

      // Show the backup interactive Google Map in the modal
      if (dest) {
        const mapUrlLocal = `https://maps.google.com/maps?q=${dest.lat},${dest.lon}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
        setMapUrl(mapUrlLocal);
        setShowMapModal(true);
      } else {
        const addressQuery = encodeURIComponent(`${hospital.address || ''} ${hospital.city || ''}`);
        const mapUrlLocal = `https://maps.google.com/maps?q=${addressQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
        setMapUrl(mapUrlLocal);
        setShowMapModal(true);
      }
    } catch (e) {
      toast.dismiss(loadingToast);
      console.error(e);
      const addressQuery = encodeURIComponent(`${hospital.address || ''} ${hospital.city || ''}`);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${addressQuery}`, '_blank');
    }
  };

  return (
    <div className="page-container section">
      <div className="dashboard-header animate-slide-up" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 className="heading-xl">Your <span className="text-gradient">Appointments</span> & Health Hub</h1>
        <p className="auth-subtitle" style={{ marginTop: '16px', fontSize: '1.1rem' }}>
          Manage upcoming visits, prescriptions, and health reminders — then open your care plan only when you want the full treatment details.
        </p>
      </div>

      <div className="patient-dashboard-grid animate-fade-in">
        
        {/* Left Column (Actions, AI Reports, Search, Hospitals) */}
        <div className="left-side-content" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Quick Actions */}
          <div className="dashboard-quick-actions-grid">
            {[
              {
                icon: <FiShoppingBag size={28} />,
                label: 'Order Medicines',
                sub: 'From your prescriptions',
                color: 'var(--primary)',
                bg: 'rgba(0,217,166,0.08)',
                border: 'rgba(0,217,166,0.25)',
                to: '/my-prescriptions'
              },
              {
                icon: <FiCalendar size={28} />,
                label: 'My Bookings',
                sub: 'View appointments',
                color: 'var(--secondary)',
                bg: 'rgba(99,102,241,0.08)',
                border: 'rgba(99,102,241,0.25)',
                to: '/my-bookings'
              },
              {
                icon: <FiFileText size={28} />,
                label: 'My Prescriptions',
                sub: 'Digital health records',
                color: '#f59e0b',
                bg: 'rgba(245,158,11,0.08)',
                border: 'rgba(245,158,11,0.25)',
                to: '/my-prescriptions'
              },
              {
                icon: <FiVideo size={28} />,
                label: 'Online Consult',
                sub: 'Join video call',
                color: '#ec4899',
                bg: 'rgba(236,72,153,0.08)',
                border: 'rgba(236,72,153,0.25)',
                to: '/my-bookings'
              }
            ].map((action, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => navigate(action.to)}
                style={{
                  padding: '24px 20px',
                  background: action.bg,
                  border: `1px solid ${action.border}`,
                  borderRadius: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.2s',
                }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
              >
                <div style={{ color: action.color }}>{action.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{action.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{action.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* AI Report Comparison & Care Plan */}
          <div className="rewards-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 className="heading-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <FiCpu color="var(--primary)" /> AI Health Status & Care Plan
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                  Analyze previous vs current health reports to check recovery and get personalized recommendations.
                </p>
              </div>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleAnalyzeReports}
                disabled={analyzingReports}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {analyzingReports ? (
                  <>
                    <div className="spinner"></div> Analyzing...
                  </>
                ) : (
                  <>
                    <FiCpu /> Analyze Reports
                  </>
                )}
              </button>
            </div>

            <div className="divider" style={{ margin: 0 }}></div>

            {/* Health Badge & Comparison Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Current Condition Badge:</span>
                <span className={`health-badge ${profileData?.healthBadge || 'STABLE'}`}>
                  {profileData?.healthBadge === 'CRITICAL' ? '🔴 Critical / Action Required' : profileData?.healthBadge === 'MONITORING' ? '🟡 Monitoring Required' : '🟢 Stable / Healthy'}
                </span>
              </div>
              
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '8px' }}>AI Recovery & Comparison Summary</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                  {profileData?.lastAnalysis || "No analysis available. Click 'Analyze Reports' to compare your health records."}
                </p>
              </div>
            </div>

            {/* Personalized Care Plan */}
            {profileData?.carePlan && (
              <div style={{ background: 'rgba(0, 217, 166, 0.02)', border: '1px dashed rgba(0, 217, 166, 0.15)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiActivity /> AI Personalized Care Plan
                </div>
                <div 
                  className="care-plan-markdown"
                  dangerouslySetInnerHTML={{ 
                    __html: profileData.carePlan
                      .replace(/\n\n/g, '<br/><br/>')
                      .replace(/\n- /g, '<br/>• ')
                      .replace(/\n\* /g, '<br/>• ')
                      .replace(/### (.*)/g, '<h3>$1</h3>')
                      .replace(/#### (.*)/g, '<h4>$1</h4>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  }}
                />
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="dashboard-tabs" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '8px' }}>
            <button
              onClick={() => setActiveTab('hospitals')}
              className={`tab-btn ${activeTab === 'hospitals' ? 'active' : ''}`}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'hospitals' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '8px 16px',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              Find Care Centers
              {activeTab === 'hospitals' && (
                <motion.div 
                  layoutId="activeTabUnderline"
                  style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '3px', background: 'var(--primary)', borderRadius: '2px' }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('visited-doctors')}
              className={`tab-btn ${activeTab === 'visited-doctors' ? 'active' : ''}`}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'visited-doctors' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '8px 16px',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              My Bookings
              {activeTab === 'visited-doctors' && (
                <motion.div 
                  layoutId="activeTabUnderline"
                  style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '3px', background: 'var(--primary)', borderRadius: '2px' }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('body-map')}
              className={`tab-btn ${activeTab === 'body-map' ? 'active' : ''}`}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'body-map' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '8px 16px',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              Body Map
              {activeTab === 'body-map' && (
                <motion.div 
                  layoutId="activeTabUnderline"
                  style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '3px', background: 'var(--primary)', borderRadius: '2px' }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('skin-care')}
              className={`tab-btn ${activeTab === 'skin-care' ? 'active' : ''}`}
              style={{
                background: 'none',
                border: 'none',
                color: activeTab === 'skin-care' ? 'var(--primary)' : 'var(--text-secondary)',
                fontSize: '1.1rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '8px 16px',
                position: 'relative',
                transition: 'all 0.3s ease'
              }}
            >
              Skin Care
              {activeTab === 'skin-care' && (
                <motion.div 
                  layoutId="activeTabUnderline"
                  style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '3px', background: 'var(--primary)', borderRadius: '2px' }}
                />
              )}
            </button>
          </div>


          {activeTab === 'hospitals' && (
            <>
              {/* Search Bar */}
              <form onSubmit={handleSearch} className="search-container" style={{ 
                maxWidth: '100%', display: 'flex', gap: '16px', margin: 0 
              }}>
                <div className="form-input-icon" style={{ flex: 1 }}>
                  <FiSearch className="icon" />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Search hospitals by name or city..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ borderRadius: 'var(--radius-full)', padding: '16px 20px 16px 48px', fontSize: '1.05rem' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary">Search</button>
              </form>

              {/* Filters & Sorting Row */}
              <div className="filters-row animate-fade-in" style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '0px', 
                flexWrap: 'wrap', 
                gap: '16px',
                position: 'relative',
                zIndex: 50
              }}>
                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                  <button type="button" className="btn btn-ghost btn-sm active"><FiFilter /> All Hospitals</button>
                  <button type="button" className="btn btn-ghost btn-sm"><FiActivity /> Cardiology</button>
                  <button type="button" className="btn btn-ghost btn-sm"><FiActivity /> Neurology</button>
                  <button type="button" className="btn btn-ghost btn-sm"><FiActivity /> Orthopedics</button>
                </div>

                {/* Custom Sorting Dropdown */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 100 }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Sort By:</span>
                  
                  <button 
                    type="button"
                    onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '10px 18px',
                      borderRadius: '99px',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      outline: 'none',
                      minWidth: '170px',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.2s ease',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                    }}
                  >
                    <span>
                      {sortBy === 'rating' ? '⭐ Rating' : 
                       sortBy === 'distance' ? '📍 Distance' : 
                       sortBy === 'price-asc' ? '₹ Price: Low to High' : 
                       sortBy === 'price-desc' ? '₹ Price: High to Low' : 
                       'Default'}
                    </span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>▼</span>
                  </button>

                  {sortDropdownOpen && (
                    <>
                      {/* Overlay transparent backdrop to close dropdown when clicking outside */}
                      <div 
                        onClick={() => setSortDropdownOpen(false)}
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 99
                        }}
                      />
                      
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '6px',
                        minWidth: '190px',
                        boxShadow: 'var(--shadow-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        zIndex: 1000
                      }}>
                        {[
                          { value: '', label: 'Default' },
                          { value: 'rating', label: '⭐ Rating' },
                          { value: 'distance', label: '📍 Distance' },
                          { value: 'price-asc', label: '₹ Price: Low to High' },
                          { value: 'price-desc', label: '₹ Price: High to Low' }
                        ].map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              handleSortChange(item.value);
                              setSortDropdownOpen(false);
                            }}
                            style={{
                              background: sortBy === item.value ? 'var(--bg-secondary)' : 'transparent',
                              border: 'none',
                              color: sortBy === item.value ? 'var(--primary-dark)' : 'var(--text-secondary)',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              fontSize: '0.85rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              transition: 'all 0.15s ease',
                              fontWeight: sortBy === item.value ? '600' : '400'
                            }}
                            onMouseEnter={(e) => {
                              if (sortBy !== item.value) {
                                e.currentTarget.style.background = 'var(--border-light)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (sortBy !== item.value) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                              }
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Hospital Grid */}
              {loading ? (
                <div className="grid grid-2" style={{ gap: '24px' }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="glass-card skeleton" style={{ height: '380px' }}></div>
                  ))}
                </div>
              ) : getSortedHospitals().length === 0 ? (
                <div className="empty-state">
                  <FiMapPin className="icon" />
                  <h3>No hospitals found</h3>
                  <p>Try adjusting your search criteria</p>
                </div>
              ) : (
                <div className="grid grid-2" style={{ gap: '24px' }}>
                  {getSortedHospitals().map((hospital, index) => (
                    <motion.div 
                      key={hospital.id} 
                      className="glass-card hospital-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      style={{ overflow: 'hidden', cursor: 'pointer' }}
                      onClick={() => setSelectedHospital(hospital)}
                    >
                      {/* Image Header */}
                      <div className="hospital-image" style={{ 
                        height: '200px', 
                        background: `url(${hospital.images?.[0] || 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800'}) center/cover`,
                        position: 'relative'
                      }}>
                        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                          <span className="badge badge-success" style={{ backdropFilter: 'blur(10px)', background: 'rgba(0, 230, 118, 0.2)' }}>
                            {hospital.availableBeds} Beds Available
                          </span>
                        </div>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h3 className="heading-sm" style={{ margin: 0 }}>{hospital.name}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: '600' }}>
                            <FiStar fill="currentColor" /> {hospital.rating ? parseFloat(hospital.rating).toFixed(1) : 'New'}
                          </div>
                        </div>

                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FiMapPin /> {hospital.address}, {hospital.city}
                          </span>
                          {userCoords && hospital.latitude && hospital.longitude && (
                            <span style={{ 
                              fontSize: '0.8rem', 
                              background: 'rgba(0, 217, 166, 0.15)', 
                              color: 'var(--primary)', 
                              padding: '2px 8px', 
                              borderRadius: 'var(--radius-full)',
                              fontWeight: '600'
                            }}>
                              📍 {getDistance(userCoords.latitude, userCoords.longitude, hospital.latitude, hospital.longitude).toFixed(1)} km
                            </span>
                          )}
                        </div>

                        {/* Facilities */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
                          {hospital.facilities?.slice(0, 3).map((facility, i) => (
                            <span key={i} className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{facility}</span>
                          ))}
                          {hospital.facilities?.length > 3 && (
                            <span className="badge badge-ghost" style={{ fontSize: '0.7rem' }}>+{hospital.facilities.length - 3}</span>
                          )}
                        </div>

                        {/* Footer */}
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                          <div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>Consultation</span>
                            <span style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1.1rem' }}>₹{hospital.consultationRate}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/book/${hospital.id}`);
                            }} 
                            className="btn btn-outline btn-sm"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'visited-doctors' && (
            <div className="visited-doctors-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Filter Buttons */}
              <div className="bookings-filter-tabs" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                {[
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setBookingsFilter(item.value)}
                    style={{
                      background: bookingsFilter === item.value ? 'rgba(0, 217, 166, 0.15)' : 'none',
                      border: bookingsFilter === item.value ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      color: bookingsFilter === item.value ? 'var(--primary)' : 'var(--text-secondary)',
                      padding: '8px 20px',
                      borderRadius: '99px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {bookingsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="glass-card skeleton" style={{ height: '78px', width: '100%' }}></div>
                  ))}
                </div>
              ) : bookings.filter(b => {
                if (bookingsFilter === 'upcoming') {
                  return (b.status === 'CONFIRMED' || b.status === 'PENDING') && !b.aiReport;
                } else if (bookingsFilter === 'completed') {
                  return b.status === 'COMPLETED' || !!b.aiReport;
                } else if (bookingsFilter === 'cancelled') {
                  return b.status === 'CANCELLED';
                }
                return true;
              }).length === 0 ? (
                <div className="empty-state glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
                  <FiCalendar className="icon" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px', display: 'block', margin: '0 auto' }} />
                  <h3>No {bookingsFilter} appointments</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '8px auto 0 auto' }}>
                    You don't have any {bookingsFilter} appointments at the moment.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Visited Doctors Header */}
                  <div className="visited-doctors-table-header" style={{
                    display: 'grid',
                    gridTemplateColumns: '2.5fr 1.5fr 1fr 1.5fr',
                    padding: '12px 24px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    fontWeight: '600',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    marginBottom: '8px'
                  }}>
                    <div>Doctor & Hospital</div>
                    <div>Date & Time</div>
                    <div>Type</div>
                    <div style={{ textAlign: 'right' }}>Actions</div>
                  </div>

                  {/* Bookings Cards */}
                  {bookings
                    .filter(b => {
                      if (bookingsFilter === 'upcoming') {
                        return (b.status === 'CONFIRMED' || b.status === 'PENDING') && !b.aiReport;
                      } else if (bookingsFilter === 'completed') {
                        return b.status === 'COMPLETED' || !!b.aiReport;
                      } else if (bookingsFilter === 'cancelled') {
                        return b.status === 'CANCELLED';
                      }
                      return true;
                    })
                    .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
                    .map((booking, index) => (
                      <motion.div
                        key={booking.id}
                        className="visited-doctor-card"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2.5fr 1.5fr 1fr 1.5fr',
                          alignItems: 'center',
                          padding: '16px 24px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '12px',
                          transition: 'all 0.2s ease',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                        whileHover={{ scale: 1.01, borderColor: 'var(--primary)', boxShadow: 'var(--shadow-md)' }}
                      >
                        {/* Doctor Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'rgba(0, 217, 166, 0.1)',
                            border: '1px solid rgba(0, 217, 166, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)'
                          }}>
                            <FiUser size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              Dr. {booking.doctorName}
                              {booking.notes && booking.notes.includes('Follow-up Visit') && (
                                <span className="badge" style={{ fontSize: '0.68rem', padding: '2px 8px', background: '#f59e0b', color: 'white', borderRadius: '4px', fontWeight: 'bold' }}>
                                  Follow-up Visit
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{booking.hospitalName}</div>
                          </div>
                        </div>

                        {/* Date & Time */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: '500' }}>
                            <FiCalendar size={14} style={{ color: 'var(--primary)' }} /> {formatDateToDDMMYYYY(booking.bookingDate)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px' }}>
                            <FiClock size={14} style={{ color: 'var(--secondary)' }} /> {booking.timeSlot}
                          </div>
                        </div>

                        {/* Type */}
                        <div>
                          <span className={`badge ${booking.type === 'ONLINE' ? 'badge-primary' : 'badge-ghost'}`} style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
                            {booking.type === 'ONLINE' ? '🎥 Video' : '🏥 In-Person'}
                          </span>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {bookingsFilter === 'upcoming' && (
                            <>
                              <button
                                onClick={() => {
                                  setReschedulingBooking(booking);
                                  setRescheduleDate('');
                                  setRescheduleTimeSlot('');
                                  setRescheduleSlots([]);
                                }}
                                className="btn btn-sm btn-outline"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  borderRadius: '99px',
                                  fontWeight: 'bold',
                                  borderColor: 'var(--primary)',
                                  color: 'var(--primary)',
                                }}
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelBooking(booking.id)}
                                className="btn btn-sm btn-ghost"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  borderRadius: '99px',
                                  color: 'var(--danger)',
                                }}
                                disabled={cancellingId === booking.id}
                              >
                                {cancellingId === booking.id ? '...' : 'Cancel'}
                              </button>
                            </>
                          )}
                          
                          {bookingsFilter === 'completed' && (
                            <>
                              {booking.aiReport ? (
                                <>
                                  <button
                                    onClick={() => setSelectedReportBooking(booking)}
                                    className="btn btn-sm btn-primary"
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '0.75rem',
                                      borderRadius: '99px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      background: 'linear-gradient(135deg, #00D9A6, #7C3AED)',
                                      border: 'none',
                                      color: 'white',
                                      fontWeight: 'bold',
                                      boxShadow: '0 4px 10px rgba(0, 217, 166, 0.15)'
                                    }}
                                    title="View AI Consultation Report"
                                  >
                                    <FiCpu size={12} /> Report
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFollowUpBooking(booking);
                                      setFollowUpDate('');
                                      setFollowUpTimeSlot('');
                                      setFollowUpSlots([]);
                                    }}
                                    className="btn btn-sm btn-primary"
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '0.75rem',
                                      borderRadius: '99px',
                                      background: '#f59e0b',
                                      border: 'none',
                                      color: 'white',
                                      fontWeight: 'bold',
                                    }}
                                    title="Schedule Follow-up Visit"
                                  >
                                    Follow-up
                                  </button>
                                  <button
                                    onClick={() => handleDownloadReportPDF(booking)}
                                    className="btn btn-sm btn-outline"
                                    style={{
                                      padding: '6px',
                                      borderRadius: '50%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderColor: 'rgba(255, 255, 255, 0.15)',
                                      color: 'var(--text-secondary)',
                                      width: '28px',
                                      height: '28px'
                                    }}
                                    title="Download PDF"
                                  >
                                    <FiDownload size={12} />
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No report
                                </span>
                              )}
                            </>
                          )}

                          {bookingsFilter === 'cancelled' && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Cancelled
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'body-map' && (
            <BodyMapSymptomFlow />
          )}

          {activeTab === 'skin-care' && (
            <SkinCareAssessment />
          )}
        </div>


        {/* Right Side Column (Rewards & Checklist) */}
        <div className="right-side-rewards" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Emergency SOS Trigger Card */}
          <div 
            className="sos-dashboard-card"
            onClick={() => navigate('/emergency')}
          >
            <span className="sos-card-icon">🚨</span>
            <span className="sos-card-title">Emergency SOS</span>
            <p className="sos-card-text">
              Instantly alert emergency contacts and track nearest ambulance with available beds.
            </p>
          </div>

          {/* Pending Approvals Widget */}
          {pendingApprovalsCount > 0 && (
            <div 
              className="rewards-card" 
              style={{ 
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(239, 68, 68, 0.08))',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.08)',
                cursor: 'pointer'
              }}
              onClick={() => navigate('/workflows')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', fontWeight: 'bold', fontSize: '0.95rem' }}>
                <FiAlertTriangle size={18} />
                <span>Pending Approvals Require Action</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '6px', marginBottom: '12px', lineHeight: 1.4 }}>
                You have <strong>{pendingApprovalsCount}</strong> pending workflow step{pendingApprovalsCount > 1 ? 's' : ''} that need review and approval.
              </p>
              <button 
                className="btn btn-sm" 
                style={{ 
                  background: '#f59e0b', 
                  border: 'none', 
                  color: '#000', 
                  fontWeight: '700',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  width: '100%'
                }}
              >
                Review Approvals
              </button>
            </div>
          )}

          {/* Background Tasks Widget */}
          <div className="rewards-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="rewards-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiCpu color="var(--primary)" /> Background Tasks
              </h3>
              <button 
                onClick={() => navigate('/background-jobs')} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
              >
                View Queue
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '-4px', marginBottom: '12px' }}>
              Monitor active AI analyses.
            </p>
            {activeJobs.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                No active or recent tasks.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeJobs.slice(0, 3).map((job) => (
                  <div 
                    key={job.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: 'var(--border-light)',
                      borderRadius: '8px',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {job.jobType?.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        ID: #{job.id}
                      </span>
                    </div>
                    <span 
                      style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: 700, 
                        color: job.status === 'COMPLETED' ? '#10b981' : job.status === 'FAILED' ? '#ef4444' : '#f59e0b',
                        background: job.status === 'COMPLETED' ? 'rgba(16,185,129,0.1)' : job.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      {job.status?.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Widget */}
          <div className="rewards-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="rewards-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiActivity color="var(--primary)" /> Recent Activity
              </h3>
              <button 
                onClick={() => navigate('/activity')} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
              >
                View History
              </button>
            </div>
            {recentActivities.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                No recent activity logged.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {recentActivities.slice(0, 4).map((activity) => (
                  <div key={activity.id} style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <div style={{ fontSize: '1rem', marginTop: '2px' }}>
                      {activity.eventType === 'SOS_TRIGGERED' ? '🚨' : activity.eventType?.includes('BOOKING') ? '📅' : 'ℹ️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                        {activity.summary}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* EXP Progress Bar */}
          <div className="rewards-card">
            <h3 className="rewards-title">
              <FiAward color="var(--primary)" /> EXP Level Center
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
              <span>Level <strong>{userLevel}</strong></span>
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{currentExp} EXP Total</span>
            </div>
            <div className="exp-bar-container">
              <div className="exp-bar-fill" style={{ width: `${expPercentage}%` }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{expProgress} / 500 EXP</span>
              <span>{500 - expProgress} EXP to Level {userLevel + 1}</span>
            </div>
          </div>

          {/* Streak Tracker */}
          <div className="rewards-card" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.03), rgba(245, 158, 11, 0.03))' }}>
            <h3 className="rewards-title" style={{ color: '#f59e0b' }}>
              <FiTrendingUp /> Streak Adherence
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                borderRadius: '50%', 
                background: 'rgba(245,158,11,0.1)', 
                border: '1px solid rgba(245,158,11,0.25)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#f59e0b'
              }}>
                <FiTrendingUp size={28} />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f59e0b' }}>{profileData?.streakDays || 0} Days</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Complete checklist daily to maintain streak. Get 100 EXP bonus every 7 days!</div>
              </div>
            </div>
          </div>

          {/* Daily Checklist */}
          <div className="rewards-card">
            <h3 className="rewards-title">
              <FiCheck color="var(--primary)" /> Daily Checklist
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '-8px', marginBottom: '16px' }}>
              Track daily habits to earn health EXP rewards:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div className="checklist-item" onClick={() => handleChecklistToggle('medsChecked')}>
                <div className="checklist-label">
                  <div className={`checklist-checkbox ${profileData?.medsChecked ? 'active' : ''}`}>
                    {profileData?.medsChecked && <FiCheck size={14} />}
                  </div>
                  <span>Took Medicine</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>+10 EXP</span>
              </div>

              <div className="checklist-item" onClick={() => handleChecklistToggle('dietChecked')}>
                <div className="checklist-label">
                  <div className={`checklist-checkbox ${profileData?.dietChecked ? 'active' : ''}`}>
                    {profileData?.dietChecked && <FiCheck size={14} />}
                  </div>
                  <span>Followed Healthy Diet</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>+15 EXP</span>
              </div>

              <div className="checklist-item" onClick={() => handleChecklistToggle('exerciseChecked')}>
                <div className="checklist-label">
                  <div className={`checklist-checkbox ${profileData?.exerciseChecked ? 'active' : ''}`}>
                    {profileData?.exerciseChecked && <FiCheck size={14} />}
                  </div>
                  <span>Completed Exercise</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>+20 EXP</span>
              </div>

            </div>
          </div>

          {/* Rewards Milestones */}
          <div className="rewards-card">
            <h3 className="rewards-title">
              <FiAward color="var(--primary)" /> Rewards Milestones
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { threshold: 500, label: "Free Basic Consultation" },
                { threshold: 1000, label: "20% off Pharmacy Order" },
                { threshold: 2000, label: "Free Diagnostic Test" },
                { threshold: 5000, label: "Premium AI Health Report" }
              ].map((reward, i) => {
                const isUnlocked = currentExp >= reward.threshold;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{reward.label}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Required: {reward.threshold} EXP</span>
                    </div>
                    <span className={`reward-badge ${isUnlocked ? 'unlocked' : 'locked'}`}>
                      {isUnlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rewards-card">
            <h3 className="rewards-title">
              <FiTrendingUp color="var(--primary)" /> Health Leaderboard
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leaderboardLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                </div>
              ) : leaderboardData.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px' }}>
                  No active players yet
                </div>
              ) : (
                leaderboardData.map((player, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: player.isCurrentUser ? 'rgba(0,217,166,0.06)' : 'transparent',
                    border: player.isCurrentUser ? '1px solid rgba(0,217,166,0.15)' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', width: '16px' }}>{idx + 1}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: player.isCurrentUser ? '700' : 'normal' }}>
                          {player.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: player.badge === 'CRITICAL' ? '#dc3545' : player.badge === 'MONITORING' ? '#ffc107' : '#28a745' }}>
                          • {player.badge}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{player.exp} EXP</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Hospital Details Modal */}
      {selectedHospital && (
        <div 
          className="modal-backdrop animate-fade-in" 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={() => setSelectedHospital(null)}
        >
          <motion.div 
            className="glass-card modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ 
              maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
              position: 'relative', display: 'flex', flexDirection: 'column', padding: 0
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedHospital(null)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10
              }}
            >
              <FiX />
            </button>
            
            <div style={{ height: '250px', background: `url(${selectedHospital.images?.[0] || 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800'}) center/cover` }} />
            
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 className="heading-md" style={{ marginBottom: '8px' }}>{selectedHospital.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiMapPin /> {selectedHospital.address}, {selectedHospital.city}
                    </div>
                    <button
                      onClick={() => handleViewMap(selectedHospital)}
                      title="View Map"
                      style={{
                        padding: '4px 12px',
                        fontSize: '0.75rem',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'linear-gradient(135deg, #00D9A6, #7C3AED)',
                        color: 'white',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0, 217, 166, 0.2)',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      <FiMapPin size={12} />
                      <span>View Map</span>
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: '600', fontSize: '1.2rem' }}>
                  <FiStar fill="currentColor" /> {selectedHospital.rating ? parseFloat(selectedHospital.rating).toFixed(1) : 'New'}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '12px', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '12px', flex: 1, textAlign: 'center' }}>
                  <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>{selectedHospital.availableBeds}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available Beds</div>
                </div>
                <div style={{ padding: '12px', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '12px', flex: 1, textAlign: 'center' }}>
                  <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem' }}>₹{selectedHospital.consultationRate}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Consultation</div>
                </div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <h3 className="heading-sm" style={{ marginBottom: '12px' }}>About Hospital</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {selectedHospital.description || `${selectedHospital.name} is a state-of-the-art medical facility located in ${selectedHospital.city}. We are dedicated to providing the highest quality healthcare services with compassionate care and advanced technology.`}
                </p>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <h3 className="heading-sm" style={{ marginBottom: '12px' }}>Facilities</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedHospital.facilities?.map((facility, i) => (
                    <span key={i} className="badge badge-primary" style={{ padding: '8px 12px' }}>
                      <FiCheck style={{ marginRight: '4px' }} /> {facility}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button 
                  onClick={() => navigate(`/book/${selectedHospital.id}`)} 
                  className="btn btn-primary btn-block"
                  style={{ padding: '16px', fontSize: '1.1rem', flex: 1 }}
                >
                  Book Consultation Now
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Map Modal Preview */}
      {showMapModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }} onClick={() => setShowMapModal(false)}>
          <div style={{ width: '90%', maxWidth: '900px', height: '70vh', background: 'white', borderRadius: '12px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700 }}>{selectedHospital.name} — Map</div>
              <button onClick={() => setShowMapModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.1rem', cursor: 'pointer' }}><FiX /></button>
            </div>
            <iframe src={mapUrl} style={{ width: '100%', height: '100%', border: 0 }} title="Hospital Map Preview" />
          </div>
        </div>
      )}

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
              style={{
                flex: 1,
                padding: '24px',
                overflowY: 'auto',
                background: 'var(--border-light)'
              }}
            >
              <div style={{ color: 'var(--text-primary)' }}>
                {parseMarkdown(selectedReportBooking.aiReport)}
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

      {/* Styles for Chatbot */}
      <style>{`
        /* MedGamma chatbot styles */
        .medgamma-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          height: 54px;
          padding: 0 20px 0 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, #00D9A6, #7C3AED);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 0.2px;
          box-shadow: 0 8px 28px rgba(0, 217, 166, 0.45), 0 4px 12px rgba(124, 58, 237, 0.3);
          z-index: 999;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          white-space: nowrap;
        }
        
        .medgamma-fab:hover {
          transform: scale(1.05) translateY(-2px);
          box-shadow: 0 12px 36px rgba(0, 217, 166, 0.55), 0 6px 18px rgba(124, 58, 237, 0.4);
        }

        .medgamma-fab-pulse {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--primary);
          opacity: 0.4;
          z-index: -1;
          animation: fab-pulse 2s infinite;
        }

        @keyframes fab-pulse {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        .chat-panel {
          position: fixed;
          bottom: 96px;
          right: 24px;
          width: 380px;
          height: 520px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid var(--border-color);
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 999;
          font-family: var(--font-primary);
        }

        @media (max-width: 480px) {
          .chat-panel {
            width: calc(100% - 32px);
            right: 16px;
            left: 16px;
            bottom: 90px;
            height: 480px;
          }
        }

        .chat-header {
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chat-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chat-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
        }

        .chat-title-container {
          display: flex;
          flex-direction: column;
        }

        .chat-status {
          font-size: 0.75rem;
          opacity: 0.85;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .chat-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00E676;
          display: inline-block;
        }

        .chat-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #F8FAFC;
        }

        .chat-message-wrapper {
          display: flex;
          flex-direction: column;
          max-width: 80%;
        }

        .chat-message-wrapper.user {
          align-self: flex-end;
        }

        .chat-message-wrapper.ai {
          align-self: flex-start;
        }

        .chat-bubble {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .chat-message-wrapper.user .chat-bubble {
          background: var(--primary);
          color: white;
          border-top-right-radius: 0;
        }

        .chat-message-wrapper.ai .chat-bubble {
          background: white;
          color: #1E293B;
          border: 1px solid var(--border-color);
          border-top-left-radius: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }

        .chat-message-sender {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-bottom: 4px;
          padding: 0 4px;
        }

        .chat-message-wrapper.user .chat-message-sender {
          align-self: flex-end;
        }

        .chat-quick-tags {
          display: flex;
          gap: 8px;
          padding: 10px 20px;
          background: #F1F5F9;
          overflow-x: auto;
          border-top: 1px solid var(--border-color);
          white-space: nowrap;
        }

        .chat-tag-pill {
          padding: 6px 12px;
          background: white;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .chat-tag-pill:hover {
          border-color: var(--primary);
          color: var(--primary);
          background: rgba(0, 217, 166, 0.05);
        }

        .chat-input-area {
          padding: 16px 20px;
          background: white;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .chat-input {
          flex: 1;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-full);
          padding: 12px 18px;
          font-size: 0.9rem;
          outline: none;
          transition: border 0.2s;
        }

        .chat-input:focus {
          border-color: var(--primary);
        }

        .chat-btn-send {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          transition: background 0.2s;
        }

        .chat-btn-send:hover {
          background: var(--primary-dark);
        }

        .chat-btn-send:disabled {
          background: #CBD5E1;
          cursor: not-allowed;
        }

        .dot-animation {
          display: inline-block;
          animation: dotPulse 1.4s infinite;
          letter-spacing: 2px;
          font-weight: bold;
        }

        @keyframes dotPulse {
          0%, 20% { opacity: 0.2; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0.2; }
        }

        .patient-dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .patient-dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
        .rewards-title {
          font-size: 1.15rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }
        .rewards-card {
          padding: 24px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }
        .exp-bar-container {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 5px;
          overflow: hidden;
          margin: 12px 0 6px 0;
        }
        .exp-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          border-radius: 5px;
          transition: width 0.4s ease;
        }
        .checklist-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: all 0.2s;
        }
        .checklist-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.08);
        }
        .checklist-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          font-weight: 600;
        }
        .checklist-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: 2px solid var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .checklist-checkbox.active {
          background: var(--primary);
          border-color: var(--primary);
          color: #000;
        }
        .reward-badge {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .reward-badge.locked {
          background: rgba(255,255,255,0.05);
          color: var(--text-muted);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .reward-badge.unlocked {
          background: rgba(0, 217, 166, 0.1);
          color: var(--primary);
          border: 1px solid rgba(0, 217, 166, 0.2);
        }
        .health-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 700;
        }
        .health-badge.STABLE {
          background: rgba(40, 167, 69, 0.1);
          color: #28a745;
          border: 1px solid rgba(40, 167, 69, 0.25);
        }
        .health-badge.MONITORING {
          background: rgba(255, 193, 7, 0.1);
          color: #ffc107;
          border: 1px solid rgba(255, 193, 7, 0.25);
        }
        .health-badge.CRITICAL {
          background: rgba(220, 53, 69, 0.1);
          color: #dc3545;
          border: 1px solid rgba(220, 53, 69, 0.25);
        }
        .care-plan-markdown {
          line-height: 1.6;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .care-plan-markdown h3 {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 16px;
          margin-bottom: 8px;
        }
        .care-plan-markdown h4 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--primary);
          margin-top: 12px;
          margin-bottom: 6px;
        }
        .care-plan-markdown ul {
          margin-bottom: 12px;
          padding-left: 20px;
        }
        .care-plan-markdown li {
          margin-bottom: 4px;
        }
        .hospital-card {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          text-align: left !important;
          width: 100% !important;
        }
        .hospital-image {
          width: 100% !important;
          height: 200px !important;
        }
      `}</style>



      {/* Floating Action Button */}
      <button className="medgamma-fab" onClick={() => setChatOpen(!chatOpen)}>
        {chatOpen ? (
          <>
            <FiX size={20} />
            <span>Close</span>
          </>
        ) : (
          <>
            <img src={aiBotIcon} alt="AI" style={{ width: '34px', height: '34px', objectFit: 'contain', borderRadius: '50%', flexShrink: 0 }} />
            <span>AI Recommend a Doctor</span>
          </>
        )}
        {!chatOpen && <div className="medgamma-fab-pulse"></div>}
      </button>

      {/* Chat Overlay Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div 
            className="chat-panel"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          >
            {/* Header */}
            <div className="chat-header">
              <div className="chat-header-info">
                <div className="chat-avatar" style={{ overflow: 'hidden', background: 'transparent', padding: 0 }}>
                  <img src={aiBotIcon} alt="Astra" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '50%' }} />
                </div>
                <div className="chat-title-container">
                  <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>Astra</span>
                  {!navigator.onLine ? (
                    <span className="chat-status" style={{ color: '#F59E0B' }}>
                      <span className="chat-status-dot" style={{ backgroundColor: '#F59E0B' }}></span>
                      Offline Mode (TF.js)
                    </span>
                  ) : (
                    <span className="chat-status">
                      <span className="chat-status-dot"></span>
                      Online companion
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleResetChat}
                  title="New conversation"
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', width: '28px', height: '28px', fontSize: '0.75rem' }}
                >
                  🔄
                </button>
                <button 
                  onClick={() => setChatOpen(false)} 
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <FiX size={18} />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="chat-body" id="chat-body">
              {chatHistory.map((chat, i) => (
                <div key={i} className={`chat-message-wrapper ${chat.sender}`}>
                  <span className="chat-message-sender">{chat.sender === 'user' ? 'You' : 'Astra'}</span>
                  <div className="chat-bubble">
                    {chat.sender === 'ai' ? parseMarkdown(chat.text) : chat.text}
                  </div>
                </div>
              ))}
              {sendingChat && (
                <div className="chat-message-wrapper ai">
                  <span className="chat-message-sender">Astra</span>
                  <div className="chat-bubble" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="typing-dots">Analyzing your symptoms</span>
                    <span className="dot-animation">...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Ask Tags */}
            <div className="chat-quick-tags">
              {quickTags.map((tag, i) => (
                <div key={i} className="chat-tag-pill" onClick={() => handleSendChat(tag.query)}>
                  {tag.label}
                </div>
              ))}
            </div>

            {/* Input form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendChat(); }} className="chat-input-area">
              <input 
                type="text" 
                className="chat-input" 
                placeholder="Ask Astra anything..." 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                disabled={sendingChat}
              />
              <button type="submit" className="chat-btn-send" disabled={sendingChat || !chatMessage.trim()}>
                <FiSend />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reschedule Modal */}
      {reschedulingBooking && (
        <div 
          className="modal-backdrop animate-fade-in" 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={() => setReschedulingBooking(null)}
        >
          <motion.div 
            className="glass-card modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ 
              maxWidth: '500px', width: '100%',
              position: 'relative', display: 'flex', flexDirection: 'column', padding: '32px',
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setReschedulingBooking(null)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10
              }}
            >
              <FiX />
            </button>
            
            <h2 className="heading-sm" style={{ marginBottom: '8px', color: 'var(--primary)' }}>Reschedule Appointment</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Rescheduling appointment with <strong>Dr. {reschedulingBooking.doctorName}</strong>. Current slot: {formatDateToDDMMYYYY(reschedulingBooking.bookingDate)} at {reschedulingBooking.timeSlot}.
            </p>

            <form onSubmit={handleRescheduleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <FiCalendar /> Select New Date
                </label>
                <input 
                  type="date" 
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setRescheduleTimeSlot('');
                  }}
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '12px 16px',
                    borderRadius: '8px'
                  }}
                />
              </div>

              {rescheduleDate && (
                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <FiClock /> Select New Time Slot
                  </label>
                  {loadingRescheduleSlots ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}>
                      <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading slots...</span>
                    </div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div style={{ padding: '12px', background: 'rgba(255, 82, 82, 0.05)', border: '1px solid rgba(255, 82, 82, 0.1)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.85rem' }}>
                      No available slots on this date.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: '10px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      padding: '4px'
                    }}>
                      {rescheduleSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setRescheduleTimeSlot(slot)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            border: rescheduleTimeSlot === slot ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            background: rescheduleTimeSlot === slot ? 'rgba(0, 217, 166, 0.15)' : 'var(--bg-secondary)',
                            color: rescheduleTimeSlot === slot ? 'var(--primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            textAlign: 'center'
                          }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setReschedulingBooking(null)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={submittingReschedule || !rescheduleDate || !rescheduleTimeSlot}
                >
                  {submittingReschedule ? 'Rescheduling...' : 'Confirm'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Follow-up Booking Modal */}
      {followUpBooking && (
        <div 
          className="modal-backdrop animate-fade-in" 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={() => setFollowUpBooking(null)}
        >
          <motion.div 
            className="glass-card modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ 
              maxWidth: '500px', width: '100%',
              position: 'relative', display: 'flex', flexDirection: 'column', padding: '32px',
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setFollowUpBooking(null)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: 'none',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10
              }}
            >
              <FiX />
            </button>
            
            <h2 className="heading-sm" style={{ marginBottom: '8px', color: '#f59e0b' }}>Schedule Follow-up Visit</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Schedule a follow-up consultation with <strong>Dr. {followUpBooking.doctorName}</strong>. 
            </p>

            <form onSubmit={handleFollowUpSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <FiCalendar /> Select Date
                </label>
                <input 
                  type="date" 
                  className="form-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={followUpDate}
                  onChange={(e) => {
                    setFollowUpDate(e.target.value);
                    setFollowUpTimeSlot('');
                  }}
                  required
                  style={{
                    width: '100%',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '12px 16px',
                    borderRadius: '8px'
                  }}
                />
              </div>

              {followUpDate && (
                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <FiClock /> Select Time Slot
                  </label>
                  {loadingFollowUpSlots ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}>
                      <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading slots...</span>
                    </div>
                  ) : followUpSlots.length === 0 ? (
                    <div style={{ padding: '12px', background: 'rgba(255, 82, 82, 0.05)', border: '1px solid rgba(255, 82, 82, 0.1)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.85rem' }}>
                      No available slots on this date.
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                      gap: '10px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      padding: '4px'
                    }}>
                      {followUpSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setFollowUpTimeSlot(slot)}
                          style={{
                            padding: '10px 8px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            border: followUpTimeSlot === slot ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            background: followUpTimeSlot === slot ? 'rgba(0, 217, 166, 0.15)' : 'var(--bg-secondary)',
                            color: followUpTimeSlot === slot ? 'var(--primary)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            textAlign: 'center'
                          }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setFollowUpBooking(null)}
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: '#f59e0b', borderColor: '#f59e0b' }}
                  disabled={submittingFollowUp || !followUpDate || !followUpTimeSlot}
                >
                  {submittingFollowUp ? 'Scheduling...' : 'Book Follow-up'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
