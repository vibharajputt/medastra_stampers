import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { riskAPI } from '../../services/api';
import './RiskDashboardPage.css';

// ── Risk colour scale ────────────────────────────────────────────────────────
const RISK_COLORS = {
  SAFE:     '#4ade80',
  LOW:      '#34d399',
  MODERATE: '#fbbf24',
  HIGH:     '#fb923c',
  CRITICAL: '#f87171',
};

const RISK_ICONS = {
  SAFE:     '🛡️',
  LOW:      '✅',
  MODERATE: '⚠️',
  HIGH:     '🔴',
  CRITICAL: '🚨',
};

// ── Animated Semicircle Gauge ────────────────────────────────────────────────
function RiskGauge({ score, riskLevel, animated = true }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!animated) { setDisplayScore(score); return; }
    let start = 0;
    const target = score;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setDisplayScore(target); clearInterval(timer); }
      else setDisplayScore(start);
    }, 30);
    return () => clearInterval(timer);
  }, [score, animated]);

  // SVG arc math — semicircle (180°)
  const cx = 110, cy = 110, r = 90;
  const circumference = Math.PI * r; // half circle
  const trackDash = `${circumference} ${circumference * 10}`;
  const pct = Math.min(displayScore, 100) / 100;
  const fillDash = `${pct * circumference} ${circumference * 10}`;
  const strokeColor = RISK_COLORS[riskLevel] || '#60a5fa';

  return (
    <div className="gauge-wrapper">
      <div className="gauge-svg-container">
        <svg className="gauge-svg" viewBox="0 0 220 120" width="220" height="120">
          {/* Track */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          {/* Coloured fill arc */}
          <path
            d="M 20 110 A 90 90 0 0 1 200 110"
            stroke={strokeColor}
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={fillDash}
            strokeDashoffset="0"
            style={{
              filter: `drop-shadow(0 0 8px ${strokeColor}60)`,
              transition: 'stroke-dasharray 1.5s cubic-bezier(0.34,1.56,0.64,1), stroke 0.5s'
            }}
          />
          {/* Zone labels */}
          <text x="18"  y="128" className="chart-axis-text" fontSize="10" fill="#4ade80">SAFE</text>
          <text x="95"  y="28"  className="chart-axis-text" fontSize="10" fill="#fbbf24" textAnchor="middle">MOD</text>
          <text x="185" y="128" className="chart-axis-text" fontSize="10" fill="#f87171" textAnchor="end">CRIT</text>
        </svg>
        <div className="gauge-center-text">
          <div className="gauge-score" style={{ color: strokeColor }}>{displayScore}</div>
          <div className="gauge-label">/ 100</div>
        </div>
      </div>
      <div className={`risk-level-badge ${riskLevel}`}>
        {RISK_ICONS[riskLevel]} {riskLevel}
      </div>
    </div>
  );
}

// ── Time-Series SVG Line Chart ────────────────────────────────────────────────
function RiskTimeChart({ history }) {
  if (!history || history.length < 2) {
    return (
      <div className="chart-empty">
        <div>📊</div>
        <div>Run at least 2 assessments to see your risk trend over time.</div>
      </div>
    );
  }

  const W = 700, H = 200, PAD = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const scores = history.map(h => h.riskScore);
  const maxScore = Math.max(...scores, 60);
  const minScore = Math.max(0, Math.min(...scores) - 10);

  const xScale = (i) => PAD.left + (i / (history.length - 1)) * innerW;
  const yScale = (v) => PAD.top + innerH - ((v - minScore) / (maxScore - minScore)) * innerH;

  const linePath = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(h.riskScore)}`).join(' ');
  const areaPath = `${linePath} L ${xScale(history.length - 1)} ${PAD.top + innerH} L ${PAD.left} ${PAD.top + innerH} Z`;

  // Grid lines
  const gridLines = [0, 25, 50, 75, 100].filter(v => v >= minScore && v <= maxScore);

  // X-axis labels (show every Nth)
  const labelStep = Math.max(1, Math.floor(history.length / 6));

  return (
    <div className="chart-container">
      <svg className="time-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {gridLines.map(v => (
          <g key={v}>
            <line
              x1={PAD.left} y1={yScale(v)} x2={PAD.left + innerW} y2={yScale(v)}
              className="chart-grid-line"
            />
            <text x={PAD.left - 6} y={yScale(v) + 4} className="chart-axis-text" textAnchor="end">{v}</text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#riskGrad)" className="chart-area" />

        {/* Risk level zones (subtle bands) */}
        <rect x={PAD.left} y={yScale(80)} width={innerW} height={yScale(60) - yScale(80)}
          fill="rgba(239,68,68,0.05)" />
        <rect x={PAD.left} y={yScale(60)} width={innerW} height={yScale(40) - yScale(60)}
          fill="rgba(249,115,22,0.05)" />

        {/* Gradient def */}
        <defs>
          <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Main line */}
        <path d={linePath} stroke="#8b5cf6" strokeWidth="2.5" className="chart-line" />

        {/* Data dots */}
        {history.map((h, i) => {
          const color = RISK_COLORS[h.riskLevel] || '#8b5cf6';
          return (
            <circle
              key={i}
              cx={xScale(i)} cy={yScale(h.riskScore)}
              r={h.alertTriggered ? 7 : 5}
              fill={color}
              stroke={h.alertTriggered ? '#f87171' : 'rgba(255,255,255,0.2)'}
              strokeWidth={h.alertTriggered ? 2 : 1}
              className="chart-dot"
            >
              <title>
                Score: {h.riskScore} | {h.riskLevel}
                {h.alertTriggered ? ' ⚠️ Alert was triggered' : ''}
                {'\n'}{new Date(h.timestamp).toLocaleString()}
              </title>
            </circle>
          );
        })}

        {/* X-axis date labels */}
        {history.map((h, i) => {
          if (i % labelStep !== 0 && i !== history.length - 1) return null;
          const d = new Date(h.timestamp);
          const label = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
          return (
            <text key={i} x={xScale(i)} y={H - 6} className="chart-axis-text" textAnchor="middle" fontSize="9">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ── Vitals Input Form ─────────────────────────────────────────────────────────
function VitalsForm({ vitals, onChange }) {
  const fields = [
    { key: 'heartRate',      label: 'Heart Rate',   unit: 'bpm',       placeholder: '60–100' },
    { key: 'systolicBP',     label: 'Systolic BP',  unit: 'mmHg',      placeholder: '90–120' },
    { key: 'diastolicBP',    label: 'Diastolic BP', unit: 'mmHg',      placeholder: '60–80' },
    { key: 'bloodSugar',     label: 'Blood Sugar',  unit: 'mg/dL',     placeholder: '70–100' },
    { key: 'spo2',           label: 'SpO2',         unit: '%',         placeholder: '95–100' },
    { key: 'temperature',    label: 'Temperature',  unit: '°C',        placeholder: '36.1–37.5' },
    { key: 'weight',         label: 'Weight',       unit: 'kg',        placeholder: 'e.g. 70' },
    { key: 'height',         label: 'Height',       unit: 'm',         placeholder: 'e.g. 1.72' },
    { key: 'respiratoryRate',label: 'Resp. Rate',   unit: 'breaths/m', placeholder: '12–20' },
  ];

  return (
    <div className="vitals-form">
      {fields.map(f => (
        <div key={f.key} className="vital-input-group">
          <label>
            {f.label} <span className="vital-unit">({f.unit})</span>
          </label>
          <input
            type="number"
            step="any"
            className="vital-input"
            placeholder={f.placeholder}
            value={vitals[f.key] || ''}
            onChange={e => onChange(f.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RiskDashboardPage() {
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [vitals, setVitals] = useState({});
  const [showVitalsForm, setShowVitalsForm] = useState(false);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await riskAPI.getRiskHistory();
      setHistory(res.data.history || []);
    } catch (err) {
      console.warn('No history yet:', err.message);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleVitalChange = (key, value) => {
    setVitals(prev => ({ ...prev, [key]: value === '' ? undefined : Number(value) }));
  };

  const handleAssess = async () => {
    setLoading(true);
    try {
      const res = await riskAPI.assessRisk(vitals);
      const data = res.data.data;
      setAssessment(data);

      if (data.alertTriggered) {
        toast.error(`🚨 HIGH RISK DETECTED (${data.riskScore}/100) — Emergency contact has been notified!`, {
          duration: 6000,
        });
      } else {
        toast.success(`✅ Risk Assessment Complete — Score: ${data.riskScore}/100`, { duration: 4000 });
      }

      // Refresh history
      await loadHistory();
    } catch (err) {
      toast.error('Failed to run risk assessment. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const topFactors = assessment?.factors?.slice(0, 8) || [];
  const maxPoints = topFactors.reduce((m, f) => Math.max(m, Math.abs(f.points)), 1);

  return (
    <div className="risk-dashboard">
      {/* ── Header ── */}
      <div className="risk-header">
        <div className="risk-header-left">
          <button className="risk-back-btn" onClick={() => navigate('/dashboard')}>
            ← Back
          </button>
          <div className="risk-title-block">
            <h1>🧬 Risk Intelligence Centre</h1>
            <p>AI-powered early risk detection & explainable predictions</p>
          </div>
        </div>
        <button
          className="risk-assess-btn"
          onClick={handleAssess}
          disabled={loading}
          id="btn-run-risk-assessment"
        >
          {loading ? <><div className="btn-spinner" /> Analysing…</> : <><span>🔬</span> Run Assessment</>}
        </button>
      </div>

      {/* ── Emergency Alert Banner ── */}
      <AnimatePresence>
        {assessment?.alertTriggered && (
          <motion.div
            className="alert-banner critical"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <span className="ab-icon">🚨</span>
            <div className="ab-content">
              <div className="ab-title">CRITICAL RISK — PROACTIVE ALERT SENT</div>
              <div className="ab-text">
                Your risk score is <strong>{assessment.riskScore}/100</strong>. An automated SMS alert has been
                dispatched to your emergency contact. Please consult a physician immediately or call <strong>112</strong>.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Vitals Input Toggle ── */}
      <div className="risk-card risk-grid-full" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-icon blue">📋</div>
          <div>
            <div className="card-title">Optional: Enter Your Vitals</div>
            <div className="card-subtitle">Leave blank to run assessment on medical history alone</div>
          </div>
          <button
            onClick={() => setShowVitalsForm(v => !v)}
            style={{
              marginLeft: 'auto', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)',
              color: '#60a5fa', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            {showVitalsForm ? '▲ Hide' : '▼ Enter Vitals'}
          </button>
        </div>
        <AnimatePresence>
          {showVitalsForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <VitalsForm vitals={vitals} onChange={handleVitalChange} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── If no assessment yet — prompt ── */}
      {!assessment && (
        <motion.div
          className="risk-empty-state"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="empty-icon">🧬</div>
          <h2>No Assessment Yet</h2>
          <p>
            Click <strong>"Run Assessment"</strong> above to get your AI-powered health risk score.
            You can optionally enter your vitals for a more accurate result, or leave them blank
            to assess based on your medical history.
          </p>
          <button className="risk-assess-btn" onClick={handleAssess} disabled={loading} id="btn-run-assessment-empty">
            {loading ? <><div className="btn-spinner" /> Analysing…</> : <>🔬 Run My First Assessment</>}
          </button>
        </motion.div>
      )}

      {/* ── Main Results Grid ── */}
      <AnimatePresence>
        {assessment && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Row 1: Gauge + Confidence */}
            <div className="risk-grid">
              {/* Gauge Card */}
              <div className="risk-card">
                <div className="card-header">
                  <div className="card-icon blue">🎯</div>
                  <div>
                    <div className="card-title">Risk Score</div>
                    <div className="card-subtitle">Composite health risk index</div>
                  </div>
                </div>
                <RiskGauge score={assessment.riskScore} riskLevel={assessment.riskLevel} />
              </div>

              {/* Confidence + Data Quality Card */}
              <div className="risk-card">
                <div className="card-header">
                  <div className="card-icon purple">🔮</div>
                  <div>
                    <div className="card-title">Prediction Confidence</div>
                    <div className="card-subtitle">Based on data completeness</div>
                  </div>
                </div>
                <div className="confidence-section">
                  <div>
                    <div className="confidence-row">
                      <span className="confidence-label">Model Confidence</span>
                      <span className="confidence-value">{assessment.confidence}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill confidence-fill"
                        style={{ width: `${assessment.confidence}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="confidence-row">
                      <span className="confidence-label">Missing Parameters</span>
                      <span className="confidence-value" style={{ color: assessment.missingDataPercentage > 50 ? '#f87171' : '#fbbf24' }}>
                        {assessment.missingDataPercentage}%
                      </span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill missing-fill"
                        style={{ width: `${assessment.missingDataPercentage}%` }}
                      />
                    </div>
                  </div>
                  {assessment.dataQualityNote && (
                    <div className="data-quality-note">
                      <span className="dq-icon">ℹ️</span>
                      <span>{assessment.dataQualityNote}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Explainability factors */}
            {topFactors.length > 0 && (
              <div className="risk-card risk-grid-full">
                <div className="card-header">
                  <div className="card-icon amber">🔍</div>
                  <div>
                    <div className="card-title">Explainable Prediction — Contributing Factors</div>
                    <div className="card-subtitle">Why your score is {assessment.riskScore}/100</div>
                  </div>
                </div>
                <div className="factors-list">
                  {topFactors.map((f, i) => (
                    <motion.div
                      key={i}
                      className="factor-row"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <div className="factor-meta">
                        <span className="factor-name">{f.factor}</span>
                        <span className={`factor-points ${f.direction}`}>
                          {f.direction === 'down' ? '-' : '+'}{Math.abs(f.points)} pts
                        </span>
                      </div>
                      <div className="factor-bar-track">
                        <div
                          className={`factor-bar-fill ${f.direction}`}
                          style={{ width: `${(Math.abs(f.points) / maxPoints) * 100}%` }}
                        />
                      </div>
                      <div className="factor-explanation">{f.explanation}</div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 3: Anomaly Alerts */}
            <div className="risk-card risk-grid-full">
              <div className="card-header">
                <div className="card-icon red">🚦</div>
                <div>
                  <div className="card-title">Anomaly Detection</div>
                  <div className="card-subtitle">Parameters outside normal medical ranges</div>
                </div>
              </div>
              {assessment.anomalies && assessment.anomalies.length > 0 ? (
                <div className="anomalies-grid">
                  {assessment.anomalies.map((a, i) => (
                    <motion.div
                      key={i}
                      className={`anomaly-card ${a.severity}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="anomaly-header">
                        <span className="anomaly-param">{a.parameter}</span>
                        <span className={`anomaly-severity-badge ${a.severity}`}>{a.severity}</span>
                      </div>
                      <div className={`anomaly-value ${a.direction}`}>{a.value}</div>
                      <div className="anomaly-normal">Normal: {a.normalRange}</div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="no-anomalies">
                  <span className="check-icon">✅</span>
                  <div>No anomalies detected in provided parameters.</div>
                </div>
              )}
            </div>

            {/* Row 4: Time-Series Chart */}
            <div className="risk-card risk-grid-full">
              <div className="card-header">
                <div className="card-icon green">📈</div>
                <div>
                  <div className="card-title">Risk Score — Time-Series Trend</div>
                  <div className="card-subtitle">Historical risk score over your last {history.length} assessments</div>
                </div>
              </div>
              {historyLoading ? (
                <div className="skeleton skeleton-gauge" />
              ) : (
                <RiskTimeChart history={history} />
              )}
              {history.some(h => h.alertTriggered) && (
                <div style={{ marginTop: 12, fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔴</span> Red dots indicate assessments where an emergency alert was triggered.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
