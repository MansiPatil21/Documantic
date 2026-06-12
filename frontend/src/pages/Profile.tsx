import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchDashboardJobs, DashboardJob } from "../services/auth";

const Profile: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<DashboardJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    fetchDashboardJobs()
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, navigate]);

  const stats = {
    total: jobs.length,
    completed: jobs.filter((j) => j.status === "complete").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    languages: Array.from(new Set(jobs.flatMap((j) => j.languagesDetected || []))),
    totalFiles: jobs.reduce((sum, j) => sum + (j.filesProcessed || 0), 0),
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <h1>{user?.name}</h1>
        <p className="profile-email">{user?.email}</p>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="profile-stats">
            <h2>Your Stats</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">Total Generations</span>
              </div>
              <div className="stat-card stat-complete">
                <span className="stat-number">{stats.completed}</span>
                <span className="stat-label">Successful</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.totalFiles}</span>
                <span className="stat-label">Files Processed</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.languages.length}</span>
                <span className="stat-label">Languages</span>
              </div>
            </div>
          </div>

          {stats.languages.length > 0 && (
            <div className="profile-section">
              <h2>Languages Used</h2>
              <div className="profile-languages">
                {stats.languages.map((lang) => (
                  <span key={lang} className="lang-badge">{lang}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="profile-actions">
        <button className="btn btn-secondary btn-full" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Profile;
