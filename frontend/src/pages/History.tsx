import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

interface HistoryEntry {
  jobId: string;
  source: string;
  createdAt: number;
}

const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const stored = JSON.parse(
      localStorage.getItem("documantic_history") || "[]"
    );
    // Filter out entries older than 48 hours
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const valid = stored.filter((e: HistoryEntry) => e.createdAt > cutoff);
    setHistory(valid);
    localStorage.setItem("documantic_history", JSON.stringify(valid));
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("documantic_history");
    setHistory([]);
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString();
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  };

  return (
    <div className="history-page">
      <h1>Recent Generations</h1>
      <p className="history-desc">
        Your last 5 documentation generations. Links expire after 48 hours.
      </p>

      {history.length === 0 ? (
        <div className="empty-state">
          <p>No recent generations found.</p>
          <Link to="/tool" className="btn btn-primary">
            Generate Your First Docs
          </Link>
        </div>
      ) : (
        <>
          <div className="history-list">
            {history.map((entry) => (
              <Link
                to={`/result/${entry.jobId}`}
                key={entry.jobId}
                className="history-card"
              >
                <div className="history-info">
                  <p className="history-source">{entry.source}</p>
                  <p className="history-time">
                    {formatTime(entry.createdAt)} ({timeAgo(entry.createdAt)})
                  </p>
                </div>
                <span className="history-arrow">&rarr;</span>
              </Link>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={clearHistory}>
            Clear History
          </button>
        </>
      )}
    </div>
  );
};

export default History;
