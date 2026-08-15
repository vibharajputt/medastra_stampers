import { useState, useEffect } from 'react';
import { activityAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiActivity, FiCalendar, FiFileText, FiShoppingBag,
  FiAlertTriangle, FiSearch, FiChevronLeft, FiChevronRight,
  FiCpu, FiLogIn, FiUser, FiHeart, FiZap
} from 'react-icons/fi';
import './ActivityHistoryPage.css';

const EVENT_ICONS = {
  AI_QUERY: <FiCpu />,
  BOOKING_CREATED: <FiCalendar />,
  BOOKING_CANCELLED: <FiCalendar />,
  PRESCRIPTION_UPLOADED: <FiFileText />,
  PRESCRIPTION_VIEWED: <FiFileText />,
  LAB_BOOKED: <FiActivity />,
  MEDICINE_ORDERED: <FiShoppingBag />,
  SOS_TRIGGERED: <FiAlertTriangle />,
  LOGIN: <FiLogIn />,
  PROFILE_UPDATED: <FiUser />,
  PAYMENT_MADE: <FiZap />,
  REPORT_GENERATED: <FiFileText />,
  WORKFLOW_STARTED: <FiHeart />,
  WORKFLOW_APPROVED: <FiHeart />,
  WORKFLOW_REJECTED: <FiHeart />,
};

const EVENT_COLORS = {
  AI_QUERY: '#00d9a6',
  BOOKING_CREATED: '#4f9eff',
  BOOKING_CANCELLED: '#ff6b6b',
  PRESCRIPTION_UPLOADED: '#a78bfa',
  PRESCRIPTION_VIEWED: '#a78bfa',
  LAB_BOOKED: '#fbbf24',
  MEDICINE_ORDERED: '#34d399',
  SOS_TRIGGERED: '#ef4444',
  LOGIN: '#6b7280',
  PROFILE_UPDATED: '#60a5fa',
  PAYMENT_MADE: '#f59e0b',
  REPORT_GENERATED: '#8b5cf6',
  WORKFLOW_STARTED: '#ec4899',
  WORKFLOW_APPROVED: '#10b981',
  WORKFLOW_REJECTED: '#f43f5e',
};

const FILTER_TYPES = [
  { label: 'All', value: 'ALL' },
  { label: 'AI Queries', value: 'AI_QUERY' },
  { label: 'Bookings', value: 'BOOKING_CREATED' },
  { label: 'Prescriptions', value: 'PRESCRIPTION_UPLOADED' },
  { label: 'Orders', value: 'MEDICINE_ORDERED' },
  { label: 'Labs', value: 'LAB_BOOKED' },
  { label: 'SOS', value: 'SOS_TRIGGERED' },
  { label: 'Workflows', value: 'WORKFLOW_STARTED' },
];

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const secs = Math.floor((now - date) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityHistoryPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadActivity();
  }, [page, filter]);

  const loadActivity = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await activityAPI.getHistory(page, 20, filter);
      setActivities(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      setError('Failed to load activity history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = activities.filter(a =>
    !search || a.summary?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="activity-page">
      <div className="activity-header">
        <div className="activity-title-row">
          <div className="activity-title-icon"><FiActivity size={24} /></div>
          <div>
            <h1 className="activity-title">Activity History</h1>
            <p className="activity-subtitle">Your complete platform activity log</p>
          </div>
        </div>

        <div className="activity-controls">
          <div className="activity-search-wrap">
            <FiSearch className="search-ico" />
            <input
              type="text"
              placeholder="Search activities..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="activity-search"
            />
          </div>
          <div className="activity-filters">
            {FILTER_TYPES.map(f => (
              <button
                key={f.value}
                className={`filter-pill ${filter === f.value ? 'active' : ''}`}
                onClick={() => { setFilter(f.value); setPage(0); }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="activity-error">{error}</div>}

      {loading ? (
        <div className="activity-loading">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="activity-skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="activity-empty">
          <FiActivity size={48} className="empty-icon" />
          <p>No activity found</p>
          <span>Your actions will appear here once you start using the platform</span>
        </div>
      ) : (
        <div className="activity-timeline">
          <AnimatePresence>
            {filtered.map((item, idx) => {
              const color = EVENT_COLORS[item.eventType] || '#00d9a6';
              const icon = EVENT_ICONS[item.eventType] || <FiActivity />;
              return (
                <motion.div
                  key={item.id}
                  className="activity-item"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <div className="activity-dot-col">
                    <div className="activity-dot" style={{ background: color, boxShadow: `0 0 8px ${color}55` }}>
                      {icon}
                    </div>
                    {idx < filtered.length - 1 && <div className="activity-line" />}
                  </div>
                  <div className="activity-card">
                    <div className="activity-card-top">
                      <span className="activity-event-badge" style={{ background: `${color}22`, color }}>
                        {item.eventType?.replace(/_/g, ' ')}
                      </span>
                      <span className="activity-time">{timeAgo(item.createdAt)}</span>
                    </div>
                    <p className="activity-summary">{item.summary || 'Activity recorded'}</p>
                    {item.entityType && (
                      <span className="activity-entity">
                        {item.entityType} #{item.entityId}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {totalPages > 1 && (
        <div className="activity-pagination">
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <FiChevronLeft />
          </button>
          <span className="page-info">Page {page + 1} of {totalPages}</span>
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <FiChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
