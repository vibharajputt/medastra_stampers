import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { authAPI, otpAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, FiRefreshCw, FiShield, FiX, FiCheck } from 'react-icons/fi';
import { FaUserMd, FaUser, FaStore, FaHospital, FaFlask } from 'react-icons/fa';
import { useGoogleLogin } from '@react-oauth/google';
import logo from '../assets/medastrax-logo.png';
import './Auth.css';

const generateCaptchaText = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let str = '';
  for (let i = 0; i < 6; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return { text: str, answer: str };
};

function CaptchaCanvas({ text }) {
  const canvasRef = useRef(null);
  const W = 260, H = 70;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#dce8e6');
    bg.addColorStop(1, '#d4dfe0');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 10);
    ctx.fill();

    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${100 + Math.random()*80|0},${120 + Math.random()*60|0},${120 + Math.random()*60|0},${0.12 + Math.random()*0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = `rgba(100,130,130,${0.15 + Math.random()*0.1})`;
      ctx.lineWidth = 0.8 + Math.random() * 0.6;
      ctx.beginPath();
      ctx.moveTo(-5, Math.random() * H);
      ctx.bezierCurveTo(W * 0.3, Math.random() * H, W * 0.7, Math.random() * H, W + 5, Math.random() * H);
      ctx.stroke();
    }

    const chars = text.split('');
    const darkColors = ['#000000', '#000000', '#000000', '#000000', '#000000', '#000000'];
    const fonts = ['Georgia', 'Courier New', 'Arial Black', 'Times New Roman', 'Palatino', 'Trebuchet MS'];
    const charWidth = (W - 50) / chars.length;
    const startX = 25 + charWidth / 2;

    chars.forEach((ch, i) => {
      ctx.save();
      const x = startX + i * charWidth;
      const y = H / 2 + (Math.random() - 0.5) * 10;
      ctx.translate(x, y);
      ctx.rotate((Math.random() - 0.5) * 0.4);

      const scale = 0.9 + Math.random() * 0.3;
      ctx.scale(scale, scale);

      const fontSize = 28 + Math.random() * 6 | 0;
      const fontFamily = fonts[Math.floor(Math.random() * fonts.length)];
      const isBold = Math.random() > 0.3;
      ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = darkColors[i % darkColors.length];
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });

    ctx.strokeStyle = 'rgba(80,100,100,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, H * 0.5 + (Math.random() - 0.5) * 16);
    ctx.lineTo(W - 20, H * 0.5 + (Math.random() - 0.5) * 16);
    ctx.stroke();
  }, [text]);

  return <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: '10px', display: 'block', width: '100%', height: 'auto' }} />;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState('PATIENT');
  const [rememberMe, setRememberMe] = useState(false);

  const [captcha, setCaptcha] = useState(generateCaptchaText);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState(false);

  const [show2FA, setShow2FA] = useState(false);
  const [otp2FA, setOtp2FA] = useState(['', '', '', '', '', '']);
  const [authData, setAuthData] = useState(null);
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [otpError, setOtpError] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState(['', '', '', '', '', '']);
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfPass, setForgotConfPass] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showForgotPass, setShowForgotPass] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('medastrax_remember_email');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const makeOtpHandler = (setter, errSetter) => (val, idx, boxes) => {
    if (!/^\d?$/.test(val)) return;
    setter(prev => { const n = [...prev]; n[idx] = val; return n; });
    if (errSetter) errSetter(false);
    if (val && idx < 5) document.getElementById(`${boxes}-${idx + 1}`)?.focus();
  };

  const makeOtpKeyDown = (getter) => (e, idx, boxes) => {
    if (e.key === 'Backspace' && !getter[idx] && idx > 0)
      document.getElementById(`${boxes}-${idx - 1}`)?.focus();
  };

  const handleOtpChange = (val, idx) => makeOtpHandler(setOtp2FA, setOtpError)(val, idx, 'otp-box');
  const handleOtpKeyDown = (e, idx) => makeOtpKeyDown(otp2FA)(e, idx, 'otp-box');
  const handleForgotOtpChange = (val, idx) => makeOtpHandler(setForgotOtp, null)(val, idx, 'fotp-box');
  const handleForgotOtpKeyDown = (e, idx) => makeOtpKeyDown(forgotOtp)(e, idx, 'fotp-box');

  const redirectByRole = (role) => {
    if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (role === 'DOCTOR') navigate('/doctor/dashboard');
    else if (role === 'PHARMACY') navigate('/pharmacy/dashboard');
    else if (role === 'HOSPITAL') navigate('/hospital/dashboard');
    else if (role === 'LAB') navigate('/lab/dashboard');
    else navigate('/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    if (captchaInput.trim().toLowerCase() !== captcha.answer.toLowerCase()) {
      setCaptchaError(true);
      setCaptcha(generateCaptchaText());
      setCaptchaInput('');
      toast.error('Incorrect CAPTCHA. Please try the new code.');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login({ email, password });

      if (rememberMe) {
        localStorage.setItem('medastrax_remember_email', email);
      } else {
        localStorage.removeItem('medastrax_remember_email');
      }

      setAuthData(response.data);
      setShow2FA(true);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerify = () => {
    const code = otp2FA.join('');
    if (code.length < 6) {
      setOtpError(true);
      toast.error('Please enter the full 6-digit code.');
      return;
    }

    setVerifying2FA(true);

    setTimeout(() => {
      if (code === '123456') {
        login(authData);
        toast.success(`Welcome back, ${authData.name}!`);
        redirectByRole(authData.role);
      } else {
        setOtpError(true);
        setOtp2FA(['', '', '', '', '', '']);
        document.getElementById('otp-box-0')?.focus();
        toast.error('Invalid 2FA code. Use 123456 for demo.');
      }
      setVerifying2FA(false);
    }, 900);
  };

  const openForgot = () => {
    setForgotEmail(''); setForgotOtp(['','','','','','']);
    setForgotNewPass(''); setForgotConfPass('');
    setForgotStep(1); setForgotLoading(false);
    setShowForgot(true);
  };

  const closeForgot = () => setShowForgot(false);

  const handleForgotSendOtp = async () => {
    if (!forgotEmail) { toast.error('Please enter your email.'); return; }
    setForgotLoading(true);
    try {
      await otpAPI.sendOtp(forgotEmail, 'EMAIL');
      toast.success('OTP sent to your email!');
      setForgotStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP.');
    } finally { setForgotLoading(false); }
  };

  const handleForgotVerifyOtp = async () => {
    const code = forgotOtp.join('');
    if (code.length < 6) { toast.error('Enter the full OTP.'); return; }
    setForgotLoading(true);
    try {
      await otpAPI.verifyOtp(forgotEmail, 'EMAIL', code);
      toast.success('OTP verified!');
      setForgotStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP.');
    } finally { setForgotLoading(false); }
  };

  const handleForgotReset = async () => {
    if (!forgotNewPass || forgotNewPass.length < 6) {
      toast.error('Password must be at least 6 characters.'); return;
    }
    if (forgotNewPass !== forgotConfPass) {
      toast.error('Passwords do not match.'); return;
    }
    setForgotLoading(true);
    try {
      await authAPI.resetPassword(forgotEmail, forgotNewPass);
      toast.success('Password reset successfully! Please log in.');
      closeForgot();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed.');
    } finally { setForgotLoading(false); }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const loadingToast = toast.loading('Signing in with Google...');
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await res.json();
        const response = await authAPI.googleLogin(profile.email);
        login(response.data);
        toast.success(`Welcome back, ${response.data.name}!`, { id: loadingToast, duration: 3000 });
        redirectByRole(response.data.role);
      } catch (error) {
        toast.error('Failed to sign in with Google.', { id: loadingToast, duration: 4000 });
      }
    },
    onError: () => {
      toast.error('Google sign-in was cancelled or failed.');
    },
    flow: 'implicit',
  });

  const handleGoogleLogin = () => googleLogin();

  const roles = [
    { key: 'PATIENT',  label: 'Patient',  icon: <FaUser />,     demo: 'patient@demo.com' },
    { key: 'DOCTOR',   label: 'Doctor',   icon: <FaUserMd />,   demo: 'doctor@demo.com' },
    { key: 'PHARMACY', label: 'Pharmacy', icon: <FaStore />,    demo: 'pharmacy@demo.com' },
    { key: 'HOSPITAL', label: 'Hospital', icon: <FaHospital />, demo: 'hospital@demo.com' },
    { key: 'LAB',      label: 'Lab',      icon: <FaFlask />,   demo: 'lab@demo.com' },
    { key: 'ADMIN',    label: 'Admin',    icon: <FiShield />,   demo: 'admin@demo.com' },
  ];

  const fillDemoCredentials = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-effects">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
        <div className="floating-icons">
          {['💊', '🏥', '🩺', '❤️', '🧬', '💉'].map((icon, i) => (
            <span key={i} className="floating-icon" style={{
              left: `${15 + i * 15}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${6 + i}s`
            }}>{icon}</span>
          ))}
        </div>
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="auth-header">
          <Link to="/" className="auth-logo">
            <img src={logo} alt="MedAstraX Logo" className="auth-logo-img" />
            <div className="brand-text-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
              <span className="brand-text"><span className="brand-med">Med</span><span className="brand-astra">Astra</span><span className="brand-x">X</span></span>
              <span className="brand-tagline" style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.4px', marginTop: '1px' }}>Innovate • Heal • Evolve</span>
            </div>
          </Link>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to continue to your health portal</p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            padding: '4px',
            gap: '4px',
            marginBottom: '28px'
          }}
        >
          {roles.map((role) => (
            <button
              key={role.key}
              type="button"
              className={`tab-item ${selectedRole === role.key ? 'active' : ''}`}
              style={{ borderRadius: 'var(--radius-md)', fontSize: '0.85rem', padding: '10px 8px' }}
              onClick={() => { setSelectedRole(role.key); fillDemoCredentials(role.demo); }}
            >
              {role.icon}
              <span style={{ marginLeft: '6px' }}>{role.label}</span>
            </button>
          ))}
        </div>

        <button className="google-login-btn" onClick={handleGoogleLogin} type="button">
          <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="auth-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="form-input-icon">
              <FiMail className="icon" />
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Password</label>
              <button type="button" className="forgot-password-link" onClick={openForgot}>Forgot password?</button>
            </div>
            <div className="form-input-icon">
              <FiLock className="icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '48px' }}
                autoComplete="current-password"
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div className="remember-me-row">
            <label className="remember-me-label">
              <div
                className={`custom-checkbox ${rememberMe ? 'checked' : ''}`}
                onClick={() => setRememberMe(!rememberMe)}
                role="checkbox"
                aria-checked={rememberMe}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && setRememberMe(!rememberMe)}
              >
                {rememberMe && <FiCheck size={12} />}
              </div>
              <span>Remember me</span>
            </label>
          </div>

          <div className={`captcha-block-clean ${captchaError ? 'captcha-error' : ''}`}>
            <div className="captcha-clean-header">
              <span className="captcha-clean-label">
                <FiShield size={12} /> Verify you're human
              </span>
              <button
                type="button"
                className="captcha-clean-refresh"
                onClick={() => { setCaptcha(generateCaptchaText()); setCaptchaInput(''); setCaptchaError(false); }}
                title="New CAPTCHA"
              >
                <FiRefreshCw size={13} />
              </button>
            </div>

            <div className="captcha-clean-canvas" data-captcha-value={captcha.text}>
              <CaptchaCanvas text={captcha.text} />
            </div>

            <div className="captcha-clean-input-wrap">
              <input
                type="text"
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                className={`captcha-clean-input ${captchaError ? 'error' : captchaInput ? 'has-value' : ''}`}
                placeholder="Type the characters above"
                value={captchaInput}
                onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
              />
              {captchaInput.trim().toLowerCase() === captcha.answer.toLowerCase() && (
                <div className="captcha-clean-tick"><FiCheck size={14} /></div>
              )}
            </div>

            {captchaError && (
              <p className="captcha-clean-error">Incorrect — try the new code above</p>
            )}
          </div>

          <motion.button
            type="submit"
            className="btn btn-primary btn-lg auth-submit"
            disabled={loading}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? <div className="spinner"></div> : <><span>Sign In</span><FiArrowRight /></>}
          </motion.button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">Create Account</Link>
          </p>
        </div>

        <div className="demo-credentials">
          <p className="demo-title">🎯 Quick Demo Access</p>
          <div className="demo-chips">
            {roles.map((role) => (
              <button key={role.key} type="button" className="demo-chip" onClick={() => fillDemoCredentials(role.demo)}>
                {role.icon}
                <span>{role.label}</span>
              </button>
            ))}
          </div>
          <p className="demo-hint">Password: <code>password123</code> &nbsp;|&nbsp; 2FA code: <code>123456</code></p>
        </div>
      </motion.div>

      <AnimatePresence>
        {show2FA && (
          <motion.div
            className="twofa-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="twofa-modal"
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            >
              <button className="twofa-close" onClick={() => { setShow2FA(false); setOtp2FA(['','','','','','']); setOtpError(false); }}>
                <FiX />
              </button>

              <div className="twofa-icon-ring">
                <FiShield size={28} />
              </div>

              <h2 className="twofa-title">Two-Factor Authentication</h2>
              <p className="twofa-subtitle">
                Enter the 6-digit verification code sent to your device.<br />
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Demo code: 123456</span>
              </p>

              <div className={`otp-boxes ${otpError ? 'otp-error' : ''}`}>
                {otp2FA.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-box-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-box ${digit ? 'filled' : ''} ${otpError ? 'error' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    onFocus={(e) => e.target.select()}
                    autoFocus={idx === 0}
                  />
                ))}
              </div>

              {otpError && (
                <p className="otp-error-msg">❌ Invalid code. Hint: use <strong>123456</strong></p>
              )}

              <motion.button
                className="btn btn-primary btn-lg twofa-verify-btn"
                onClick={handle2FAVerify}
                disabled={verifying2FA || otp2FA.join('').length < 6}
                whileTap={{ scale: 0.97 }}
              >
                {verifying2FA ? <div className="spinner"></div> : <><FiShield /><span>Verify &amp; Login</span></>}
              </motion.button>

              <p className="twofa-resend">
                Didn't get the code?{' '}
                <button
                  type="button"
                  className="twofa-resend-btn"
                  onClick={() => toast.success('Code resent! (Demo — use 123456)')}
                >
                  Resend code
                </button>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForgot && (
          <motion.div className="twofa-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="twofa-modal"
              initial={{ scale: 0.85, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 40 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              style={{ maxWidth: '440px' }}
            >
              <button className="twofa-close" onClick={closeForgot}><FiX /></button>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>
                {[1,2,3].map(s => (
                  <div key={s} style={{ width: s === forgotStep ? '28px' : '8px', height: '8px', borderRadius: '99px', background: s <= forgotStep ? 'var(--primary)' : 'var(--border-color)', transition: 'all 0.3s ease' }} />
                ))}
              </div>

              {forgotStep === 1 && (
                <>
                  <div className="twofa-icon-ring"><FiMail size={26} /></div>
                  <h2 className="twofa-title">Forgot Password?</h2>
                  <p className="twofa-subtitle">Enter your registered email and we will send you a verification code.</p>
                  <div className="form-input-icon" style={{ marginBottom: '16px', textAlign: 'left' }}>
                    <FiMail className="icon" />
                    <input type="email" className="form-input" placeholder="Enter your email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgotSendOtp()} autoFocus />
                  </div>
                  <motion.button className="btn btn-primary btn-lg twofa-verify-btn" onClick={handleForgotSendOtp} disabled={forgotLoading} whileTap={{ scale: 0.97 }}>
                    {forgotLoading ? <div className="spinner"></div> : <><FiArrowRight /><span>Send OTP</span></>}
                  </motion.button>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <div className="twofa-icon-ring"><FiShield size={26} /></div>
                  <h2 className="twofa-title">Enter OTP</h2>
                  <p className="twofa-subtitle">A 6-digit code was sent to <strong style={{ color: 'var(--primary)' }}>{forgotEmail}</strong></p>
                  <div className="otp-boxes">
                    {forgotOtp.map((digit, idx) => (
                      <input key={idx} id={`fotp-box-${idx}`} type="text" inputMode="numeric" maxLength={1} className={`otp-box ${digit ? 'filled' : ''}`} value={digit} onChange={e => handleForgotOtpChange(e.target.value, idx)} onKeyDown={e => handleForgotOtpKeyDown(e, idx)} onFocus={e => e.target.select()} autoFocus={idx === 0} />
                    ))}
                  </div>
                  <motion.button className="btn btn-primary btn-lg twofa-verify-btn" onClick={handleForgotVerifyOtp} disabled={forgotLoading || forgotOtp.join('').length < 6} whileTap={{ scale: 0.97 }}>
                    {forgotLoading ? <div className="spinner"></div> : <><FiShield /><span>Verify OTP</span></>}
                  </motion.button>
                  <p className="twofa-resend">Didn't get the code? <button type="button" className="twofa-resend-btn" onClick={handleForgotSendOtp}>Resend</button></p>
                </>
              )}

              {forgotStep === 3 && (
                <>
                  <div className="twofa-icon-ring"><FiLock size={26} /></div>
                  <h2 className="twofa-title">Set New Password</h2>
                  <p className="twofa-subtitle">Create a strong new password for your account.</p>
                  <div className="form-input-icon" style={{ marginBottom: '12px', textAlign: 'left' }}>
                    <FiLock className="icon" />
                    <input type={showForgotPass ? 'text' : 'password'} className="form-input" placeholder="New password (min 6 chars)" value={forgotNewPass} onChange={e => setForgotNewPass(e.target.value)} style={{ paddingRight: '48px' }} autoFocus />
                    <button type="button" className="password-toggle" onClick={() => setShowForgotPass(!showForgotPass)}>{showForgotPass ? <FiEyeOff /> : <FiEye />}</button>
                  </div>
                  <div className="form-input-icon" style={{ marginBottom: '16px', textAlign: 'left' }}>
                    <FiLock className="icon" />
                    <input type={showForgotPass ? 'text' : 'password'} className="form-input" placeholder="Confirm new password" value={forgotConfPass} onChange={e => setForgotConfPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleForgotReset()} />
                  </div>
                  <motion.button className="btn btn-primary btn-lg twofa-verify-btn" onClick={handleForgotReset} disabled={forgotLoading} whileTap={{ scale: 0.97 }}>
                    {forgotLoading ? <div className="spinner"></div> : <><FiCheck /><span>Reset Password</span></>}
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
