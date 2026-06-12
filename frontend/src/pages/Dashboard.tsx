import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardJobs, DashboardJob } from "../services/auth";
import { fetchCloudWatchMetrics, CloudWatchMetrics } from "../services/api";

const Dashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [metrics, setMetrics] = useState<CloudWatchMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    Promise.all([
      fetchDashboardJobs().then(setJobs).catch(() => {}),
      fetchCloudWatchMetrics().then(setMetrics).catch(() => {})
    ]).finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString();
  const formatTime = (ts: number) => new Date(ts * 1000).toLocaleTimeString();

  const stats = {
    total: jobs.length,
    completed: jobs.filter((j) => j.status === "complete").length,
    processing: jobs.filter((j) => j.status === "processing").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-welcome">
            Welcome back, <strong>{user?.name}</strong>
          </p>
        </div>
        <Link to="/tool" className="btn btn-primary">
          New Generation
        </Link>
      </div>

      <div className="dashboard-section" style={{ marginBottom: "2rem" }}>
        <h2>
          Platform Metrics 
          <span style={{ fontSize: "0.8rem", color: "#64748b", marginLeft: "10px", fontWeight: "normal" }}>
            (Powered by AWS CloudWatch)
          </span>
        </h2>
        {metrics?.error ? (
           <p className="error-msg" style={{ fontSize: '0.85rem' }}>{metrics.error}</p>
        ) : (
          <div className="stats-grid">
            <div className="stat-card" style={{ background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)", borderColor: "#38bdf8" }}>
              <span className="stat-number">{metrics?.totalProcessed || 0}</span>
              <span className="stat-label">Lambda Invocations</span>
            </div>
            <div className="stat-card" style={{ background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)", borderColor: "#4ade80" }}>
              <span className="stat-number">{metrics?.successRate || 100}%</span>
              <span className="stat-label">Success Rate</span>
            </div>
            <div className="stat-card" style={{ background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)", borderColor: "#a78bfa" }}>
              <span className="stat-number">{metrics?.avgDurationSeconds || 0}s</span>
              <span className="stat-label">Avg Processing Time</span>
            </div>
          </div>
        )}
      </div>

      <h2>Your Activity</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Jobs</span>
        </div>
        <div className="stat-card stat-complete">
          <span className="stat-number">{stats.completed}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-card stat-processing">
          <span className="stat-number">{stats.processing}</span>
          <span className="stat-label">Processing</span>
        </div>
        <div className="stat-card stat-failed">
          <span className="stat-number">{stats.failed}</span>
          <span className="stat-label">Failed</span>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Recent Generations</h2>
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading your jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <p>No documentation generated yet.</p>
            <Link to="/tool" className="btn btn-primary">
              Generate Your First Docs
            </Link>
          </div>
        ) : (
          <div className="jobs-table">
            <div className="jobs-header">
              <span>Job ID</span>
              <span>Status</span>
              <span>Languages</span>
              <span>Files</span>
              <span>Date</span>
            </div>
            {jobs.map((job) => (
              <Link
                to={`/result/${job.jobId}`}
                key={job.jobId}
                className="jobs-row"
              >
                <span className="job-id-cell">
                  {job.jobId.slice(0, 8)}...
                </span>
                <span>
                  <span className={`status-badge status-${job.status}`}>
                    {job.status}
                  </span>
                </span>
                <span className="lang-cell">
                  {job.languagesDetected?.map((l) => (
                    <span key={l} className="lang-badge">{l}</span>
                  ))}
                </span>
                <span>{job.filesProcessed || "-"}</span>
                <span className="date-cell">
                  {job.createdAt ? `${formatDate(job.createdAt)} ${formatTime(job.createdAt)}` : "-"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
