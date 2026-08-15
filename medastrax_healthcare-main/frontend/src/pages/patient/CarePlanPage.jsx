import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiClock,
  FiSun,
  FiMoon,
  FiHeart,
  FiActivity,
  FiAlertCircle,
  FiInfo,
  FiRefreshCw,
  FiChevronRight,
  FiBell,
  FiCheck,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { prescriptionAPI } from '../../services/api';

/* ───────────────────────────── constants ───────────────────────────── */

const REMINDER_KEY = 'mediverse_med_reminders';
const DEFAULT_REMINDERS = {
  enabled: false,
  morning: '08:00',
  afternoon: '14:00',
  night: '21:00',
};

const TABS = [
  { id: 'medicines', label: 'Medicine Schedule', icon: <FiClock size={16} /> },
  { id: 'diet', label: 'Diet Plan', icon: <FiHeart size={16} /> },
  { id: 'exercise', label: 'Exercise Plan', icon: <FiActivity size={16} /> },
];

const FALLBACK_CARE_PLAN = {
  diet: `## 🍽️ Balanced Daily Diet Plan

### Breakfast (7:30 – 8:30 AM)
- Whole-grain oatmeal topped with fresh berries and a drizzle of honey
- One boiled egg or a glass of warm milk
- A small handful of almonds or walnuts

### Mid-Morning Snack (10:30 AM)
- A seasonal fruit (apple, banana, or papaya)
- Green tea or buttermilk

### Lunch (12:30 – 1:30 PM)
- Brown rice or whole wheat chapati (2)
- Dal (lentil soup) or lean protein (grilled chicken / paneer)
- One serving of seasonal vegetables (steamed or stir-fried)
- A small bowl of curd / yogurt
- Fresh salad with cucumber, carrots, and tomato

### Afternoon Snack (4:00 PM)
- Roasted chickpeas or makhana (fox nuts)
- A cup of herbal tea (ginger / tulsi)

### Dinner (7:00 – 8:00 PM)
- Light soup (vegetable or chicken broth)
- Whole wheat chapati (1–2) or khichdi
- Steamed or sautéed vegetables
- A glass of warm turmeric milk before bed

### General Guidelines
- Drink at least 8–10 glasses of water throughout the day
- Avoid processed foods, excessive sugar, and deep-fried items
- Limit caffeine to 1–2 cups per day
- Include probiotics like yogurt or fermented foods`,

  exercise: `## 🏃 Daily Exercise & Wellness Routine

### Morning Routine (6:30 – 7:15 AM)
- **Light Walking** – 20 to 30 minutes at a comfortable pace
- **Gentle Stretching** – Neck rolls, shoulder stretches, hamstring stretch (10 min)
- **Deep Breathing (Pranayama)** – 5 minutes of alternate nostril breathing

### Midday Movement (12:00 – 12:15 PM)
- **Desk Stretches** – Wrist circles, seated spinal twist
- **Short Walk** – 10-minute walk after lunch to aid digestion

### Evening Activity (5:00 – 5:30 PM)
- **Light Yoga / Tai Chi** – Sun salutations or gentle flow (15 min)
- **Balance Exercises** – Single leg stands, heel-to-toe walk (5 min)

### Before Bed (9:00 – 9:15 PM)
- **Progressive Muscle Relaxation** – Tense and release each muscle group
- **Guided Meditation** – 5–10 minutes of mindfulness or body scan

### Weekly Goals
- Aim for at least 150 minutes of moderate activity per week
- Include 2 sessions of light strength training (resistance bands or bodyweight)
- Rest at least 1 day per week to allow recovery

### Important Notes
- Always warm up before exercise and cool down after
- Stop any exercise that causes pain or discomfort
- Stay hydrated before, during, and after exercise
- Consult your doctor before starting any new exercise program`,
};

/* ───────────────────── helper: parse frequency ────────────────────── */

function parseFrequency(freq) {
  if (!freq) return { morning: false, afternoon: false, night: false };
  const parts = freq.split('-').map((v) => parseInt(v, 10));
  return {
    morning: parts[0] === 1,
    afternoon: parts.length > 1 ? parts[1] === 1 : false,
    night: parts.length > 2 ? parts[2] === 1 : false,
  };
}

/* ──────────────────── helper: parse medicines JSON ────────────────── */

function parseMedicines(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ────────────────── helper: simple markdown renderer ──────────────── */

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;

  const flushList = () => {
    if (listItems.length > 0) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <Tag key={`list-${elements.length}`} style={{ paddingLeft: 24, margin: '8px 0', lineHeight: 1.8 }}>
          {listItems.map((li, i) => (
            <li key={i} style={{ marginBottom: 4, color: 'var(--text-secondary)', fontSize: '0.9rem' }}
              dangerouslySetInnerHTML={{ __html: li }} />
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  const inlineFormat = (str) =>
    str
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

  lines.forEach((raw, idx) => {
    const line = raw;

    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={idx} style={{ margin: '20px 0 8px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary-dark)', letterSpacing: '-0.01em' }}>
          {line.replace('## ', '')}
        </h3>
      );
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={idx} style={{ margin: '16px 0 6px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {line.replace('### ', '')}
        </h4>
      );
    } else if (/^[-*]\s/.test(line.trim())) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(inlineFormat(line.trim().replace(/^[-*]\s/, '')));
    } else if (/^\d+\.\s/.test(line.trim())) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(inlineFormat(line.trim().replace(/^\d+\.\s/, '')));
    } else if (line.trim() === '') {
      flushList();
      elements.push(<div key={idx} style={{ height: 6 }} />);
    } else {
      flushList();
      elements.push(
        <p key={idx} style={{ margin: '4px 0', lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '0.9rem' }}
          dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
  });
  flushList();
  return elements;
}

/* ─────────────────────── animation variants ───────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 30 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 28, stiffness: 360 } },
  exit: { opacity: 0, scale: 0.92, y: 30 },
};

/* ═══════════════════════════════════════════════════════════════════ */
/*                         MAIN COMPONENT                            */
/* ═══════════════════════════════════════════════════════════════════ */

export default function CarePlanPage() {
  /* ── state ── */
  const [activeTab, setActiveTab] = useState('medicines');
  const [prescriptions, setPrescriptions] = useState([]);
  const [allMedicines, setAllMedicines] = useState([]);
  const [carePlanText, setCarePlanText] = useState('');
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true);
  const [loadingCarePlan, setLoadingCarePlan] = useState(false);
  const [carePlanError, setCarePlanError] = useState(false);
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);

  // Explain medicine modal
  const [explainModal, setExplainModal] = useState({ open: false, name: '', loading: false, text: '' });

  const intervalRef = useRef(null);

  /* ── load saved reminders ── */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(REMINDER_KEY));
      if (saved) setReminders(saved);
    } catch { /* ignore */ }
  }, []);

  /* ── fetch prescriptions ── */
  useEffect(() => {
    (async () => {
      setLoadingPrescriptions(true);
      try {
        const res = await prescriptionAPI.getPatientPrescriptions();
        const data = res.data;
        const list = Array.isArray(data) ? data : data?.prescriptions || [];
        setPrescriptions(list);

        const meds = [];
        list.forEach((rx) => {
          const parsed = parseMedicines(rx.medicines);
          parsed.forEach((m) => meds.push({ ...m, prescriptionId: rx.id, doctorName: rx.doctorName, diagnosis: rx.diagnosis }));
        });
        setAllMedicines(meds);
        localStorage.setItem('mediverse_all_medicines', JSON.stringify(meds));
      } catch (err) {
        console.error('Failed to load prescriptions:', err);
        const cached = localStorage.getItem('mediverse_all_medicines');
        if (cached) {
          try {
            const meds = JSON.parse(cached);
            if (meds && meds.length > 0) {
              setAllMedicines(meds);
              toast.success('Loaded saved medicine schedule (Offline Mode) 📶');
              setLoadingPrescriptions(false);
              return;
            }
          } catch (e) {
            console.error('Failed to parse cached medicines:', e);
          }
        }
        toast.error('Could not load prescriptions');
      } finally {
        setLoadingPrescriptions(false);
      }
    })();
  }, []);

  /* ── fetch AI care plan once we have medicines ── */
  const fetchCarePlan = useCallback(async (medicines) => {
    if (!medicines || medicines.length === 0) {
      setCarePlanError(true);
      return;
    }
    setLoadingCarePlan(true);
    setCarePlanError(false);
    try {
      const res = await api.post('/ai/care-plan', { medicines: JSON.stringify(medicines) });
      if (res.data?.success && res.data?.carePlan) {
        setCarePlanText(res.data.carePlan);
      } else {
        setCarePlanError(true);
      }
    } catch (err) {
      console.error('AI care plan error:', err);
      setCarePlanError(true);
    } finally {
      setLoadingCarePlan(false);
    }
  }, []);

  useEffect(() => {
    if (allMedicines.length > 0) fetchCarePlan(allMedicines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMedicines]);

  /* ── refresh handler ── */
  const handleRefresh = () => {
    toast('Regenerating care plan…', { icon: '🔄' });
    fetchCarePlan(allMedicines);
  };

  /* ── explain medicine ── */
  const handleExplain = async (medicineName) => {
    setExplainModal({ open: true, name: medicineName, loading: true, text: '' });
    try {
      const res = await api.post('/ai/explain-medicine', { medicine: medicineName });
      if (res.data?.success && res.data?.explanation) {
        setExplainModal((prev) => ({ ...prev, loading: false, text: res.data.explanation }));
      } else {
        setExplainModal((prev) => ({ ...prev, loading: false, text: '⚠️ Could not retrieve explanation. Please try again later.' }));
      }
    } catch {
      setExplainModal((prev) => ({ ...prev, loading: false, text: '⚠️ AI service is currently unavailable. Please try again later.' }));
    }
  };

  /* ── notification reminders ── */
  const enableReminders = async () => {
    if (!('Notification' in window)) {
      toast.error('Your browser does not support notifications');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const updated = { ...reminders, enabled: true };
      setReminders(updated);
      localStorage.setItem(REMINDER_KEY, JSON.stringify(updated));
      toast.success('Medicine reminders enabled! 🔔');
    } else {
      toast.error('Notification permission denied');
    }
  };


  /* ── extract diet / exercise sections from AI text ── */
  const extractSection = (text, sectionKeywords) => {
    if (!text) return '';
    const lines = text.split('\n');
    let capturing = false;
    let captured = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (sectionKeywords.some((kw) => lower.includes(kw))) {
        capturing = true;
        captured.push(line);
        continue;
      }
      if (capturing) {
        // Stop if we hit another major heading (##) that isn't part of our section
        if (/^##\s/.test(line) && !sectionKeywords.some((kw) => line.toLowerCase().includes(kw))) {
          break;
        }
        captured.push(line);
      }
    }
    return captured.join('\n').trim();
  };

  const dietText = carePlanText
    ? extractSection(carePlanText, ['diet', 'nutrition', 'meal', 'food', 'breakfast', 'lunch', 'dinner', 'eating'])
    : '';
  const exerciseText = carePlanText
    ? extractSection(carePlanText, ['exercise', 'workout', 'physical', 'yoga', 'walk', 'stretch', 'fitness', 'movement'])
    : '';

  /* ═══════════════════════════════ RENDER ══════════════════════════ */

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 80px' }}>
      {/* ─────────────────────── HEADER ─────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'linear-gradient(135deg, #1D9E75 0%, #17b885 40%, #12c28e 100%)',
          borderRadius: 'var(--radius-xl, 20px)',
          padding: '36px 36px 32px',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(29, 158, 117, 0.25)',
        }}
      >
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: 30, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <FiHeart size={26} color="#fff" />
              <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
                My Care Plan
              </h1>
            </div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: 500 }}>
              AI-powered personalized health plan based on your prescriptions
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleRefresh}
            disabled={loadingCarePlan}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 22px',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 'var(--radius-lg, 14px)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: loadingCarePlan ? 'wait' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <FiRefreshCw size={16} style={{ animation: loadingCarePlan ? 'spin 1s linear infinite' : 'none' }} />
            {loadingCarePlan ? 'Generating…' : 'Refresh Plan'}
          </motion.button>
        </div>
      </motion.div>

      {/* ────────────────────── TAB SWITCHER ────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="dashboard-tabs"
        style={{
          display: 'flex',
          background: 'var(--bg-secondary, #f4f6f8)',
          borderRadius: 'var(--radius-lg, 14px)',
          padding: 4,
          marginBottom: 28,
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.97 }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md, 10px)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#fff' : 'var(--text-secondary, #64748b)',
                background: isActive ? 'linear-gradient(135deg, #1D9E75, #17b885)' : 'transparent',
                boxShadow: isActive ? '0 4px 14px rgba(29,158,117,0.3)' : 'none',
                transition: 'all 0.25s ease',
              }}
            >
              {tab.icon}
              {tab.label}
            </motion.button>
          );
        })}
      </motion.div>

      {/* ──────────────── TAB 1: MEDICINE SCHEDULE ──────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'medicines' && (
          <motion.div
            key="medicines"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={containerVariants}
          >
            {/* Reminder bar */}
            <motion.div
              variants={itemVariants}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                padding: '16px 22px',
                borderRadius: 'var(--radius-lg, 14px)',
                background: reminders.enabled
                  ? 'linear-gradient(135deg, rgba(29,158,117,0.08), rgba(23,184,133,0.04))'
                  : 'var(--bg-secondary, #f4f6f8)',
                border: `1px solid ${reminders.enabled ? 'rgba(29,158,117,0.2)' : 'var(--border-color, #e2e8f0)'}`,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FiBell size={18} color={reminders.enabled ? '#1D9E75' : 'var(--text-muted, #94a3b8)'} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {reminders.enabled ? 'Reminders Active' : 'Medicine Reminders'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)' }}>
                    {reminders.enabled
                      ? `Morning ${reminders.morning} · Afternoon ${reminders.afternoon} · Night ${reminders.night}`
                      : 'Get notified when it\'s time to take your medicines'}
                  </p>
                </div>
              </div>
              {!reminders.enabled && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={enableReminders}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 18px',
                    borderRadius: 'var(--radius-md, 10px)',
                    border: '1.5px solid #1D9E75',
                    background: '#fff',
                    color: '#1D9E75',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  <FiBell size={14} /> Enable Reminders
                </motion.button>
              )}
              {reminders.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1D9E75', fontWeight: 600, fontSize: '0.82rem' }}>
                  <FiCheck size={16} /> Active
                </div>
              )}
            </motion.div>

            {/* Medicine cards */}
            {loadingPrescriptions ? (
              <SkeletonCards count={3} />
            ) : allMedicines.length === 0 ? (
              <motion.div
                variants={itemVariants}
                style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  borderRadius: 'var(--radius-xl, 20px)',
                  background: 'var(--bg-secondary, #f4f6f8)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                }}
              >
                <FiAlertCircle size={40} color="var(--text-muted, #94a3b8)" style={{ marginBottom: 12 }} />
                <h3 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontWeight: 700 }}>No Prescriptions Found</h3>
                <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
                  Visit a doctor and get a prescription to see your personalized medicine schedule.
                </p>
              </motion.div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {allMedicines.map((med, index) => {
                  const freq = parseFrequency(med.frequency);
                  return (
                    <motion.div
                      key={`${med.name}-${index}`}
                      variants={itemVariants}
                      whileHover={{ y: -2, boxShadow: '0 12px 36px rgba(0,0,0,0.08)' }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 16,
                        padding: '20px 24px',
                        borderRadius: 'var(--radius-lg, 14px)',
                        background: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.06))',
                        transition: 'box-shadow 0.3s, transform 0.3s',
                      }}
                    >
                      {/* Left: medicine info */}
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <div style={{
                            width: 38, height: 38, borderRadius: 'var(--radius-md, 10px)',
                            background: 'linear-gradient(135deg, rgba(29,158,117,0.12), rgba(29,158,117,0.04))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.1rem',
                          }}>
                            💊
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {med.name}
                            </h4>
                            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted, #94a3b8)' }}>
                              {med.dosage} · {med.duration}
                            </p>
                          </div>
                        </div>

                        {/* Frequency chips */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          <FreqChip active={freq.morning} label="Morning" emoji="☀️" icon={<FiSun size={12} />} />
                          <FreqChip active={freq.afternoon} label="Afternoon" emoji="🌤️" icon={<FiClock size={12} />} />
                          <FreqChip active={freq.night} label="Night" emoji="🌙" icon={<FiMoon size={12} />} />
                        </div>
                      </div>

                      {/* Right: Ask AI button */}
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => handleExplain(med.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 16px',
                          borderRadius: 'var(--radius-md, 10px)',
                          border: '1.5px solid rgba(29,158,117,0.3)',
                          background: 'linear-gradient(135deg, rgba(29,158,117,0.06), rgba(29,158,117,0.02))',
                          color: '#1D9E75',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Ask AI 🤖 <FiChevronRight size={14} />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ───────────────── TAB 2: DIET PLAN ────────────────── */}
        {activeTab === 'diet' && (
          <motion.div
            key="diet"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              style={{
                borderRadius: 'var(--radius-xl, 20px)',
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.08))',
                overflow: 'hidden',
              }}
            >
              {/* Section header */}
              <div style={{
                padding: '24px 28px 20px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                background: 'linear-gradient(135deg, rgba(29,158,117,0.04), rgba(29,158,117,0.01))',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md, 10px)',
                    background: 'linear-gradient(135deg, #1D9E75, #17b885)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem',
                  }}>
                    🥗
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Personalized Diet Plan
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                      {carePlanError ? 'General wellness recommendations' : 'AI-curated nutrition based on your medicines'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '24px 28px 28px' }}>
                {loadingCarePlan ? (
                  <SkeletonContent />
                ) : (
                  <div>
                    {(dietText || carePlanError) ? (
                      renderMarkdown(dietText || FALLBACK_CARE_PLAN.diet)
                    ) : (
                      renderMarkdown(carePlanText || FALLBACK_CARE_PLAN.diet)
                    )}

                    {carePlanError && (
                      <div style={{
                        marginTop: 20,
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-md, 10px)',
                        background: 'rgba(251,191,36,0.08)',
                        border: '1px solid rgba(251,191,36,0.2)',
                        display: 'flex', alignItems: 'center', gap: 10,
                        fontSize: '0.84rem', color: '#92400e',
                      }}>
                        <FiInfo size={16} />
                        <span>AI service unavailable. Showing general wellness recommendations as a fallback.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ──────────────── TAB 3: EXERCISE PLAN ────────────────── */}
        {activeTab === 'exercise' && (
          <motion.div
            key="exercise"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={containerVariants}
          >
            <motion.div
              variants={itemVariants}
              style={{
                borderRadius: 'var(--radius-xl, 20px)',
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.08))',
                overflow: 'hidden',
              }}
            >
              {/* Section header */}
              <div style={{
                padding: '24px 28px 20px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(99,102,241,0.01))',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-md, 10px)',
                    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem',
                  }}>
                    🏃
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Exercise & Wellness Plan
                    </h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                      {carePlanError ? 'General fitness recommendations' : 'AI-recommended activities for your recovery'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '24px 28px 28px' }}>
                {loadingCarePlan ? (
                  <SkeletonContent />
                ) : (
                  <div>
                    {(exerciseText || carePlanError) ? (
                      renderMarkdown(exerciseText || FALLBACK_CARE_PLAN.exercise)
                    ) : (
                      renderMarkdown(carePlanText || FALLBACK_CARE_PLAN.exercise)
                    )}

                    {carePlanError && (
                      <div style={{
                        marginTop: 20,
                        padding: '14px 18px',
                        borderRadius: 'var(--radius-md, 10px)',
                        background: 'rgba(251,191,36,0.08)',
                        border: '1px solid rgba(251,191,36,0.2)',
                        display: 'flex', alignItems: 'center', gap: 10,
                        fontSize: '0.84rem', color: '#92400e',
                      }}>
                        <FiInfo size={16} />
                        <span>AI service unavailable. Showing general fitness recommendations as a fallback.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────── AI EXPLAIN MEDICINE MODAL ──────────────── */}
      <AnimatePresence>
        {explainModal.open && (
          <motion.div
            key="modal-overlay"
            variants={modalOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setExplainModal({ open: false, name: '', loading: false, text: '' })}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(15,23,42,0.6)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <motion.div
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 560,
                maxHeight: '80vh',
                overflowY: 'auto',
                borderRadius: 'var(--radius-xl, 20px)',
                background: 'var(--bg-primary, #fff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 25px 80px rgba(0,0,0,0.18)',
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: '22px 26px 18px',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(29,158,117,0.06), rgba(29,158,117,0.01))',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #1D9E75, #17b885)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', color: '#fff',
                  }}>
                    🤖
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {explainModal.name}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)' }}>
                      AI-powered medicine explanation
                    </p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setExplainModal({ open: false, name: '', loading: false, text: '' })}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    background: 'var(--bg-secondary, #f4f6f8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)',
                  }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '22px 26px 26px' }}>
                {explainModal.loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                    <div style={{
                      width: 40, height: 40,
                      border: '3px solid var(--border-color, #e2e8f0)',
                      borderTopColor: '#1D9E75',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      marginBottom: 16,
                    }} />
                    <p style={{ margin: 0, color: 'var(--text-muted, #94a3b8)', fontSize: '0.88rem' }}>
                      Analyzing {explainModal.name}…
                    </p>
                  </div>
                ) : (
                  <div style={{ lineHeight: 1.7 }}>
                    {renderMarkdown(explainModal.text)}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── global keyframe for spin animation ── */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════ SUB-COMPONENTS ════════════════════════════ */

function FreqChip({ active, label, emoji, icon }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 10px',
      borderRadius: 20,
      fontSize: '0.76rem',
      fontWeight: 600,
      color: active ? '#1D9E75' : 'var(--text-muted, #94a3b8)',
      background: active ? 'rgba(29,158,117,0.1)' : 'var(--bg-secondary, #f4f6f8)',
      border: `1px solid ${active ? 'rgba(29,158,117,0.2)' : 'transparent'}`,
      opacity: active ? 1 : 0.55,
      transition: 'all 0.2s',
    }}>
      <span style={{ fontSize: '0.85rem' }}>{emoji}</span>
      {label}
      {active && <FiCheck size={11} />}
    </div>
  );
}

function SkeletonCards({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: '22px 24px',
            borderRadius: 'var(--radius-lg, 14px)',
            background: 'var(--bg-secondary, #f4f6f8)',
            border: '1px solid var(--border-color, #e2e8f0)',
          }}
        >
          <SkeletonBar width="45%" height={16} mb={10} />
          <SkeletonBar width="30%" height={12} mb={12} />
          <div style={{ display: 'flex', gap: 8 }}>
            <SkeletonBar width={70} height={24} borderRadius={20} />
            <SkeletonBar width={80} height={24} borderRadius={20} />
            <SkeletonBar width={60} height={24} borderRadius={20} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonContent() {
  return (
    <div>
      <SkeletonBar width="50%" height={18} mb={16} />
      <SkeletonBar width="80%" height={12} mb={8} />
      <SkeletonBar width="70%" height={12} mb={8} />
      <SkeletonBar width="90%" height={12} mb={8} />
      <SkeletonBar width="60%" height={12} mb={20} />
      <SkeletonBar width="45%" height={18} mb={16} />
      <SkeletonBar width="85%" height={12} mb={8} />
      <SkeletonBar width="75%" height={12} mb={8} />
      <SkeletonBar width="65%" height={12} mb={8} />
      <SkeletonBar width="80%" height={12} mb={8} />
    </div>
  );
}

function SkeletonBar({ width = '100%', height = 14, mb = 0, borderRadius = 6 }) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      marginBottom: mb,
      background: 'linear-gradient(90deg, var(--bg-secondary, #f0f0f0) 25%, #e8e8e8 50%, var(--bg-secondary, #f0f0f0) 75%)',
      backgroundSize: '800px 100%',
      animation: 'shimmer 1.8s ease-in-out infinite',
    }} />
  );
}
