import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { bookingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCalendar, 
  FiClock, 
  FiMapPin, 
  FiUser, 
  FiActivity, 
  FiFileText, 
  FiAlertCircle,
  FiInfo,
  FiVideo,
  FiDollarSign,
  FiCheckCircle,
  FiXCircle,
  FiCpu,
  FiDownload,
  FiCopy
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import ConsultationScribe from '../../components/common/ConsultationScribe';

export default function MyBookings() {
  const navigate = useNavigate();
  const { activeProfile } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [currentTime, setCurrentTime] = useState(new Date());
  const notifiedAppts = useRef(new Set());

  const [selectedReportBooking, setSelectedReportBooking] = useState(null);

  // Reschedule state
  const [reschedulingBooking, setReschedulingBooking] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseSlotHour = (slot) => {
    if (!slot || typeof slot !== 'string') return null;
    const parts = slot.split(' ');
    if (parts.length < 2) return null;
    const [time, ampm] = parts;
    const [hourStr, minuteStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    let parsedHour = hour % 12;
    if (ampm.toUpperCase() === 'PM') parsedHour += 12;
    return parsedHour + minute / 60;
  };

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

  const parseDDMMYYYYtoYYYYMMDD = (ddmmyyyy) => {
    if (!ddmmyyyy) return null;
    const parts = ddmmyyyy.split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (d.length === 1) d = '0' + d;
      if (m.length === 1) m = '0' + m;
      if (d.length === 2 && m.length === 2 && y.length === 4) {
        const day = parseInt(d, 10);
        const month = parseInt(m, 10);
        const year = parseInt(y, 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1000) {
          return `${y}-${m}-${d}`;
        }
      }
    }
    return null;
  };

  const handleOpenReschedule = (booking) => {
    setReschedulingBooking(booking);
    setRescheduleDate(formatDateToDDMMYYYY(booking.bookingDate));
    setRescheduleTimeSlot(booking.timeSlot);
    setRescheduleSlots([]);
  };

  const fetchRescheduleSlots = async (doctorId, dateStr) => {
    try {
      setLoadingRescheduleSlots(true);
      const res = await bookingAPI.getAvailableSlots(doctorId, dateStr);
      let filteredSlots = res.data || [];

      // Filter out past slots if the target date is today
      if (dateStr === getTodayString()) {
        const now = new Date();
        const currentHour = now.getHours() + now.getMinutes() / 60;
        filteredSlots = filteredSlots.filter(slot => {
          const slotHour = parseSlotHour(slot);
          return slotHour !== null && slotHour > currentHour;
        });
      }

      setRescheduleSlots(filteredSlots);
    } catch (error) {
      toast.error('Failed to load available time slots');
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  useEffect(() => {
    const yyyymmdd = parseDDMMYYYYtoYYYYMMDD(rescheduleDate);
    if (yyyymmdd && reschedulingBooking) {
      fetchRescheduleSlots(reschedulingBooking.doctorId, yyyymmdd);
    } else {
      setRescheduleSlots([]);
    }
  }, [rescheduleDate, reschedulingBooking]);

  const handleDateSelect = (e) => {
    const rawDate = e.target.value; // YYYY-MM-DD
    if (!rawDate) return;
    const [y, m, d] = rawDate.split('-');
    setRescheduleDate(`${d}/${m}/${y}`);
    setRescheduleTimeSlot('');
  };

  const handleRescheduleSubmit = async () => {
    const yyyymmdd = parseDDMMYYYYtoYYYYMMDD(rescheduleDate);
    if (!yyyymmdd) {
      toast.error('Please enter a valid date in DD/MM/YYYY format');
      return;
    }
    if (yyyymmdd < getTodayString()) {
      toast.error('Cannot reschedule appointment to a past date');
      return;
    }
    if (!rescheduleTimeSlot) {
      toast.error('Please select a time slot');
      return;
    }
    if (yyyymmdd === getTodayString()) {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      const slotHour = parseSlotHour(rescheduleTimeSlot);
      if (slotHour !== null && slotHour <= currentHour) {
        toast.error('Selected time slot has already passed');
        return;
      }
    }

    try {
      setSubmittingReschedule(true);
      const loadingToast = toast.loading('Rescheduling appointment...');
      await bookingAPI.reschedule(reschedulingBooking.id, yyyymmdd, rescheduleTimeSlot);
      toast.success('Appointment rescheduled successfully!', { id: loadingToast });
      setReschedulingBooking(null);
      fetchBookings(); // Refresh bookings
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to reschedule appointment';
      toast.error(errorMsg);
    } finally {
      setSubmittingReschedule(false);
    }
  };


  // Update current time every 10 seconds to auto-refresh Join button states
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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
    bookings.forEach(booking => {
      if (booking.status === 'CONFIRMED' || booking.status === 'PENDING') {
        const apptTime = getAppointmentStartDateTime(booking.bookingDate, booking.timeSlot);
        if (apptTime) {
          const diffMinutes = (apptTime.getTime() - currentTime.getTime()) / (1000 * 60);
          if (diffMinutes > 9 && diffMinutes <= 10 && !notifiedAppts.current.has(booking.id)) {
            toast(`Reminder: Your appointment with Dr. ${booking.doctorName} is in 10 minutes.`, {
              icon: '⏰',
              duration: 10000,
            });
            notifiedAppts.current.add(booking.id);
          }
        }
      }
    });
  }, [currentTime, bookings]);

  const handleJoinCall = (booking) => {
    const { isEnabled } = getJoinButtonState(booking.bookingDate, booking.timeSlot);
    if (!isEnabled) {
      toast.error('This appointment is not active yet.');
      return;
    }
    if (!booking.meetingLink || !booking.meetingLink.trim()) {
      toast.error('Waiting for doctor to add Google Meet / Zoom link...');
      return;
    }
    toast.success('Entering consultation room... 🎥');
    setTimeout(() => {
      navigate(`/consultation/${booking.id}`);
    }, 1000);
  };

  useEffect(() => {
    fetchBookings();
  }, [activeProfile]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await bookingAPI.getPatientBookings(activeProfile ? activeProfile.id : null);
      setBookings(res.data);
    } catch (error) {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      setCancellingId(bookingId);
      const loadingToast = toast.loading('Cancelling appointment...');
      await bookingAPI.updateStatus(bookingId, 'CANCELLED');
      toast.success('Appointment cancelled successfully!', { id: loadingToast });
      
      // Update local state to reflect cancellation immediately
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="badge badge-success"><FiCheckCircle /> Confirmed</span>;
      case 'PENDING':
        return <span className="badge badge-warning"><FiAlertCircle /> Pending</span>;
      case 'COMPLETED':
        return <span className="badge badge-info"><FiCheckCircle /> Completed</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger"><FiXCircle /> Cancelled</span>;
      default:
        return <span className="badge badge-ghost">{status}</span>;
    }
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>Paid</span>;
      case 'PENDING':
        return <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>Pay at Desk</span>;
      case 'REFUNDED':
        return <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>Refunded</span>;
      default:
        return <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>Cancelled</span>;
    }
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
            Condition Severity: {badge}
          </div>
          <div>{reason || "No high-risk signals detected in report or history"}</div>
        </div>
      </div>
    );
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

  return (
    <div className="page-container section" style={{ minHeight: '85vh' }}>
      
      {/* Styles local to this page */}
      <style>{`
        .bookings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 24px;
        }

        .booking-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .booking-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .card-detail-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .card-detail-item .icon {
          color: var(--primary);
          margin-top: 3px;
          flex-shrink: 0;
        }

        .symptom-text {
          font-size: 0.85rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 12px;
          color: var(--text-primary);
          line-height: 1.4;
        }

        @media (max-width: 640px) {
          .bookings-grid {
            grid-template-columns: 1fr;
          }
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

      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 className="heading-lg">My <span className="text-gradient">Appointments</span></h1>
        <p className="auth-subtitle" style={{ marginTop: '8px' }}>
          View, manage, or cancel your consultations with hospitals and doctors.
        </p>
      </div>

      <div className="divider"></div>

      {loading ? (
        <div className="bookings-grid">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card skeleton" style={{ height: '320px' }}></div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state glass-card" style={{ padding: '80px 24px' }}>
          <FiCalendar className="icon" />
          <h3>No Appointments Found</h3>
          <p style={{ maxWidth: '400px', margin: '8px auto 24px auto' }}>
            You haven't booked any hospital appointments yet. Select from our list of registered care centers.
          </p>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
            Find Hospitals
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
            {[
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' }
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                style={{
                  background: filter === item.value ? 'rgba(0, 217, 166, 0.15)' : 'none',
                  border: filter === item.value ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  color: filter === item.value ? 'var(--primary)' : 'var(--text-secondary)',
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

          <div className="bookings-grid">
            <AnimatePresence>
              {bookings.filter(b => {
                if (filter === 'upcoming') {
                  return (b.status === 'CONFIRMED' || b.status === 'PENDING') && !b.aiReport;
                } else if (filter === 'completed') {
                  return b.status === 'COMPLETED' || !!b.aiReport;
                } else if (filter === 'cancelled') {
                  return b.status === 'CANCELLED';
                }
                return true;
              }).length === 0 ? (
                <div className="empty-state glass-card" style={{ padding: '60px 24px', width: '100%', gridColumn: '1/-1', textAlign: 'center' }}>
                  <FiCalendar className="icon" style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '16px', display: 'block', margin: '0 auto' }} />
                  <h3>No {filter} appointments</h3>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '8px auto 0 auto' }}>
                    You don't have any {filter} appointments at the moment.
                  </p>
                </div>
              ) : bookings.filter(b => {
                if (filter === 'upcoming') {
                  return (b.status === 'CONFIRMED' || b.status === 'PENDING') && !b.aiReport;
                } else if (filter === 'completed') {
                  return b.status === 'COMPLETED' || !!b.aiReport;
                } else if (filter === 'cancelled') {
                  return b.status === 'CANCELLED';
                }
                return true;
              })
              .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
              .map((booking, idx) => (
              <motion.div
                key={booking.id}
                className="glass-card booking-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
              >
                
                {/* Header: Hospital Info & Booking Status */}
                <div className="booking-card-header">
                  <div>
                    <h3 className="heading-sm" style={{ margin: '0 0 4px 0' }}>{booking.hospitalName}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FiUser /> Doc: {booking.doctorName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    {getStatusBadge(booking.status)}
                    {getConditionBadge(booking)}
                  </div>
                </div>

                <div className="divider" style={{ margin: '4px 0' }}></div>

                {/* Details Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="card-detail-item">
                    <FiCalendar className="icon" />
                    <span>
                      <strong>Date:</strong> {formatDateToDDMMYYYY(booking.bookingDate)}
                    </span>
                  </div>

                  <div className="card-detail-item">
                    <FiClock className="icon" />
                    <span>
                      <strong>Time Slot:</strong> {booking.timeSlot}
                    </span>
                  </div>

                  <div className="card-detail-item">
                    {booking.type === 'ONLINE' ? (
                      <FiVideo className="icon" color="var(--primary)" />
                    ) : (
                      <FiMapPin className="icon" color="var(--secondary)" />
                    )}
                    <span>
                      <strong>Consultation:</strong> {booking.type === 'ONLINE' ? 'Video Conference (Remote)' : 'Physical Visit (In-Person)'}
                    </span>
                  </div>

                  {/* Patient Info */}
                  <div className="card-detail-item">
                    <FiUser className="icon" />
                    <span>
                      <strong>Patient:</strong> {booking.patientName} ({booking.age} yrs, {booking.gender})
                    </span>
                  </div>

                  {/* Payment Details */}
                  <div className="card-detail-item" style={{ display: 'flex', alignItems: 'center' }}>
                    <FiDollarSign className="icon" />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>Payment:</strong> 
                      <span style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>{booking.paymentMethod}</span>
                      {getPaymentStatusBadge(booking.paymentStatus)}
                    </span>
                  </div>
                </div>

                {/* Symptom Info */}
                {booking.symptoms && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>Symptoms Intake Notes</span>
                    <p className="symptom-text">{booking.symptoms}</p>
                  </div>
                )}

                {/* Actions or AI Report */}
                {booking.aiReport ? (
                  <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
                    <button
                      onClick={() => setSelectedReportBooking(booking)}
                      className="btn btn-sm btn-primary"
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
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
                        justifyContent: 'center'
                      }}
                    >
                      <FiCpu /> View AI Consultation Report
                    </button>
                  </div>
                ) : (
                  (booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                    <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleCancelBooking(booking.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--danger)', borderColor: 'rgba(255, 82, 82, 0.2)', padding: '6px 12px', fontSize: '0.8rem' }}
                          disabled={cancellingId === booking.id}
                        >
                          {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                        <button 
                          onClick={() => handleOpenReschedule(booking)}
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--primary)', borderColor: 'rgba(0, 217, 166, 0.2)', padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Reschedule
                        </button>
                      </div>

                      {booking.type === 'ONLINE' && (() => {
                        const { isEnabled, timeDiffText } = getJoinButtonState(booking.bookingDate, booking.timeSlot);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <div className="join-btn-container">
                              <button
                                onClick={() => handleJoinCall(booking)}
                                className={`btn btn-sm ${!isEnabled || !booking.meetingLink || !booking.meetingLink.trim() ? 'join-btn-disabled' : 'btn-primary'}`}
                                style={{
                                  padding: '8px 16px',
                                  fontSize: '0.85rem',
                                  borderRadius: '99px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: isEnabled && booking.meetingLink && booking.meetingLink.trim() ? 'linear-gradient(135deg, #00D9A6, #7C3AED)' : '',
                                  border: 'none',
                                  boxShadow: isEnabled && booking.meetingLink && booking.meetingLink.trim() ? '0 4px 12px rgba(0, 217, 166, 0.25)' : '',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <FiVideo /> Join Call
                              </button>
                              {!isEnabled ? (
                                <span className="tooltip-text">
                                  🔒 Join button will activate 5 minutes before the appointment.
                                </span>
                              ) : !booking.meetingLink || !booking.meetingLink.trim() ? (
                                <span className="tooltip-text" style={{ background: '#7f1d1d', borderColor: '#ef4444' }}>
                                  ⚠️ Waiting for doctor to add Google Meet / Zoom link...
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
                        );
                      })()}
                    </div>
                  )
                )}

              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </>
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

      {/* Reschedule Modal */}
      {reschedulingBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div className="glass-card animate-scale-up" style={{
            width: '100%',
            maxWidth: '500px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            borderRadius: '16px'
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--primary)' }}>Reschedule Appointment</h2>
              <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                With Dr. {reschedulingBooking.doctorName} at {reschedulingBooking.hospitalName}
              </p>
            </div>

            <div className="divider" style={{ margin: 0 }}></div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Choose New Date (DD/MM/YYYY)</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="DD/MM/YYYY"
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleTimeSlot('');
                    }}
                    style={{ flex: 1, padding: '10px 14px' }}
                  />
                  <div style={{ position: 'relative', width: '42px', height: '42px' }}>
                    <input
                      type="date"
                      onChange={handleDateSelect}
                      min={getTodayString()}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 2
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                      pointerEvents: 'none',
                      zIndex: 1
                    }}>
                      <FiCalendar size={18} />
                    </div>
                  </div>
                </div>
                <small style={{ color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Type in DD/MM/YYYY format or use the calendar icon to select.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Select Time Slot {loadingRescheduleSlots && <span style={{ color: 'var(--primary)', fontSize: '0.8rem', marginLeft: '6px' }}>(Loading...)</span>}
                </label>

                {!parseDDMMYYYYtoYYYYMMDD(rescheduleDate) ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem'
                  }}>
                    <FiInfo style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Please enter a valid date to load slots.
                  </div>
                ) : loadingRescheduleSlots ? (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <div className="spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }}></div>
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center',
                    color: '#f87171',
                    fontSize: '0.85rem'
                  }}>
                    No available time slots on this date. Please choose another date.
                  </div>
                ) : (
                  <div className="slots-grid" style={{ maxHeight: '160px', overflowY: 'auto', paddingRight: '4px', gap: '8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {rescheduleSlots.map((slot) => (
                      <div
                        key={slot}
                        className={`slot-pill ${rescheduleTimeSlot === slot ? 'selected' : ''}`}
                        onClick={() => setRescheduleTimeSlot(slot)}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          background: rescheduleTimeSlot === slot ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${rescheduleTimeSlot === slot ? 'var(--primary)' : 'var(--border-color)'}`,
                          color: rescheduleTimeSlot === slot ? 'var(--bg-primary)' : 'var(--text-primary)',
                          textAlign: 'center',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: rescheduleTimeSlot === slot ? '600' : 'normal',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {slot}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="divider" style={{ margin: 0 }}></div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setReschedulingBooking(null)}
                className="btn btn-ghost"
                style={{ padding: '10px 20px' }}
                disabled={submittingReschedule}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRescheduleSubmit}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #00D9A6, #7C3AED)',
                  border: 'none',
                  padding: '10px 24px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(0, 217, 166, 0.25)'
                }}
                disabled={submittingReschedule || !rescheduleTimeSlot || !parseDDMMYYYYtoYYYYMMDD(rescheduleDate)}
              >
                {submittingReschedule ? 'Rescheduling...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

