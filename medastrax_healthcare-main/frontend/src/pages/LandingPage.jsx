import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowRight,
  FiCalendar,
  FiShield,
  FiClock,
  FiVideo,
  FiFileText,
  FiTruck,
  FiSend,
  FiUser,
  FiMail,
  FiPhone,
  FiMessageSquare,
  FiMapPin,
  FiHeadphones
} from 'react-icons/fi';
import { FaUserMd, FaUser, FaStore } from 'react-icons/fa';
import doctorPatientImg from '../assets/doctor-patient.png';
import drAdityaImg from '../assets/dr-aditya.png';
import medastraxLogo from '../assets/medastrax-logo.png';
import './LandingPage.css';
import './ContactPage.css';
import ScrollReveal from '../components/common/ScrollReveal';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, ease: 'easeOut', delay: i * 0.12 }
  })
};

const fadeLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: 'easeOut' } }
};

const fadeRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: 'easeOut' } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: (i = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 0.55, ease: 'easeOut', delay: i * 0.1 }
  })
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.13 }
  }
};

const itemVariants = {
  hidden: { y: 32, opacity: 0 },
  visible: {
    y: 0, opacity: 1,
    transition: { duration: 0.6, ease: 'easeOut' }
  }
};

export default function LandingPage() {
  const [contactDetails, setContactDetails] = useState({ name: '', email: '', phone: '', purpose: '', message: '' });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleContactChange = (e) => {
    let value = e.target.value;
    if (e.target.name === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    setContactDetails({ ...contactDetails, [e.target.name]: value });
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (contactDetails.phone.length !== 10) {
      alert('Phone number must be exactly 10 digits.');
      return;
    }
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 4000);
    setContactDetails({ name: '', email: '', phone: '', purpose: '', message: '' });
  };

  const cards = [
    {
      title: "For Patients",
      description: "Book appointments instantly. Choose between in-person hospital visits or remote video consultations, secure your slots, and manage your health records in a central dashboard.",
      link: "/login",
      icon: <FaUser />,
      color: "var(--primary)",
      actionText: "Access Patient Portal"
    },
    {
      title: "For Doctors",
      description: "Manage your practice. Add clinics/hospitals, adjust consult sitting rates, update available beds in real-time, and run telemedicine checkups without friction.",
      link: "/login",
      icon: <FaUserMd />,
      color: "var(--secondary)",
      actionText: "Access Doctor Console"
    },
    {
      title: "For Pharmacies",
      description: "Process prescriptions instantly. Dispense medicines, check digital logs, manage active queues, and streamline billing details in one unified platform.",
      link: "/login",
      icon: <FaStore />,
      color: "var(--primary-dark)",
      actionText: "Access Pharmacy Desk"
    }
  ];

  const stats = [
    { icon: <FaUser />, number: "10,000+", label: "Patients Served", cls: "stat-pink" },
    { icon: <FaUserMd />, number: "500+", label: "Doctors", cls: "stat-purple" },
    { icon: <FaStore />, number: "100+", label: "Hospitals", cls: "stat-orange" },
    { icon: <FiClock />, number: "24/7", label: "Support", cls: "stat-green" },
  ];

  const features = [
    { icon: <FiCalendar />, title: "Slot Allocation", desc: "Fetches real-time appointments dynamically based on doctor timetables to avoid double-bookings." },
    { icon: <FiVideo />, title: "Telehealth Ready", desc: "Conduct consultation checkups securely via browser-based video calls from any device." },
    { icon: <FiShield />, title: "Secure Payments", desc: "Integrates with Razorpay test mode payment validation with cryptographic HMAC signature verification." },
    { icon: <FiClock />, title: "Instant Statuses", desc: "Real-time booking cancellations and instant transaction refund status displays." },
  ];

  const processSteps = [
    { icon: <FiCalendar />, title: "Book Appointment", desc: "Choose a doctor and schedule your visit", cls: "step-1" },
    { icon: <FiVideo />, title: "Consult & Connect", desc: "Talk to your doctor via chat or video call", cls: "step-2" },
    { icon: <FiFileText />, title: "Get Prescription", desc: "Receive digital prescriptions and medical advice", cls: "step-3" },
    { icon: <FiTruck />, title: "Get Care Delivered", desc: "Medicines and reports delivered to your door", cls: "step-4" },
  ];

  return (
    <div className="landing-page">
      <div className="landing-bg-effects">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      <section className="hero-section" id="home">
        <motion.div
          className="hero-content"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.span className="badge badge-primary hero-badge" variants={fadeUp} custom={0}>
            <span className="badge-dot"></span> UNIFIED HEALTHCARE PLATFORM
          </motion.span>

          <motion.h1 className="hero-title" variants={fadeUp} custom={1}>
            Care that connects.<br />
            Technology that <span className="text-accent">heals.</span>
          </motion.h1>

          <motion.p className="hero-subtitle" variants={fadeUp} custom={2}>
            MedAstraX bridges patients, doctors, and pharmacies together. Book appointments, manage records, and get care — all in one secure platform.
          </motion.p>

          <motion.div className="hero-actions" variants={fadeUp} custom={3}>
            <Link to="/login" className="btn btn-primary btn-lg">
              Get Started Now <FiArrowRight />
            </Link>
            <Link to="/signup" className="btn btn-ghost btn-lg">
              Explore Features
            </Link>
          </motion.div>

          <motion.div
            className="hero-stats-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {stats.map((s, i) => (
              <motion.div
                key={i}
                className="stat-item"
                variants={scaleIn}
                custom={i}
                whileHover={{ scale: 1.06, transition: { duration: 0.2 } }}
              >
                <div className={`stat-icon-wrapper ${s.cls}`}>{s.icon}</div>
                <div className="stat-info">
                  <span className="stat-number">{s.number}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.9, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
        >
          <div className="doctor-patient-visual-container">
            <div className="doctor-patient-glow"></div>
            <motion.div
              className="image-frame"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img src={doctorPatientImg} alt="Empathetic Doctor Patient Interaction" className="doctor-patient-photo" />
            </motion.div>

            <motion.div
              className="floating-card secure-card"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              whileHover={{ scale: 1.05 }}
            >
              <div className="secure-icon-box"><FiShield /></div>
              <div className="secure-text-box">
                <span className="secure-heading">100% Secure</span>
                <span className="secure-caption">Your data is protected</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section className="care-simple-section" id="how-it-works">
        <motion.div
          className="section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-80px' }}
          variants={fadeUp}
        >
          <h2 className="heading-lg">Care made <span className="text-gradient">simple</span></h2>
          <p className="auth-subtitle">From booking to recovery, we make every step of your healthcare journey seamless.</p>
        </motion.div>

        <div className="process-timeline-container">
          <div className="process-timeline-line"></div>
          <motion.div
            className="process-timeline-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: '-60px' }}
          >
            {processSteps.map((step, i) => (
              <motion.div
                key={i}
                className="process-step-item"
                variants={fadeUp}
                custom={i}
                whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
              >
                <div className={`process-icon-box ${step.cls}`}>{step.icon}</div>
                <h4 className="process-step-title">{step.title}</h4>
                <p className="process-step-desc">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="portal-section">
        <motion.div
          className="section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-80px' }}
          variants={fadeUp}
        >
          <h2 className="heading-lg">Select Your <span className="text-gradient">Portal</span></h2>
          <p className="auth-subtitle">Login or register to get customized access based on your profile.</p>
        </motion.div>

        <motion.div
          className="portal-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-100px' }}
        >
          {cards.map((card, i) => (
            <motion.div
              key={i}
              className="glass-card portal-card"
              variants={itemVariants}
              whileHover={{ y: -10, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', transition: { duration: 0.25 } }}
            >
              <div className="portal-card-icon" style={{ background: card.color + '15', color: card.color }}>
                {card.icon}
              </div>
              <h3 className="heading-sm">{card.title}</h3>
              <p className="portal-card-desc">{card.description}</p>
              <Link to={card.link} className="btn btn-ghost portal-card-btn" style={{ borderColor: card.color + '30', color: card.color }}>
                {card.actionText} <FiArrowRight />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="features-section" id="about">
        <motion.div
          className="section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-80px' }}
          variants={fadeUp}
        >
          <h2 className="heading-lg">Built for <span className="text-gradient">Modern Care</span></h2>
          <p className="auth-subtitle">Optimized features engineered for healthcare speed and accessibility.</p>
        </motion.div>

        <motion.div
          className="features-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-60px' }}
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="feature-item glass-card"
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.22 } }}
            >
              <div className="feature-icon-wrapper">{f.icon}</div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="testimonial-section">
        <motion.div
          className="section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-80px' }}
          variants={fadeUp}
        >
          <h2 className="heading-lg">What Our Clients <span className="text-gradient">Say</span></h2>
          <p className="auth-subtitle">Stories from healthcare institutions that have transformed their operations with MedAstraX</p>
        </motion.div>

        <div className="testimonial-container glass-card">
          <motion.div
            className="testimonial-left"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: '-60px' }}
            variants={fadeLeft}
          >
            <div className="client-image-wrapper">
              <img src={drAdityaImg} alt="Dr. Aditya Sharma" className="client-image" />
              <div className="quote-badge"><span>"</span></div>
            </div>
            <div className="client-meta">
              <h4 className="client-org">Oxford Hospital</h4>
              <span className="client-name">Dr. Aditya Sharma</span>
              <span className="client-role">Chief Intervention Cardiologist & Diabetologist</span>
            </div>
          </motion.div>

          <motion.div
            className="testimonial-right"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: '-60px' }}
            variants={fadeRight}
          >
            <div className="large-quote-icon">"</div>
            <motion.p
              className="testimonial-quote-text"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              viewport={{ once: false }}
            >
              "MedAstraX is redefining how healthcare should work in India. Their innovative platforms like Hospital+ and DocAssist are not just improving operational efficiency but also bringing back the focus on patient care."
            </motion.p>
          </motion.div>
        </div>
      </section>

      <section className="contact-section-landing" id="contact">
        <motion.div
          className="contact-header"
          style={{ marginBottom: '48px' }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: false, margin: '-80px' }}
          variants={fadeUp}
        >
          <span className="contact-badge">
            <span className="badge-dot"></span> WE'RE HERE TO HELP
          </span>
          <h2 className="contact-title">
            Get in <span className="text-gradient">Touch!</span>
          </h2>
          <p className="contact-subtitle">
            Make Your Hospital Smarter, Faster and Better with Improved Patient Experience and Efficiency.
          </p>
          <p className="contact-reach">Reach out to us and we'll get back to you as soon as possible.</p>
        </motion.div>

        <div className="contact-body">
          <motion.div
            className="contact-info-panel"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: '-60px' }}
            variants={containerVariants}
          >
            {[
              { icon: <FiMapPin />, cls: 'info-icon-coral', title: 'Our Office', text: <>GBP Crest Road, Bhago Majra<br />Kharar, Punjab — 140301</> },
              { icon: <FiHeadphones />, cls: 'info-icon-purple', title: 'Support', text: <>support@demo.com<br />+91 79887XXXXX</> },
              { icon: <FiClock />, cls: 'info-icon-green', title: 'Working Hours', text: <>Mon – Sat: 9:00 AM – 6:00 PM<br />Emergency: 24 / 7</> },
            ].map((card, i) => (
              <motion.div
                key={i}
                className="contact-info-card glass-card"
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                <div className={`info-icon-box ${card.cls}`}>{card.icon}</div>
                <div className="info-text">
                  <h4>{card.title}</h4>
                  <p>{card.text}</p>
                </div>
              </motion.div>
            ))}
            <div className="contact-quote-box">
              <span className="contact-quote-mark">"</span>
              <p>Every family deserves trusted health support in their pocket, 24/7.</p>
              <span className="contact-quote-author">— MedAstraX</span>
            </div>
          </motion.div>

          <motion.div
            className="contact-form-panel"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            viewport={{ once: false, margin: '-60px' }}
          >
            <div className="contact-form-card glass-card">
              {showSuccess ? (
                <motion.div className="contact-success" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <div className="success-icon">✓</div>
                  <h3>Message Sent!</h3>
                  <p>Thank you for reaching out. We'll get back to you shortly.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleContactSubmit} className="contact-form" id="landing-contact-form">
                  {[
                    { id: 'lc-name', icon: <FiUser />, label: 'Name', type: 'text', name: 'name', val: contactDetails.name, ph: 'John Doe', req: true },
                    { id: 'lc-email', icon: <FiMail />, label: 'Email', type: 'email', name: 'email', val: contactDetails.email, ph: 'john@example.com', req: true },
                    { id: 'lc-phone', icon: <FiPhone />, label: 'Phone Number', type: 'tel', name: 'phone', val: contactDetails.phone, ph: '+1 (123) 456-7890', req: true },
                  ].map((f, i) => (
                    <motion.div
                      key={i}
                      className="form-group"
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.45 }}
                      viewport={{ once: false }}
                    >
                      <label htmlFor={f.id} className="form-label">{f.icon} {f.label}{!f.req && <span className="optional-tag"> (optional)</span>}</label>
                      <input id={f.id} type={f.type} name={f.name} value={f.val} onChange={handleContactChange} placeholder={f.ph} required={f.req} className="contact-input" />
                    </motion.div>
                  ))}
                  <motion.div className="form-group" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.45 }} viewport={{ once: false }}>
                    <label htmlFor="lc-purpose" className="form-label"><FiMessageSquare /> Purpose</label>
                    <select id="lc-purpose" name="purpose" value={contactDetails.purpose} onChange={handleContactChange} required className="contact-select">
                      <option value="" disabled>Select a purpose</option>
                      <option value="general">General Inquiry</option>
                      <option value="partnership">Partnership / B2B</option>
                      <option value="hospital">Hospital Onboarding</option>
                      <option value="pharmacy">Pharmacy Integration</option>
                      <option value="technical">Technical Support</option>
                      <option value="feedback">Feedback</option>
                      <option value="other">Other</option>
                    </select>
                  </motion.div>
                  <motion.div className="form-group" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, duration: 0.45 }} viewport={{ once: false }}>
                    <label htmlFor="lc-message" className="form-label"><FiMessageSquare /> Message</label>
                    <textarea id="lc-message" name="message" value={contactDetails.message} onChange={handleContactChange} placeholder="Type your message here..." required rows={5} className="contact-textarea" />
                  </motion.div>
                  <motion.button
                    type="submit"
                    className="contact-submit-btn"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <FiSend /> Send Message
                  </motion.button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-main">
          <div className="footer-brand-col">
            <div className="footer-logo-row">
              <img src={medastraxLogo} alt="MedAstraX" className="footer-logo-img" />
              <span className="footer-brand-name"><span className="brand-med">Med</span><span className="brand-astra">Astra</span><span className="brand-x">X</span></span>
            </div>
            <p className="footer-tagline">Making Quality Healthcare Accessible for Every Family.</p>
            <div className="footer-social-row">
              <a href="#" aria-label="Twitter" className="footer-social-btn">𝕏</a>
              <a href="#" aria-label="LinkedIn" className="footer-social-btn">in</a>
              <a href="#" aria-label="Instagram" className="footer-social-btn">ig</a>
            </div>
          </div>

          <div className="footer-link-col">
            <h5 className="footer-col-heading">Quick Links</h5>
            <ul className="footer-link-list">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact Us</Link></li>
              <li><Link to="/signup">Get Started</Link></li>
            </ul>
          </div>

          <div className="footer-link-col">
            <h5 className="footer-col-heading">Useful Links</h5>
            <ul className="footer-link-list">
              <li><a href="#">How it Works?</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Use</a></li>
              <li><a href="#">Refund Policy</a></li>
            </ul>
          </div>

          <div className="footer-link-col">
            <h5 className="footer-col-heading">Company</h5>
            <ul className="footer-link-list">
              <li><a href="#">Careers</a></li>
              <li><Link to="/help">Help Center</Link></li>
              <li><a href="#">Our Team</a></li>
              <li><Link to="/faq">FAQs</Link></li>
            </ul>
          </div>

          <div className="footer-link-col">
            <h5 className="footer-col-heading">Community</h5>
            <ul className="footer-link-list">
              <li><a href="#">Outreach</a></li>
              <li><Link to="/support">Support</Link></li>
              <li><a href="#">Campaigns</a></li>
              <li><a href="#">Partner Portal</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p>© 2025 MedAstraX Health IT Pvt. Ltd. All rights reserved.</p>
          <div className="footer-bottom-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Cookies</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
