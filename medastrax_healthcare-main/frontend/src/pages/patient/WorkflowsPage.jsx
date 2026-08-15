import { useState, useEffect } from 'react';
import { workflowAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiGitBranch, FiCheckCircle, FiXCircle, FiClock,
  FiAlertTriangle, FiPlay, FiChevronDown, FiChevronUp,
  FiThumbsUp, FiThumbsDown
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import './WorkflowsPage.css';

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: '#4f9eff', icon: <FiPlay size={13} /> },
  PAUSED_FOR_APPROVAL: { label: 'Needs Approval', color: '#f59e0b', icon: <FiAlertTriangle size={13} /> },
  COMPLETED: { label: 'Completed', color: '#10b981', icon: <FiCheckCircle size={13} /> },
  REJECTED: { label: 'Rejected', color: '#ef4444', icon: <FiXCircle size={13} /> },
  FAILED: { label: 'Failed', color: '#ef4444', icon: <FiXCircle size={13} /> },
};

const STEP_STATUS_ICONS = {
  PENDING: <FiClock className="step-icon pending" />,
  RUNNING: <FiPlay className="step-icon running" />,
  COMPLETED: <FiCheckCircle className="step-icon done" />,
  APPROVED: <FiCheckCircle className="step-icon approved" />,
  AWAITING_APPROVAL: <FiAlertTriangle className="step-icon waiting" />,
  REJECTED: <FiXCircle className="step-icon rejected" />,
};

const WORKFLOW_TYPES = [
  { value: 'MEDICATION_APPROVAL', label: '💊 Medication Approval Workflow' },
  { value: 'EMERGENCY_PROTOCOL', label: '🚨 Emergency Response Protocol' },
  { value: 'GENERIC_APPROVAL', label: '✅ Generic Approval Workflow' },
];

function ApprovalModal({ workflow, onApprove, onReject, onClose }) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  let steps = [];
  try { steps = JSON.parse(workflow.stepsJson || '[]'); } catch {}
  const pendingStep = steps.find(s => s.status === 'AWAITING_APPROVAL');

  const handleApprove = async () => {
    setLoading(true);
    await onApprove(workflow.id, pendingStep?.stepIndex ?? workflow.currentStepIndex);
    setLoading(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Please enter a reason'); return; }
    setLoading(true);
    await onReject(workflow.id, pendingStep?.stepIndex ?? workflow.currentStepIndex, rejectReason);
    setLoading(false);
  };

  return (
    <motion.div className="modal-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="approval-modal" onClick={e => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>

        <div className="modal-header">
          <div className="modal-icon"><FiAlertTriangle size={20} /></div>
          <h2>Action Required</h2>
          <p>The system is requesting your approval to continue</p>
        </div>

        {pendingStep && (
          <div className="modal-step-info">
            <div className="modal-step-name">Step: {pendingStep.stepName}</div>
            <div className="modal-step-tool">
              Tool: <code>{pendingStep.toolToCall}</code>
            </div>
            <div className="modal-step-desc">
              This step requires your explicit approval before proceeding.
              Approving this will allow the system to execute <strong>{pendingStep.toolToCall}</strong>.
            </div>
          </div>
        )}

        {showRejectInput ? (
          <div className="reject-input-group">
            <label>Rejection Reason (required)</label>
            <textarea
              placeholder="Why are you rejecting this step?"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              className="reject-textarea"
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowRejectInput(false)}>Cancel</button>
              <button className="btn-reject-confirm" onClick={handleReject} disabled={loading}>
                <FiThumbsDown /> Confirm Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-actions">
            <button className="btn-reject" onClick={() => setShowRejectInput(true)} disabled={loading}>
              <FiThumbsDown /> Reject
            </button>
            <button className="btn-approve" onClick={handleApprove} disabled={loading}>
              <FiThumbsUp /> {loading ? 'Processing...' : 'Approve & Continue'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function WorkflowCard({ wf, onApproveClick }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[wf.status] || STATUS_CONFIG.ACTIVE;

  let steps = [];
  let auditTrail = [];
  try { steps = JSON.parse(wf.stepsJson || '[]'); } catch {}
  try { auditTrail = JSON.parse(wf.auditTrailJson || '[]'); } catch {}

  const progress = steps.length ? Math.round((wf.currentStepIndex / steps.length) * 100) : 0;

  return (
    <div className={`wf-card ${wf.status === 'PAUSED_FOR_APPROVAL' ? 'needs-approval' : ''}`}>
      <div className="wf-card-top" onClick={() => setExpanded(!expanded)}>
        <div className="wf-left">
          <div className="wf-status-dot" style={{ background: cfg.color }}>
            {cfg.icon}
          </div>
          <div>
            <div className="wf-type">{wf.workflowType?.replace(/_/g, ' ')}</div>
            <div className="wf-desc">{wf.description}</div>
          </div>
        </div>
        <div className="wf-right">
          <span className="wf-status-badge" style={{ background: `${cfg.color}22`, color: cfg.color }}>
            {cfg.icon} {cfg.label}
          </span>
          {wf.status === 'PAUSED_FOR_APPROVAL' && (
            <button className="wf-approve-btn" onClick={e => { e.stopPropagation(); onApproveClick(wf); }}>
              <FiAlertTriangle size={13} /> Review
            </button>
          )}
          <span className="wf-expand-btn">{expanded ? <FiChevronUp /> : <FiChevronDown />}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="wf-progress-track">
        <div className="wf-progress-fill" style={{ width: `${progress}%`, background: cfg.color }} />
      </div>
      <div className="wf-progress-label">
        Step {wf.currentStepIndex} of {steps.length} · {progress}% complete
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div className="wf-body"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>

            {steps.length > 0 && (
              <div className="wf-steps">
                <div className="section-label">Workflow Steps</div>
                {steps.map((step, i) => (
                  <div key={i} className={`wf-step ${step.status?.toLowerCase()}`}>
                    <div className="step-icon-wrap">
                      {STEP_STATUS_ICONS[step.status] || STEP_STATUS_ICONS.PENDING}
                      {i < steps.length - 1 && <div className="step-connector" />}
                    </div>
                    <div className="step-info">
                      <div className="step-name">{step.stepName}</div>
                      <div className="step-meta">
                        {step.stepType} · {step.toolToCall}
                        {step.approvedAt && ` · Approved ${new Date(step.approvedAt).toLocaleTimeString()}`}
                        {step.rejectedAt && ` · Rejected`}
                      </div>
                      {step.outputData && <div className="step-output">{step.outputData}</div>}
                      {step.rejectionReason && <div className="step-rejection">❌ {step.rejectionReason}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {auditTrail.length > 0 && (
              <div className="wf-audit">
                <div className="section-label">Audit Trail</div>
                {auditTrail.map((entry, i) => (
                  <div key={i} className="audit-entry">
                    <span className="audit-action">{entry.action}</span>
                    <span className="audit-step">{entry.stepName}</span>
                    <span className="audit-time">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}</span>
                    {entry.detail && <div className="audit-detail">{entry.detail}</div>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [selectedWf, setSelectedWf] = useState(null);
  const [startType, setStartType] = useState('MEDICATION_APPROVAL');
  const [starting, setStarting] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadWorkflows();
  }, [page]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await workflowAPI.getWorkflows(page, 10);
      setWorkflows(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
      setPendingApprovals(res.data.pendingApprovals || 0);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = async () => {
    setStarting(true);
    try {
      await workflowAPI.start(startType, { description: `Started ${startType}` });
      toast.success('Workflow started successfully!');
      await loadWorkflows();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start workflow');
    } finally {
      setStarting(false);
    }
  };

  const handleApprove = async (workflowId, stepIndex) => {
    try {
      await workflowAPI.approveStep(workflowId, stepIndex);
      toast.success('Step approved! Workflow continues.');
      setSelectedWf(null);
      await loadWorkflows();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed');
    }
  };

  const handleReject = async (workflowId, stepIndex, reason) => {
    try {
      await workflowAPI.rejectStep(workflowId, stepIndex, reason);
      toast.error('Step rejected. Workflow stopped.');
      setSelectedWf(null);
      await loadWorkflows();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rejection failed');
    }
  };

  return (
    <div className="wf-page">
      <div className="wf-header">
        <div className="wf-title-row">
          <div className="wf-title-icon"><FiGitBranch size={22} /></div>
          <div>
            <h1 className="wf-title">Multi-Step Workflows</h1>
            <p className="wf-subtitle">AI-orchestrated workflows with human approval gates</p>
          </div>
        </div>
        {pendingApprovals > 0 && (
          <div className="pending-alert">
            <FiAlertTriangle size={16} />
            {pendingApprovals} pending approval{pendingApprovals > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Start Workflow */}
      <div className="wf-start-card">
        <h3 className="start-title">Start New Workflow</h3>
        <div className="start-row">
          <select className="start-select" value={startType} onChange={e => setStartType(e.target.value)}>
            {WORKFLOW_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button className="start-btn" onClick={handleStartWorkflow} disabled={starting}>
            <FiPlay size={14} /> {starting ? 'Starting...' : 'Start Workflow'}
          </button>
        </div>
        <p className="start-hint">
          The system will automatically execute safe steps and pause on risky steps for your approval.
        </p>
      </div>

      {loading ? (
        <div className="wf-loading">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="wf-empty">
          <FiGitBranch size={48} />
          <p>No workflows yet</p>
          <span>Start a workflow to see it here with full step tracking and audit trail</span>
        </div>
      ) : (
        <div className="wf-list">
          {workflows.map(wf => (
            <WorkflowCard key={wf.id} wf={wf} onApproveClick={setSelectedWf} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="wf-pagination">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="page-btn">◀</button>
          <span>{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="page-btn">▶</button>
        </div>
      )}

      <AnimatePresence>
        {selectedWf && (
          <ApprovalModal
            workflow={selectedWf}
            onApprove={handleApprove}
            onReject={handleReject}
            onClose={() => setSelectedWf(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
