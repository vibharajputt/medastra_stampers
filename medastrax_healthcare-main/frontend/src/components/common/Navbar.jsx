import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX, FiLogOut, FiUser, FiHome, FiCalendar, FiFileText, FiShoppingBag, FiTrash2, FiCamera, FiActivity, FiBell, FiSettings, FiSun, FiMoon, FiMonitor, FiCpu, FiGitBranch, FiPlus } from 'react-icons/fi';
import logo from '../../assets/medastrax-logo-new.png';
import toast from 'react-hot-toast';
import { familyMemberAPI, fileAPI, authAPI, notificationAPI } from '../../services/api';
import './Navbar.css';

export default function Navbar() {
  const { user, isAuthenticated, logout, isPatient, isDoctor, isPharmacy, activeProfile, familyMembers, switchProfile, refreshFamilyMembers, updateUserAvatar, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [avatarHover, setAvatarHover] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [scheduleMode, setScheduleMode] = useState('NONE');
  const [scheduleTimeStart, setScheduleTimeStart] = useState('09:00');
  const [scheduleTimeEnd, setScheduleTimeEnd] = useState('10:00');
  const [scheduleStatus, setScheduleStatus] = useState({ mode: 'NONE', date: '' });
  const [notifications, setNotifications] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    if (!showProfileModal) {
      setIsEditing(false);
    }
  }, [showProfileModal]);

  // Global offline medicine schedule reminders checker
  useEffect(() => {
    let intervalId = null;

    const parseFrequency = (freq) => {
      if (!freq) return { morning: false, afternoon: false, night: false };
      const parts = freq.split('-').map((v) => parseInt(v, 10));
      return {
        morning: parts[0] === 1,
        afternoon: parts.length > 1 ? parts[1] === 1 : false,
        night: parts.length > 2 ? parts[2] === 1 : false,
      };
    };

    const checkGlobalReminders = () => {
      try {
        const REMINDER_KEY = 'mediverse_med_reminders';
        const savedReminders = JSON.parse(localStorage.getItem(REMINDER_KEY));
        if (!savedReminders || !savedReminders.enabled) return;

        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const current = `${hh}:${mm}`;

        const slots = ['morning', 'afternoon', 'night'];
        const emojis = { morning: '☀️', afternoon: '🌤️', night: '🌙' };
        const labels = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };

        slots.forEach((slot) => {
          if (savedReminders[slot] === current) {
            // Get medicines scheduled for this slot
            const cachedMeds = localStorage.getItem('mediverse_all_medicines');
            let medNames = [];
            if (cachedMeds) {
              const meds = JSON.parse(cachedMeds);
              if (Array.isArray(meds)) {
                meds.forEach((m) => {
                  const freq = parseFrequency(m.frequency);
                  if (freq[slot]) {
                    medNames.push(m.name);
                  }
                });
              }
            }

            const title = `💊 MedAstraX Medicine Reminder`;
            let body = `${emojis[slot]} Time to take your ${labels[slot]} medicines!`;
            if (medNames.length > 0) {
              body = `${emojis[slot]} Time to take: ${medNames.join(', ')}`;
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                const lastTriggeredKey = `mediverse_last_trigger_${slot}_${current}`;
                if (!localStorage.getItem(lastTriggeredKey)) {
                  localStorage.setItem(lastTriggeredKey, 'true');
                  
                  // Clean up older keys
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('mediverse_last_trigger_') && !k.endsWith(current)) {
                      localStorage.removeItem(k);
                    }
                  }

                  new Notification(title, {
                    body,
                    icon: '/favicon.png',
                    tag: `med-reminder-${slot}`,
                    renotify: true
                  });
                  toast(body, { icon: '💊', duration: 8000 });
                }
              } catch (e) {
                console.error('Failed to trigger notification:', e);
              }
            }
          }
        });
      } catch (err) {
        console.error('Error checking global reminders:', err);
      }
    };

    // Check every 30 seconds
    intervalId = setInterval(checkGlobalReminders, 30000);
    // Also run immediately
    checkGlobalReminders();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const startEditing = () => {
    setEditFormData({
      name: profileData.name || '',
      phone: profileData.phone || '',
      city: profileData.city || '',
      address: profileData.address || '',
      dob: profileData.dob || '',
      age: profileData.age !== undefined && profileData.age !== null ? profileData.age.toString() : '',
      gender: profileData.gender || 'MALE',
      bloodGroup: profileData.bloodGroup || 'A+',
      emergencyNumber: profileData.emergencyNumber || '',
      preferredLanguage: profileData.preferredLanguage || 'English',
      existingMedicalCondition: profileData.existingMedicalCondition || 'None',
      idProof: profileData.idProof || '',
      currentMedication: profileData.currentMedication || 'None',
      allergies: profileData.allergies || 'None',
    });
    setIsEditing(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    let cleanedValue = value;
    if (name === 'phone' || name === 'emergencyNumber') {
      cleanedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    setEditFormData(prev => ({ ...prev, [name]: cleanedValue }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (editFormData.phone && editFormData.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    if (user?.role === 'PATIENT' && editFormData.emergencyNumber && editFormData.emergencyNumber.length !== 10) {
      toast.error('Emergency contact number must be exactly 10 digits');
      return;
    }
    try {
      setSavingProfile(true);
      await authAPI.updateProfile(editFormData);
      
      updateUser({
        name: editFormData.name,
        phone: editFormData.phone,
        city: editFormData.city,
        address: editFormData.address
      });
      
      setProfileData(prev => ({
        ...prev,
        ...editFormData,
        age: editFormData.age ? parseInt(editFormData.age) : null
      }));
      
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to update profile';
      toast.error(errMsg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds the 5MB limit.');
      return;
    }

    const uploadToast = toast.loading('Uploading profile picture...');
    try {
      const uploadRes = await fileAPI.upload(file);
      if (uploadRes.data && uploadRes.data.success) {
        const fileUrl = uploadRes.data.message;
        await authAPI.updateAvatar(fileUrl);
        updateUserAvatar(fileUrl);
        toast.success('Profile picture updated!', { id: uploadToast });
      } else {
        toast.error('Failed to upload image.', { id: uploadToast });
      }
    } catch (err) {
      console.error(err);
      toast.error('Error updating profile picture.', { id: uploadToast });
    }
  };

  const triggerAvatarUpload = () => {
    if (activeProfile) {
      toast.error('Please switch back to your own profile to change your photo.');
      return;
    }
    document.getElementById('avatar-upload-input')?.click();
  };

  const handleRemoveAvatar = async () => {
    if (activeProfile) {
      toast.error('Please switch back to your own profile to remove your photo.');
      return;
    }
    const removeToast = toast.loading('Removing profile picture...');
    try {
      await authAPI.updateAvatar(null);
      updateUserAvatar(null);
      toast.success('Profile picture removed!', { id: removeToast });
    } catch (err) {
      console.error(err);
      toast.error('Error removing profile picture.', { id: removeToast });
    }
  };

  const scheduleStorageKey = user?.id ? `mediverse_doctor_busy_${user.id}` : 'mediverse_doctor_busy';
  const notificationStorageKey = user?.role ? `mediverse_notifications_${user.role}` : 'mediverse_notifications';
  const getDefaultNotifications = () => {
    if (isPatient) {
      return [
        { id: 1, title: 'Appointment reminder', message: 'Your appointment with Dr. Mehta is today at 4:30 PM.', time: '2h left', read: false },
        { id: 2, title: 'Prescription ready', message: 'Your latest prescription is ready to view in My Prescriptions.', time: '1d ago', read: false },
        { id: 3, title: 'Health tip', message: 'Don’t forget to stay hydrated and take a short walk after lunch.', time: '3d ago', read: true },
      ];
    }
    if (isDoctor) {
      return [
        { id: 1, title: 'New booking', message: 'You have a new booking request for 5:00 PM today.', time: '15m ago', read: false },
        { id: 2, title: 'Prescription review', message: 'Please review the prescription for patient Mr. Shah before 6:00 PM.', time: '1h ago', read: false },
        { id: 3, title: 'System notice', message: 'Your doctor dashboard has a new feature for appointment summaries.', time: 'Yesterday', read: true },
      ];
    }
    return [
      { id: 1, title: 'Reminder', message: 'Check your latest messages for important updates.', time: 'Just now', read: false },
    ];
  };

  // Reset notifications state when user role/key changes to prevent state leakage
  useEffect(() => {
    setNotifications([]);
  }, [notificationStorageKey]);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      // Try server-side notifications first (authenticated users)
      if (isAuthenticated && user?.id) {
        try {
          const res = await notificationAPI.getNotifications({ userId: user.id });
          if (!canceled && res?.data) {
            setNotifications(res.data.map(n => ({ id: n.id, title: n.title, message: n.message, time: 'Just now', read: n.readFlag })));
            return;
          }
        } catch (err) {
          console.warn('Failed to load server notifications, falling back to localStorage', err);
        }
      }

      const stored = window.localStorage.getItem(notificationStorageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Self-heal: If the user is logged in as a patient or doctor, but the stored notifications
          // contain the generic guest reminder, discard it.
          const hasGenericReminder = Array.isArray(parsed) && parsed.some(n => n.message === 'Check your latest messages for important updates.');
          if (hasGenericReminder && (isPatient || isDoctor)) {
            console.warn('Discarding generic notifications fallback for logged-in user');
          } else {
            setNotifications(parsed);
            return;
          }
        } catch (err) {
          console.warn('Invalid notifications data, resetting', err);
        }
      }
      setNotifications(getDefaultNotifications());
    };
    load();
    return () => { canceled = true; };
  }, [notificationStorageKey, isPatient, isDoctor]);

  useEffect(() => {
    if (notifications.length > 0) {
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
    }
  }, [notifications, notificationStorageKey]);

  useEffect(() => {
    if (!isDoctor) {
      setScheduleStatus({ mode: 'NONE', date: '' });
      setScheduleMode('NONE');
      setScheduleTimeStart('09:00');
      setScheduleTimeEnd('10:00');
      return;
    }
    try {
      const stored = window.localStorage.getItem(scheduleStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.mode) {
          setScheduleStatus(parsed);
          setScheduleMode(parsed.mode || 'NONE');
          setScheduleDate(parsed.date || new Date().toISOString().split('T')[0]);
          setScheduleTimeStart(parsed.startTime || '09:00');
          setScheduleTimeEnd(parsed.endTime || '10:00');
          return;
        }
      }
    } catch (err) {
      console.warn('Unable to load doctor schedule', err);
    }
    setScheduleStatus({ mode: 'NONE', date: '' });
    setScheduleMode('NONE');
    setScheduleTimeStart('09:00');
    setScheduleTimeEnd('10:00');
  }, [scheduleStorageKey, isDoctor]);

  useEffect(() => {
    if (scheduleStatus.mode && scheduleStatus.mode !== 'NONE') {
      window.localStorage.setItem(scheduleStorageKey, JSON.stringify(scheduleStatus));
    } else {
      window.localStorage.removeItem(scheduleStorageKey);
    }
  }, [scheduleStatus, scheduleStorageKey]);

  const getScheduleLabel = (status) => {
    if (!status || status.mode === 'NONE') return 'Available';
    if (status.mode === 'ALL_DAY') return `Busy All Day ${status.date}`;
    if (status.mode === 'AFTERNOON') return `Busy Afternoon ${status.date}`;
    if (status.mode === 'TIME_RANGE' && status.startTime && status.endTime) {
      return `Busy ${status.startTime}-${status.endTime} ${status.date}`;
    }
    return 'Busy';
  };

  const handleSaveSchedule = () => {
    const normalizedDate = scheduleDate || new Date().toISOString().split('T')[0];
    if (scheduleMode === 'TIME_RANGE') {
      if (!scheduleTimeStart || !scheduleTimeEnd) {
        toast.error('Please choose both start and end time.');
        return;
      }
      if (scheduleTimeStart >= scheduleTimeEnd) {
        toast.error('End time must be later than start time.');
        return;
      }
    }

    const payload = scheduleMode === 'NONE'
      ? { mode: 'NONE', date: '' }
      : {
          mode: scheduleMode,
          date: normalizedDate,
          ...(scheduleMode === 'TIME_RANGE' ? { startTime: scheduleTimeStart, endTime: scheduleTimeEnd } : {}),
        };

    setScheduleStatus(payload);
    setShowSchedulePanel(false);
    toast.success(payload.mode === 'NONE' ? 'Doctor schedule cleared.' : `Doctor schedule saved for ${payload.date}.`);
  };

  const handleToggleSchedulePanel = () => {
    setShowSchedulePanel((prev) => !prev);
    setShowNotifications(false);
  };

  const unreadCount = notifications.filter((note) => !note.read).length;
  const markAllNotificationsRead = () => setNotifications((prev) => prev.map((note) => ({ ...note, read: true })));
  const markNotificationRead = (id) => setNotifications((prev) => prev.map((note) => note.id === id ? { ...note, read: true } : note));

  const handleViewProfile = async () => {
    setShowProfileDropdown(false);
    
    if (activeProfile) {
      setProfileData(activeProfile);
      setShowProfileModal(true);
      return;
    }
    
    setLoadingProfile(true);
    setShowProfileModal(true);
    try {
      const res = await authAPI.getProfile();
      setProfileData(res.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile details.');
      setShowProfileModal(false);
    } finally {
      setLoadingProfile(false);
    }
  };
  const [familyForm, setFamilyForm] = useState({
    name: '',
    dob: '',
    age: '',
    gender: 'MALE',
    relation: 'SPOUSE',
    phone: '',
    bloodGroup: 'A+',
    emergencyNumber: '',
    preferredLanguage: 'English',
    existingMedicalCondition: 'None',
    idProof: '',
    allergies: 'None',
    currentMedication: 'None',
  });

  const handleFamilyFormChange = (e) => {
    const { name, value } = e.target;
    let cleanedValue = value;
    if (name === 'phone' || name === 'emergencyNumber') {
      cleanedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    setFamilyForm((prev) => ({ ...prev, [name]: cleanedValue }));
  };

  const handleAddFamilyMember = async (e) => {
    e.preventDefault();
    if (!familyForm.name.trim()) {
      toast.error('Please enter name');
      return;
    }
    if (!familyForm.age || parseInt(familyForm.age) <= 0) {
      toast.error('Please enter a valid age');
      return;
    }
    if (familyForm.phone && familyForm.phone.length !== 10) {
      toast.error('Phone number must be exactly 10 digits');
      return;
    }
    if (!familyForm.emergencyNumber) {
      toast.error('Please enter emergency contact number');
      return;
    }
    if (familyForm.emergencyNumber.length !== 10) {
      toast.error('Emergency contact number must be exactly 10 digits');
      return;
    }

    try {
      setAddingMember(true);
      await familyMemberAPI.add(familyForm);
      toast.success('Family member added successfully!');
      setFamilyForm({
        name: '',
        dob: '',
        age: '',
        gender: 'MALE',
        relation: 'SPOUSE',
        phone: '',
        bloodGroup: 'A+',
        emergencyNumber: '',
        preferredLanguage: 'English',
        existingMedicalCondition: 'None',
        idProof: '',
        allergies: 'None',
        currentMedication: 'None',
      });
      setShowAddUserModal(false);
      await refreshFamilyMembers();
    } catch (error) {
      const errMsg = error.response?.data?.message || 'Failed to add family member';
      toast.error(errMsg);
    } finally {
      setAddingMember(false);
    }
  };

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const getNavLinks = () => {
    if (isAuthenticated) {
      if (isPatient) {
        return [
          { path: '/dashboard', label: 'Hospitals', icon: <FiHome /> },
          { path: '/my-bookings', label: 'My Bookings', icon: <FiCalendar /> },
          { path: '/my-prescriptions', label: 'Prescriptions', icon: <FiFileText /> },
          { path: '/health-records', label: 'Health Records', icon: <FiFileText /> },
          { path: '/activity', label: 'History', icon: <FiActivity /> },
          { path: '/background-jobs', label: 'Tasks', icon: <FiCpu /> },
          { path: '/workflows', label: 'Workflows', icon: <FiGitBranch /> },
          { path: 'notifications', label: 'Important', icon: <FiBell /> },
        ];
      }
      if (isDoctor) {
        return [
          { path: '/doctor/dashboard', label: 'Dashboard', icon: <FiHome /> },
          { path: 'doctor-schedule', label: 'Schedule', icon: <FiCalendar /> },
          { path: '/health-records', label: 'Health Records', icon: <FiFileText /> },
          { path: '/observability', label: 'Observability', icon: <FiActivity /> },
          { path: 'notifications', label: 'Important', icon: <FiBell /> },
        ];
      }
      if (isPharmacy) {
        return [
          { path: '/pharmacy/dashboard', label: 'Dashboard', icon: <FiHome /> },
        ];
      }
      if (user?.role === 'ADMIN') {
        return [
          { path: '/admin/dashboard', label: 'Dashboard', icon: <FiHome /> },
          { path: '/health-records', label: 'Health Records', icon: <FiFileText /> },
          { path: '/observability', label: 'Observability', icon: <FiActivity /> },
        ];
      }
      if (user?.role === 'LAB') {
        return [
          { path: '/lab/dashboard', label: 'Dashboard', icon: <FiHome /> },
        ];
      }
    }
    // Public/Guest links
    return [
      { path: '/', label: 'Home', icon: <FiHome /> },
      { path: '/about', label: 'About Us', icon: <FiUser /> },
      { path: '/contact', label: 'Contact Us', icon: <FiFileText /> },
    ];
  };

  const handleNavLinkClick = (path) => {
    setMobileMenuOpen(false);
    if (path.includes('#')) {
      const [targetPath, hash] = path.split('#');
      const id = hash;
      const scrollToHash = () => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      if (location.pathname === (targetPath || '/')) {
        scrollToHash();
      } else {
        navigate(targetPath || '/');
        setTimeout(scrollToHash, 200);
      }
      return;
    }

    if (path === '/') {
      if (location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
    }
  };

  const navLinks = getNavLinks();

  const isLinkActive = (linkPath) => {
    if (linkPath.includes('#')) {
      const [basePath] = linkPath.split('#');
      return location.pathname === (basePath || '/') && !location.hash;
    }
    return location.pathname === linkPath && !location.hash;
  };

  return (
    <>
      <nav className="navbar">
      <div className="navbar-container">
        <Link to={isAuthenticated ? '/dashboard' : '/'} className="navbar-brand brand-glow" onClick={() => handleNavLinkClick('/')}>
          <img src={logo} alt="MedAstraX Logo" className="navbar-logo-img" />
          <div className="brand-text-container">
            <span className="brand-text"><span className="brand-med">Med</span><span className="brand-astra">Astra</span><span className="brand-x">X</span></span>
            <span className="brand-tagline">Innovate • Heal • Evolve</span>
          </div>
        </Link>

        {/* Desktop Right Navigation & Actions */}
        <div className="navbar-right">
          <div className="navbar-links">
            {navLinks.map((link, index) => (
              link.path === 'notifications' ? (
                <button
                  key={`${link.path}-${index}`}
                  type="button"
                  className={`nav-link notification-link ${showNotifications ? 'active' : ''}`}
                  onClick={() => {
                    setShowNotifications((prev) => !prev);
                    setShowSchedulePanel(false);
                  }}
                >
                  {link.icon}
                  <span>{link.label}</span>
                  {unreadCount > 0 && <span className="nav-notification-badge">{unreadCount}</span>}
                </button>
              ) : link.path === 'doctor-schedule' ? (
                <button
                  key={`${link.path}-${index}`}
                  type="button"
                  className={`nav-link schedule-link ${showSchedulePanel ? 'active' : ''}`}
                  onClick={handleToggleSchedulePanel}
                >
                  {link.icon}
                  <span>{link.label}</span>
                  {scheduleStatus.mode !== 'NONE' && (
                    <span className="nav-schedule-badge">
                      {scheduleStatus.mode === 'ALL_DAY' ? 'All Day' : scheduleStatus.mode === 'AFTERNOON' ? 'Afternoon' : scheduleStatus.mode === 'TIME_RANGE' ? 'Range' : 'Busy'}
                    </span>
                  )}
                </button>
              ) : (
                <Link
                  key={`${link.path}-${index}`}
                  to={link.path}
                  className={`nav-link ${isLinkActive(link.path) ? 'active' : ''} ${link.path === '/care-plan' ? 'nav-care-plan-link' : ''}`}
                  onClick={(e) => {
                    if (link.path.startsWith('/#') || link.path === '/') {
                      e.preventDefault();
                      handleNavLinkClick(link.path);
                    }
                  }}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              )
            ))}
          </div>

          <div className="navbar-actions-wrapper">
            {/* Theme Settings Button */}
            <div className="settings-dropdown-container" style={{ position: 'relative' }}>
              <button 
                onClick={() => {
                  setShowSettingsDropdown(!showSettingsDropdown);
                  setShowNotifications(false);
                  setShowUserSwitcher(false);
                }} 
                className={`btn btn-ghost btn-icon ${showSettingsDropdown ? 'active' : ''}`}
                style={{ width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Settings & Theme"
              >
                <FiSettings size={20} />
              </button>
              
              {showSettingsDropdown && (
                <>
                  <div className="notification-panel-backdrop" onClick={() => setShowSettingsDropdown(false)} style={{ zIndex: 104, background: 'none' }} />
                  <div className="profile-dropdown-menu" style={{ display: 'flex', width: '200px', right: 0, zIndex: 105, marginTop: '8px' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Appearance Settings
                    </div>
                    <button 
                      onClick={() => { setTheme('light'); setShowSettingsDropdown(false); }}
                      className={`profile-dropdown-item ${theme === 'light' ? 'active' : ''}`}
                      style={{ color: theme === 'light' ? 'var(--primary)' : 'inherit', background: theme === 'light' ? 'rgba(0, 217, 166, 0.05)' : 'none' }}
                    >
                      <FiSun className="item-icon" /> Light Mode
                    </button>
                    <button 
                      onClick={() => { setTheme('dark'); setShowSettingsDropdown(false); }}
                      className={`profile-dropdown-item ${theme === 'dark' ? 'active' : ''}`}
                      style={{ color: theme === 'dark' ? 'var(--primary)' : 'inherit', background: theme === 'dark' ? 'rgba(0, 217, 166, 0.05)' : 'none' }}
                    >
                      <FiMoon className="item-icon" /> Dark Mode
                    </button>
                    <button 
                      onClick={() => { setTheme('system'); setShowSettingsDropdown(false); }}
                      className={`profile-dropdown-item ${theme === 'system' ? 'active' : ''}`}
                      style={{ color: theme === 'system' ? 'var(--primary)' : 'inherit', background: theme === 'system' ? 'rgba(0, 217, 166, 0.05)' : 'none' }}
                    >
                      <FiMonitor className="item-icon" /> System Default
                    </button>
                  </div>
                </>
              )}
            </div>

            {isAuthenticated ? (
              <div className="navbar-actions">
                <div 
                  className="user-profile-wrapper"
                  onMouseEnter={() => setShowProfileDropdown(true)}
                  onMouseLeave={() => setShowProfileDropdown(false)}
                  style={{ position: 'relative' }}
                >
                  <div className="user-info" style={{ cursor: 'pointer' }}>
                    <div 
                      className={`avatar ${!activeProfile ? 'uploadable' : ''}`}
                      onClick={triggerAvatarUpload}
                      onMouseEnter={() => !activeProfile && setAvatarHover(true)}
                      onMouseLeave={() => !activeProfile && setAvatarHover(false)}
                    >
                      {!activeProfile && user?.avatarUrl ? (
                        <img 
                          src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${user.avatarUrl}`} 
                          alt="User Avatar" 
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                        />
                      ) : (
                        (activeProfile ? activeProfile.name : user?.name)?.charAt(0).toUpperCase()
                      )}
                      {!activeProfile && avatarHover && (
                        <div className="avatar-overlay">
                          Upload
                        </div>
                      )}
                    </div>
                    <div className="user-details">
                      <span className="user-name">{activeProfile ? activeProfile.name : user?.name}</span>
                      <span className="user-role">{activeProfile ? `${activeProfile.relation}` : user?.role}</span>
                    </div>
                  </div>
                  
                  {showProfileDropdown && (
                    <div className="profile-dropdown-menu">
                      <div className="profile-dropdown-header">
                        <span className="profile-dropdown-name">{activeProfile ? activeProfile.name : user?.name}</span>
                        <span className="profile-dropdown-email">{activeProfile ? `Relation: ${activeProfile.relation}` : user?.email}</span>
                      </div>
                      <div className="profile-dropdown-divider"></div>
                      
                      <button className="profile-dropdown-item" onClick={handleViewProfile}>
                        <FiUser className="item-icon" /> {activeProfile ? "View Details" : "My Profile"}
                      </button>
                      
                      {isPatient && (
                        <button className="profile-dropdown-item nav-care-plan-dropdown-item" onClick={() => { setShowProfileDropdown(false); navigate('/care-plan'); }}>
                          <FiActivity className="item-icon" /> Care Plan
                        </button>
                      )}
                      
                      {!activeProfile && (
                        <>
                          <button className="profile-dropdown-item" onClick={triggerAvatarUpload}>
                            <FiCamera className="item-icon" /> {user?.avatarUrl ? "Change Photo" : "Add Photo"}
                          </button>
                          {user?.avatarUrl && (
                            <button className="profile-dropdown-item danger" onClick={handleRemoveAvatar}>
                              <FiTrash2 className="item-icon" /> Remove Photo
                            </button>
                          )}
                        </>
                      )}

                      {isPatient && (
                        <>
                          <div className="profile-dropdown-divider"></div>
                          <div style={{ padding: '6px 16px', fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                            SWITCH PROFILE
                          </div>
                          
                          <button 
                            className={`profile-dropdown-item ${!activeProfile ? 'active' : ''}`}
                            onClick={() => { switchProfile(null); setShowProfileDropdown(false); }}
                            style={{ background: !activeProfile ? 'rgba(0, 217, 166, 0.08)' : 'none', fontWeight: !activeProfile ? 'bold' : 'normal' }}
                          >
                            <FiUser className="item-icon" /> Myself ({user?.name})
                          </button>
                          
                          {familyMembers && familyMembers.map((member) => (
                            <button 
                              key={member.id}
                              className={`profile-dropdown-item ${activeProfile?.id === member.id ? 'active' : ''}`}
                              onClick={() => { switchProfile(member); setShowProfileDropdown(false); }}
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                width: '100%',
                                background: activeProfile?.id === member.id ? 'rgba(0, 217, 166, 0.08)' : 'none',
                                fontWeight: activeProfile?.id === member.id ? 'bold' : 'normal'
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FiUser className="item-icon" /> {member.name}
                              </span>
                              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{member.relation}</span>
                            </button>
                          ))}

                          <button 
                            className="profile-dropdown-item" 
                            onClick={() => { setShowProfileDropdown(false); setShowAddUserModal(true); }}
                            style={{ color: 'var(--primary)', fontWeight: 'bold' }}
                          >
                            <FiPlus className="item-icon" /> Add Family Member
                          </button>
                        </>
                      )}
                      
                      <div className="profile-dropdown-divider"></div>
                      <button className="profile-dropdown-item danger" onClick={handleLogout}>
                        <FiLogOut className="item-icon" style={{ color: 'var(--danger)' }} /> Logout
                      </button>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  id="avatar-upload-input" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={handleAvatarChange} 
                />

                <button onClick={handleLogout} className="btn btn-ghost btn-sm logout-btn">
                  <FiLogOut />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="navbar-actions auth-actions">
                <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Sign Up</Link>
              </div>
            )}

            {/* Toggle Menu button (for mobile viewports) */}
            <button
              className="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {navLinks.map((link, index) => (
              link.path === 'notifications' ? (
                <button
                  key={`${link.path}-${index}`}
                  type="button"
                  className="mobile-nav-link notification-mobile-link"
                  onClick={() => {
                    setShowNotifications((prev) => !prev);
                    setShowSchedulePanel(false);
                    setMobileMenuOpen(false);
                  }}
                >
                  {link.icon}
                  <span>{link.label}</span>
                  {unreadCount > 0 && <span className="nav-notification-badge">{unreadCount}</span>}
                </button>
              ) : link.path === 'doctor-schedule' ? (
                <button
                  key={`${link.path}-${index}`}
                  type="button"
                  className="mobile-nav-link schedule-mobile-link"
                  onClick={() => {
                    handleToggleSchedulePanel();
                    setMobileMenuOpen(false);
                  }}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </button>
              ) : (
                <Link
                  key={`${link.path}-${index}`}
                  to={link.path}
                  className={`mobile-nav-link ${isLinkActive(link.path) ? 'active' : ''}`}
                  onClick={(e) => {
                    if (link.path.startsWith('/#') || link.path === '/') {
                      e.preventDefault();
                      handleNavLinkClick(link.path);
                    } else {
                      setMobileMenuOpen(false);
                    }
                  }}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              )
            ))}
            {isAuthenticated ? (
              <button onClick={handleLogout} className="mobile-nav-link logout">
                <FiLogOut />
                <span>Logout</span>
              </button>
            ) : (
              <div className="mobile-auth-buttons">
                <Link to="/login" className="btn btn-ghost btn-sm" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                <Link to="/signup" className="btn btn-primary btn-sm" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
              </div>
            )}

            {/* Mobile Theme Selector */}
            <div className="mobile-theme-selector" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0 16px 8px 16px' }}>
                Appearance
              </div>
              <div style={{ display: 'flex', gap: '8px', padding: '0 16px' }}>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`btn btn-ghost btn-sm ${theme === 'light' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '36px', borderColor: theme === 'light' ? 'var(--primary)' : '', background: theme === 'light' ? 'rgba(0, 217, 166, 0.08)' : '' }}
                >
                  <FiSun size={14} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`btn btn-ghost btn-sm ${theme === 'dark' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '36px', borderColor: theme === 'dark' ? 'var(--primary)' : '', background: theme === 'dark' ? 'rgba(0, 217, 166, 0.08)' : '' }}
                >
                  <FiMoon size={14} /> Dark
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`btn btn-ghost btn-sm ${theme === 'system' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '36px', borderColor: theme === 'system' ? 'var(--primary)' : '', background: theme === 'system' ? 'rgba(0, 217, 166, 0.08)' : '' }}
                >
                  <FiMonitor size={14} /> System
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>

    <AnimatePresence>
      {showNotifications && (
        <>
          <div className="notification-panel-backdrop" onClick={() => setShowNotifications(false)} />
          <motion.div
            className="notification-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="notification-panel-header">
              <div>
                <div className="notification-panel-title">Important Alerts</div>
                <div className="notification-panel-subtitle">Reminders and pending messages for you.</div>
              </div>
              <button className="notification-mark-read" onClick={markAllNotificationsRead}>
                Mark all seen
              </button>
            </div>
            <div className="notification-list">
              {notifications.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className={`notification-item ${note.read ? '' : 'unread'}`}
                  onClick={() => markNotificationRead(note.id)}
                >
                  <div className="notification-item-title">{note.title}</div>
                  <div className="notification-item-message">{note.message}</div>
                  <div className="notification-item-time">{note.time}</div>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}

      {showSchedulePanel && isDoctor && (
        <>
          <div className="notification-panel-backdrop" onClick={() => setShowSchedulePanel(false)} />
          <motion.div
            className="schedule-panel"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="schedule-panel-header">
              <div>
                <div className="schedule-panel-title">Doctor Schedule</div>
                <div className="schedule-panel-subtitle">Set your availability for patients.</div>
              </div>
              <button className="notification-mark-read" onClick={handleSaveSchedule}>
                Save
              </button>
            </div>
            <div className="schedule-panel-content">
              <div className="schedule-field">
                <label>Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="schedule-field">
                <label>Availability</label>
                <div className="schedule-options">
                  <button
                    type="button"
                    className={scheduleMode === 'NONE' ? 'selected' : ''}
                    onClick={() => setScheduleMode('NONE')}
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    className={scheduleMode === 'ALL_DAY' ? 'selected' : ''}
                    onClick={() => setScheduleMode('ALL_DAY')}
                  >
                    Busy All Day
                  </button>
                  <button
                    type="button"
                    className={scheduleMode === 'AFTERNOON' ? 'selected' : ''}
                    onClick={() => setScheduleMode('AFTERNOON')}
                  >
                    Busy Afternoon
                  </button>
                  <button
                    type="button"
                    className={scheduleMode === 'TIME_RANGE' ? 'selected' : ''}
                    onClick={() => setScheduleMode('TIME_RANGE')}
                  >
                    Busy Time Range
                  </button>
                </div>
              </div>
              {scheduleMode === 'TIME_RANGE' && (
                <div className="schedule-field">
                  <label>Busy Hours</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input
                      type="time"
                      value={scheduleTimeStart}
                      onChange={(e) => setScheduleTimeStart(e.target.value)}
                    />
                    <input
                      type="time"
                      value={scheduleTimeEnd}
                      onChange={(e) => setScheduleTimeEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="schedule-current-status">
                Current status: <strong>{getScheduleLabel(scheduleStatus)}</strong>
              </div>
              <button className="schedule-clear-btn" onClick={() => {
                setScheduleMode('NONE');
                setScheduleStatus({ mode: 'NONE', date: '' });
                setShowSchedulePanel(false);
                toast.success('Doctor schedule cleared.');
              }}>
                Clear schedule
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {showAddUserModal && (
      <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="heading-sm" style={{ margin: 0, color: '#0F172A' }}>Add Family Member</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddUserModal(false)} style={{ padding: '4px' }}>
              <FiX size={20} />
            </button>
          </div>
          <form onSubmit={handleAddFamilyMember}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '60vh', overflowY: 'auto', padding: '20px' }}>
              
              {/* Row 1: Name and Relation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={familyForm.name}
                    onChange={handleFamilyFormChange}
                    placeholder="Full Name"
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Relation</label>
                  <select
                    name="relation"
                    value={familyForm.relation}
                    onChange={handleFamilyFormChange}
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                  >
                    <option value="SPOUSE">Spouse</option>
                    <option value="CHILD">Child</option>
                    <option value="PARENT">Parent</option>
                    <option value="SIBLING">Sibling</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* Row 2: DOB and Age */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Date of Birth</label>
                  <input
                    type="date"
                    name="dob"
                    value={familyForm.dob}
                    onChange={handleFamilyFormChange}
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Age</label>
                  <input
                    type="number"
                    name="age"
                    value={familyForm.age}
                    onChange={handleFamilyFormChange}
                    placeholder="Age"
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                    required
                  />
                </div>
              </div>

              {/* Row 3: Gender and Blood Group */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Gender</label>
                  <select
                    name="gender"
                    value={familyForm.gender}
                    onChange={handleFamilyFormChange}
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Blood Group</label>
                  <select
                    name="bloodGroup"
                    value={familyForm.bloodGroup}
                    onChange={handleFamilyFormChange}
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Phone and Emergency Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Phone (Optional)</label>
                  <input
                    type="tel"
                    name="phone"
                    value={familyForm.phone}
                    onChange={handleFamilyFormChange}
                    placeholder="Phone"
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Emergency Contact</label>
                  <input
                    type="tel"
                    name="emergencyNumber"
                    value={familyForm.emergencyNumber}
                    onChange={handleFamilyFormChange}
                    placeholder="Emergency Number"
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                    required
                  />
                </div>
              </div>

              {/* Row 5: Language and ID Proof */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Preferred Language</label>
                  <input
                    type="text"
                    name="preferredLanguage"
                    value={familyForm.preferredLanguage}
                    onChange={handleFamilyFormChange}
                    placeholder="English, Spanish, etc."
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>ID Proof (e.g. Aadhaar/Passport)</label>
                  <input
                    type="text"
                    name="idProof"
                    value={familyForm.idProof}
                    onChange={handleFamilyFormChange}
                    placeholder="ID Number"
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                    required
                  />
                </div>
              </div>

              {/* Row 6: Medical Conditions */}
              <div className="form-group">
                <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Existing Medical Conditions</label>
                <input
                  type="text"
                  name="existingMedicalCondition"
                  value={familyForm.existingMedicalCondition}
                  onChange={handleFamilyFormChange}
                  placeholder="Describe chronic illnesses or write 'None'"
                  className="form-input"
                  style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                />
              </div>

              {/* Row 7: Allergies & Medications */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Allergies</label>
                  <input
                    type="text"
                    name="allergies"
                    value={familyForm.allergies}
                    onChange={handleFamilyFormChange}
                    placeholder="Food/drug allergies or 'None'"
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0F172A', fontSize: '0.8rem', marginBottom: '4px' }}>Current Medication</label>
                  <input
                    type="text"
                    name="currentMedication"
                    value={familyForm.currentMedication}
                    onChange={handleFamilyFormChange}
                    placeholder="List daily medicines or 'None'"
                    className="form-input"
                    style={{ color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '8px 12px' }}
                  />
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddUserModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={addingMember}>
                {addingMember ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {showProfileModal && (
      <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
        <div className="modal-card profile-details-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="heading-sm" style={{ margin: 0, color: '#0F172A' }}>
              {activeProfile ? `${activeProfile.name}'s Profile` : 'My Profile'}
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowProfileModal(false)} style={{ padding: '4px' }}>
              <FiX size={20} />
            </button>
          </div>
          
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
            {loadingProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <div className="skeleton-loader" style={{ height: '32px', width: '60%', borderRadius: '4px' }}></div>
                <div className="skeleton-loader" style={{ height: '20px', width: '80%', borderRadius: '4px' }}></div>
                <div className="skeleton-loader" style={{ height: '20px', width: '40%', borderRadius: '4px' }}></div>
              </div>
            ) : profileData ? (
              isEditing ? (
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Basic Details Section */}
                  <div>
                    <h5 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0F172A', margin: '0 0 12px 0' }}>
                      Basic Profile Details
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Name</label>
                        <input 
                          type="text" 
                          name="name" 
                          value={editFormData.name} 
                          onChange={handleEditFormChange} 
                          className="form-input" 
                          style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          required 
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Phone</label>
                        <input 
                          type="text" 
                          name="phone" 
                          value={editFormData.phone} 
                          onChange={handleEditFormChange} 
                          className="form-input" 
                          style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          required 
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>City</label>
                        <input 
                          type="text" 
                          name="city" 
                          value={editFormData.city} 
                          onChange={handleEditFormChange} 
                          className="form-input" 
                          style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Address</label>
                        <input 
                          type="text" 
                          name="address" 
                          value={editFormData.address} 
                          onChange={handleEditFormChange} 
                          className="form-input" 
                          style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medical / Clinical Details Section (Only for Patient role) */}
                  {user?.role === 'PATIENT' && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <h5 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0F172A', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FiActivity style={{ color: 'var(--primary)' }} /> Clinical & Health Profile
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Date of Birth</label>
                          <input 
                            type="date" 
                            name="dob" 
                            value={editFormData.dob} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Age</label>
                          <input 
                            type="number" 
                            name="age" 
                            value={editFormData.age} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Gender</label>
                          <select 
                            name="gender" 
                            value={editFormData.gender} 
                            onChange={handleEditFormChange} 
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          >
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Blood Group</label>
                          <select 
                            name="bloodGroup" 
                            value={editFormData.bloodGroup} 
                            onChange={handleEditFormChange} 
                            className="form-input"
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          >
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Emergency Contact</label>
                          <input 
                            type="text" 
                            name="emergencyNumber" 
                            value={editFormData.emergencyNumber} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Preferred Language</label>
                          <input 
                            type="text" 
                            name="preferredLanguage" 
                            value={editFormData.preferredLanguage} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>ID Proof Reference</label>
                          <input 
                            type="text" 
                            name="idProof" 
                            value={editFormData.idProof} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Existing Medical Conditions</label>
                          <textarea 
                            name="existingMedicalCondition" 
                            value={editFormData.existingMedicalCondition} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            rows="2"
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%', resize: 'vertical' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Allergies</label>
                          <textarea 
                            name="allergies" 
                            value={editFormData.allergies} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            rows="2"
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%', resize: 'vertical' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                          <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>Current Medications</label>
                          <textarea 
                            name="currentMedication" 
                            value={editFormData.currentMedication} 
                            onChange={handleEditFormChange} 
                            className="form-input" 
                            rows="2"
                            style={{ padding: '8px 12px', fontSize: '0.88rem', color: '#0F172A', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', width: '100%', resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hidden Submit Button */}
                  <button type="submit" id="profile-edit-submit-btn" style={{ display: 'none' }}></button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Avatar & Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                    <div className="avatar avatar-lg" style={{ width: '64px', height: '64px', fontSize: '1.6rem' }}>
                      {!activeProfile && user?.avatarUrl ? (
                        <img 
                          src={user.avatarUrl.startsWith('http') ? user.avatarUrl : `${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${user.avatarUrl}`} 
                          alt="Avatar" 
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                        />
                      ) : (
                        profileData.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0F172A', margin: '0 0 4px 0' }}>{profileData.name}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {activeProfile ? `Family Member (${profileData.relation})` : profileData.role || user?.role}
                      </p>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                    <div className="profile-info-group">
                      <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Email Address</span>
                      <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.email || 'N/A'}</span>
                    </div>
                    <div className="profile-info-group">
                      <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Phone Number</span>
                      <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.phone || 'N/A'}</span>
                    </div>
                    <div className="profile-info-group">
                      <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>City</span>
                      <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.city || 'N/A'}</span>
                    </div>
                    <div className="profile-info-group">
                      <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Address</span>
                      <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.address || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Medical Details (Only for Patients/Family) */}
                  {(profileData.dob || profileData.gender || profileData.bloodGroup) && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
                      <h5 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0F172A', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiActivity style={{ color: 'var(--primary)' }} /> Clinical & Health Profile
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                        <div className="profile-info-group">
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Date of Birth</span>
                          <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.dob || 'N/A'}</span>
                        </div>
                        <div className="profile-info-group">
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Age</span>
                          <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.age || 'N/A'} yrs</span>
                        </div>
                        <div className="profile-info-group">
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Gender</span>
                          <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500', textTransform: 'capitalize' }}>{profileData.gender?.toLowerCase() || 'N/A'}</span>
                        </div>
                        <div className="profile-info-group">
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Blood Group</span>
                          <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.bloodGroup || 'N/A'}</span>
                        </div>
                        <div className="profile-info-group">
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Emergency Contact</span>
                          <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.emergencyNumber || 'N/A'}</span>
                        </div>
                        <div className="profile-info-group">
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Preferred Language</span>
                          <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.preferredLanguage || 'N/A'}</span>
                        </div>
                        <div className="profile-info-group" style={{ gridColumn: 'span 2' }}>
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>ID Proof Reference</span>
                          <span className="profile-info-value" style={{ color: '#0F172A', fontSize: '0.9rem', fontWeight: '500' }}>{profileData.idProof || 'N/A'}</span>
                        </div>
                        <div className="profile-info-group" style={{ gridColumn: 'span 2' }}>
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Existing Medical Conditions</span>
                          <span className="profile-info-value" style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'block', fontSize: '0.85rem', color: '#0F172A' }}>
                            {profileData.existingMedicalCondition || 'None'}
                          </span>
                        </div>
                        <div className="profile-info-group" style={{ gridColumn: 'span 2' }}>
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Allergies</span>
                          <span className="profile-info-value" style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'block', fontSize: '0.85rem', color: '#0F172A' }}>
                            {profileData.allergies || 'None'}
                          </span>
                        </div>
                        <div className="profile-info-group" style={{ gridColumn: 'span 2' }}>
                          <span className="profile-info-label" style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: '600' }}>Current Medications</span>
                          <span className="profile-info-value" style={{ background: '#F8FAFC', padding: '8px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'block', fontSize: '0.85rem', color: '#0F172A' }}>
                            {profileData.currentMedication || 'None'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No profile data found.</p>
            )}
          </div>
          
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {isEditing ? (
              <>
                <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)} disabled={savingProfile}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  disabled={savingProfile} 
                  onClick={() => document.getElementById('profile-edit-submit-btn')?.click()}
                  style={{ background: 'var(--primary)', borderColor: 'var(--primary)' }}
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                {!activeProfile && (
                  <button type="button" className="btn btn-outline" onClick={startEditing}>
                    Edit Profile
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => setShowProfileModal(false)}>
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )}
  </>
);
}
