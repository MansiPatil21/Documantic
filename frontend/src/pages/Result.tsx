import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getJobStatus, getDownloadUrl, JobStatus } from "../services/api";

const STAGES = [
  { key: "extracting", label: "Extracting Files" },
  { key: "generating_readme", label: "Generating README" },
  { key: "generating_api_docs", label: "Generating API Docs" },
  { key: "generating_quality", label: "Quality Scorecard" },
  { key: "adding_comments", label: "Adding Comments" },
  { key: "packaging", label: "Packaging Output" },
  { key: "complete", label: "Complete" },
];

type PreviewTab = "readme" | "api" | "quality";

const EC2_BASE = process.env.REACT_APP_EC2_URL || "http://54.157.20.133:8000";

const Result: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobStatus | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(true);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("readme");
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const status = await getJobStatus(jobId);
        setJob(status);

        if (status.status === "complete") {
          setPolling(false);
          const dl = await getDownloadUrl(jobId);
          setDownloadUrl(dl.downloadUrl);
        } else if (status.status === "failed") {
          setPolling(false);
          setError("Documentation generation failed. Please try again.");
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch job status");
        setPolling(false);
      }
    };

    poll();
    const interval = polling ? setInterval(poll, 3000) : undefined;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, polling]);

  // Fallback copy that works on HTTP (not just HTTPS)
  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const shareableLink = `${window.location.origin}/result/${jobId}`;
  const copyLink = () => copyToClipboard(shareableLink);

  const badgeUrl = `${EC2_BASE}/badge/${jobId}`;
  const badgeMarkdown = `![CodeDoc Quality](${badgeUrl})`;
  const badgeHtml = `<img src="${badgeUrl}" alt="CodeDoc Quality" />`;

  const copyBadge = (text: string, type: string) => {
    copyToClipboard(text);
    setCopiedBadge(type);
    setTimeout(() => setCopiedBadge(null), 2000);
  };

  const currentStageIndex = STAGES.findIndex(
    (s) => s.key === (job?.progressStage || "extracting")
  );

  return (
    <div className="result-page">
      <h1>Documentation Results</h1>

      {error && <p className="error-msg">{error}</p>}

      {!job && !error && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading job status...</p>
        </div>
      )}

      {job && (
        <div className="result-content">
          {/* Status card */}
          <div className="status-card">
            <div className="status-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className={`status-badge status-${job.status}`}>
                  {job.status}
                </span>
                <span className="job-id">Job: {job.jobId.slice(0, 8)}...</span>
              </div>
              <div className="api-gw-indicator" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b', background: '#0f172a', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #334155' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: job.status === 'processing' ? '#fbbf24' : '#4ade80', display: 'inline-block', animation: job.status === 'processing' ? 'pulse 2s infinite' : 'none' }}></span>
                Live status via API Gateway
              </div>
            </div>

            {job.languagesDetected && job.languagesDetected.length > 0 && (
              <div className="languages">
                <strong>Languages: </strong>
                {job.languagesDetected.map((lang) => (
                  <span key={lang} className="lang-badge">{lang}</span>
                ))}
              </div>
            )}

            {job.filesProcessed !== undefined && job.filesProcessed > 0 && (
              <p className="files-count">{job.filesProcessed} files processed</p>
            )}
          </div>

          {/* Progress Steps */}
          {job.status === "processing" && (
            <div className="progress-steps">
              {STAGES.map((stage, i) => {
                const isActive = i === currentStageIndex;
                const isDone = i < currentStageIndex;
                const isPending = i > currentStageIndex;
                return (
                  <div
                    key={stage.key}
                    className={`progress-step ${isDone ? "done" : ""} ${isActive ? "active" : ""} ${isPending ? "pending" : ""}`}
                  >
                    <div className="step-indicator">
                      {isDone ? (
                        <span className="step-check">&#10003;</span>
                      ) : isActive ? (
                        <div className="step-spinner" />
                      ) : (
                        <span className="step-dot" />
                      )}
                    </div>
                    <span className="step-label">{stage.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Complete — Preview & Download */}
          {job.status === "complete" && (
            <>
              {/* Doc Preview Tabs */}
              {(job.readmeContent || job.apiDocsContent || job.qualityContent) && (
                <div className="doc-preview">
                  <h2>Preview Generated Documentation</h2>
                  <div className="tab-bar">
                    <button
                      className={`tab ${previewTab === "readme" ? "active" : ""}`}
                      onClick={() => setPreviewTab("readme")}
                    >
                      README.md
                    </button>
                    <button
                      className={`tab ${previewTab === "api" ? "active" : ""}`}
                      onClick={() => setPreviewTab("api")}
                    >
                      API_DOCS.md
                    </button>
                    <button
                      className={`tab ${previewTab === "quality" ? "active" : ""}`}
                      onClick={() => setPreviewTab("quality")}
                    >
                      Quality Report
                    </button>
                  </div>
                  <div className="preview-box">
                    <pre>
                      {previewTab === "readme" && (job.readmeContent || "No content")}
                      {previewTab === "api" && (job.apiDocsContent || "No content")}
                      {previewTab === "quality" && (job.qualityContent || "No content")}
                    </pre>
                  </div>
                </div>
              )}

              {/* Quality Badge Section */}
              <div className="badge-section">
                <h2>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'text-bottom', marginRight: '0.5rem' }}>
                    <path d="M12 15l-2 5l9-11h-5l2-5l-9 11h5z" />
                  </svg>
                  Quality Badge
                </h2>
                <p className="badge-desc">
                  Add this badge to your GitHub README to showcase your code quality score.
                </p>

                <div className="badge-preview">
                  <img
                    src={badgeUrl}
                    alt="CodeDoc Quality Badge"
                    className="badge-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>

                <div className="badge-snippets">
                  <div className="badge-snippet">
                    <div className="snippet-header">
                      <span className="snippet-label">Markdown</span>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => copyBadge(badgeMarkdown, "md")}
                      >
                        {copiedBadge === "md" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                    <code className="snippet-code">{badgeMarkdown}</code>
                  </div>

                  <div className="badge-snippet">
                    <div className="snippet-header">
                      <span className="snippet-label">HTML</span>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => copyBadge(badgeHtml, "html")}
                      >
                        {copiedBadge === "html" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                    <code className="snippet-code">{badgeHtml}</code>
                  </div>

                  <div className="badge-snippet">
                    <div className="snippet-header">
                      <span className="snippet-label">URL</span>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => copyBadge(badgeUrl, "url")}
                      >
                        {copiedBadge === "url" ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                    <code className="snippet-code">{badgeUrl}</code>
                  </div>
                </div>
              </div>

              {/* Download Section */}
              <div className="download-section">
                <h2>Download Full Package</h2>
                <p>The zip contains README, API docs, quality report, and commented source files.</p>

                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    className="btn btn-primary btn-large"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download Documentation Zip
                  </a>
                )}

                <div className="share-section">
                  <p>Share this result (expires in 48 hours):</p>
                  <div className="share-row">
                    <input type="text" readOnly value={shareableLink} className="share-input" />
                    <button className="btn btn-secondary" onClick={copyLink}>Copy</button>
                  </div>
                </div>
              </div>
            </>
          )}

          <Link to="/tool" className="btn btn-secondary" style={{ marginTop: "2rem" }}>
            Generate Another
          </Link>
        </div>
      )}
    </div>
  );
};

export default Result;
