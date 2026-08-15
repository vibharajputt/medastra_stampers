import { motion } from 'framer-motion';
import { 
  FiCalendar, 
  FiFileText, 
  FiActivity, 
  FiClipboard, 
  FiMic, 
  FiFolder,
  FiHeart
} from 'react-icons/fi';
import { 
  FaPills, 
  FaMicroscope, 
  FaAmbulance, 
  FaRobot, 
  FaHospital, 
  FaStethoscope,
  FaTrophy
} from 'react-icons/fa';
import './AboutPage.css';
import ScrollReveal from '../components/common/ScrollReveal';

// ── Animation Variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.65, ease: 'easeOut', delay: i * 0.1 }
  })
};

const fadeLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } }
};

const fadeRight = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 28, opacity: 0, scale: 0.95 },
  visible: {
    y: 0, opacity: 1, scale: 1,
    transition: { duration: 0.55, ease: 'easeOut' }
  }
};
// ─────────────────────────────────────────────────────────────────────────────

export default function AboutPage() {

  const capabilities = [
    {
      title: "Consultation",
      description: "Book verified doctors and hospitals, online or offline.",
      icon: <FiCalendar />,
      class: "icon-consultation"
    },
    {
      title: "Smart Prescription",
      description: "AI sends your prescription to the right place automatically.",
      icon: <FiFileText />,
      class: "icon-prescription"
    },
    {
      title: "Pharmacy",
      description: "Compare nearby pharmacies and get medicines delivered.",
      icon: <FaPills />,
      class: "icon-pharmacy"
    },
    {
      title: "Diagnostics",
      description: "Book lab tests and get digital reports online.",
      icon: <FaMicroscope />,
      class: "icon-diagnostics"
    },
    {
      title: "AI Health Triage",
      description: "AI reads your reports and flags how urgent it is.",
      icon: <FiActivity />,
      class: "icon-triage"
    },
    {
      title: "Personal Care Plans",
      description: "Get an AI diet, medicine and exercise plan with reminders.",
      icon: <FiClipboard />,
      class: "icon-careplans"
    },
    {
      title: "Recovery & Rewards",
      description: "Complete health tasks, earn points, unlock free offers.",
      icon: <FaTrophy />,
      class: "icon-rewards"
    },
    {
      title: "Emergency Response",
      description: "Find the nearest ambulance and an empty hospital bed.",
      icon: <FaAmbulance />,
      class: "icon-emergency"
    },
    {
      title: "Voice Assistant",
      description: "Talk to MedAstraX in your own language, anytime.",
      icon: <FiMic />,
      class: "icon-voice"
    },
    {
      title: "Offline Guardian Bot",
      description: "A pocket health bot that works even without internet.",
      icon: <FaRobot />,
      class: "icon-offline"
    },
    {
      title: "Health Record",
      description: "All your prescriptions and reports in one secure place.",
      icon: <FiFolder />,
      class: "icon-records"
    },
    {
      title: "For Partners",
      description: "Hospitals, pharmacies and labs grow with our network.",
      icon: <FaHospital />,
      class: "icon-partners"
    }
  ];

  return (
    <div className="about-page">
      {/* Animated background orbs */}
      <div className="about-bg-effects">
        <div className="bg-orb about-orb-1"></div>
        <div className="bg-orb about-orb-2"></div>
        <div className="about-orb-3"></div>
      </div>

      <div className="about-container">

        {/* ── Header ──────────────────────────────────────── */}
        <header className="about-header-section">
          <motion.h1
            className="about-title"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            About <span className="brand-med">Med</span><span className="brand-astra">Astra</span><span className="brand-x">X</span>
          </motion.h1>

          <motion.p
            className="about-intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: 'easeOut' }}
          >
            An all-in-one healthcare platform that connects doctors, pharmacies, labs, and an AI health assistant — so booking, medicines, tests, recovery, and emergencies all happen in one place. Powered by AI, available in your language, and built to work even offline. Every family's 24/7 health friend.
          </motion.p>

          {/* Animated heart icon below intro */}
          <motion.div
            className="about-heart-icon"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: 'spring', stiffness: 200 }}
          >
            <motion.div
              animate={{ scale: [1, 1.18, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <FiHeart />
            </motion.div>
          </motion.div>
        </header>

        {/* ── Mission Section ──────────────────────────────── */}
        <section className="about-mission-section">
          <ScrollReveal>
            <motion.div
              className="mission-card glass-card"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, margin: '-80px' }}
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 } } }}
            >
              <motion.div className="mission-content" variants={fadeLeft}>
                <h2 className="heading-md mission-heading">Our <span className="text-gradient">mission</span></h2>
                <p className="mission-text">
                  Our mission is to make quality healthcare reachable for every person — no matter where they live, what language they speak, or whether they have an internet connection.
                </p>
                <p className="mission-text">
                  We're uniting doctors, pharmacies, labs, and AI into one seamless platform, so getting care is never again slow, scattered, or out of reach. From a simple consultation to a life-saving emergency, we want every family to have trusted health support in their pocket, 24/7.
                </p>
              </motion.div>
              <motion.div className="mission-graphic-box" variants={fadeRight}>
                <motion.div
                  className="stethoscope-glow"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <FaStethoscope className="stethoscope-icon" />
                </motion.div>
              </motion.div>
            </motion.div>
          </ScrollReveal>
        </section>

        {/* ── What We Do ──────────────────────────────────── */}
        <section className="about-what-we-do-section">
          <motion.div
            className="section-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, margin: '-80px' }}
            variants={fadeUp}
          >
            <h2 className="heading-lg">What we <span className="text-gradient">do</span></h2>
            <p className="auth-subtitle">Four connected chambers, one health journey</p>
          </motion.div>

          <motion.div
            className="capabilities-grid"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.08 }}
          >
            {capabilities.map((cap, index) => (
              <motion.div
                key={index}
                className="capability-card glass-card"
                variants={itemVariants}
                custom={index}
                whileHover={{
                  y: -10,
                  scale: 1.03,
                  boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
                  transition: { duration: 0.22 }
                }}
              >
                <motion.div
                  className={`capability-icon-wrapper ${cap.class}`}
                  whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
                >
                  {cap.icon}
                </motion.div>
                <h3 className="capability-title">{cap.title}</h3>
                <p className="capability-desc">{cap.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </div>
    </div>
  );
}
