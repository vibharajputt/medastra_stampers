import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiChevronDown, FiChevronUp,
  FiCalendar, FiVideo, FiShield, FiPackage,
  FiUser, FiFileText, FiHelpCircle, FiArrowRight,
  FiCreditCard, FiAlertCircle, FiMic, FiSmartphone
} from 'react-icons/fi';
import { FaUserMd, FaAmbulance, FaRobot, FaPills } from 'react-icons/fa';
import './FAQPage.css';

const categories = [
  { id: 'all',           label: 'All Questions',    icon: <FiHelpCircle /> },
  { id: 'appointments',  label: 'Appointments',      icon: <FiCalendar />  },
  { id: 'teleconsult',   label: 'Teleconsult',       icon: <FiVideo />     },
  { id: 'pharmacy',      label: 'Pharmacy',          icon: <FaPills />     },
  { id: 'prescriptions', label: 'Prescriptions',     icon: <FiFileText />  },
  { id: 'payments',      label: 'Payments & Refunds',icon: <FiCreditCard />},
  { id: 'account',       label: 'Account & Privacy', icon: <FiShield />    },
  { id: 'doctors',       label: 'Doctors & Clinics', icon: <FaUserMd />    },
  { id: 'emergency',     label: 'Emergency',         icon: <FaAmbulance /> },
  { id: 'ai',            label: 'AI & Technology',   icon: <FaRobot />     },
];

const faqs = [
  // ── APPOINTMENTS ──
  {
    cat: 'appointments',
    q: 'How do I book an appointment on MedAstraX?',
    a: 'Log in to your patient account, navigate to the Hospitals section, search for a doctor or specialty, select an available slot, and confirm your booking. You\'ll get a confirmation SMS and email instantly.'
  },
  {
    cat: 'appointments',
    q: 'Can I reschedule or cancel a booked appointment?',
    a: 'Yes! Go to My Bookings, find the appointment, and click Reschedule or Cancel. Cancellations made more than 2 hours before the appointment are eligible for a full refund.'
  },
  {
    cat: 'appointments',
    q: 'What is the difference between in-person and teleconsult booking?',
    a: 'In-person bookings reserve a physical slot at the doctor\'s clinic or hospital. Teleconsult bookings connect you with a doctor via secure browser-based video call — no travel needed.'
  },
  {
    cat: 'appointments',
    q: 'How early can I book an appointment in advance?',
    a: 'You can book appointments up to 30 days in advance depending on the doctor\'s schedule. Some specialists may allow longer advance bookings.'
  },
  {
    cat: 'appointments',
    q: 'Will I receive a reminder before my appointment?',
    a: 'Yes, MedAstraX sends automated reminders via SMS and email 24 hours and 1 hour before your scheduled appointment.'
  },

  // ── TELECONSULT ──
  {
    cat: 'teleconsult',
    q: 'How does video consultation work?',
    a: 'Select a doctor offering teleconsult, book a video slot, and join the session from your dashboard at the scheduled time. No third-party app required — it runs directly in your browser.'
  },
  {
    cat: 'teleconsult',
    q: 'What if my video call gets disconnected?',
    a: 'Simply refresh your browser and rejoin — the session stays open for 10 minutes. If issues persist, contact support and we\'ll arrange a free re-session.'
  },
  {
    cat: 'teleconsult',
    q: 'Is teleconsult available 24/7?',
    a: 'Certain on-call doctors are available 24/7 for emergencies. Most specialists have set teleconsult hours visible on their profile.'
  },
  {
    cat: 'teleconsult',
    q: 'Is the video session private and encrypted?',
    a: 'Yes. All video sessions are end-to-end encrypted and are never recorded without explicit consent from both the doctor and patient.'
  },

  // ── PHARMACY ──
  {
    cat: 'pharmacy',
    q: 'How are medicines delivered to my home?',
    a: 'After your doctor sends a digital prescription, choose a nearby pharmacy on the platform. Confirm the order and medicines are delivered within 2–4 hours in most cities.'
  },
  {
    cat: 'pharmacy',
    q: 'Can I compare pharmacy prices?',
    a: 'Yes! MedAstraX shows nearby pharmacies with prices and estimated delivery times so you can choose the best option for you.'
  },
  {
    cat: 'pharmacy',
    q: 'What if a medicine is out of stock?',
    a: 'If your chosen pharmacy is out of stock, you\'ll be notified and offered alternatives from nearby pharmacies. You can also switch pharmacies at any time before dispatch.'
  },
  {
    cat: 'pharmacy',
    q: 'Can I order medicines without a prescription?',
    a: 'Over-the-counter (OTC) medicines can be ordered without a prescription. Prescription medicines require a valid digital prescription from a verified MedAstraX doctor.'
  },

  // ── PRESCRIPTIONS ──
  {
    cat: 'prescriptions',
    q: 'Where can I find my digital prescription?',
    a: 'After your consultation, your prescription is automatically saved under My Prescriptions in your dashboard. You can download or share it at any time.'
  },
  {
    cat: 'prescriptions',
    q: 'Can I use an old prescription to order medicines?',
    a: 'Prescriptions are valid for the duration stated by the doctor. To use an old prescription, upload it in the pharmacy section and a pharmacist will verify its validity.'
  },
  {
    cat: 'prescriptions',
    q: 'Are digital prescriptions legally valid in India?',
    a: 'Yes. Digital prescriptions issued by verified doctors on MedAstraX comply with applicable regulations and are legally valid for dispensing medicines at pharmacies.'
  },

  // ── PAYMENTS ──
  {
    cat: 'payments',
    q: 'What payment methods are accepted?',
    a: 'MedAstraX accepts UPI, debit/credit cards, net banking, and popular wallets. All transactions are secured via Razorpay with HMAC signature verification.'
  },
  {
    cat: 'payments',
    q: 'How long do refunds take?',
    a: 'Refunds for cancelled appointments are processed within 5–7 business days and credited back to your original payment method. You\'ll receive an email confirmation once initiated.'
  },
  {
    cat: 'payments',
    q: 'Is it safe to enter my payment details on MedAstraX?',
    a: 'Absolutely. MedAstraX never stores your card or bank details. All payments go through Razorpay\'s PCI-DSS compliant gateway with full encryption.'
  },
  {
    cat: 'payments',
    q: 'Can I get an invoice or receipt for my payment?',
    a: 'Yes, payment receipts are automatically sent to your email. You can also download invoices from My Bookings in your dashboard.'
  },

  // ── ACCOUNT ──
  {
    cat: 'account',
    q: 'Is my health data safe on MedAstraX?',
    a: 'All health data is end-to-end encrypted and stored on secure servers. We never share your data with third parties without your explicit consent, and we comply with all healthcare data protection regulations.'
  },
  {
    cat: 'account',
    q: 'How do I update my profile or contact details?',
    a: 'Go to your Dashboard → Profile icon → Edit Profile to update your name, phone number, email, or health history.'
  },
  {
    cat: 'account',
    q: 'I forgot my password. How do I reset it?',
    a: 'Click "Forgot Password" on the login page. Enter your registered email and we\'ll send you a password reset link valid for 30 minutes.'
  },
  {
    cat: 'account',
    q: 'How do I delete my account?',
    a: 'Go to Settings → Account → Delete Account. This action is permanent and all data will be removed within 30 days per our data retention policy.'
  },
  {
    cat: 'account',
    q: 'Can I have separate accounts for different family members?',
    a: 'Currently each account is individual. Family accounts with dependent profiles are on our roadmap and coming soon.'
  },

  // ── DOCTORS ──
  {
    cat: 'doctors',
    q: 'How are doctors verified on MedAstraX?',
    a: 'Every doctor goes through a multi-step verification including medical registration validation, document checks, and onboarding review by our medical advisory board.'
  },
  {
    cat: 'doctors',
    q: 'Can I choose a specific doctor for my appointment?',
    a: 'Yes. You can search by doctor name, specialty, hospital, or location and book directly with your preferred doctor if they have available slots.'
  },
  {
    cat: 'doctors',
    q: 'How do I rate or review a doctor after a visit?',
    a: 'After your appointment is complete, you\'ll receive a prompt to leave a rating and review. You can also do so from My Bookings → Appointment Details → Leave Review.'
  },

  // ── EMERGENCY ──
  {
    cat: 'emergency',
    q: 'How does the emergency ambulance feature work?',
    a: 'Open the MedAstraX app, tap Emergency, and the platform locates the nearest available ambulance and dispatches it to your GPS location automatically.'
  },
  {
    cat: 'emergency',
    q: 'Can MedAstraX help find an available hospital bed in an emergency?',
    a: 'Yes. The Emergency dashboard shows real-time bed availability at nearby hospitals so you or emergency responders can make informed decisions quickly.'
  },
  {
    cat: 'emergency',
    q: 'Is the emergency feature available 24/7?',
    a: 'Yes. Emergency services are available around the clock. For life-threatening situations, always call 112 (India national emergency) in addition to using MedAstraX.'
  },

  // ── AI ──
  {
    cat: 'ai',
    q: 'What can the MedAstraX AI Health Assistant do?',
    a: 'The AI assistant can answer health queries, analyse your reports, suggest urgency levels, recommend doctors, remind you about medicines, and guide you through health plans — in your own language.'
  },
  {
    cat: 'ai',
    q: 'Does the AI assistant work offline?',
    a: 'Yes! MedAstraX includes an offline guardian bot that works without internet. It can handle common health queries, medication reminders, and first-aid guidance even in low-connectivity areas.'
  },
  {
    cat: 'ai',
    q: 'Is the AI a replacement for a real doctor?',
    a: 'No. The AI provides guidance, information, and triage support but is never a substitute for a qualified doctor\'s diagnosis or treatment. Always consult a doctor for medical decisions.'
  },
  {
    cat: 'ai',
    q: 'Which languages does the AI voice assistant support?',
    a: 'Currently Hindi, English, Tamil, Telugu, Bengali, Marathi, and Kannada. More regional languages are being added regularly.'
  },
];

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  // votes: { [uniqueKey]: 'yes' | 'no' }
  const [votes, setVotes] = useState({});

  const filtered = useMemo(() => {
    let items = activeCategory === 'all' ? faqs : faqs.filter(f => f.cat === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
    }
    return items;
  }, [activeCategory, searchQuery]);

  const toggle = (idx) => setOpenFaq(openFaq === idx ? null : idx);

  const catCount = (id) => id === 'all' ? faqs.length : faqs.filter(f => f.cat === id).length;

  const handleVote = (key, vote) => {
    setVotes(prev => ({ ...prev, [key]: vote }));
  };

  return (
    <div className="faq-page">
      {/* Background */}
      <div className="faq-bg">
        <div className="faq-orb faq-orb-1" />
        <div className="faq-orb faq-orb-2" />
      </div>

      {/* ── HERO ── */}
      <section className="faq-hero">
        <motion.div
          className="faq-hero-content"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="faq-badge">
            <FiHelpCircle /> FREQUENTLY ASKED QUESTIONS
          </span>
          <h1 className="faq-title">
            Got <span className="text-gradient">Questions?</span><br />
            We've got answers.
          </h1>
          <p className="faq-subtitle">
            Everything you need to know about MedAstraX — appointments, pharmacy, payments, AI features, and more.
          </p>

          {/* Search */}
          <div className="faq-search-bar">
            <FiSearch className="faq-search-icon" />
            <input
              id="faq-search"
              type="text"
              placeholder="Search questions…"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setOpenFaq(null); }}
              className="faq-search-input"
            />
            {searchQuery && (
              <button className="faq-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          {/* Stats row */}
          <div className="faq-stats-row">
            <div className="faq-stat"><span className="faq-stat-num">{faqs.length}+</span><span>Questions answered</span></div>
            <div className="faq-stat-divider" />
            <div className="faq-stat"><span className="faq-stat-num">{categories.length - 1}</span><span>Topic categories</span></div>
            <div className="faq-stat-divider" />
            <div className="faq-stat"><span className="faq-stat-num">24/7</span><span>Live support backup</span></div>
          </div>
        </motion.div>
      </section>

      {/* ── BODY ── */}
      <div className="faq-body">

        {/* Left — Category Sidebar */}
        <aside className="faq-sidebar">
          <h3 className="faq-sidebar-title">Categories</h3>
          <nav className="faq-cat-nav">
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`faq-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => { setActiveCategory(cat.id); setOpenFaq(null); }}
              >
                <span className="faq-cat-icon">{cat.icon}</span>
                <span className="faq-cat-label">{cat.label}</span>
                <span className="faq-cat-badge">{catCount(cat.id)}</span>
              </button>
            ))}
          </nav>

          {/* Still need help box */}
          <div className="faq-help-box">
            <div className="faq-help-icon"><FiAlertCircle /></div>
            <h4>Still confused?</h4>
            <p>Our support team is ready to help you right away.</p>
            <Link to="/support" className="faq-help-btn">
              Contact Support <FiArrowRight />
            </Link>
          </div>
        </aside>

        {/* Right — FAQ List */}
        <main className="faq-main">

          {/* Result header */}
          <div className="faq-result-header">
            <h2 className="faq-result-title">
              {searchQuery
                ? <>Results for "<span className="text-gradient">{searchQuery}</span>"</>
                : categories.find(c => c.id === activeCategory)?.label
              }
            </h2>
            <span className="faq-result-count">{filtered.length} question{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? (
            <motion.div
              className="faq-empty glass-card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <FiSearch size={36} style={{ color: 'var(--primary)', opacity: 0.5 }} />
              <h3>No results found</h3>
              <p>Try different keywords or <Link to="/support" className="faq-inline-link">contact our support team</Link>.</p>
            </motion.div>
          ) : (
            <motion.div
              className="faq-accordion"
              key={activeCategory + searchQuery}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {filtered.map((item, idx) => {
                const isOpen = openFaq === idx;
                const catInfo = categories.find(c => c.id === item.cat);
                return (
                  <div
                    key={idx}
                    className={`faq-accordion-item ${isOpen ? 'open' : ''}`}
                  >
                    <button
                      className="faq-accordion-trigger"
                      onClick={() => toggle(idx)}
                      id={`faq-item-${idx}`}
                    >
                      <div className="faq-q-left">
                        <span className={`faq-q-num`}>{String(idx + 1).padStart(2, '0')}</span>
                        <span className="faq-q-text">{item.q}</span>
                      </div>
                      <div className="faq-q-right">
                        {activeCategory === 'all' && (
                          <span className={`faq-q-cat-tag cat-${item.cat}`}>
                            {catInfo?.icon} {catInfo?.label}
                          </span>
                        )}
                        <span className="faq-chevron">
                          {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                        </span>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          className="faq-accordion-body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: 'easeInOut' }}
                        >
                          <p className="faq-answer-text">{item.a}</p>
                          <div className="faq-answer-footer">
                            {votes[`${activeCategory}-${idx}`] ? (
                              <motion.span
                                className="faq-voted-msg"
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                              >
                                {votes[`${activeCategory}-${idx}`] === 'yes'
                                  ? '🎉 Thanks for your feedback!'
                                  : '🙏 Sorry to hear that! Try contacting support.'}
                              </motion.span>
                            ) : (
                              <>
                                <span>Was this helpful?</span>
                                <button
                                  className={`faq-helpful-btn ${
                                    votes[`${activeCategory}-${idx}`] === 'yes' ? 'voted-yes' : ''
                                  }`}
                                  onClick={() => handleVote(`${activeCategory}-${idx}`, 'yes')}
                                >
                                  👍 Yes
                                </button>
                                <button
                                  className={`faq-helpful-btn ${
                                    votes[`${activeCategory}-${idx}`] === 'no' ? 'voted-no' : ''
                                  }`}
                                  onClick={() => handleVote(`${activeCategory}-${idx}`, 'no')}
                                >
                                  👎 No
                                </button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
