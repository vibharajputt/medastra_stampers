import { useState, useEffect } from 'react';
import { observabilityAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiActivity, FiClock, FiCheckCircle, FiAlertCircle,
  FiTrendingUp, FiChevronDown, FiChevronUp, FiRefreshCw
} from 'react-icons/fi';
import './ObservabilityDashboard.css';

function StatCard({ label, value, icon, color, unit }) {
  return (
    <div className="obs-stat-card" style={{ '--stat-color': color }}>
      <div className="obs-stat-icon" style={{ background: `${color}22`, color }}>{icon}</div>
      <div className="obs-stat-body">
        <div className="obs-stat-value">{value}{unit && <span className="obs-stat-unit">{unit}</span>}</div>
        <div className="obs-stat-label">{label}</div>
      </div>
    </div>
  );
}

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false);
  const slow = run.latencyMs > 3000;
  const statusColor = run.success ? '#10b981' : '#ef4444';
  const latencyColor = !run.latencyMs ? '#6b7280' : slow ? '#f59e0b' : '#10b981';

  return (
    <>
      <tr className="run-row" onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <td>
          <span className="tool-badge">{run.toolName}</span>
        </td>
        <td>
          <span className="run-status" style={{ color: statusColor }}>
            {run.success ? <FiCheckCircle size={14} /> : <FiAlertCircle size={14} />}
            {run.success ? 'Success' : 'Failed'}
          </span>
        </td>
        <td>
          <span style={{ color: latencyColor, fontSize: '0.85rem', fontWeight: 600 }}>
            {run.latencyMs != null ? `${run.latencyMs}ms` : '—'}
            {slow && <span className="slow-badge">slow</span>}
          </span>
        </td>
        <td className="run-ts">{run.runTimestamp ? new Date(run.runTimestamp).toLocaleString() : '—'}</td>
        <td className="run-expand">{expanded ? <FiChevronUp /> : <FiChevronDown />}</td>
      </tr>
      {expanded && (
        <tr className="run-detail-row">
          <td colSpan={5}>
            <div className="run-detail-panel">
              {run.inputSummary && (
                <div className="detail-block">
                  <div className="detail-label">📥 Input</div>
                  <div className="detail-text">{run.inputSummary}</div>
                </div>
              )}
              {run.outputSummary && (
                <div className="detail-block">
                  <div className="detail-label">📤 Output</div>
                  <div className="detail-text">{run.outputSummary}</div>
                </div>
              )}
              {run.agentDecision && (
                <div className="detail-block">
                  <div className="detail-label">🤖 Agent Decision</div>
                  <div className="detail-text">{run.agentDecision}</div>
                </div>
              )}
              {run.errorMessage && (
                <div className="detail-block error">
                  <div className="detail-label">❌ Error</div>
                  <div className="detail-text">{run.errorMessage}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ObservabilityDashboard() {
  const [runs, setRuns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [runsRes, statsRes] = await Promise.all([
        observabilityAPI.getRuns(page, 20),
        observabilityAPI.getStats()
      ]);
      setRuns(runsRes.data.data || []);
      setTotalPages(runsRes.data.totalPages || 1);
      setStats(statsRes.data.data);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="obs-page">
      <div className="obs-header">
        <div className="obs-title-row">
          <div className="obs-title-icon"><FiActivity size={22} /></div>
          <div>
            <h1 className="obs-title">AI Observability Dashboard</h1>
            <p className="obs-subtitle">Monitor tool calls, latency, and AI decision logs</p>
          </div>
        </div>
        <button className="obs-refresh-btn" onClick={loadData}>
          <FiRefreshCw size={14} /> Refresh
        </button>
      </div>

      {stats && (
        <div className="obs-stats-grid">
          <StatCard label="Total Runs" value={stats.totalRuns} icon={<FiTrendingUp />} color="#4f9eff" />
          <StatCard label="Successful" value={stats.successes} icon={<FiCheckCircle />} color="#10b981" />
          <StatCard label="Failed" value={stats.failures} icon={<FiAlertCircle />} color="#ef4444" />
          <StatCard label="Error Rate" value={stats.errorRate} icon={<FiAlertCircle />} color="#f59e0b" unit="%" />
          <StatCard label="Avg Latency" value={stats.avgLatencyMs} icon={<FiClock />} color="#a78bfa" unit="ms" />
        </div>
      )}

      <div className="obs-table-card">
        <div className="obs-table-header">
          <h3>Tool Run Logs</h3>
          <span className="obs-table-count">{runs.length} records</span>
        </div>

        {loading ? (
          <div className="obs-loading">Loading runs...</div>
        ) : runs.length === 0 ? (
          <div className="obs-empty">
            <FiActivity size={40} />
            <p>No tool runs recorded yet</p>
            <span>Runs will appear here as you use AI features</span>
          </div>
        ) : (
          <div className="obs-table-wrap">
            <table className="obs-table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Timestamp</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => <RunRow key={run.id} run={run} />)}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="obs-pagination">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="page-btn">◀</button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="page-btn">▶</button>
          </div>
        )}
      </div>
    </div>
  );
}
