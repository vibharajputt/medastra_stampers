import { useState, useEffect, useRef } from 'react';
import { jobsAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCpu, FiRefreshCw, FiCheckCircle, FiXCircle,
  FiClock, FiLoader, FiChevronDown, FiChevronUp, FiSend
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './BackgroundJobsPage.css';

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: '#f59e0b', icon: <FiClock /> },
  RUNNING: { label: 'Running', color: '#4f9eff', icon: <FiLoader className="spin-icon" /> },
  COMPLETED: { label: 'Completed', color: '#10b981', icon: <FiCheckCircle /> },
  FAILED: { label: 'Failed', color: '#ef4444', icon: <FiXCircle /> },
  RETRYING: { label: 'Retrying', color: '#f59e0b', icon: <FiRefreshCw className="spin-icon" /> },
};

const JOB_TYPES = [
  { value: 'AI_DIAGNOSIS', label: '🧠 AI Diagnosis' },
  { value: 'PRESCRIPTION_ANALYSIS', label: '💊 Prescription Analysis' },
  { value: 'REPORT_EXPORT', label: '📄 Report Export' },
  { value: 'LAB_SUMMARY', label: '🔬 Lab Summary' },
  { value: 'SYMPTOM_CHECK', label: '🩺 Symptom Check' },
];

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const secs = Math.floor((now - date) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return date.toLocaleDateString();
}

function JobCard({ job, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.PENDING;

  return (
    <motion.div
      className="job-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ '--job-color': cfg.color }}
    >
      <div className="job-card-top" onClick={() => setExpanded(!expanded)}>
        <div className="job-left">
          <div className="job-status-dot" style={{ background: cfg.color, boxShadow: `0 0 6px ${cfg.color}` }}>
            {cfg.icon}
          </div>
          <div>
            <div className="job-type">{job.jobType?.replace(/_/g, ' ')}</div>
            <div className="job-meta">
              #{job.id} · {timeAgo(job.createdAt)} · Attempt {job.attemptCount}/{job.maxAttempts}
            </div>
          </div>
        </div>
        <div className="job-right">
          <span className="job-status-badge" style={{ background: `${cfg.color}22`, color: cfg.color }}>
            {cfg.icon} {cfg.label}
          </span>
          {job.status === 'FAILED' && (
            <button className="job-retry-btn" onClick={e => { e.stopPropagation(); onRetry(job.id); }}>
              <FiRefreshCw size={13} /> Retry
            </button>
          )}
          <span className="job-expand-btn">{expanded ? <FiChevronUp /> : <FiChevronDown />}</span>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="job-card-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {job.status === 'COMPLETED' && job.resultPayload && (
              <div className="job-result">
                <div className="job-result-label">✅ Result</div>
                <div className="job-result-text">{job.resultPayload}</div>
              </div>
            )}
            {job.status === 'FAILED' && job.errorMessage && (
              <div className="job-error">
                <div className="job-result-label">❌ Error</div>
                <div className="job-result-text">{job.errorMessage}</div>
              </div>
            )}
            {(job.status === 'PENDING' || job.status === 'RUNNING') && (
              <div className="job-running-bar">
                <div className="running-bar-fill" />
              </div>
            )}
            {job.completedAt && (
              <div className="job-completed-at">Completed: {new Date(job.completedAt).toLocaleString()}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BackgroundJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobType, setJobType] = useState('AI_DIAGNOSIS');
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadJobs();
    intervalRef.current = setInterval(loadJobs, 5000);
    return () => clearInterval(intervalRef.current);
  }, [page]);

  const loadJobs = async () => {
    try {
      const res = await jobsAPI.getJobs(page, 10);
      setJobs(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const submitJob = async () => {
    if (!inputText.trim()) { toast.error('Please describe your query'); return; }
    setSubmitting(true);
    try {
      const res = await jobsAPI.submit(jobType, inputText);
      toast.success(`Job #${res.data.jobId} submitted! Processing in background...`);
      setInputText('');
      await loadJobs();
    } catch (err) {
      toast.error('Failed to submit job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async (jobId) => {
    try {
      await jobsAPI.retryJob(jobId);
      toast.success('Job queued for retry!');
      await loadJobs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Retry failed');
    }
  };

  const running = jobs.filter(j => j.status === 'RUNNING' || j.status === 'PENDING' || j.status === 'RETRYING');
  const done = jobs.filter(j => j.status === 'COMPLETED' || j.status === 'FAILED');

  return (
    <div className="jobs-page">
      <div className="jobs-header">
        <div className="jobs-title-row">
          <div className="jobs-title-icon"><FiCpu size={22} /></div>
          <div>
            <h1 className="jobs-title">Background Tasks</h1>
            <p className="jobs-subtitle">Submit AI analysis jobs and track their progress</p>
          </div>
        </div>
        {running.length > 0 && (
          <div className="jobs-running-badge">
            <FiLoader className="spin-icon" size={14} />
            {running.length} job{running.length > 1 ? 's' : ''} running
          </div>
        )}
      </div>

      {/* Submit Form */}
      <div className="jobs-submit-card">
        <h3 className="submit-title">Submit New Analysis Job</h3>
        <div className="submit-row">
          <select
            className="submit-select"
            value={jobType}
            onChange={e => setJobType(e.target.value)}
          >
            {JOB_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <textarea
          className="submit-textarea"
          placeholder="Describe your query or paste data here... (e.g., 'I have been experiencing chest pain and shortness of breath for 2 days')"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          rows={4}
        />
        <button className="submit-btn" onClick={submitJob} disabled={submitting || !inputText.trim()}>
          {submitting ? <><FiLoader className="spin-icon" /> Submitting...</> : <><FiSend size={14} /> Submit to Background Queue</>}
        </button>
      </div>

      {/* Active Jobs */}
      {loading ? (
        <div className="jobs-loading">Loading jobs...</div>
      ) : (
        <>
          {running.length > 0 && (
            <div className="jobs-section">
              <div className="section-label">⚡ Active</div>
              {running.map(job => <JobCard key={job.id} job={job} onRetry={handleRetry} />)}
            </div>
          )}
          {done.length > 0 && (
            <div className="jobs-section">
              <div className="section-label">📋 History</div>
              {done.map(job => <JobCard key={job.id} job={job} onRetry={handleRetry} />)}
            </div>
          )}
          {jobs.length === 0 && (
            <div className="jobs-empty">
              <FiCpu size={48} />
              <p>No background jobs yet</p>
              <span>Submit an analysis job using the form above</span>
            </div>
          )}
        </>
      )}

      {totalPages > 1 && (
        <div className="jobs-pagination">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="page-btn">◀</button>
          <span>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="page-btn">▶</button>
        </div>
      )}
    </div>
  );
}
