import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiChevronDown, FiChevronUp,
  FiCalendar, FiVideo, FiShield, FiPackage,
  FiUser, FiFileText, FiMail, FiPhone,
  FiMessageSquare, FiAlertCircle, FiHeart,
  FiArrowRight
} from 'react-icons/fi';
import { FaUserMd, FaAmbulance, FaRobot } from 'react-icons/fa';
import './HelpCenterPage.css';

const categories = [
  { icon: <FiCalendar />, label: 'Appointments', color: 'hsl-blue', count: 8 },
  { icon: <FiVideo />, label: 'Teleconsult', color: 'hsl-purple', count: 5 },
  { icon: <FiPackage />, label: 'Medicines & Pharmacy', color: 'hsl-green', count: 6 },
  { icon: <FiFileText />, label: 'Prescriptions', color: 'hsl-coral', count: 7 },
  { icon: <FaUserMd />, label: 'Doctors & Clinics', color: 'hsl-orange', count: 9 },
  { icon: <FiShield />, label: 'Privacy & Security', color: 'hsl-teal', count: 4 },
  { icon: <FaAmbulance />, label: 'Emergency Services', color: 'hsl-red', count: 3 },
  { icon: <FaRobot />, label: 'AI Health Assistant', color: 'hsl-indigo', count: 6 },
];

const faqs = [
  {
    category: 'Appointments',
    items: [
      {
        q: 'How do I book an appointment on MedAstraX?',
        a: 'Log in to your patient account, go to the Hospitals section, search for a doctor or hospital, select an available slot, and confirm your booking. You\'ll receive a confirmation SMS and email instantly.'
      },
      {
        q: 'Can I reschedule or cancel my appointment?',
        a: 'Yes! Go to My Bookings, find the appointment you want to change, and click Reschedule or Cancel. Cancellations made more than 2 hours before the appointment are eligible for a full refund.'
      },
      {
        q: 'How do I know if my appointment is confirmed?',
        a: 'Once confirmed, you\'ll receive a notification on the app, an email, and an SMS with your appointment details including doctor name, clinic location, and time.'
      },
    ]
  },
  {
    category: 'Teleconsult',
    items: [
      {
        q: 'How does video consultation work?',
        a: 'Select a doctor who offers teleconsult, book a video slot, and at the scheduled time, join the session directly from your dashboard. No third-party app is needed — it runs in your browser.'
      },
      {
        q: 'What if my video call gets disconnected?',
        a: 'If you get disconnected, simply refresh your browser and rejoin. The session remains open for 10 minutes. If the issue persists, contact our support team and we\'ll arrange a free re-session.'
      },
    ]
  },
  {
    category: 'Medicines & Pharmacy',
    items: [
      {
        q: 'How are medicines delivered to my home?',
        a: 'After your doctor sends a prescription, you can choose a nearby pharmacy from the platform. Confirm the order and your medicines will be delivered within 2–4 hours in most cities.'
      },
      {
        q: 'Can I compare prices across pharmacies?',
        a: 'Yes, MedAstraX shows you available pharmacies near you along with their prices and estimated delivery time so you can choose the best option.'
      },
    ]
  },
  {
    category: 'Account & Privacy',
    items: [
      {
        q: 'Is my health data safe on MedAstraX?',
        a: 'Absolutely. All your health data is encrypted end-to-end and stored securely. We never share your data with third parties without your explicit consent. We comply with all applicable healthcare data protection regulations.'
      },
      {
        q: 'How do I update my profile or personal details?',
        a: 'Go to your dashboard, click on your profile icon, and select Edit Profile. You can update your name, contact information, health history, and more.'
      },
      {
        q: 'How do I delete my account?',
        a: 'To delete your account, go to Settings → Account → Delete Account. Please note this action is permanent and all your data will be removed within 30 days per our data retention policy.'
      },
    ]
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');

  const allItems = faqs.flatMap(f => f.items.map(item => ({ ...item, cat: f.category })));

  const filtered = searchQuery.trim()
    ? allItems.filter(item =>
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  const toggleFaq = (key) => setOpenFaq(openFaq === key ? null : key);

  return (
    <div className="help-page">
      {/* Background effects */}
      <div className="help-bg">
        <div className="help-orb help-orb-1" />
        <div className="help-orb help-orb-2" />
      </div>

      {/* ── HERO ── */}
      <section className="help-hero">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="help-hero-content"
        >
          <span className="help-badge">
            <FiHeart style={{ color: 'var(--primary)' }} /> HELP CENTER
          </span>
          <h1 className="help-title">
            How can we <span className="text-gradient">help you?</span>
          </h1>
          <p className="help-subtitle">
            Search our knowledge base, browse categories, or reach out to our team.
          </p>

          {/* Search bar */}
          <div className="help-search-bar">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search for appointments, prescriptions, teleconsult…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="help-search-input"
              id="help-search"
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
        </motion.div>
      </section>

      <div className="help-container">

        {/* ── SEARCH RESULTS ── */}
        {filtered && (
          <section className="help-search-results">
            <h3 className="results-heading">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "<span className="text-gradient">{searchQuery}</span>"
            </h3>
            {filtered.length === 0 ? (
              <div className="no-results glass-card">
                <FiAlertCircle size={32} style={{ color: 'var(--primary)' }} />
                <p>No articles found. Try different keywords or <Link to="/contact" className="inline-link">contact support</Link>.</p>
              </div>
            ) : (
              <div className="faq-list">
                {filtered.map((item, i) => {
                  const key = `search-${i}`;
                  return (
                    <div key={key} className="faq-item glass-card">
                      <button className="faq-question" onClick={() => toggleFaq(key)}>
                        <span>{item.q}</span>
                        <span className="faq-cat-tag">{item.cat}</span>
                        {openFaq === key ? <FiChevronUp /> : <FiChevronDown />}
                      </button>
                      <AnimatePresence>
                        {openFaq === key && (
                          <motion.div
                            className="faq-answer"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            <p>{item.a}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── CATEGORIES ── */}
        {!filtered && (
          <>
            <section className="help-categories-section">
              <h2 className="section-title">Browse by Category</h2>
              <div className="categories-grid">
                {categories.map((cat, i) => (
                  <motion.button
                    key={i}
                    className={`category-card glass-card ${activeCategory === cat.label ? 'active' : ''}`}
                    onClick={() => setActiveCategory(activeCategory === cat.label ? 'All' : cat.label)}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className={`cat-icon-box ${cat.color}`}>{cat.icon}</div>
                    <span className="cat-label">{cat.label}</span>
                    <span className="cat-count">{cat.count} articles</span>
                  </motion.button>
                ))}
              </div>
            </section>

            {/* ── FAQs ── */}
            <section className="help-faq-section">
              <h2 className="section-title">
                {activeCategory === 'All' ? 'Frequently Asked Questions' : activeCategory}
              </h2>

              {faqs
                .filter(f => activeCategory === 'All' || f.category === activeCategory ||
                  (activeCategory === 'Account & Privacy' && f.category === 'Account & Privacy'))
                .map((group) => (
                  <div key={group.category} className="faq-group">
                    {activeCategory === 'All' && (
                      <h4 className="faq-group-heading">{group.category}</h4>
                    )}
                    <div className="faq-list">
                      {group.items.map((item, idx) => {
                        const key = `${group.category}-${idx}`;
                        return (
                          <div key={key} className="faq-item glass-card">
                            <button className="faq-question" onClick={() => toggleFaq(key)}>
                              <span>{item.q}</span>
                              {openFaq === key ? <FiChevronUp /> : <FiChevronDown />}
                            </button>
                            <AnimatePresence>
                              {openFaq === key && (
                                <motion.div
                                  className="faq-answer"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                >
                                  <p>{item.a}</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </section>
          </>
        )}

        {/* ── STILL NEED HELP ── */}
        <section className="help-support-section">
          <h2 className="section-title">Still need help?</h2>
          <div className="support-cards-grid">
            <div className="support-card glass-card">
              <div className="support-icon-box support-coral">
                <FiMail />
              </div>
              <h4>Email Support</h4>
              <p>Send us a message and we'll reply within 24 hours.</p>
              <Link to="/contact" className="support-action-btn">
                Send Email <FiArrowRight />
              </Link>
            </div>

            <div className="support-card glass-card">
              <div className="support-icon-box support-purple">
                <FiPhone />
              </div>
              <h4>Call Us</h4>
              <p>Speak to our support team Mon–Sat, 9 AM – 6 PM.</p>
              <a href="tel:+9179887XXXXX" className="support-action-btn">
                +91 79887XXXXX <FiArrowRight />
              </a>
            </div>

            <div className="support-card glass-card">
              <div className="support-icon-box support-green">
                <FiMessageSquare />
              </div>
              <h4>Live Chat</h4>
              <p>Chat with our AI assistant or a live agent instantly.</p>
              <button className="support-action-btn" onClick={() => alert('Live chat coming soon!')}>
                Start Chat <FiArrowRight />
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
