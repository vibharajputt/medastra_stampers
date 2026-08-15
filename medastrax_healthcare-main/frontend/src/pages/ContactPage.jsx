import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiSend, FiUser, FiMail, FiPhone, FiMessageSquare, FiMapPin, FiClock, FiHeadphones } from 'react-icons/fi';
import './ContactPage.css';
import ScrollReveal from '../components/common/ScrollReveal';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, ease: 'easeOut', delay: i * 0.12 }
  })
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.13 }
  }
};

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    purpose: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (e) => {
    let value = e.target.value;
    if (e.target.name === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.phone && formData.phone.length > 0 && formData.phone.length !== 10) {
      alert('Phone number must be exactly 10 digits if you provide it.');
      return;
    }
    const apiBase = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
      : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8083/api'
        : 'https://mediverse-ke9x.onrender.com/api');
    
    const targetUrl = `${apiBase}/contact`;

    fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
      .then(async response => {
        if (response.ok) {
          setIsSubmitted(true);
          setTimeout(() => setIsSubmitted(false), 4000);
          setFormData({ name: '', email: '', phone: '', purpose: '', message: '' });
        } else {
          const data = await response.json().catch(() => null);
          const errMsg = data?.error || data?.message || 'Failed to send message.';
          alert(errMsg);
        }
      })
      .catch(error => {
        setIsSubmitted(true);
        setTimeout(() => setIsSubmitted(false), 4000);
        setFormData({ name: '', email: '', phone: '', purpose: '', message: '' });
      });
  };

  const infoCards = [
    { icon: <FiMapPin />, cls: 'info-icon-coral', title: 'Our Office', text: <>GBP Crest Road, Bhago Majra<br />Kharar, Punjab — 140301</> },
    { icon: <FiHeadphones />, cls: 'info-icon-purple', title: 'Support', text: <><a href="mailto:admin@medastrax.com" style={{color:'inherit'}}>admin@medastrax.com</a><br />+91 7527910223</> },
    { icon: <FiClock />, cls: 'info-icon-green', title: 'Working Hours', text: <>Mon – Sat: 9:00 AM – 6:00 PM<br />Emergency: 24 / 7</> },
  ];

  const formFields = [
    { id: 'contact-name', icon: <FiUser />, label: 'Name', type: 'text', name: 'name', val: formData.name, ph: 'John Doe', req: true },
    { id: 'contact-email', icon: <FiMail />, label: 'Email', type: 'email', name: 'email', val: formData.email, ph: 'john@example.com', req: true },
    { id: 'contact-phone', icon: <FiPhone />, label: 'Phone Number', type: 'tel', name: 'phone', val: formData.phone, ph: '+91 1234567890', req: true },
  ];

  return (
    <div className="contact-page">
      <div className="contact-bg-effects">
        <div className="contact-orb contact-orb-1"></div>
        <div className="contact-orb contact-orb-2"></div>
        <div className="contact-orb contact-orb-3"></div>
      </div>

      <div className="contact-container">

        <motion.div
          className="contact-header"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.span className="contact-badge" variants={fadeUp} custom={0}>
            <span className="badge-dot"></span> WE'RE HERE TO HELP
          </motion.span>
          <motion.h1 className="contact-title" variants={fadeUp} custom={1}>
            Get in <span className="text-gradient">Touch!</span>
          </motion.h1>
          <motion.p className="contact-subtitle" variants={fadeUp} custom={2}>
            Make Your Hospital Smarter, Faster and Better with Improved Patient Experience and Efficiency.
          </motion.p>
          <motion.p className="contact-reach" variants={fadeUp} custom={3}>
            Reach out to us and we'll get back to you as soon as possible.
          </motion.p>
        </motion.div>

        <ScrollReveal className="contact-body">
          <motion.div
            className="contact-info-panel"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: '-60px' }}
          >
            {infoCards.map((card, i) => (
              <motion.div
                key={i}
                className="contact-info-card glass-card"
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -7, scale: 1.02, transition: { duration: 0.22 } }}
              >
                <motion.div
                  className={`info-icon-box ${card.cls}`}
                  whileHover={{ rotate: [0, -15, 15, 0], transition: { duration: 0.4 } }}
                >
                  {card.icon}
                </motion.div>
                <div className="info-text">
                  <h4>{card.title}</h4>
                  <p>{card.text}</p>
                </div>
              </motion.div>
            ))}

            <motion.div
              className="contact-quote-box"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              viewport={{ once: false }}
            >
              <span className="contact-quote-mark">"</span>
              <p>Every family deserves trusted health support in their pocket, 24/7.</p>
              <span className="contact-quote-author">— MedAstraX</span>
            </motion.div>
          </motion.div>

          <motion.div
            className="contact-form-panel"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            viewport={{ once: false, margin: '-60px' }}
          >
            <div className="contact-form-card glass-card">
              {isSubmitted ? (
                <motion.div
                  className="contact-success"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 180 }}
                >
                  <motion.div
                    className="success-icon"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 0.6, repeat: 2 }}
                  >
                    ✓
                  </motion.div>
                  <h3>Message Sent!</h3>
                  <p>Thank you for reaching out. Our team will contact you within 24 hours.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form" id="contact-form">
                  {formFields.map((f, i) => (
                    <motion.div
                      key={i}
                      className="form-group"
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.09, duration: 0.45 }}
                      viewport={{ once: false }}
                    >
                      <label htmlFor={f.id} className="form-label">
                        {f.icon} {f.label}
                        {!f.req && <span className="optional-tag"> (optional)</span>}
                      </label>
                      <input
                        id={f.id}
                        type={f.type}
                        name={f.name}
                        value={f.val}
                        onChange={handleChange}
                        placeholder={f.ph}
                        required={f.req}
                        className="contact-input"
                      />
                    </motion.div>
                  ))}

                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.27, duration: 0.45 }}
                    viewport={{ once: false }}
                  >
                    <label htmlFor="contact-purpose" className="form-label">
                      <FiMessageSquare /> Purpose
                    </label>
                    <select
                      id="contact-purpose"
                      name="purpose"
                      value={formData.purpose}
                      onChange={handleChange}
                      required
                      className="contact-select"
                    >
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

                  <motion.div
                    className="form-group"
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.36, duration: 0.45 }}
                    viewport={{ once: false }}
                  >
                    <label htmlFor="contact-message" className="form-label">
                      <FiMessageSquare /> Message
                    </label>
                    <textarea
                      id="contact-message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Type your message here..."
                      required
                      rows={5}
                      className="contact-textarea"
                    />
                  </motion.div>

                  <motion.button
                    type="submit"
                    className="contact-submit-btn"
                    whileHover={{ scale: 1.04, boxShadow: '0 8px 30px rgba(29,158,117,0.35)' }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <FiSend /> Send Message
                  </motion.button>
                </form>
              )}
            </div>
          </motion.div>
        </ScrollReveal>
      </div>
    </div>
  );
}
