import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSend, FiMail, FiPhone, FiMessageSquare,
  FiCheckCircle, FiClock, FiAlertCircle,
  FiSearch, FiArrowRight, FiHeadphones,
  FiZap, FiShield, FiRefreshCw, FiUser,
  FiFileText, FiCalendar, FiPackage
} from 'react-icons/fi';
import { FaRobot } from 'react-icons/fa';
import './SupportPage.css';

const quickHelps = [
  { icon: <FiCalendar />, label: 'Cancel / Reschedule Appointment', color: 'qh-blue', link: '/help' },
  { icon: <FiPackage />, label: 'Track Medicine Delivery', color: 'qh-green', link: '/help' },
  { icon: <FiFileText />, label: 'Download Prescription', color: 'qh-purple', link: '/help' },
  { icon: <FiRefreshCw />, label: 'Payment Refund Status', color: 'qh-coral', link: '/help' },
  { icon: <FiUser />, label: 'Update Profile Details', color: 'qh-orange', link: '/help' },
  { icon: <FiShield />, label: 'Account Security Issue', color: 'qh-red', link: '/help' },
];

const statusMap = {
  'TKT-1001': { status: 'Resolved', label: 'Your issue has been resolved.', color: 'resolved' },
  'TKT-1042': { status: 'In Progress', label: 'Our team is actively working on this.', color: 'progress' },
  'TKT-1078': { status: 'Pending', label: "Ticket received. We'll respond within 24 hrs.", color: 'pending' },
};

const PURPOSES = [
  'Select a category',
  'Appointment Issue',
  'Payment / Refund',
  'Medicine Delivery',
  'Prescription Problem',
  'Account / Login Issue',
  'Technical Bug',
  'Doctor / Clinic Query',
  'Emergency Assistance',
  'Other',
];

export default function SupportPage() {
  const [form, setForm] = useState({ name: '', email: '', category: '', subject: '', message: '', priority: 'Normal' });
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [trackInput, setTrackInput] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = e => {
    e.preventDefault();
    const id = 'TKT-' + Math.floor(1000 + Math.random() * 9000);
    setTicketId(id);
    setSubmitted(true);
    setForm({ name: '', email: '', category: '', subject: '', message: '', priority: 'Normal' });
  };

  const handleTrack = e => {
    e.preventDefault();
    const result = statusMap[trackInput.toUpperCase().trim()];
    if (result) {
      setTrackResult(result);
      setTrackError(false);
    } else {
      setTrackResult(null);
      setTrackError(true);
    }
  };

  return (
    <div className="support-page">
      {/* Background */}
      <div className="support-bg">
        <div className="sup-orb sup-orb-1" />
        <div className="sup-orb sup-orb-2" />
        <div className="sup-orb sup-orb-3" />
      </div>

      {/* ── HERO ── */}
      <section className="sup-hero">
        <motion.div
          className="sup-hero-content"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="sup-badge">
            <FiHeadphones style={{ color: 'var(--primary)' }} /> 24/7 SUPPORT
          </span>
          <h1 className="sup-title">
            We're here <span className="text-gradient">for you</span>
          </h1>
          <p className="sup-subtitle">
            Get instant help, raise a support ticket, or track your existing request — all in one place.
          </p>

          {/* Channel Pills */}
          <div className="sup-channel-pills">
            <a href="mailto:support@demo.com" className="channel-pill pill-coral">
              <FiMail /> Email Us
            </a>
            <a href="tel:+9179887XXXXX" className="channel-pill pill-purple">
              <FiPhone /> +91 79887XXXXX
            </a>
            <button className="channel-pill pill-green" onClick={() => alert('Live chat coming soon!')}>
              <FiMessageSquare /> Live Chat
            </button>
            <Link to="/help" className="channel-pill pill-blue">
              <FiSearch /> Help Center
            </Link>
          </div>
        </motion.div>
      </section>

      <div className="sup-container">

        {/* ── QUICK HELP CARDS ── */}
        <section className="sup-quick-section">
          <h2 className="sup-section-title">Quick Help</h2>
          <p className="sup-section-sub">Common issues — click to read the guide</p>
          <div className="quick-grid">
            {quickHelps.map((item, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <Link to={item.link} className={`quick-card glass-card ${item.color}`}>
                  <div className="quick-icon">{item.icon}</div>
                  <span className="quick-label">{item.label}</span>
                  <FiArrowRight className="quick-arrow" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── MAIN GRID: Ticket Form + Sidebar ── */}
        <section className="sup-main-grid">

          {/* LEFT — Ticket Form */}
          <div className="sup-form-col">
            <div className="sup-form-card glass-card">
              <div className="sup-form-header">
                <div className="sup-form-icon"><FiSend /></div>
                <div>
                  <h3 className="sup-form-title">Submit a Support Ticket</h3>
                  <p className="sup-form-sub">We'll respond within 24 hours on business days.</p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    className="sup-success"
                    initial={{ scale: 0.88, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="sup-success-icon"><FiCheckCircle /></div>
                    <h3>Ticket Raised!</h3>
                    <p>Your ticket ID is</p>
                    <div className="ticket-id-badge">{ticketId}</div>
                    <p className="success-note">Save this ID to track your ticket status below.</p>
                    <button className="sup-new-btn" onClick={() => setSubmitted(false)}>
                      Raise Another Ticket
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    className="sup-form"
                    onSubmit={handleSubmit}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    id="support-ticket-form"
                  >
                    <div className="sup-form-row">
                      <div className="form-group">
                        <label className="sup-label"><FiUser /> Your Name</label>
                        <input name="name" type="text" value={form.name} onChange={handleChange}
                          placeholder="John Doe" required className="sup-input" id="sup-name" />
                      </div>
                      <div className="form-group">
                        <label className="sup-label"><FiMail /> Email Address</label>
                        <input name="email" type="email" value={form.email} onChange={handleChange}
                          placeholder="john@example.com" required className="sup-input" id="sup-email" />
                      </div>
                    </div>

                    <div className="sup-form-row">
                      <div className="form-group">
                        <label className="sup-label"><FiMessageSquare /> Category</label>
                        <select name="category" value={form.category} onChange={handleChange}
                          required className="sup-select" id="sup-category">
                          {PURPOSES.map((p, i) => (
                            <option key={i} value={i === 0 ? '' : p} disabled={i === 0}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="sup-label"><FiZap /> Priority</label>
                        <select name="priority" value={form.priority} onChange={handleChange}
                          className="sup-select" id="sup-priority">
                          <option>Low</option>
                          <option>Normal</option>
                          <option>High</option>
                          <option>Urgent</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="sup-label"><FiFileText /> Subject</label>
                      <input name="subject" type="text" value={form.subject} onChange={handleChange}
                        placeholder="Brief description of your issue" required className="sup-input" id="sup-subject" />
                    </div>

                    <div className="form-group">
                      <label className="sup-label"><FiMessageSquare /> Describe your issue</label>
                      <textarea name="message" value={form.message} onChange={handleChange}
                        placeholder="Please provide as much detail as possible so we can help you faster…"
                        required rows={5} className="sup-textarea" id="sup-message" />
                    </div>

                    <button type="submit" className="sup-submit-btn">
                      <FiSend /> Submit Ticket
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT — Sidebar */}
          <div className="sup-sidebar">

            {/* Ticket Tracker */}
            <div className="tracker-card glass-card">
              <div className="tracker-header">
                <div className="tracker-icon"><FiSearch /></div>
                <div>
                  <h4>Track Your Ticket</h4>
                  <p>Enter your ticket ID to check status</p>
                </div>
              </div>
              <form className="tracker-form" onSubmit={handleTrack} id="ticket-tracker-form">
                <input
                  type="text"
                  value={trackInput}
                  onChange={e => { setTrackInput(e.target.value); setTrackResult(null); setTrackError(false); }}
                  placeholder="e.g. TKT-1042"
                  className="sup-input"
                  id="tracker-input"
                />
                <button type="submit" className="tracker-btn">Track</button>
              </form>

              <AnimatePresence>
                {trackResult && (
                  <motion.div
                    className={`track-result track-${trackResult.color}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="track-status-row">
                      {trackResult.color === 'resolved' && <FiCheckCircle />}
                      {trackResult.color === 'progress' && <FiRefreshCw />}
                      {trackResult.color === 'pending'  && <FiClock />}
                      <span className="track-status-label">{trackResult.status}</span>
                    </div>
                    <p>{trackResult.label}</p>
                  </motion.div>
                )}
                {trackError && (
                  <motion.div
                    className="track-result track-error"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="track-status-row"><FiAlertCircle /> <span>Not Found</span></div>
                    <p>No ticket found with this ID. Please check and try again.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="tracker-demo-note">
                Demo IDs to try: <code>TKT-1001</code>, <code>TKT-1042</code>, <code>TKT-1078</code>
              </p>
            </div>

            {/* Contact Card */}
            <div className="sup-contact-card glass-card">
              <h4>Need instant help?</h4>
              <p>Our team is available Mon–Sat, 9 AM – 6 PM. For emergencies, call us anytime.</p>
              <a href="tel:+9179887XXXXX" className="sup-call-btn">
                <FiPhone /> +91 79887XXXXX
              </a>
              <a href="mailto:support@demo.com" className="sup-email-btn">
                <FiMail /> support@demo.com
              </a>
            </div>

            {/* AI Bot Card */}
            <div className="sup-ai-card glass-card">
              <div className="ai-card-icon"><FaRobot /></div>
              <h4>Try our AI Assistant</h4>
              <p>Get instant answers to common queries — available 24/7 even offline.</p>
              <button className="sup-ai-btn" onClick={() => alert('AI Assistant coming soon!')}>
                <FiZap /> Ask AI Assistant
              </button>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
